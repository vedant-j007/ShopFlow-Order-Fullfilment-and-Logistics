import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';

const router = Router();

// ORDER BY cannot be a bind parameter, so the sort key is looked up in a whitelist.
const SORTS = {
  popular: 'units_sold DESC, p.name',
  price_asc: 'p.price ASC, p.name',
  price_desc: 'p.price DESC, p.name',
  name: 'p.name',
};

// GET /api/categories
router.get('/categories', async (req, res) => {
  const { rows } = await query(`
    SELECT c.category_id, c.name, COUNT(p.product_id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.category_id
     GROUP BY c.category_id, c.name
     ORDER BY c.name`);
  res.json(rows);
});

// GET /api/products?search=&category_id=&sort=popular|price_asc|price_desc|name&in_stock=true
router.get('/products', async (req, res) => {
  const { search, category_id, sort, in_stock } = req.query;
  const { rows } = await query(
    `SELECT p.product_id, p.name, p.description, p.price,
            c.category_id, c.name AS category, s.name AS supplier,
            COALESCE(st.total_stock, 0)   AS total_stock,
            COALESCE(st.max_orderable, 0) AS max_orderable,
            COALESCE(sold.units_sold, 0)  AS units_sold
       FROM products p
       JOIN categories c ON c.category_id = p.category_id
       JOIN suppliers  s ON s.supplier_id = p.supplier_id
       LEFT JOIN (SELECT product_id,
                         SUM(stock_qty) AS total_stock,
                         -- an order line is fulfilled from ONE warehouse (see trigger T1)
                         MAX(stock_qty) AS max_orderable
                    FROM inventory
                   GROUP BY product_id) st ON st.product_id = p.product_id
       LEFT JOIN (SELECT oi.product_id, SUM(oi.quantity) AS units_sold
                    FROM order_items oi
                    JOIN orders o ON o.order_id = oi.order_id
                   WHERE o.status <> 'cancelled'
                   GROUP BY oi.product_id) sold ON sold.product_id = p.product_id
      WHERE ($1::text IS NULL OR p.name ILIKE '%' || $1 || '%' OR c.name ILIKE '%' || $1 || '%')
        AND ($2::int  IS NULL OR p.category_id = $2)
        AND ($3::bool IS NOT TRUE OR st.max_orderable > 0)
      ORDER BY ${SORTS[sort] ?? SORTS.popular}`,
    [search?.trim() || null, category_id || null, in_stock === 'true'],
  );
  res.json(rows);
});

// GET /api/products/:id  (with stock per warehouse)
router.get('/products/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT p.product_id, p.name, p.description, p.price,
            c.category_id, c.name AS category, s.name AS supplier,
            COALESCE(json_agg(json_build_object('warehouse', w.location, 'stock_qty', i.stock_qty)
                              ORDER BY w.location)
                     FILTER (WHERE i.inventory_id IS NOT NULL), '[]') AS stock_by_warehouse
       FROM products p
       JOIN categories c      ON c.category_id  = p.category_id
       JOIN suppliers  s      ON s.supplier_id  = p.supplier_id
       LEFT JOIN inventory  i ON i.product_id   = p.product_id
       LEFT JOIN warehouses w ON w.warehouse_id = i.warehouse_id
      WHERE p.product_id = $1
      GROUP BY p.product_id, c.category_id, s.supplier_id`,
    [req.params.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Product not found');
  res.json(rows[0]);
});

export default router;
