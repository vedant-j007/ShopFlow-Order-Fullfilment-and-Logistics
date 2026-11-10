# ShopFlow: Integrated E-commerce Order Fulfillment & Logistics Management System

A DBMS course project. The core is a normalized PostgreSQL schema with the business rules written in SQL (triggers, stored procedures, views). A small Express API runs raw SQL against it, and a React + Tailwind UI sits on top.

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Database | PostgreSQL 16 (works on 13+)                                |
| Backend  | Node.js 22, Express 5, `pg` (raw SQL, no ORM), JWT auth     |
| Frontend | React 19, React Router, Tailwind CSS 4, Vite                 |
| Runtime  | Docker Compose (Postgres + backend + frontend)              |

---

## 1. Quick start with Docker

```bash
docker compose up --build
```

| What                | Where                                   |
| ------------------- | --------------------------------------- |
| Web app             | http://localhost:3000                   |
| REST API            | http://localhost:4000/api/health        |
| PostgreSQL          | `localhost:5433`, db `ecommerce`, user `postgres`, password `postgres` |

On the **first** start, Postgres runs the SQL files automatically (schema → triggers → procedures → views → seed).

### Demo accounts

| Role     | Email                       | Password      |
| -------- | --------------------------- | ------------- |
| Customer | `aarav.sharma@example.com`  | `customer123` |
| Admin    | `admin@shopflow.local`      | `admin123`    |

All 10 seeded customers use `customer123` (for example `priya.iyer@example.com`). You can also register a new customer from the login page.

---

## 2. Running the SQL files in `db/`

### What each file is

| # | File                      | Contains                                                                  | Run it?              |
| - | ------------------------- | ------------------------------------------------------------------------- | -------------------- |
| 1 | `schema.sql`              | `DROP` + `CREATE TABLE`, all constraints and indexes                      | Yes, first           |
| 2 | `triggers.sql`            | 3 trigger functions + triggers                                            | Yes                  |
| 3 | `procedures.sql`          | `place_order`, `cancel_order`                                             | Yes                  |
| 4 | `views.sql`               | `order_summary`, `delivery_performance`, `low_stock_alert`                | Yes                  |
| 5 | `seed.sql`                | Sample data (10 customers, 30 products, 3 warehouses, 25 orders…)          | Yes, last            |
| - | `init.sql`                | Runs 1–5 in order (psql only)                                             | Shortcut for 1–5     |
| - | `analytics.sql`           | 9 analytical queries (read-only)                                          | Any time after seed  |
| - | `test_business_logic.sql` | Demonstrates every trigger/procedure incl. failure cases, then `ROLLBACK` | Any time after seed  |

**Order matters**: triggers and procedures reference tables, views reference tables, and the seed script relies on the triggers (inserting order items is what decrements stock). Every file is re-runnable: `schema.sql` drops and recreates everything, and `seed.sql` truncates before inserting.

### Option A: psql, one command

You need PostgreSQL installed locally (`psql --version` should work).

```bash
# from the project root
createdb -h localhost -U postgres ecommerce                      # once
psql -h localhost -U postgres -d ecommerce -f db/init.sql        # builds + seeds everything
```

`init.sql` uses `\ir` (include relative to this file), so it works from any working directory.

### Option B: psql, file by file

```bash
psql -h localhost -U postgres -d ecommerce -f db/schema.sql
psql -h localhost -U postgres -d ecommerce -f db/triggers.sql
psql -h localhost -U postgres -d ecommerce -f db/procedures.sql
psql -h localhost -U postgres -d ecommerce -f db/views.sql
psql -h localhost -U postgres -d ecommerce -f db/seed.sql
```

Or from inside an interactive `psql -h localhost -U postgres -d ecommerce` session:

```sql
\i db/schema.sql
\i db/triggers.sql
\i db/procedures.sql
\i db/views.sql
\i db/seed.sql
```

