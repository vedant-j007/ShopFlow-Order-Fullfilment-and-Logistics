-- =============================================================================
--  seed.sql  —  realistic sample data
--
--  Requires schema.sql, triggers.sql and procedures.sql to be loaded first.
--  Re-runnable: wipes all data and resets identity counters.
--
--  Order history is inserted as it would happen in real life, so the triggers
--  do the work and get exercised:
--    order_items insert  -> T1 reserves stock and chooses a warehouse
--    shipments insert    -> T2 moves the order to 'shipped'
--    tracking_events     -> T3 moves shipment/order to 'delivered' (and settles COD)
--    CALL cancel_order   -> P2 restocks and refunds
--  All dates are relative to now(), so dashboards always look current.
--
--  Logins:   every customer -> password  customer123
--            admin@shopflow.local -> password  admin123
-- =============================================================================

BEGIN;

TRUNCATE tracking_events, shipments, carriers, payments, order_items, orders,
         inventory, warehouses, products, suppliers, categories, addresses,
         customers, admins
RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- Accounts
-- -----------------------------------------------------------------------------
INSERT INTO admins (admin_id, name, email, password_hash) VALUES
(1, 'Store Admin', 'admin@shopflow.local', '$2a$10$4iRyS5ABPfHmLbkVt3VHO.gCWpo7gSGuThpBePtADzTsprKZCBjJO');

INSERT INTO customers (customer_id, name, email, phone, password_hash, created_at) VALUES
(1,  'Aarav Sharma',    'aarav.sharma@example.com',    '9820011223', '$2a$10$D8wo5cYDrDkdGUud/tr3r..vCldUV4G5SyCRBNxjWZND.ruHCrjlm', now() - interval '240 days'),
(2,  'Priya Iyer',      'priya.iyer@example.com',      '9876543210', '$2a$10$D8wo5cYDrDkdGUud/tr3r..vCldUV4G5SyCRBNxjWZND.ruHCrjlm', now() - interval '230 days'),
(3,  'Rohan Mehta',     'rohan.mehta@example.com',     '9811122334', '$2a$10$D8wo5cYDrDkdGUud/tr3r..vCldUV4G5SyCRBNxjWZND.ruHCrjlm', now() - interval '220 days'),
(4,  'Sneha Reddy',     'sneha.reddy@example.com',     '9900456789', '$2a$10$D8wo5cYDrDkdGUud/tr3r..vCldUV4G5SyCRBNxjWZND.ruHCrjlm', now() - interval '210 days'),
(5,  'Vikram Nair',     'vikram.nair@example.com',     '9845067812', '$2a$10$D8wo5cYDrDkdGUud/tr3r..vCldUV4G5SyCRBNxjWZND.ruHCrjlm', now() - interval '200 days'),
(6,  'Ananya Das',      'ananya.das@example.com',      '9831098765', '$2a$10$D8wo5cYDrDkdGUud/tr3r..vCldUV4G5SyCRBNxjWZND.ruHCrjlm', now() - interval '190 days'),
(7,  'Karan Patel',     'karan.patel@example.com',     '9825034567', '$2a$10$D8wo5cYDrDkdGUud/tr3r..vCldUV4G5SyCRBNxjWZND.ruHCrjlm', now() - interval '180 days'),
(8,  'Meera Joshi',     'meera.joshi@example.com',     '9829076543', '$2a$10$D8wo5cYDrDkdGUud/tr3r..vCldUV4G5SyCRBNxjWZND.ruHCrjlm', now() - interval '170 days'),
(9,  'Aditya Verma',    'aditya.verma@example.com',    '9839012345', '$2a$10$D8wo5cYDrDkdGUud/tr3r..vCldUV4G5SyCRBNxjWZND.ruHCrjlm', now() - interval '160 days'),
(10, 'Lakshmi Menon',   'lakshmi.menon@example.com',   '9847123456', '$2a$10$D8wo5cYDrDkdGUud/tr3r..vCldUV4G5SyCRBNxjWZND.ruHCrjlm', now() - interval '150 days');

