-- Loads the whole database layer in dependency order.
-- Usage:  psql -U postgres -d ecommerce -f db/init.sql
\set ON_ERROR_STOP on
\ir schema.sql
\ir triggers.sql
\ir procedures.sql
\ir views.sql
\ir seed.sql
