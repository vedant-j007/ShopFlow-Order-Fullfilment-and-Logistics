// Analytical queries (the same SQL as db/analytics.sql) and the three reporting views.
// The admin UI shows each report's SQL next to its result.
// "Revenue" = line totals of orders that were not cancelled.

export const REPORTS = [
  {
    key: 'top_products',
    kind: 'query',
    title: 'Top-selling products',
    description: 'Top 10 products by units sold.',
    concepts: ['JOIN ×3', 'GROUP BY', 'ORDER BY + LIMIT'],
    sql: `
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
 LIMIT 10;`.trim(),
  },
  {
    key: 'monthly_revenue',
    kind: 'query',
    title: 'Monthly revenue',
    description: 'Revenue per month with month-over-month growth and a running total.',
    concepts: ['date_trunc', 'GROUP BY', 'Derived table', 'Window functions (LAG, SUM OVER)'],
    sql: `
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
 ORDER BY month;`.trim(),
  },
  {
    key: 'warehouse_utilization',
    kind: 'query',
    title: 'Warehouse utilization',
    description:
      'Stock on hand vs. capacity and units dispatched. Each aggregate is computed in its own derived table so inventory rows and order lines do not multiply each other.',
    concepts: ['LEFT JOIN', 'Derived tables', 'COUNT … FILTER', 'COALESCE'],
    sql: `
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
 ORDER BY utilization_pct DESC;`.trim(),
  },
  {
    key: 'above_average_customers',
    kind: 'query',
    title: 'Customers spending above average',
    description: "Customers whose lifetime spend is higher than the average customer's spend.",
    concepts: ['GROUP BY', 'HAVING', 'Nested subquery'],
    sql: `
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
 ORDER BY lifetime_spend DESC;`.trim(),
  },
  {
    key: 'category_revenue',
    kind: 'query',
    title: 'Revenue by category',
    description: 'Revenue and share of total per category, keeping only categories above ₹5,000.',
    concepts: ['GROUP BY', 'HAVING', 'Scalar subquery'],
    sql: `
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
 ORDER BY revenue DESC;`.trim(),
  },
  {
    key: 'never_ordered',
    kind: 'query',
    title: 'Products never ordered',
    description: 'Dead stock: products with no order lines at all.',
    concepts: ['NOT EXISTS', 'Correlated subquery'],
    sql: `
SELECT p.product_id,
       p.name,
       p.price,
       (SELECT SUM(i.stock_qty) FROM inventory i WHERE i.product_id = p.product_id) AS total_stock
  FROM products p
 WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id)
 ORDER BY p.product_id;`.trim(),
  },
  {
    key: 'above_category_average',
    kind: 'query',
    title: 'Priced above category average',
    description: "Products whose price is higher than their own category's average price.",
    concepts: ['Correlated subquery in WHERE'],
    sql: `
SELECT p.name,
       c.name  AS category,
       p.price,
       ROUND((SELECT AVG(p2.price) FROM products p2 WHERE p2.category_id = p.category_id), 2)
               AS category_avg
  FROM products p
  JOIN categories c ON c.category_id = p.category_id
 WHERE p.price > (SELECT AVG(p2.price) FROM products p2 WHERE p2.category_id = p.category_id)
 ORDER BY c.name, p.price DESC;`.trim(),
  },
  {
    key: 'repeat_customers',
    kind: 'query',
    title: 'Repeat customers',
    description: 'Customers with 2+ orders and the category they buy most.',
    concepts: ['HAVING', 'LEFT JOIN LATERAL'],
    sql: `
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
 ORDER BY orders DESC, last_order DESC;`.trim(),
  },
  {
    key: 'order_status_distribution',
    kind: 'query',
    title: 'Order status distribution',
    description: 'Orders per status with average order value (built on the order_summary view).',
    concepts: ['GROUP BY', 'Window function over an aggregate'],
    sql: `
SELECT status,
       COUNT(*)                                          AS orders,
       ROUND(AVG(order_total), 2)                        AS avg_order_value,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct_of_orders
  FROM order_summary
 GROUP BY status
 ORDER BY orders DESC;`.trim(),
  },
  {
    key: 'order_summary',
    kind: 'view',
    title: 'View: order_summary',
    description: 'One row per order with customer, item count and total.',
    concepts: ['VIEW', 'Aggregate before join (avoids fan-out)'],
    sql: `SELECT * FROM order_summary ORDER BY order_date DESC;`,
  },
  {
    key: 'delivery_performance',
    kind: 'view',
    title: 'View: delivery_performance',
    description: 'Average time from order to delivery, per carrier.',
    concepts: ['VIEW', 'CTE', 'LEFT JOIN', 'EXTRACT(EPOCH …)'],
    sql: `SELECT * FROM delivery_performance ORDER BY avg_delivery_days NULLS LAST;`,
  },
  {
    key: 'low_stock_alert',
    kind: 'view',
    title: 'View: low_stock_alert',
    description: 'Inventory rows at or below their warehouse-specific reorder level.',
    concepts: ['VIEW', 'JOIN ×4', 'CASE'],
    sql: `SELECT * FROM low_stock_alert ORDER BY stock_qty, shortfall DESC;`,
  },
];