INSERT INTO addresses (address_id, customer_id, line1, city, state, pincode) VALUES
(1,  1,  'Flat 402, Kalyani Nagar Heights',   'Pune',               'Maharashtra',    '411006'),
(2,  1,  '12 Hill Road, Bandra West',         'Mumbai',             'Maharashtra',    '400050'),
(3,  2,  'B-17, Hauz Khas Enclave',           'New Delhi',          'Delhi',          '110016'),
(4,  3,  '221, 5th Cross, Koramangala',       'Bengaluru',          'Karnataka',      '560034'),
(5,  3,  '88 Sayyaji Rao Road',               'Mysuru',             'Karnataka',      '570001'),
(6,  4,  'Plot 45, Jubilee Hills',            'Hyderabad',          'Telangana',      '500033'),
(7,  5,  '9 Luz Church Road, Mylapore',       'Chennai',            'Tamil Nadu',     '600004'),
(8,  6,  '14/2 Gariahat Road',                'Kolkata',            'West Bengal',    '700019'),
(9,  6,  'Plot 77, Saheed Nagar',             'Bhubaneswar',        'Odisha',         '751007'),
(10, 7,  '301 Shivalik Complex, Satellite',   'Ahmedabad',          'Gujarat',        '380015'),
(11, 8,  'C-9 Malviya Nagar',                 'Jaipur',             'Rajasthan',      '302017'),
(12, 9,  '5 Gomti Nagar Extension',           'Lucknow',            'Uttar Pradesh',  '226010'),
(13, 10, 'Door 21, Panampilly Nagar',         'Kochi',              'Kerala',         '682036'),
(14, 10, 'TC 4/112, Kowdiar',                 'Thiruvananthapuram', 'Kerala',         '695003');

-- -----------------------------------------------------------------------------
-- Catalog
-- -----------------------------------------------------------------------------
INSERT INTO categories (category_id, name) VALUES
(1, 'Electronics'),
(2, 'Home & Kitchen'),
(3, 'Fashion'),
(4, 'Books'),
(5, 'Sports & Fitness');

INSERT INTO suppliers (supplier_id, name, contact_email) VALUES
(1, 'TechNova Distributors', 'sales@technova.example.com'),
(2, 'Voltline Electronics',  'orders@voltline.example.com'),
(3, 'HomeCraft Supplies',    'b2b@homecraft.example.com'),
(4, 'UrbanThread Apparel',   'wholesale@urbanthread.example.com'),
(5, 'Pageturn Books',        'trade@pageturn.example.com'),
(6, 'PeakForm Sports',       'partners@peakform.example.com');

