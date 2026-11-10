-- =============================================================================
--  triggers.sql  —  business rules enforced inside the database
-- =============================================================================

-- -----------------------------------------------------------------------------
-- T1. Reserve stock when an order line is inserted
--     BEFORE INSERT ON order_items
--
--   * If the caller named a warehouse, stock is taken from that warehouse.
--   * Otherwise the trigger picks one: prefer a warehouse already fulfilling
--     another line of the same order (fewer split shipments), then the one
--     with the most stock.
--   * The chosen inventory row is locked (FOR UPDATE) so two concurrent orders
--     cannot both take the last unit.
--   * If no single warehouse can cover the quantity, RAISE aborts the insert
--     (and the surrounding transaction).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_reserve_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_inventory_id  INT;
    v_warehouse_id  INT;
    v_available     INT;
    v_product_name  products.name%TYPE;
BEGIN
    SELECT i.inventory_id, i.warehouse_id
      INTO v_inventory_id, v_warehouse_id
      FROM inventory i
     WHERE i.product_id = NEW.product_id
       AND i.stock_qty >= NEW.quantity
       AND (NEW.warehouse_id IS NULL OR i.warehouse_id = NEW.warehouse_id)
     ORDER BY
           EXISTS (SELECT 1 FROM order_items oi
                    WHERE oi.order_id = NEW.order_id
                      AND oi.warehouse_id = i.warehouse_id) DESC,
           i.stock_qty DESC
     LIMIT 1
       FOR UPDATE OF i;

    IF v_inventory_id IS NULL THEN
        SELECT p.name, COALESCE(MAX(i.stock_qty), 0)
          INTO v_product_name, v_available
          FROM products p
          LEFT JOIN inventory i
                 ON i.product_id = p.product_id
                AND (NEW.warehouse_id IS NULL OR i.warehouse_id = NEW.warehouse_id)
         WHERE p.product_id = NEW.product_id
         GROUP BY p.product_id;

        RAISE EXCEPTION 'Insufficient stock for "%" (product %): requested %, but no single warehouse has more than %',
                        v_product_name, NEW.product_id, NEW.quantity, v_available
              USING ERRCODE = 'check_violation';
    END IF;

    UPDATE inventory
       SET stock_qty = stock_qty - NEW.quantity
     WHERE inventory_id = v_inventory_id;

    NEW.warehouse_id := v_warehouse_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_reserve_stock ON order_items;
CREATE TRIGGER trg_order_items_reserve_stock
    BEFORE INSERT ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION fn_reserve_stock();


-- -----------------------------------------------------------------------------
-- T2. Mark the order as shipped when a shipment is created
--     AFTER INSERT ON shipments
--
--   Cancelled or already-delivered orders cannot receive a new shipment.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_order_shipped()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_status orders.status%TYPE;
BEGIN
    SELECT status INTO v_status
      FROM orders
     WHERE order_id = NEW.order_id
       FOR UPDATE;

    IF v_status IN ('cancelled', 'delivered') THEN
        RAISE EXCEPTION 'Cannot create a shipment for order % with status "%"',
                        NEW.order_id, v_status
              USING ERRCODE = 'check_violation';
    END IF;

    UPDATE orders
       SET status = 'shipped'
     WHERE order_id = NEW.order_id
       AND status IN ('pending', 'confirmed');

    RETURN NULL;   -- return value of an AFTER trigger is ignored
END;
$$;

DROP TRIGGER IF EXISTS trg_shipments_mark_order_shipped ON shipments;
CREATE TRIGGER trg_shipments_mark_order_shipped
    AFTER INSERT ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION fn_order_shipped();


-- -----------------------------------------------------------------------------
-- T3. Keep shipment (and order) status in sync with tracking events
--     AFTER INSERT ON tracking_events
--
--   * Shipment status follows its LATEST event by event_time (so events may be
--     inserted out of order, e.g. backfilled by a carrier feed).
--   * When every shipment of an order is delivered, the order becomes
--     'delivered'.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_shipment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_latest    tracking_events.status%TYPE;
    v_order_id  INT;
BEGIN
    SELECT status INTO v_latest
      FROM tracking_events
     WHERE shipment_id = NEW.shipment_id
     ORDER BY event_time DESC, event_id DESC
     LIMIT 1;

    UPDATE shipments
       SET status = CASE v_latest
                        WHEN 'picked_up'        THEN 'in_transit'
                        WHEN 'in_transit'       THEN 'in_transit'
                        WHEN 'arrived_at_hub'   THEN 'in_transit'
                        WHEN 'out_for_delivery' THEN 'out_for_delivery'
                        WHEN 'delivered'        THEN 'delivered'
                        WHEN 'delivery_failed'  THEN 'failed'
                    END
     WHERE shipment_id = NEW.shipment_id
     RETURNING order_id INTO v_order_id;

    IF v_latest = 'delivered'
       AND NOT EXISTS (SELECT 1 FROM shipments
                        WHERE order_id = v_order_id
                          AND status <> 'delivered') THEN
        UPDATE orders
           SET status = 'delivered'
         WHERE order_id = v_order_id
           AND status <> 'cancelled';

        -- Cash-on-delivery is collected at the door.
        UPDATE payments
           SET status = 'completed', paid_at = NEW.event_time
         WHERE order_id = v_order_id
           AND method = 'cod'
           AND status = 'pending';
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tracking_events_sync_status ON tracking_events;
CREATE TRIGGER trg_tracking_events_sync_status
    AFTER INSERT ON tracking_events
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_shipment_status();
