-- RevoTech database schema (PostgreSQL 14+; Supabase runs 15+).
--
-- The five Module 2 tables, column for column as the Flask SQLAlchemy models define them, plus
-- what the storefront adds: product media and specs, editable page content, and the store
-- settings. Point the Flask API at the same database and it keeps working - it just ignores the
-- extra columns and tables.
--
-- Created and seeded by `npm run db:setup` (scripts/db-setup.mjs). Safe to run twice: every
-- statement is IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS categories (
  category_id   SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL,
  description   TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  product_id      SERIAL PRIMARY KEY,
  category_id     INTEGER NOT NULL REFERENCES categories (category_id),
  product_name    VARCHAR(150) NOT NULL,
  description     TEXT,
  price           NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  stock_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- storefront extensions
  official_url    VARCHAR(500),
  overview        TEXT,
  overview_source VARCHAR(500),
  specs_source    VARCHAR(500),
  images          JSONB NOT NULL DEFAULT '[]'::jsonb,
  specs           JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  -- Werkzeug format (pbkdf2:sha256:...), so Flask's check_password_hash reads it too
  password_hash VARCHAR(255) NOT NULL,
  phone_number  VARCHAR(20),
  address       TEXT,
  role          VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('superadmin', 'admin', 'customer')),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  order_id         SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users (id),
  order_status     VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (order_status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  shipping_address TEXT NOT NULL,
  ordered_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders (order_id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products (product_id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(12, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON order_items (product_id);

-- homepage and About page, one JSON document each
CREATE TABLE IF NOT EXISTS site_content (
  key        VARCHAR(20) PRIMARY KEY,
  content    JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- exactly one row: the store settings and the logo (as traced vector paths)
CREATE TABLE IF NOT EXISTS site_settings (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings   JSONB NOT NULL,
  logo       JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
