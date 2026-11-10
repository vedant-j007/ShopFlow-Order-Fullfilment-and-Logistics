import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { REPORTS } from '../queries/reports.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

// GET /api/admin/kpis
router.get('/kpis', async (req, res) => {
  const { rows } = await query(`
    SELECT (SELECT COALESCE(SUM(order_total), 0)
              FROM order_summary WHERE status <> 'cancelled')              AS revenue,
           (SELECT ROUND(AVG(order_total), 2)
              FROM order_summary WHERE status <> 'cancelled')              AS avg_order_value,
           (SELECT COUNT(*) FROM orders)                                   AS total_orders,
           (SELECT COUNT(*) FROM orders
             WHERE status IN ('pending', 'confirmed'))                     AS awaiting_shipment,
           (SELECT COUNT(*) FROM shipments
             WHERE status IN ('label_created', 'in_transit', 'out_for_delivery')) AS active_shipments,
           (SELECT COUNT(*) FROM customers)                                AS customers,
           (SELECT COUNT(*) FROM low_stock_alert)                          AS low_stock_items`);
  res.json(rows[0]);
});

// GET /api/admin/reports  — catalogue of analytical queries and views (with their SQL)
router.get('/reports', (req, res) => res.json(REPORTS));

// GET /api/admin/reports/:key  — run one of them
router.get('/reports/:key', async (req, res) => {
  const report = REPORTS.find((r) => r.key === req.params.key);
  if (!report) throw new HttpError(404, `Unknown report "${req.params.key}"`);
  const started = performance.now();
  const { rows, fields } = await query(report.sql);
  res.json({
    ...report,
    columns: fields.map((f) => f.name),
    rows,
    ms: Number((performance.now() - started).toFixed(1)),
  });
});