> **Windows:** open *SQL Shell (psql)* from the Start menu (or add `C:\Program Files\PostgreSQL\16\bin` to `PATH`). Use forward slashes in paths: `\i 'C:/Users/you/DBMS-project/db/schema.sql'`.

### Option C: inside the Docker container

The compose file mounts `db/` at `/db` in the database container:

```bash
docker compose exec db psql -h localhost -U postgres -d ecommerce                                 # interactive shell
docker compose exec db psql -h localhost -U postgres -d ecommerce -f /db/analytics.sql            # run the analytics
docker compose exec db psql -h localhost -U postgres -d ecommerce -f /db/test_business_logic.sql  # run the demo tests
docker compose exec db psql -h localhost -U postgres -d ecommerce -f /db/init.sql                 # rebuild + reseed
```

### Option D: a GUI (pgAdmin or DBeaver)

MySQL Workbench cannot connect to PostgreSQL. Use **pgAdmin** (bundled with the Windows installer) or **DBeaver**.

1. Connect to host `localhost`, port `5432` (or `5433` for the Docker database), database `ecommerce`.
2. Open the Query Tool, then open and execute the files **one at a time, in order**: `schema.sql`, `triggers.sql`, `procedures.sql`, `views.sql`, `seed.sql`.
3. `analytics.sql` runs fine in a GUI (run one query at a time by selecting it).

`init.sql` and `test_business_logic.sql` contain psql meta-commands (`\ir`, `\echo`, `\set`), which GUIs don't understand. Use psql for those two.

### Checking that it worked

```sql
\dt                     -- 14 tables
\dv                     -- 3 views
\df                     -- functions + procedures
SELECT status, COUNT(*) FROM orders GROUP BY status;   -- delivered 15, shipped 4, confirmed 2, pending 2, cancelled 2
SELECT * FROM order_summary ORDER BY order_date DESC LIMIT 5;
SELECT * FROM low_stock_alert;
SELECT * FROM delivery_performance;
```

Try the business logic by hand:

```sql
-- Place an order (atomic). Returns the new order_id.
CALL place_order(1, 1, '[{"product_id": 21, "quantity": 2}, {"product_id": 30, "quantity": 1}]');
CALL place_order(1, 1, '[{"product_id": 3, "quantity": 1}]', 'cod', NULL);   -- with payment method

-- Insufficient stock: the trigger raises, and the whole CALL is rolled back
CALL place_order(1, 1, '[{"product_id": 1, "quantity": 1}, {"product_id": 12, "quantity": 500}]');

-- Ship it: the trigger moves the order to 'shipped'
INSERT INTO shipments (order_id, warehouse_id, carrier_id)
SELECT DISTINCT order_id, warehouse_id, 1 FROM order_items WHERE order_id = 22;

-- Deliver it: the trigger marks shipment + order delivered
INSERT INTO tracking_events (shipment_id, location, status)
SELECT shipment_id, 'Bengaluru', 'delivered' FROM shipments WHERE order_id = 22;

CALL cancel_order(23);   -- restock + refund
```

`test_business_logic.sql` runs all of these (and the failure cases) inside a transaction and rolls back at the end. The `ERROR:` lines in its output are the expected, demonstrated failures.

**Resetting data:** re-run `seed.sql` (data only) or `init.sql` (everything). With Docker, `docker compose down -v` deletes the volume so the next `up` re-initializes from scratch.

> Seed dates are relative to `now()`, so the dashboard always shows the last ~6 months.

---

## 3. Running without Docker

Requires PostgreSQL and **Node.js 20.19+ or 22.12+**.

```bash
# 1. Database (see section 2)
createdb -h localhost -U postgres ecommerce
psql -h localhost -U postgres -d ecommerce -f db/init.sql

# 2. API on http://localhost:4000
cd backend
npm install
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/ecommerce npm run dev

# 3. Web app on http://localhost:5173 (proxies /api to :4000)
cd frontend
npm install
npm run dev
```

