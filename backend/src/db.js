import pg from 'pg';

// NUMERIC (1700) and BIGINT (20, e.g. COUNT/SUM results) arrive as strings by default.
pg.types.setTypeParser(1700, (value) => parseFloat(value));
pg.types.setTypeParser(20, (value) => parseInt(value, 10));
// DATE (1082) stays 'YYYY-MM-DD'; a JS Date would invent a midnight time and timezone.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ecommerce',
  max: 10,
});

export const query = (text, params) => pool.query(text, params);
