-- =============================================================================
--  analytics.sql  —  analytical queries (the admin dashboard uses these)
--
--  "Revenue" = line totals of orders that were not cancelled.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Q1. Top 10 best-selling products by units sold
--     JOIN x4, GROUP BY, ORDER BY, LIMIT
-- -----------------------------------------------------------------------------
SELECT p.product_id,
       p.name                              AS product,
       c.name                              AS category,
       SUM(oi.quantity)                    AS units_sold,
       SUM(oi.quantity * oi.unit_price)    AS revenue,
       COUNT(DISTINCT oi.order_id)         AS orders
  FROM order_items oi
  JOIN orders     o ON o.order_id     = oi.order_id
  JOIN products   p ON p.product_id   = oi.product_id
  JOIN categories c ON c.category_id  = p.category_id
 WHERE o.status <> 'cancelled'
 GROUP BY p.product_id, p.name, c.name
 ORDER BY units_sold DESC, revenue DESC
 LIMIT 10;


-- -----------------------------------------------------------------------------
-- Q2. Monthly revenue with month-over-month growth and running total
--     GROUP BY on date_trunc + window functions (LAG, SUM OVER)
-- -----------------------------------------------------------------------------
SELECT to_char(month, 'YYYY-MM')                                   AS month,
       orders,
       revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER w)
                   / NULLIF(LAG(revenue) OVER w, 0), 1)            AS growth_pct,
       SUM(revenue) OVER (ORDER BY month)                          AS running_total
  FROM (SELECT date_trunc('month', o.order_date)   AS month,
               COUNT(DISTINCT o.order_id)          AS orders,
               SUM(oi.quantity * oi.unit_price)    AS revenue
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.order_id
         WHERE o.status <> 'cancelled'
         GROUP BY date_trunc('month', o.order_date)) m
WINDOW w AS (ORDER BY month)
 ORDER BY month;


-- -----------------------------------------------------------------------------
-- Q3. Warehouse utilization: stock on hand vs capacity, and units dispatched
--     Two independent aggregates in derived tables, then joined, so that
--     inventory rows and order_item rows don't multiply each other.
-- -----------------------------------------------------------------------------
SELECT w.warehouse_id,
       w.location,
       w.capacity,
       COALESCE(inv.units_in_stock, 0)                                  AS units_in_stock,
       ROUND(100.0 * COALESCE(inv.units_in_stock, 0) / w.capacity, 1)   AS utilization_pct,
       COALESCE(inv.products_stocked, 0)                                AS products_stocked,
       COALESCE(inv.low_stock_rows, 0)                                  AS low_stock_products,
       COALESCE(out.units_dispatched, 0)                                AS units_dispatched
  FROM warehouses w
  LEFT JOIN (SELECT warehouse_id,
                    SUM(stock_qty)                                       AS units_in_stock,
                    COUNT(*)                                             AS products_stocked,
                    COUNT(*) FILTER (WHERE stock_qty <= reorder_level)   AS low_stock_rows
               FROM inventory
              GROUP BY warehouse_id) inv ON inv.warehouse_id = w.warehouse_id
  LEFT JOIN (SELECT oi.warehouse_id, SUM(oi.quantity) AS units_dispatched
               FROM order_items oi
               JOIN orders o ON o.order_id = oi.order_id
              WHERE o.status <> 'cancelled'
              GROUP BY oi.warehouse_id) out ON out.warehouse_id = w.warehouse_id
 ORDER BY utilization_pct DESC;


-- -----------------------------------------------------------------------------
-- Q4. Customers whose lifetime spend is above the average customer's spend
--     GROUP BY + HAVING with a nested subquery in the HAVING clause
-- -----------------------------------------------------------------------------
SELECT c.customer_id,
       c.name,
       COUNT(DISTINCT o.order_id)           AS orders,
       SUM(oi.quantity * oi.unit_price)     AS lifetime_spend
  FROM customers c
  JOIN orders o       ON o.customer_id = c.customer_id AND o.status <> 'cancelled'
  JOIN order_items oi ON oi.order_id   = o.order_id
 GROUP BY c.customer_id, c.name