INSERT INTO products (product_id, category_id, supplier_id, name, description, price) VALUES
-- Electronics
(1,  1, 1, 'Wireless Earbuds Pro',            'Active noise cancellation, 30h battery with case.',         2499.00),
(2,  1, 1, 'Smartwatch Fit 2',                'AMOLED display, SpO2 and heart-rate tracking.',             4999.00),
(3,  1, 2, 'Bluetooth Speaker Mini',          'Pocket-sized, IPX7 waterproof, 12h playtime.',              1799.00),
(4,  1, 2, 'Mechanical Keyboard TKL',         'Hot-swappable switches, white backlight.',                  3499.00),
(5,  1, 2, 'USB-C Power Bank 20000mAh',       '22.5W fast charging, dual output.',                         1999.00),
(6,  1, 1, '4K Action Camera',                'Electronic stabilisation, 40m waterproof case.',            8999.00),
-- Home & Kitchen
(7,  2, 3, 'Non-stick Cookware Set (5 pc)',   'Induction-ready granite finish cookware.',                  3299.00),
(8,  2, 3, 'Steel Water Bottle 1L',           'Double-wall insulated, keeps cold for 24h.',                 649.00),
(9,  2, 3, 'Electric Kettle 1.5L',            'Auto shut-off, 1500W, stainless steel.',                    1499.00),
(10, 2, 3, 'Cotton Bedsheet Set (Queen)',     '200 TCS pure cotton with two pillow covers.',               1299.00),
(11, 2, 3, 'Ceramic Coffee Mugs (Set of 4)',  'Microwave and dishwasher safe, 350ml.',                      799.00),
(12, 2, 3, 'Air Fryer 4.2L',                  'Digital touch panel, 8 presets.',                           6499.00),
-- Fashion
(13, 3, 4, 'Slim Fit Denim Jeans',            'Stretch denim, mid-rise, dark indigo.',                     1899.00),
(14, 3, 4, 'Women''s Kurta Set',              'Printed rayon kurta with palazzo.',                         2199.00),
(15, 3, 4, 'Everyday Running Sneakers',       'Breathable mesh upper, cushioned sole.',                    3499.00),
(16, 3, 4, 'Crew T-Shirt (Pack of 2)',        '100% combed cotton, regular fit.',                           899.00),
(17, 3, 4, 'Leather Bifold Wallet',           'Genuine leather with RFID blocking.',                        999.00),
(18, 3, 4, 'Unisex Fleece Hoodie',            'Brushed fleece, kangaroo pocket.',                          1599.00),
-- Books
(19, 4, 5, 'Database System Concepts',        'Silberschatz, Korth & Sudarshan. 7th edition.',             1195.00),
(20, 4, 5, 'Clean Code',                      'Robert C. Martin. A handbook of agile craftsmanship.',       699.00),
(21, 4, 5, 'Atomic Habits',                   'James Clear. Tiny changes, remarkable results.',             499.00),
(22, 4, 5, 'The Pragmatic Programmer',        'Hunt & Thomas. 20th anniversary edition.',                   899.00),
(23, 4, 5, 'Sapiens',                         'Yuval Noah Harari. A brief history of humankind.',           599.00),
(24, 4, 5, 'Introduction to Algorithms',      'Cormen, Leiserson, Rivest & Stein. 4th edition.',           1450.00),
-- Sports & Fitness
(25, 5, 6, 'Yoga Mat 6mm',                    'Anti-slip TPE mat with carry strap.',                        899.00),
(26, 5, 6, 'Adjustable Dumbbells 10kg Pair',  'Chrome-plated handles with spinlock collars.',              2999.00),
(27, 5, 6, 'Kashmir Willow Cricket Bat',      'Full size, cane handle, ready to play.',                    1799.00),
(28, 5, 6, 'Carbon Badminton Racquet',        'Lightweight 85g frame, strung.',                            1299.00),
(29, 5, 6, 'Cycling Helmet',                  'In-mould shell, 18 vents, adjustable fit.',                 2499.00),
(30, 5, 6, 'Resistance Bands Set',            'Five bands from 5 to 25 kg with handles.',                   599.00);

-- -----------------------------------------------------------------------------
-- Warehouses & inventory
-- -----------------------------------------------------------------------------
INSERT INTO warehouses (warehouse_id, location, capacity) VALUES
(1, 'Mumbai - Bhiwandi',    5000),
(2, 'Delhi NCR - Gurugram', 4000),
(3, 'Bengaluru - Hoskote',  2500);

-- Every product in every warehouse (CROSS JOIN) with a deterministic stock
-- level between 20 and 79, except a few products a warehouse does not carry.
INSERT INTO inventory (product_id, warehouse_id, stock_qty, reorder_level)
SELECT p.product_id,
       w.warehouse_id,
       20 + (p.product_id * 7 + w.warehouse_id * 13) % 60,
       10
  FROM products p
 CROSS JOIN warehouses w
 WHERE (p.product_id, w.warehouse_id) NOT IN ((6, 3), (12, 3), (24, 2))
 ORDER BY p.product_id, w.warehouse_id;

