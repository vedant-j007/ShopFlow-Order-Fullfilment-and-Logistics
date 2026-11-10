-- =============================================================================
--  test_business_logic.sql  —  demonstrates every trigger/procedure, including
--  the failure paths. Safe to run on seeded data: everything is rolled back.
--
--  Usage:  psql -U postgres -d ecommerce -f db/test_business_logic.sql
-- =============================================================================
\set ON_ERROR_STOP off
\set VERBOSITY terse
\pset footer off

BEGIN;

\echo
\echo '=== 1. place_order happy path: stock reserved, duplicates merged, payment = total'
SELECT warehouse_id, stock_qty FROM inventory WHERE product_id = 30 ORDER BY warehouse_id;
CALL place_order(1, 1, '[{"product_id":30,"quantity":2},{"product_id":30,"quantity":1},{"product_id":21,"quantity":1}]', 'upi', NULL);
SELECT order_id, status, line_count, item_count, order_total, payment_method, payment_status
  FROM order_summary WHERE order_id = (SELECT MAX(order_id) FROM orders);
SELECT product_id, warehouse_id, quantity, unit_price
  FROM order_items WHERE order_id = (SELECT MAX(order_id) FROM orders);
SELECT warehouse_id, stock_qty FROM inventory WHERE product_id = 30 ORDER BY warehouse_id;

\echo
\echo '=== 2. Atomicity: 2nd cart line has too little stock, so the WHOLE order rolls back'
SELECT COUNT(*) AS orders_before FROM orders;
SELECT SUM(stock_qty) AS earbuds_stock_before FROM inventory WHERE product_id = 1;
SAVEPOINT s2;
CALL place_order(1, 1, '[{"product_id":1,"quantity":1},{"product_id":12,"quantity":500}]', 'card', NULL);
ROLLBACK TO SAVEPOINT s2;
SELECT COUNT(*) AS orders_after FROM orders;
SELECT SUM(stock_qty) AS earbuds_stock_after FROM inventory WHERE product_id = 1;

\echo
\echo '=== 3. Address belongs to another customer (procedure check + composite FK)'
SAVEPOINT s3;
CALL place_order(1, 3, '[{"product_id":21,"quantity":1}]', 'upi', NULL);
ROLLBACK TO SAVEPOINT s3;
SAVEPOINT s3b;
INSERT INTO orders (customer_id, address_id) VALUES (1, 3);
ROLLBACK TO SAVEPOINT s3b;

\echo
\echo '=== 4. Direct INSERT into order_items bypassing the procedure: trigger still guards stock'
SAVEPOINT s4;
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (22, 6, 999, 8999);
ROLLBACK TO SAVEPOINT s4;

\echo
\echo '=== 5. CHECK constraints'
SAVEPOINT s5;
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (22, 21, 0, 499);
ROLLBACK TO SAVEPOINT s5;
SAVEPOINT s5b;
UPDATE inventory SET stock_qty = -1 WHERE inventory_id = 1;
ROLLBACK TO SAVEPOINT s5b;

\echo
\echo '=== 6. Shipment trigger: confirmed order 22 becomes shipped'
SELECT order_id, status FROM orders WHERE order_id = 22;
INSERT INTO shipments (order_id, warehouse_id, carrier_id)
SELECT DISTINCT order_id, warehouse_id, 1 FROM order_items WHERE order_id = 22;
SELECT order_id, status FROM orders WHERE order_id = 22;

\echo
\echo '=== 7. Tracking trigger: delivered event marks shipment + order delivered'
INSERT INTO tracking_events (shipment_id, location, status)
SELECT shipment_id, 'Bengaluru', 'delivered' FROM shipments WHERE order_id = 22;
SELECT s.status AS shipment_status, o.status AS order_status
  FROM shipments s JOIN orders o USING (order_id) WHERE o.order_id = 22;

\echo
\echo '=== 8. Shipment for a cancelled order is rejected'
SAVEPOINT s8;
INSERT INTO shipments (order_id, warehouse_id, carrier_id) VALUES (5, 1, 1);
ROLLBACK TO SAVEPOINT s8;

\echo
\echo '=== 9. cancel_order: restocks and refunds; cannot cancel a shipped order'
SELECT oi.product_id, oi.warehouse_id, oi.quantity, i.stock_qty AS stock_before
  FROM order_items oi JOIN inventory i USING (product_id, warehouse_id) WHERE oi.order_id = 23;
CALL cancel_order(23);
SELECT oi.product_id, i.stock_qty AS stock_after
  FROM order_items oi JOIN inventory i USING (product_id, warehouse_id) WHERE oi.order_id = 23;
SELECT o.status, p.status AS payment_status FROM orders o JOIN payments p USING (order_id) WHERE order_id = 23;
SAVEPOINT s9;
CALL cancel_order(18);
ROLLBACK TO SAVEPOINT s9;

ROLLBACK;
\echo
\echo '=== All changes rolled back.'
