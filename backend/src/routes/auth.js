import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = Router();

const withToken = (user) => ({ token: jwt.sign(user, JWT_SECRET, { expiresIn: '7d' }), user });

// Customers and admins are separate tables, so the client says which one to check.
const LOGIN_SQL = {
  customer: `SELECT customer_id AS id, name, email, password_hash
               FROM customers
              WHERE lower(email) = lower($1)`,
  admin: `SELECT admin_id AS id, name, email, password_hash
            FROM admins
           WHERE lower(email) = lower($1)`,
};

// POST /api/auth/login  { email, password, role: 'customer' | 'admin' }
router.post('/login', async (req, res) => {
  const { email, password, role = 'customer' } = req.body ?? {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required');
  if (!LOGIN_SQL[role]) throw new HttpError(400, 'Role must be customer or admin');

  const { rows } = await query(LOGIN_SQL[role], [email.trim()]);
  const account = rows[0];
  if (!account || !(await bcrypt.compare(password, account.password_hash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  res.json(withToken({ id: account.id, name: account.name, email: account.email, role }));
});

// POST /api/auth/register  { name, email, phone, password }
// Email/phone format is validated by the CHECK constraints on CUSTOMERS.
router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body ?? {};
  if (![name, email, phone, password].every((v) => typeof v === 'string' && v.trim())) {
    throw new HttpError(400, 'All fields are required');
  }
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO customers (name, email, phone, password_hash)
     VALUES ($1, lower($2), $3, $4)
     RETURNING customer_id AS id, name, email`,
    [name.trim(), email.trim(), phone.trim(), passwordHash],
  );
  res.status(201).json(withToken({ ...rows[0], role: 'customer' }));
});

export default router;