-- A handful of rows at or below their reorder level, for the low_stock_alert view.
UPDATE inventory i
   SET stock_qty = v.stock_qty, reorder_level = v.reorder_level
  FROM (VALUES
        (6,  2, 2,  10),   -- 4K Action Camera          @ Delhi NCR
        (12, 1, 0,  8),    -- Air Fryer                 @ Mumbai (out of stock)
        (15, 3, 4,  12),   -- Running Sneakers          @ Bengaluru
        (19, 1, 6,  15),   -- Database System Concepts  @ Mumbai
        (26, 2, 3,  10),   -- Adjustable Dumbbells      @ Delhi NCR
        (29, 3, 5,  10),   -- Cycling Helmet            @ Bengaluru
        (2,  3, 9,  10)    -- Smartwatch                @ Bengaluru
       ) AS v(product_id, warehouse_id, stock_qty, reorder_level)
 WHERE i.product_id = v.product_id
   AND i.warehouse_id = v.warehouse_id;

-- -----------------------------------------------------------------------------
-- Carriers
-- -----------------------------------------------------------------------------
INSERT INTO carriers (carrier_id, name) VALUES
(1, 'SwiftShip Express'),
(2, 'RapidRoute Couriers'),
(3, 'Coastal Freight Co.'),
(4, 'MetroDash Logistics');

-- -----------------------------------------------------------------------------
-- Orders (25, spread over the last ~6 months)
--   COD orders start as 'pending'; prepaid orders as 'confirmed'.
--   Final statuses are produced by the triggers/procedures further down.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE seed_order_plan (
    order_id     INT PRIMARY KEY,
    customer_id  INT,
    address_id   INT,
    placed_ago   INTERVAL,
    method       VARCHAR(20)
) ON COMMIT DROP;

INSERT INTO seed_order_plan VALUES
( 1,  1,  1, '175 days 3 hours',  'card'),
( 2,  3,  4, '162 days 5 hours',  'upi'),
( 3,  2,  3, '150 days 8 hours',  'cod'),
( 4,  5,  7, '141 days 2 hours',  'card'),
( 5,  4,  6, '128 days 6 hours',  'upi'),          -- cancelled below
( 6,  6,  8, '120 days 1 hour',   'netbanking'),
( 7,  1,  2, '109 days 7 hours',  'upi'),
( 8,  7, 10, '97 days 4 hours',   'wallet'),
( 9,  8, 11, '88 days 9 hours',   'card'),
(10,  3,  5, '76 days 2 hours',   'cod'),
(11,  9, 12, '65 days 6 hours',   'upi'),
(12, 10, 13, '54 days 3 hours',   'card'),
(13,  2,  3, '43 days 5 hours',   'upi'),
(14,  6,  9, '35 days 8 hours',   'card'),
(15,  4,  6, '27 days 4 hours',   'cod'),
(16,  5,  7, '20 days 2 hours',   'card'),         -- cancelled below
(17,  1,  1, '12 days 6 hours',   'upi'),
(18,  8, 11, '6 days 3 hours',    'card'),         -- in transit
(19, 10, 14, '5 days 2 hours',    'upi'),          -- failed delivery attempt
(20,  7, 10, '4 days 1 hour',     'card'),         -- out for delivery
(21,  9, 12, '3 days 4 hours',    'netbanking'),   -- just picked up
(22,  3,  4, '2 days 5 hours',    'upi'),          -- confirmed, not shipped
(23,  2,  3, '1 day 2 hours',     'card'),         -- confirmed, not shipped
(24,  5,  7, '14 hours',          'cod'),          -- pending (COD)
(25,  6,  8, '5 hours',           'cod');          -- pending (COD)

INSERT INTO orders (order_id, customer_id, address_id, order_date, status)
SELECT order_id, customer_id, address_id, now() - placed_ago,
       CASE WHEN method = 'cod' THEN 'pending' ELSE 'confirmed' END
  FROM seed_order_plan
 ORDER BY order_id;

