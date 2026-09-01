/**
 * PLUS 233 AUTOMASTER — Database layer
 * ------------------------------------------------------------
 * SQLite via better-sqlite3. This module is the single point of
 * access to persistent data. To move to PostgreSQL / MongoDB in
 * production, replace the implementation here — the REST API and
 * frontend never touch SQL directly.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'automaster.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  image       TEXT DEFAULT '',
  sort_order  INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  part_number TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  brand       TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  description TEXT DEFAULT '',
  price_ghs   REAL NOT NULL CHECK (price_ghs >= 0),
  stock_qty   INTEGER NOT NULL DEFAULT 0,
  low_stock_at INTEGER NOT NULL DEFAULT 10,
  image_url   TEXT DEFAULT '',
  featured    INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- One row per compatible (make, model, year-range, engine).
-- engine = '' or NULL means "all engines for this model".
-- make = 'Universal' means fits every vehicle.
CREATE TABLE IF NOT EXISTS product_compatibility (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  make       TEXT NOT NULL,
  model      TEXT NOT NULL,
  year_start INTEGER DEFAULT 0,
  year_end   INTEGER DEFAULT 9999,
  engine     TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_compat_product ON product_compatibility(product_id);
CREATE INDEX IF NOT EXISTS idx_compat_vehicle ON product_compatibility(make, model);

-- Vehicle reference catalogue used by the "Find Parts For Your Vehicle" selector
CREATE TABLE IF NOT EXISTS vehicles (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  make    TEXT NOT NULL,
  model   TEXT NOT NULL,
  year_start INTEGER DEFAULT 0,
  year_end   INTEGER DEFAULT 9999,
  engines TEXT DEFAULT ''   -- comma separated engine options
);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT DEFAULT '',
  phone      TEXT DEFAULT '',
  address    TEXT DEFAULT '',
  city       TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_email_phone ON customers(email, phone);

CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number  TEXT NOT NULL UNIQUE,
  customer_id   INTEGER REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  address       TEXT NOT NULL,
  city          TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  status        TEXT NOT NULL DEFAULT 'Pending',
  subtotal_ghs  REAL NOT NULL DEFAULT 0,
  delivery_ghs  REAL NOT NULL DEFAULT 0,
  total_ghs     REAL NOT NULL DEFAULT 0,
  notes         TEXT DEFAULT '',
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  part_number TEXT DEFAULT '',
  unit_price_ghs REAL NOT NULL,
  qty         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT DEFAULT '',
  role          TEXT DEFAULT 'admin',
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT DEFAULT '',
  phone      TEXT DEFAULT '',
  subject    TEXT DEFAULT '',
  message    TEXT NOT NULL,
  status     TEXT DEFAULT 'new',
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// ============ migrations ============
// v2: customer accounts (registration/login)
const custCols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
if (!custCols.includes('password_hash')) {
  db.exec("ALTER TABLE customers ADD COLUMN password_hash TEXT DEFAULT ''");
}
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email != ''`);
} catch (e) {
  console.warn('customer email index:', e.message);
}

module.exports = db;