Windows PowerShell: `$env:DATABASE_URL="postgres://postgres:YOUR_PASSWORD@localhost:5432/ecommerce"; npm run dev`

| Variable       | Default                                               |
| -------------- | ----------------------------------------------------- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/ecommerce` |
| `JWT_SECRET`   | `dev-only-secret-change-me`                           |
| `PORT`         | `4000`                                                |
| `API_URL` (frontend dev proxy) | `http://localhost:4000`               |

---

## 4. Schema design

```mermaid
erDiagram
    CUSTOMERS  ||--o{ ADDRESSES       : has
    CUSTOMERS  ||--o{ ORDERS          : places
    ADDRESSES  ||--o{ ORDERS          : "delivered to"
    CATEGORIES ||--o{ PRODUCTS        : groups
    SUPPLIERS  ||--o{ PRODUCTS        : supplies
    PRODUCTS   ||--o{ INVENTORY       : "stocked as"
    WAREHOUSES ||--o{ INVENTORY       : holds
    ORDERS     ||--|{ ORDER_ITEMS     : contains
    PRODUCTS   ||--o{ ORDER_ITEMS     : "ordered as"
    WAREHOUSES ||--o{ ORDER_ITEMS     : fulfils
    ORDERS     ||--o| PAYMENTS        : "paid by"
    ORDERS     ||--o{ SHIPMENTS       : "shipped in"
    WAREHOUSES ||--o{ SHIPMENTS       : dispatches
    CARRIERS   ||--o{ SHIPMENTS       : carries
    SHIPMENTS  ||--o{ TRACKING_EVENTS : logs
```

`ADMINS` is a separate table with no relationships: admins aren't customers and never place orders.

### Why it is in 3NF

- **1NF**: every column is atomic. A cart is not a list inside `ORDERS`; each line is a row in `ORDER_ITEMS`. A customer's addresses are rows in `ADDRESSES`, not columns.
- **2NF**: every table has a single-column surrogate key, so no attribute can depend on part of a key. Where a natural composite key exists it is enforced with `UNIQUE` (for example `INVENTORY(product_id, warehouse_id)`), and `stock_qty` depends on the whole pair.
- **3NF**: no non-key attribute depends on another non-key attribute. Category names live only in `CATEGORIES`, supplier names only in `SUPPLIERS`, warehouse locations only in `WAREHOUSES`, and customer details are never copied into `ORDERS`.

### Columns that look redundant but aren't

| Column | Why it stays |
| --- | --- |
| `order_items.unit_price` | Price **at purchase time**. `products.price` can change later; old orders must not. |
| `payments.amount` | Amount actually charged, a fact recorded when the payment happened. |
| `orders.status`, `shipments.status` | Required by the spec. They are derived state, kept consistent by triggers rather than by the application, and are indexed for filtering. |
| `addresses.city` + `pincode` | Neither determines the other: one pincode can cover several towns and a city has many pincodes, so there is no transitive dependency. |

### Other design decisions