// GET /api/admin/lookups  — dropdown data
router.get('/lookups', async (req, res) => {
  const [warehouses, carriers] = await Promise.all([
    query('SELECT warehouse_id, location, capacity FROM warehouses ORDER BY warehouse_id'),
    query('SELECT carrier_id, name FROM carriers ORDER BY name'),
  ]);
  res.json({ warehouses: warehouses.rows, carriers: carriers.rows });
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

// GET /api/admin/inventory?warehouse_id=&search=&low_only=true
router.get('/inventory', async (req, res) => {
  const { warehouse_id, search, low_only } = req.query;
  const { rows } = await query(
    `SELECT i.inventory_id, i.product_id, p.name AS product_name, c.name AS category,
            i.warehouse_id, w.location AS warehouse,
            i.stock_qty, i.reorder_level,
            i.stock_qty <= i.reorder_level AS is_low
       FROM inventory  i
       JOIN products   p ON p.product_id   = i.product_id
       JOIN categories c ON c.category_id  = p.category_id
       JOIN warehouses w ON w.warehouse_id = i.warehouse_id
      WHERE ($1::int  IS NULL OR i.warehouse_id = $1)
        AND ($2::text IS NULL OR p.name ILIKE '%' || $2 || '%')
        AND ($3::bool IS NOT TRUE OR i.stock_qty <= i.reorder_level)
      ORDER BY p.name, w.location`,
    [warehouse_id || null, search?.trim() || null, low_only === 'true'],
  );
  res.json(rows);
});

// PATCH /api/admin/inventory/:id  { stock_qty?, adjust_by?, reorder_level? }
// adjust_by is applied inside the UPDATE so concurrent restocks don't overwrite each other.
router.patch('/inventory/:id', async (req, res) => {
  const { stock_qty = null, adjust_by = null, reorder_level = null } = req.body ?? {};
  const { rows } = await query(
    `UPDATE inventory
        SET stock_qty     = COALESCE($1, stock_qty) + COALESCE($2, 0),
            reorder_level = COALESCE($3, reorder_level)
      WHERE inventory_id = $4
     RETURNING inventory_id, stock_qty, reorder_level, stock_qty <= reorder_level AS is_low`,
    [stock_qty, adjust_by, reorder_level, req.params.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Inventory row not found');
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

// GET /api/admin/orders?status=
router.get('/orders', async (req, res) => {
  const { rows } = await query(
    `SELECT os.*,
            (SELECT COUNT(*) FROM shipments s WHERE s.order_id = os.order_id) AS shipment_count
       FROM order_summary os
      WHERE ($1::text IS NULL OR os.status = $1)
      ORDER BY os.order_date DESC`,
    [req.query.status || null],
  );
  res.json(rows);
});

// POST /api/admin/orders/:id/ship  { carrier_id }
// One shipment per fulfilling warehouse. Trigger trg_shipments_mark_order_shipped
// then sets orders.status = 'shipped' (or rejects cancelled/delivered orders).
router.post('/orders/:id/ship', async (req, res) => {
  const { carrier_id } = req.body ?? {};
  if (!carrier_id) throw new HttpError(400, 'Choose a carrier');
  const { rows } = await query(
    `INSERT INTO shipments (order_id, warehouse_id, carrier_id)
     SELECT DISTINCT oi.order_id, oi.warehouse_id, $2::int
       FROM order_items oi
      WHERE oi.order_id = $1
     ON CONFLICT (order_id, warehouse_id) DO NOTHING
     RETURNING shipment_id, tracking_number, warehouse_id`,
    [req.params.id, carrier_id],
  );
  if (rows.length === 0) throw new HttpError(409, 'Order not found or already shipped');
  res.status(201).json(rows);
});

// POST /api/admin/orders/:id/cancel
router.post('/orders/:id/cancel', async (req, res) => {
  await query('CALL cancel_order($1)', [req.params.id]);
  res.json({ order_id: Number(req.params.id), status: 'cancelled' });
});

// ---------------------------------------------------------------------------
// Shipments & tracking
// ---------------------------------------------------------------------------

// GET /api/admin/shipments  — board data, with each shipment's latest event
router.get('/shipments', async (req, res) => {
  const { rows } = await query(`
    SELECT s.shipment_id, s.order_id, s.tracking_number, s.status, s.created_at,
           ca.name AS carrier, w.location AS warehouse,
           cu.name AS customer, a.city AS destination,
           last_ev.status AS last_event, last_ev.location AS last_location,
           last_ev.event_time AS last_event_time
      FROM shipments s
      JOIN carriers   ca ON ca.carrier_id  = s.carrier_id
      JOIN warehouses w  ON w.warehouse_id = s.warehouse_id
      JOIN orders     o  ON o.order_id     = s.order_id
      JOIN customers  cu ON cu.customer_id = o.customer_id
      JOIN addresses  a  ON a.address_id   = o.address_id
      LEFT JOIN LATERAL (
            SELECT te.status, te.location, te.event_time
              FROM tracking_events te
             WHERE te.shipment_id = s.shipment_id
             ORDER BY te.event_time DESC, te.event_id DESC
             LIMIT 1) last_ev ON TRUE
     ORDER BY COALESCE(last_ev.event_time, s.created_at) DESC`);
  res.json(rows);
});

// GET /api/admin/shipments/:id/events
router.get('/shipments/:id/events', async (req, res) => {
  const { rows } = await query(
    `SELECT event_id, location, event_time, status
       FROM tracking_events
      WHERE shipment_id = $1
      ORDER BY event_time, event_id`,
    [req.params.id],
  );
  res.json(rows);
});

// POST /api/admin/shipments/:id/events  { status, location }
// Trigger trg_tracking_events_sync_status updates shipments.status, and marks the
// order delivered once all of its shipments are delivered.
router.post('/shipments/:id/events', async (req, res) => {
  const { status, location } = req.body ?? {};
  if (!status || !location?.trim()) throw new HttpError(400, 'Status and location are required');

  const { rowCount } = await query(
    `INSERT INTO tracking_events (shipment_id, location, status)
     SELECT shipment_id, $2, $3
       FROM shipments
      WHERE shipment_id = $1
        AND status <> 'delivered'`,
    [req.params.id, location.trim(), status],
  );
  if (!rowCount) throw new HttpError(409, 'Shipment not found or already delivered');

  const { rows } = await query(
    `SELECT s.shipment_id, s.status AS shipment_status, o.order_id, o.status AS order_status
       FROM shipments s
       JOIN orders o ON o.order_id = s.order_id
      WHERE s.shipment_id = $1`,
    [req.params.id],
  );
  res.status(201).json(rows[0]);
});

export default router;
