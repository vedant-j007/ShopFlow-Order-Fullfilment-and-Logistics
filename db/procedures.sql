-- =============================================================================
--  procedures.sql  —  stored procedures
-- =============================================================================

-- -----------------------------------------------------------------------------
-- P1. place_order(customer_id, address_id, cart_items, payment_method, OUT order_id)
--
--   cart_items is a JSONB array:  [{"product_id": 3, "quantity": 2}, ...]
--
--   Creates ORDERS + ORDER_ITEMS + PAYMENTS as ONE atomic unit:
--     * A procedure body runs inside the caller's transaction. Any RAISE here,
--       or inside the stock trigger (T1), aborts the whole CALL, so no partial
--       order, item, stock change, or payment can remain.
--     * Prices are read from PRODUCTS, never trusted from the client.
--     * Duplicate product_ids in the cart are merged (GROUP BY).
--
--   Usage:
--     CALL place_order(1, 1, '[{"product_id":3,"quantity":2}]', 'upi', NULL);
--   The trailing NULL is the placeholder for the OUT/INOUT parameter; the CALL
--   returns one row containing the new order_id.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE place_order(
    IN    p_customer_id     INT,
    IN    p_address_id      INT,
    IN    p_cart_items      JSONB,
    IN    p_payment_method  VARCHAR DEFAULT 'card',
    INOUT p_order_id        INT     DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total        NUMERIC(12,2);
    v_bad_product  INT;
BEGIN
    -- 1. Validate input -------------------------------------------------------
    IF p_cart_items IS NULL
       OR jsonb_typeof(p_cart_items) <> 'array'
       OR jsonb_array_length(p_cart_items) = 0 THEN
        RAISE EXCEPTION 'Cart must be a non-empty JSON array'
              USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM addresses
                    WHERE address_id = p_address_id
                      AND customer_id = p_customer_id) THEN
        RAISE EXCEPTION 'Address % does not belong to customer %', p_address_id, p_customer_id
              USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF EXISTS (SELECT 1
                 FROM jsonb_to_recordset(p_cart_items) AS c(product_id INT, quantity INT)
                WHERE c.product_id IS NULL OR c.quantity IS NULL OR c.quantity <= 0) THEN
        RAISE EXCEPTION 'Every cart item needs a product_id and a positive quantity'
              USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT c.product_id INTO v_bad_product
      FROM jsonb_to_recordset(p_cart_items) AS c(product_id INT, quantity INT)
     WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.product_id = c.product_id)
     LIMIT 1;

    IF v_bad_product IS NOT NULL THEN
        RAISE EXCEPTION 'Product % does not exist', v_bad_product
              USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- 2. Order header ---------------------------------------------------------
    INSERT INTO orders (customer_id, address_id, status)
    VALUES (p_customer_id, p_address_id,
            CASE WHEN p_payment_method = 'cod' THEN 'pending' ELSE 'confirmed' END)
    RETURNING order_id INTO p_order_id;

    -- 3. Order lines (trigger T1 reserves stock per row, or raises) -----------
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    SELECT p_order_id, p.product_id, c.quantity, p.price
      FROM (SELECT product_id, SUM(quantity)::INT AS quantity
              FROM jsonb_to_recordset(p_cart_items) AS x(product_id INT, quantity INT)
             GROUP BY product_id) AS c
      JOIN products p ON p.product_id = c.product_id
     ORDER BY p.product_id;          -- consistent lock order avoids deadlocks

    -- 4. Payment (amount computed from the lines just inserted) ---------------
    SELECT SUM(quantity * unit_price) INTO v_total
      FROM order_items
     WHERE order_id = p_order_id;

    INSERT INTO payments (order_id, amount, method, status, paid_at)
    VALUES (p_order_id, v_total, p_payment_method,
            CASE WHEN p_payment_method = 'cod' THEN 'pending' ELSE 'completed' END,
            CASE WHEN p_payment_method = 'cod' THEN NULL      ELSE now()       END);
END;
$$;


-- -----------------------------------------------------------------------------
-- P2. cancel_order(order_id)
--
--   Allowed only before shipping. Returns each line's quantity to the
--   warehouse it was reserved from, refunds a completed payment (a pending COD
--   payment is marked failed), and sets the order to 'cancelled'. Atomic like P1.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE cancel_order(IN p_order_id INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status orders.status%TYPE;
BEGIN
    SELECT status INTO v_status
      FROM orders
     WHERE order_id = p_order_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % does not exist', p_order_id
              USING ERRCODE = 'no_data_found';
    END IF;

    IF v_status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Order % cannot be cancelled (status "%")', p_order_id, v_status
              USING ERRCODE = 'check_violation';
    END IF;

    -- Restock: UPDATE ... FROM joins inventory to this order's lines.
    UPDATE inventory i
       SET stock_qty = i.stock_qty + oi.quantity
      FROM order_items oi
     WHERE oi.order_id     = p_order_id
       AND i.product_id    = oi.product_id
       AND i.warehouse_id  = oi.warehouse_id;

    UPDATE payments
       SET status = CASE WHEN status = 'completed' THEN 'refunded' ELSE 'failed' END
     WHERE order_id = p_order_id
       AND status IN ('completed', 'pending');

    UPDATE orders
       SET status = 'cancelled'
     WHERE order_id = p_order_id;
END;
$$;