-- Order lines. unit_price is copied from the catalog at "purchase time";
-- warehouse_id is left out on purpose, so trigger T1 picks it and decrements stock.
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT v.order_id, v.product_id, v.quantity, p.price
  FROM (VALUES
        ( 1,  1, 1), ( 1, 19, 2),
        ( 2,  3, 1), ( 2, 25, 1), ( 2, 20, 1),
        ( 3,  7, 1), ( 3, 13, 2),
        ( 4,  2, 1),
        ( 5,  9, 1), ( 5, 14, 1),
        ( 6,  1, 2), ( 6, 21, 1), ( 6, 26, 1),
        ( 7,  8, 1), ( 7, 19, 1),
        ( 8, 15, 1), ( 8, 16, 2),
        ( 9,  4, 1), ( 9, 25, 2),
        (10, 10, 1), (10, 22, 3),
        (11,  1, 1), (11, 27, 1),
        (12,  5, 1), (12, 11, 2), (12, 19, 1),
        (13, 17, 1), (13, 23, 1),
        (14,  2, 1), (14, 28, 1),
        (15,  7, 2), (15, 20, 1),
        (16,  3, 1),
        (17, 25, 1), (17,  1, 1), (17, 24, 2),
        (18, 13, 1), (18, 30, 1),
        (19,  4, 1),
        (20,  9, 1), (20, 19, 3),
        (21, 18, 2), (21, 26, 1),
        (22,  1, 1), (22, 11, 1),
        (23, 16, 1), (23, 21, 2),
        (24,  8, 1),
        (25, 27, 2), (25, 14, 1)
       ) AS v(order_id, product_id, quantity)
  JOIN products p ON p.product_id = v.product_id
 ORDER BY v.order_id, v.product_id;

-- One payment per order, amount = sum of its lines.
INSERT INTO payments (order_id, amount, method, status, paid_at)
SELECT o.order_id,
       SUM(oi.quantity * oi.unit_price),
       sp.method,
       CASE WHEN sp.method = 'cod' THEN 'pending' ELSE 'completed' END,
       CASE WHEN sp.method = 'cod' THEN NULL ELSE o.order_date + interval '2 minutes' END
  FROM orders o
  JOIN order_items oi     ON oi.order_id = o.order_id
  JOIN seed_order_plan sp ON sp.order_id = o.order_id
 GROUP BY o.order_id, o.order_date, sp.method
 ORDER BY o.order_id;

-- -----------------------------------------------------------------------------
-- Cancellations (P2 restocks inventory and refunds the payment)
-- -----------------------------------------------------------------------------
CALL cancel_order(5);
CALL cancel_order(16);

-- -----------------------------------------------------------------------------
-- Shipments & tracking
--   Offsets are measured from order_date. NULL = that milestone not reached yet.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE seed_shipment_plan (
    order_id      INT PRIMARY KEY,
    carrier_id    INT,
    pickup_after  INTERVAL,
    hub_after     INTERVAL,
    ofd_after     INTERVAL,       -- out for delivery
    final_after   INTERVAL,
    final_status  VARCHAR(20)     -- 'delivered' | 'delivery_failed' | NULL
) ON COMMIT DROP;

INSERT INTO seed_shipment_plan VALUES
-- delivered
( 1, 1, '18 hours', '1 day 10 hours', '2 days 6 hours',  '2 days 11 hours', 'delivered'),
( 2, 2, '22 hours', '2 days',         '3 days 20 hours', '4 days 2 hours',  'delivered'),
( 3, 4, '20 hours', '1 day 14 hours', '2 days 18 hours', '2 days 23 hours', 'delivered'),
( 4, 3, '1 day',    '3 days',         '5 days 18 hours', '6 days',          'delivered'),
( 6, 2, '16 hours', '2 days 2 hours', '4 days 1 hour',   '4 days 6 hours',  'delivered'),
( 7, 1, '12 hours', '1 day 2 hours',  '1 day 20 hours',  '2 days 1 hour',   'delivered'),
( 8, 4, '19 hours', '1 day 16 hours', '3 days',          '3 days 4 hours',  'delivered'),
( 9, 3, '1 day 2 hours', '3 days 6 hours', '6 days 20 hours', '7 days 2 hours', 'delivered'),
(10, 2, '21 hours', '2 days 4 hours', '3 days 22 hours', '4 days 3 hours',  'delivered'),
(11, 1, '14 hours', '1 day 6 hours',  '2 days 4 hours',  '2 days 9 hours',  'delivered'),
(12, 3, '23 hours', '3 days 1 hour',  '5 days 4 hours',  '5 days 10 hours', 'delivered'),
(13, 4, '17 hours', '1 day 12 hours', '2 days 22 hours', '3 days 2 hours',  'delivered'),
(14, 2, '20 hours', '2 days 3 hours', '4 days 8 hours',  '4 days 12 hours', 'delivered'),
(15, 1, '15 hours', '1 day 5 hours',  '2 days 2 hours',  '2 days 7 hours',  'delivered'),
(17, 4, '18 hours', '1 day 14 hours', '2 days 20 hours', '3 days 1 hour',   'delivered'),
-- still moving
(18, 3, '20 hours', '3 days',         NULL,              NULL,              NULL),
(19, 2, '1 day',    '2 days',         '3 days 20 hours', '4 days',          'delivery_failed'),
(20, 1, '22 hours', '2 days',         '3 days 20 hours', NULL,              NULL),
(21, 4, '1 day',    NULL,             NULL,              NULL,              NULL);

