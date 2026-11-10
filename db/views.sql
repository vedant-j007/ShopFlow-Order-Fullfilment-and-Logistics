-- =============================================================================
--  views.sql  —  reporting views
-- =============================================================================

-- -----------------------------------------------------------------------------
-- V1. order_summary: one row per order with customer, item count and total
--
--   Line totals are aggregated in a derived table BEFORE joining. Joining
--   order_items directly next to payments/shipments would multiply rows
--   ("fan-out") and inflate SUM().
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW order_summary AS
SELECT o.order_id,
       o.order_date,
       o.status,
       c.customer_id,
       c.name                    AS customer_name,
       c.email                   AS customer_email,
       a.city,
       a.pincode,
       li.line_count,
       li.item_count,
       li.order_total,
       p.method                  AS payment_method,
       p.status                  AS payment_status
  FROM orders o
  JOIN customers c ON c.customer_id = o.customer_id
  JOIN addresses a ON a.address_id  = o.address_id
  JOIN (SELECT order_id,
               COUNT(*)                     AS line_count,   -- distinct products
               SUM(quantity)                AS item_count,   -- total units
               SUM(quantity * unit_price)   AS order_total
          FROM order_items
         GROUP BY order_id) li ON li.order_id = o.order_id
  LEFT JOIN payments p ON p.order_id = o.order_id;


-- -----------------------------------------------------------------------------
-- V2. delivery_performance: average time from order to delivery, per carrier
--
--   Delivery time of a shipment = its first 'delivered' tracking event minus
--   the order_date. Carriers with no delivered shipments still appear
--   (LEFT JOIN), with NULL averages.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW delivery_performance AS
WITH delivered AS (
    SELECT s.shipment_id,
           s.carrier_id,
           MIN(te.event_time) - o.order_date AS time_to_deliver
      FROM shipments s
      JOIN orders o           ON o.order_id     = s.order_id
      JOIN tracking_events te ON te.shipment_id = s.shipment_id
                             AND te.status      = 'delivered'
     GROUP BY s.shipment_id, s.carrier_id, o.order_date
)
SELECT ca.carrier_id,
       ca.name                                                        AS carrier_name,
       COUNT(DISTINCT s.shipment_id)                                  AS total_shipments,
       COUNT(DISTINCT d.shipment_id)                                  AS delivered_shipments,
       COUNT(DISTINCT s.shipment_id) FILTER (WHERE s.status = 'failed') AS failed_shipments,
       ROUND(AVG(EXTRACT(EPOCH FROM d.time_to_deliver)) / 3600, 1)    AS avg_delivery_hours,
       ROUND(AVG(EXTRACT(EPOCH FROM d.time_to_deliver)) / 86400, 2)   AS avg_delivery_days,
       ROUND(MIN(EXTRACT(EPOCH FROM d.time_to_deliver)) / 86400, 2)   AS fastest_days,
       ROUND(MAX(EXTRACT(EPOCH FROM d.time_to_deliver)) / 86400, 2)   AS slowest_days
  FROM carriers ca
  LEFT JOIN shipments s ON s.carrier_id  = ca.carrier_id
  LEFT JOIN delivered d ON d.shipment_id = s.shipment_id
 GROUP BY ca.carrier_id, ca.name;


-- -----------------------------------------------------------------------------
-- V3. low_stock_alert: inventory rows at or below their warehouse-specific
--     reorder level
--
--   The threshold is stored per (product, warehouse) in inventory.reorder_level
--   because a view cannot take parameters, and a busy warehouse needs a higher
--   buffer than a small one. For an ad-hoc threshold, filter the base table:
--     SELECT * FROM inventory WHERE stock_qty < 15;
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW low_stock_alert AS
SELECT i.inventory_id,
       w.warehouse_id,
       w.location                         AS warehouse,
       p.product_id,
       p.name                             AS product_name,
       cat.name                           AS category,
       sup.name                           AS supplier,
       i.stock_qty,
       i.reorder_level,
       i.reorder_level - i.stock_qty      AS shortfall,
       CASE WHEN i.stock_qty = 0 THEN 'out_of_stock'
            WHEN i.stock_qty <= i.reorder_level / 2 THEN 'critical'
            ELSE 'low'
       END                                AS severity
  FROM inventory  i
  JOIN products   p   ON p.product_id    = i.product_id
  JOIN warehouses w   ON w.warehouse_id  = i.warehouse_id
  JOIN categories cat ON cat.category_id = p.category_id
  JOIN suppliers  sup ON sup.supplier_id = p.supplier_id
 WHERE i.stock_qty <= i.reorder_level;
