import express from 'express';
import { pool } from './db.js';
import { toHttpError } from './errors.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import addressRoutes from './routes/addresses.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.use(express.json());

app.get('/api/health', async (req, res) => {
  const { rows } = await pool.query('SELECT now() AS db_time, version() AS db_version');
  res.json({ status: 'ok', ...rows[0] });
});

app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// Express 5 forwards errors thrown in async handlers here.
app.use((err, req, res, next) => {
  const httpError = toHttpError(err);
  if (httpError.status >= 500) console.error(err);
  res.status(httpError.status).json({ error: httpError.message });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
