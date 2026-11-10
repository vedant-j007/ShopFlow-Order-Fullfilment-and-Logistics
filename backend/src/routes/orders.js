import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('customer'));

// GET /api/orders  — the logged-in customer's order history
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT os.*, items.preview
       FROM order_summary os
      CROSS JOIN LATERAL (
            SELECT string_agg(p.name, ', ' ORDER BY oi.order_item_id) AS preview
              FROM order_items oi
              JOIN products p ON p.product_id = oi.product_id
             WHERE oi.order_id = os.order_id) items
      WHERE os.customer_id = $1
      ORDER BY os.order_date DESC`,
    [req.user.id],
  );
  res.json(rows);
});

// POST /api/orders  { address_id, payment_method, items: [{ product_id, quantity }] }
// One CALL = one atomic transaction: order + order_items (stock trigger) + payment.
router.post('/', async (req, res) => {
  const { address_id, payment_method = 'card', items } = req.body ?? {};
  if (!address_id) throw new HttpError(400, 'Choose a delivery address');
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Your cart is empty');

  const cart = items.map(({ product_id, quantity }) => ({ product_id, quantity }));
  const { rows } = await query('CALL place_order($1, $2, $3::jsonb, $4, NULL)', [
    req.user.id,
    address_id,
    JSON.stringify(cart),
    payment_method,
  ]);
  res.status(201).json({ order_id: rows[0].p_order_id });
});

// GET /api/orders/:id  — header, lines, and every shipment with its tracking timeline
router.get('/:id', async (req, res) => {
  const { rows: [order] } = await query(
    `SELECT o.order_id, o.order_date, o.status,
            a.line1, a.city, a.state, a.pincode,
            os.line_count, os.item_count, os.order_total,
            pay.method AS payment_method, pay.status AS payment_status, pay.paid_at
       FROM orders o
       JOIN addresses a      ON a.address_id  = o.address_id
       JOIN order_summary os ON os.order_id   = o.order_id
       LEFT JOIN payments pay ON pay.order_id = o.order_id
      WHERE o.order_id = $1
        AND o.customer_id = $2`,
    [req.params.id, req.user.id],
  );
  if (!order) throw new HttpError(404, 'Order not found');

  const [items, shipments] = await Promise.all([
    query(
      `SELECT oi.order_item_id, oi.product_id, p.name, c.name AS category,
              oi.quantity, oi.unit_price, oi.quantity * oi.unit_price AS line_total,
              w.location AS warehouse
         FROM order_items oi
         JOIN products   p ON p.product_id   = oi.product_id
         JOIN categories c ON c.category_id  = p.category_id
         JOIN warehouses w ON w.warehouse_id = oi.warehouse_id
        WHERE oi.order_id = $1
        ORDER BY oi.order_item_id`,
      [order.order_id],
    ),
    query(
      `SELECT s.shipment_id, s.tracking_number, s.status, s.created_at,
              w.location AS warehouse, ca.name AS carrier,
              COALESCE(json_agg(json_build_object('event_id',   te.event_id,
                                                  'location',   te.location,
                                                  'event_time', te.event_time,
                                                  'status',     te.status)
                                ORDER BY te.event_time, te.event_id)
                       FILTER (WHERE te.event_id IS NOT NULL), '[]') AS events
         FROM shipments s
         JOIN warehouses w ON w.warehouse_id = s.warehouse_id
         JOIN carriers  ca ON ca.carrier_id  = s.carrier_id
         LEFT JOIN tracking_events te ON te.shipment_id = s.shipment_id
        WHERE s.order_id = $1
        GROUP BY s.shipment_id, w.warehouse_id, ca.carrier_id
        ORDER BY s.shipment_id`,
      [order.order_id],
    ),
  ]);
  res.json({ ...order, items: items.rows, shipments: shipments.rows });
});

// POST /api/orders/:id/cancel  — cancel_order restocks and refunds atomically
router.post('/:id/cancel', async (req, res) => {
  const { rowCount } = await query(
    'SELECT 1 FROM orders WHERE order_id = $1 AND customer_id = $2',
    [req.params.id, req.user.id],
  );
  if (!rowCount) throw new HttpError(404, 'Order not found');
  await query('CALL cancel_order($1)', [req.params.id]);
  res.json({ order_id: Number(req.params.id), status: 'cancelled' });
});

export default router;