HAVING SUM(oi.quantity * oi.unit_price) >
       (SELECT AVG(spend)
          FROM (SELECT SUM(oi2.quantity * oi2.unit_price) AS spend
                  FROM orders o2
                  JOIN order_items oi2 ON oi2.order_id = o2.order_id
                 WHERE o2.status <> 'cancelled'
                 GROUP BY o2.customer_id) per_customer)
 ORDER BY lifetime_spend DESC;


-- -----------------------------------------------------------------------------
-- Q5. Revenue by category, with share of total; only categories above ₹5,000
--     GROUP BY + HAVING + scalar subquery for the grand total
-- -----------------------------------------------------------------------------
SELECT c.name                                         AS category,
       COUNT(DISTINCT p.product_id)                   AS products_sold,
       SUM(oi.quantity)                               AS units,
       SUM(oi.quantity * oi.unit_price)               AS revenue,
       ROUND(100.0 * SUM(oi.quantity * oi.unit_price) /
             (SELECT SUM(oi2.quantity * oi2.unit_price)
                FROM order_items oi2
                JOIN orders o2 ON o2.order_id = oi2.order_id
               WHERE o2.status <> 'cancelled'), 1)    AS revenue_share_pct
  FROM categories c
  JOIN products    p  ON p.category_id = c.category_id
  JOIN order_items oi ON oi.product_id = p.product_id
  JOIN orders      o  ON o.order_id    = oi.order_id
 WHERE o.status <> 'cancelled'
 GROUP BY c.category_id, c.name
HAVING SUM(oi.quantity * oi.unit_price) > 5000
 ORDER BY revenue DESC;


-- -----------------------------------------------------------------------------
-- Q6. Products that have never been ordered (dead stock)
--     NOT EXISTS correlated subquery
-- -----------------------------------------------------------------------------
SELECT p.product_id,
       p.name,
       p.price,
       (SELECT SUM(i.stock_qty) FROM inventory i WHERE i.product_id = p.product_id) AS total_stock
  FROM products p
 WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id)
 ORDER BY p.product_id;


-- -----------------------------------------------------------------------------
-- Q7. Products priced above their own category's average price
--     Correlated subquery in WHERE
-- -----------------------------------------------------------------------------
SELECT p.name,
       c.name  AS category,
       p.price,
       ROUND((SELECT AVG(p2.price) FROM products p2 WHERE p2.category_id = p.category_id), 2)
               AS category_avg
  FROM products p
  JOIN categories c ON c.category_id = p.category_id
 WHERE p.price > (SELECT AVG(p2.price) FROM products p2 WHERE p2.category_id = p.category_id)
 ORDER BY c.name, p.price DESC;


-- -----------------------------------------------------------------------------
-- Q8. Repeat customers (2+ orders) and their favourite category
--     HAVING + LATERAL subquery
-- -----------------------------------------------------------------------------
SELECT c.customer_id,
       c.name,
       COUNT(o.order_id)       AS orders,
       MAX(o.order_date)::date AS last_order,
       fav.category            AS favourite_category
  FROM customers c
  JOIN orders o ON o.customer_id = c.customer_id
  LEFT JOIN LATERAL (
        SELECT cat.name AS category
          FROM orders o2
          JOIN order_items oi ON oi.order_id    = o2.order_id
          JOIN products p     ON p.product_id   = oi.product_id
          JOIN categories cat ON cat.category_id = p.category_id
         WHERE o2.customer_id = c.customer_id
           AND o2.status <> 'cancelled'
         GROUP BY cat.name
         ORDER BY SUM(oi.quantity) DESC, cat.name
         LIMIT 1) fav ON TRUE
 GROUP BY c.customer_id, c.name, fav.category
HAVING COUNT(o.order_id) >= 2
 ORDER BY orders DESC, last_order DESC;


-- -----------------------------------------------------------------------------
-- Q9. Order status distribution with average order value
-- -----------------------------------------------------------------------------
SELECT status,
       COUNT(*)                                          AS orders,
       ROUND(AVG(order_total), 2)                        AS avg_order_value,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct_of_orders
  FROM order_summary
 GROUP BY status
 ORDER BY orders DESC;
