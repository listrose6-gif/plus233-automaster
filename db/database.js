/**
 * PLUS 233 AUTOMASTER — Database layer
 * ------------------------------------------------------------
 * Dual-mode: PostgreSQL when DATABASE_URL is set (production —
 * survives restarts), otherwise SQLite (local dev / fallback).
 *
 * Exposes a uniform async API:
 *   q(sql, params?)    → rows[]
 *   get(sql, params?)  → row | undefined
 *   run(sql, params?)  → { lastInsertRowid, changes }
 *   exec(sql)          → run multi-statement DDL (no params)
 *   transaction(fn)    → async fn, atomic, auto commit/rollback
 *   init()             → open connection + create schema + migrate
 *   type               → 'pg' | 'sqlite'
 *
 * SQL notes: use `?` positional or `@name` named placeholders —
 * both are translated to PostgreSQL `$n` / `$name` automatically.
 */
'use strict';
const path = require('path');
const fs = require('fs');

const USE_PG = !!((process.env.DATABASE_URL || '').trim());
let sqliteDb = null;
let pgPool = null;
let pgTx = null;

/* ------------------------------------------------------------------ */
/*  PostgreSQL schema (DDL is idempotent)                              */
/* ------------------------------------------------------------------ */
const PG_SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  image       TEXT DEFAULT '',
  sort_order  INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  part_number  TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  brand        TEXT NOT NULL,
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  description  TEXT DEFAULT '',
  price_ghs    REAL NOT NULL CHECK (price_ghs >= 0),
  stock_qty    INTEGER NOT NULL DEFAULT 0,
  low_stock_at INTEGER NOT NULL DEFAULT 10,
  image_url    TEXT DEFAULT '',
  featured     INTEGER DEFAULT 0,
  active       INTEGER DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_compatibility (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  make       TEXT NOT NULL,
  model      TEXT NOT NULL,
  year_start INTEGER DEFAULT 0,
  year_end   INTEGER DEFAULT 9999,
  engine     TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_compat_product ON product_compatibility(product_id);
CREATE INDEX IF NOT EXISTS idx_compat_vehicle ON product_compatibility(make, model);
CREATE TABLE IF NOT EXISTS vehicles (
  id         SERIAL PRIMARY KEY,
  make       TEXT NOT NULL,
  model      TEXT NOT NULL,
  year_start INTEGER DEFAULT 0,
  year_end   INTEGER DEFAULT 9999,
  engines    TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model);
CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT DEFAULT '',
  phone         TEXT DEFAULT '',
  address       TEXT DEFAULT '',
  city          TEXT DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email <> '';
CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  order_number   TEXT NOT NULL UNIQUE,
  customer_id    INTEGER REFERENCES customers(id),
  customer_name  TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  address        TEXT NOT NULL,
  city           TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  status         TEXT NOT NULL DEFAULT 'Pending',
  subtotal_ghs   REAL NOT NULL DEFAULT 0,
  delivery_ghs   REAL NOT NULL DEFAULT 0,
  total_ghs      REAL NOT NULL DEFAULT 0,
  notes          TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_items (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id     INTEGER REFERENCES products(id),
  product_name   TEXT NOT NULL,
  part_number    TEXT DEFAULT '',
  unit_price_ghs REAL NOT NULL,
  qty            INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT DEFAULT '',
  role          TEXT DEFAULT 'admin',
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT DEFAULT '',
  phone      TEXT DEFAULT '',
  subject    TEXT DEFAULT '',
  message    TEXT NOT NULL,
  status     TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

/* ------------------------------------------------------------------ */
/*  SQLite schema                                                      */
/* ------------------------------------------------------------------ */
const SQLITE_SCHEMA = `
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
CREATE TABLE IF NOT EXISTS vehicles (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  make    TEXT NOT NULL,
  model   TEXT NOT NULL,
  year_start INTEGER DEFAULT 0,
  year_end   INTEGER DEFAULT 9999,
  engines TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model);
CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT DEFAULT '',
  phone      TEXT DEFAULT '',
  address    TEXT DEFAULT '',
  city       TEXT DEFAULT '',
  password_hash TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email != '';
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
`;

/* ------------------------------------------------------------------ */
/*  Placeholder translation for PostgreSQL                             */
/* ------------------------------------------------------------------ */
function expandPg(sql, params) {
  let text = sql.replace(/datetime\('now'\)/g, 'now()');
  let values;
  if (Array.isArray(params)) {
    values = params;
    let i = 0;
    text = text.replace(/\?/g, () => `$${++i}`);
  } else if (params && typeof params === 'object') {
    const named = params;
    values = [];
    text = text.replace(/@([A-Za-z_]\w*)/g, (m, n) => {
      const i = values.push(named[n]);
      return `$${i}`;
    });
  } else {
    values = [];
  }
  return { text, values };
}

/* Accepts: no params, a single scalar, an array, or an object (named @params). */
function norm(args) {
  if (args.length === 0) return undefined;
  if (args.length === 1) {
    const a = args[0];
    return (a !== null && typeof a === 'object') ? a : [a];
  }
  return args;
}

/* ------------------------------------------------------------------ */
/*  Public async API                                                   */
/* ------------------------------------------------------------------ */
async function q(sql, ...args) {
  const params = norm(args);
  if (USE_PG) {
    const { text, values } = expandPg(sql, params);
    const client = pgTx || pgPool;
    const r = await client.query(text, values);
    return r.rows;
  }
  return params === undefined ? sqliteDb.prepare(sql).all() : sqliteDb.prepare(sql).all(params);
}
async function get(sql, ...args) {
  const rows = await q(sql, ...args);
  return rows[0];
}
async function run(sql, ...args) {
  const params = norm(args);
  if (USE_PG) {
    let s = sql;
    const m = /^\s*INSERT\s+INTO\s+(\w+)/i.exec(s);
    if (m && m[1].toLowerCase() !== 'settings' && !/RETURNING/i.test(s)) s += ' RETURNING id';
    const { text, values } = expandPg(s, params);
    const client = pgTx || pgPool;
    const r = await client.query(text, values);
    return { lastInsertRowid: r.rows && r.rows[0] ? r.rows[0].id : null, changes: r.rowCount || 0 };
  }
  const r = params === undefined ? sqliteDb.prepare(sql).run() : sqliteDb.prepare(sql).run(params);
  return { lastInsertRowid: r.lastInsertRowid, changes: r.changes };
}
async function exec(sql) {
  if (USE_PG) {
    await (pgTx || pgPool).query(sql);
  } else {
    sqliteDb.exec(sql);
  }
}
async function transaction(fn) {
  if (USE_PG) {
    const client = await pgPool.connect();
    const prev = pgTx;
    pgTx = client;
    try {
      await client.query('BEGIN');
      const result = await fn();
      await client.query('COMMIT');
      return result;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) { /* noop */ }
      throw e;
    } finally {
      pgTx = prev;
      client.release();
    }
  } else {
    sqliteDb.exec('BEGIN');
    try {
      const r = await fn();
      sqliteDb.exec('COMMIT');
      return r;
    } catch (e) {
      try { sqliteDb.exec('ROLLBACK'); } catch (_) { /* noop */ }
      throw e;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  init: open connection, create schema, run migrations              */
/* ------------------------------------------------------------------ */
async function init() {
  if (USE_PG) {
    const { Pool, types } = require('pg');
    // bigint / numeric → JS numbers (COUNT, SUM etc.)
    types.setTypeParser(20, v => parseInt(v, 10));
    types.setTypeParser(1700, v => parseFloat(v));
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5
    });
    await pgPool.query('SELECT 1');
    await pgPool.query(PG_SCHEMA);
    await pgPool.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT ''");
    await pgPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email <> ''`);
  } else {
    const Database = require('better-sqlite3');
    const DATA_DIR = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    sqliteDb = new Database(path.join(DATA_DIR, 'automaster.sqlite'));
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
    sqliteDb.exec(SQLITE_SCHEMA);
    const custCols = sqliteDb.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
    if (!custCols.includes('password_hash')) {
      sqliteDb.exec("ALTER TABLE customers ADD COLUMN password_hash TEXT DEFAULT ''");
    }
    sqliteDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email != ''`);
  }
  return module.exports;
}

module.exports = {
  init, q, get, run, exec, transaction,
  get type() { return USE_PG ? 'pg' : 'sqlite'; }
};