- **Composite foreign key** `orders(address_id, customer_id) → addresses(address_id, customer_id)`: an order can't be delivered to another customer's address. This is enforced by the schema, not just the app.
- **`order_items.warehouse_id`** records which warehouse fulfilled each line. `cancel_order` needs it to restock the right warehouse, and shipments are created per fulfilling warehouse.
- **One-to-one payments**: `payments.order_id` is `UNIQUE`.
- **Split shipments**: an order can have several shipments, at most one per warehouse (`UNIQUE(order_id, warehouse_id)`).
- **One warehouse per order line**: the stock trigger needs a single warehouse to cover a line's quantity, so the catalog exposes `max_orderable` (the largest single-warehouse stock) and the cart caps quantity at that.
- **Per-warehouse reorder level**: `low_stock_alert` compares against `inventory.reorder_level` because a view can't take a threshold parameter, and a busy warehouse needs a bigger buffer.
- **Delete rules**: `CASCADE` for owned children (a customer's addresses, an order's items, a shipment's events); `RESTRICT` for referenced master data (you can't delete a product that appears on an order).
- **CHECK constraints**: `stock_qty >= 0`, `quantity > 0`, `price > 0`, `amount > 0`, status and payment-method whitelists, email/phone/pincode formats, and "a completed or refunded payment must have `paid_at`".
- **Indexes**: PostgreSQL does **not** index foreign keys automatically, so every FK column is indexed (or covered as the leading column of a `UNIQUE` index). There are also indexes on `orders.status`, `orders.order_date`, `shipments.status`, `lower(products.name)` for search, and `(shipment_id, event_time)` for tracking timelines.
- **Identity columns** (`GENERATED BY DEFAULT AS IDENTITY`), the SQL-standard replacement for `SERIAL`.
- **Passwords** are stored as bcrypt hashes.

---

## 5. Business logic in the database

| Object | Kind | What it does |
| --- | --- | --- |
| `trg_order_items_reserve_stock` → `fn_reserve_stock()` | `BEFORE INSERT` on `order_items` | Picks a warehouse (prefers one already used by the same order, then the most stock), locks the inventory row `FOR UPDATE` so two orders can't both take the last unit, decrements `stock_qty`, and **raises an error if no warehouse has enough**. |
| `trg_shipments_mark_order_shipped` → `fn_order_shipped()` | `AFTER INSERT` on `shipments` | Sets `orders.status = 'shipped'`. Rejects shipments for cancelled or delivered orders. |
| `trg_tracking_events_sync_status` → `fn_sync_shipment_status()` | `AFTER INSERT` on `tracking_events` | Shipment status follows its latest event. When every shipment of an order is delivered, the order becomes `delivered` and a cash-on-delivery payment becomes `completed`. |
| `place_order(customer_id, address_id, cart_items, payment_method = 'card', INOUT order_id)` | Procedure | Validates the cart, inserts `ORDERS` → `ORDER_ITEMS` (stock trigger fires per line) → `PAYMENTS`. Prices come from `PRODUCTS`, never from the client. A `CALL` is one transaction, so any error, including one raised inside the trigger, rolls back everything. |
| `cancel_order(order_id)` | Procedure | Only for pending/confirmed orders. Restocks each line in its warehouse (`UPDATE … FROM`), refunds or voids the payment, and marks the order cancelled. |
| `order_summary` | View | One row per order with customer, item count and total. Lines are aggregated *before* the join to avoid fan-out. |
| `delivery_performance` | View | Average, fastest and slowest order-to-delivery time per carrier (CTE + `EXTRACT(EPOCH …)`). |
| `low_stock_alert` | View | Inventory rows at or below their reorder level, with a severity (`low` / `critical` / `out_of_stock`). |

### Analytical queries (`db/analytics.sql`)

| # | Query | SQL concepts |
| - | --- | --- |
| Q1 | Top 10 best-selling products | `JOIN` ×3, `GROUP BY`, `ORDER BY` + `LIMIT` |
| Q2 | Monthly revenue with MoM growth and running total | `date_trunc`, derived table, window functions `LAG`, `SUM OVER` |
| Q3 | Warehouse utilization (stock vs capacity, units dispatched) | two aggregated derived tables + `LEFT JOIN`, `COUNT … FILTER` |
| Q4 | Customers spending above the average customer | `GROUP BY` + `HAVING` with nested subquery |
| Q5 | Revenue by category with share of total | `HAVING`, scalar subquery |
| Q6 | Products never ordered | `NOT EXISTS` correlated subquery |
| Q7 | Products priced above their category average | correlated subquery in `WHERE` |
| Q8 | Repeat customers and favourite category | `HAVING`, `LEFT JOIN LATERAL` |
| Q9 | Order status distribution | window function over an aggregate |