-- One shipment per (order, fulfilling warehouse). Trigger T2 marks each order shipped.
INSERT INTO shipments (order_id, warehouse_id, carrier_id, tracking_number, created_at)
SELECT DISTINCT
       oi.order_id,
       oi.warehouse_id,
       sp.carrier_id,
       'TRK' || lpad(oi.order_id::text, 5, '0') || '-' || oi.warehouse_id,
       o.order_date + sp.pickup_after - interval '6 hours'
  FROM order_items oi
  JOIN orders o              ON o.order_id  = oi.order_id
  JOIN seed_shipment_plan sp ON sp.order_id = oi.order_id
 ORDER BY oi.order_id, oi.warehouse_id;

-- Timeline per shipment: LATERAL expands each shipment into its milestones.
-- Trigger T3 updates shipment status, and marks orders delivered / COD paid.
INSERT INTO tracking_events (shipment_id, location, event_time, status)
SELECT s.shipment_id, m.location, m.event_time, m.status
  FROM shipments s
  JOIN orders o              ON o.order_id     = s.order_id
  JOIN addresses a           ON a.address_id   = o.address_id
  JOIN warehouses w          ON w.warehouse_id = s.warehouse_id
  JOIN seed_shipment_plan sp ON sp.order_id    = s.order_id
 CROSS JOIN LATERAL (VALUES
        (w.location,                 o.order_date + sp.pickup_after, 'picked_up'),
        ('Sorting hub, ' || a.city,  o.order_date + sp.hub_after,    'arrived_at_hub'),
        (a.city,                     o.order_date + sp.ofd_after,    'out_for_delivery'),
        (a.city,                     o.order_date + sp.final_after,  sp.final_status)
       ) AS m(location, event_time, status)
 WHERE m.event_time IS NOT NULL
   AND m.status IS NOT NULL
 ORDER BY s.shipment_id, m.event_time;

-- -----------------------------------------------------------------------------
-- Move identity counters past the explicit ids used above
-- -----------------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('admins',     'admin_id'),     (SELECT MAX(admin_id)     FROM admins));
SELECT setval(pg_get_serial_sequence('customers',  'customer_id'),  (SELECT MAX(customer_id)  FROM customers));
SELECT setval(pg_get_serial_sequence('addresses',  'address_id'),   (SELECT MAX(address_id)   FROM addresses));
SELECT setval(pg_get_serial_sequence('categories', 'category_id'),  (SELECT MAX(category_id)  FROM categories));
SELECT setval(pg_get_serial_sequence('suppliers',  'supplier_id'),  (SELECT MAX(supplier_id)  FROM suppliers));
SELECT setval(pg_get_serial_sequence('products',   'product_id'),   (SELECT MAX(product_id)   FROM products));
SELECT setval(pg_get_serial_sequence('warehouses', 'warehouse_id'), (SELECT MAX(warehouse_id) FROM warehouses));
SELECT setval(pg_get_serial_sequence('carriers',   'carrier_id'),   (SELECT MAX(carrier_id)   FROM carriers));
SELECT setval(pg_get_serial_sequence('orders',     'order_id'),     (SELECT MAX(order_id)     FROM orders));

COMMIT;
