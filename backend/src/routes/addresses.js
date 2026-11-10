import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('customer'));

// GET /api/addresses
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT address_id, line1, city, state, pincode
       FROM addresses
      WHERE customer_id = $1
      ORDER BY address_id`,
    [req.user.id],
  );
  res.json(rows);
});

// POST /api/addresses  { line1, city, state, pincode }
router.post('/', async (req, res) => {
  const { line1, city, state, pincode } = req.body ?? {};
  if (![line1, city, state, pincode].every((v) => typeof v === 'string' && v.trim())) {
    throw new HttpError(400, 'All address fields are required');
  }
  const { rows } = await query(
    `INSERT INTO addresses (customer_id, line1, city, state, pincode)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING address_id, line1, city, state, pincode`,
    [req.user.id, line1.trim(), city.trim(), state.trim(), pincode.trim()],
  );
  res.status(201).json(rows[0]);
});

export default router;