In the admin UI, **SQL reports** shows each query's exact SQL next to its live result, and each dashboard card has a Chart / Table / SQL toggle.

---

## 6. REST API

All SQL is in `backend/src/routes/*.js` and `backend/src/queries/reports.js`. Database errors (CHECK violations, trigger `RAISE`s) are mapped to HTTP 400/404/409 with the database's message.

| Method | Endpoint | Auth | SQL behind it |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | – | `SELECT … FROM customers` or `admins` + bcrypt compare |
| POST | `/api/auth/register` | – | `INSERT INTO customers` |
| GET | `/api/categories` | – | `LEFT JOIN` + `COUNT` |
| GET | `/api/products?search=&category_id=&sort=&in_stock=` | – | joins + aggregated stock and sales |
| GET | `/api/products/:id` | – | `json_agg` of stock per warehouse |
| GET/POST | `/api/addresses` | customer | `SELECT` / `INSERT INTO addresses` |
| POST | `/api/orders` | customer | `CALL place_order(…)` |
| GET | `/api/orders` | customer | `order_summary` view + `LATERAL` preview |
| GET | `/api/orders/:id` | customer | order + items + shipments with `json_agg` tracking events |
| POST | `/api/orders/:id/cancel` | customer | `CALL cancel_order(…)` |
| GET | `/api/admin/kpis` | admin | scalar subqueries |
| GET | `/api/admin/reports`, `/api/admin/reports/:key` | admin | the analytical queries and views |
| GET | `/api/admin/inventory?warehouse_id=&search=&low_only=` | admin | inventory joins |
| PATCH | `/api/admin/inventory/:id` | admin | `UPDATE inventory` (hits the `stock_qty >= 0` CHECK) |
| GET | `/api/admin/orders?status=` | admin | `order_summary` |
| POST | `/api/admin/orders/:id/ship` | admin | `INSERT INTO shipments … SELECT DISTINCT` (fires trigger) |
| POST | `/api/admin/orders/:id/cancel` | admin | `CALL cancel_order(…)` |
| GET | `/api/admin/shipments` | admin | joins + `LEFT JOIN LATERAL` latest event |
| GET/POST | `/api/admin/shipments/:id/events` | admin | `SELECT` / `INSERT INTO tracking_events` (fires trigger) |
| GET | `/api/admin/lookups` | admin | warehouses and carriers |

Send the token from login as `Authorization: Bearer <token>`.

---

## 7. Project structure

```
db/
  schema.sql  triggers.sql  procedures.sql  views.sql  seed.sql
  init.sql  analytics.sql  test_business_logic.sql
backend/
  src/server.js            Express app, route mounting, error handler
  src/db.js                pg connection pool
  src/errors.js            SQLSTATE → HTTP status mapping
  src/middleware/auth.js   JWT + role check
  src/routes/              auth, catalog, addresses, orders, admin
  src/queries/reports.js   analytical queries shown in the admin UI
frontend/
  src/pages/customer/      catalog, cart, checkout, order history, order tracking
  src/pages/admin/         dashboard, orders, inventory, shipment board, SQL reports
  src/components/          UI kit, charts, SQL viewer, data table
docker-compose.yml
```

---

## 8. Troubleshooting

- **Changed a SQL file but the Docker database didn't change.** Init scripts only run when the volume is empty. Run `docker compose exec db psql -h localhost -U postgres -d ecommerce -f /db/init.sql`, or `docker compose down -v && docker compose up --build`.
- **`psql: command not found`.** Add PostgreSQL's `bin` folder to `PATH`, or use Option C (Docker) or Option D (GUI).
- **`password authentication failed`.** Use the password you chose when installing PostgreSQL, in both the `psql` command (`-U postgres`, it will prompt) and `DATABASE_URL`.
- **Port already in use.** Change the left-hand port in `docker-compose.yml` (for example `"3001:80"`).
