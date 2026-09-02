/**
 * PLUS 233 AUTOMASTER — Express server
 * -------------------------------------
 * Serves the storefront + REST API.
 * Database: PostgreSQL when DATABASE_URL is set (survives restarts),
 * otherwise SQLite (local dev / fallback).
 * - Public:  /api/products, /api/categories, /api/vehicles, /api/parts/find, /api/orders
 * - Customer: /api/auth/* (register / sign-in / profile / orders)
 * - Admin:   /api/admin/* (token-authenticated) — products, stock, prices, orders,
 *            customers, categories, messages, vehicles, settings
 * In production: add HTTPS, rate limiting and a proper auth provider (see README).
 */
'use strict';
const path = require('path');
const express = require('express');
const crypto = require('crypto');
const db = require('./db/database');
const { seed, hashPassword } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Graceful image fallback: until real product photos exist, serve branded placeholders.
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/images', (req, res) => res.sendFile(path.join(__dirname, 'public', 'images', 'placeholder-part.svg')));

/* ---------------------------------------------------------------- */
/*  Helpers                                                          */
/* ---------------------------------------------------------------- */
const S = async (key) => { const r = await db.get('SELECT value FROM settings WHERE key = ?', key); return r ? r.value : ''; };
const settingsAll = async () => {
  const rows = await db.q('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
};

const DEFAULT_LOW_STOCK = 10;
async function lowStockThreshold() {
  const r = await db.get('SELECT value FROM settings WHERE key = ?', 'low_stock_threshold');
  const n = parseInt(r && r.value, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LOW_STOCK;
}

/* Admin serializer — exact stock numbers (admin dashboard only). */
async function productRow(p, withCompat = false) {
  const row = { ...p };
  row.in_stock = p.stock_qty > 0;
  row.stock_status = p.stock_qty <= 0 ? 'out' : (p.stock_qty <= p.low_stock_at ? 'low' : 'in');
  if (withCompat) {
    row.compatibility = await db.q(
      'SELECT make, model, year_start, year_end, engine FROM product_compatibility WHERE product_id = ? ORDER BY make, model', p.id
    );
  }
  return row;
}

/* Customer serializer — never exposes stock quantities, only status labels.
   'low' (Limited Stock) uses the global configurable threshold. */
async function publicProduct(p, thr, withCompat = false) {
  const row = { ...p };
  delete row.stock_qty;
  delete row.low_stock_at;
  row.in_stock = p.stock_qty > 0;
  row.stock_status = p.stock_qty <= 0 ? 'out' : (p.stock_qty <= thr ? 'low' : 'in');
  if (withCompat) {
    row.compatibility = await db.q(
      'SELECT make, model, year_start, year_end, engine FROM product_compatibility WHERE product_id = ? ORDER BY make, model', p.id
    );
  }
  return row;
}

async function getCategory(slug) {
  return db.get('SELECT * FROM categories WHERE slug = ?', slug);
}

/* ---------------------------------------------------------------- */
/*  AUTH (prototype token auth — replace with real auth in prod)     */
/* ---------------------------------------------------------------- */
function makeToken(payload) {
  const b = Buffer.from(JSON.stringify(payload)).toString('base64');
  return b + '.' + crypto.createHash('sha256').update(b + '::pa233').digest('hex').slice(0, 16);
}
function verifyToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if (crypto.createHash('sha256').update(payload + '::pa233').digest('hex').slice(0, 16) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}
function bearerToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
async function authUser(req) {
  const data = verifyToken(bearerToken(req));
  if (!data || (data.scope && data.scope !== 'admin')) return null;
  return db.get('SELECT id, username, full_name, role FROM users WHERE id = ?', data.uid);
}
async function authCustomer(req) {
  const data = verifyToken(bearerToken(req));
  if (!data || data.scope !== 'customer') return null;
  return db.get('SELECT id, name, email, phone, address, city, created_at FROM customers WHERE id = ?', data.uid);
}
async function requireAdmin(req, res, next) {
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

/* ---------------------------------------------------------------- */
/*  PUBLIC API                                                       */
/* ---------------------------------------------------------------- */
app.get('/api/health', async (req, res) => res.json({ ok: true, name: await S('site_name') }));
app.get('/api/settings', async (req, res) => res.json(await settingsAll()));

app.get('/api/categories', async (req, res) => {
  const rows = await db.q(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
    FROM categories c WHERE c.active = 1 ORDER BY c.sort_order
  `);
  res.json(rows);
});

app.get('/api/products', async (req, res) => {
  const { q, category, brand, featured, sort, page = 1, per_page = 12, ids, in_stock } = req.query;
  const where = ['p.active = 1'];
  const params = {};
  const thr = await lowStockThreshold();

  if (ids) {
    const list = String(ids).split(',').map(Number).filter(Boolean);
    if (!list.length) return res.json({ items: [], total: 0, page: 1, pages: 0 });
    const items = await db.q(`SELECT * FROM products WHERE id IN (${list.map(() => '?').join(',')})`, list);
    return res.json({ items: await Promise.all(items.map(p => publicProduct(p, thr))), total: items.length, page: 1, pages: 1 });
  }
  if (q) { where.push('(p.name LIKE @q OR p.part_number LIKE @q OR p.brand LIKE @q OR p.description LIKE @q)'); params.q = `%${q}%`; }
  if (category) {
    const cat = await getCategory(category);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    where.push('p.category_id = @cat'); params.cat = cat.id;
  }
  if (brand) { where.push('p.brand = @brand'); params.brand = String(brand); }
  if (featured === '1') where.push('p.featured = 1');
  if (in_stock === '1') where.push('p.stock_qty > 0');

  const sortMap = {
    'new': 'p.id DESC',
    'price-asc': 'p.price_ghs ASC',
    'price-desc': 'p.price_ghs DESC',
    'name': 'p.name ASC',
    'featured': 'p.featured DESC, p.id ASC'
  };
  const orderBy = sortMap[sort] || 'p.id DESC';
  const p = Math.max(1, parseInt(page) || 1);
  const pp = Math.min(48, Math.max(1, parseInt(per_page) || 12));

  const total = (await db.get(`SELECT COUNT(*) c FROM products p WHERE ${where.join(' AND ')}`, params)).c;
  const rows = await db.q(`SELECT p.* FROM products p WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ${pp} OFFSET ${(p - 1) * pp}`, params);
  const brands = await db.q(`SELECT DISTINCT p.brand FROM products p WHERE ${where.join(' AND ')} ORDER BY p.brand`, params);

  res.json({
    items: await Promise.all(rows.map(r => publicProduct(r, thr))),
    total, page: p, pages: Math.max(1, Math.ceil(total / pp)),
    category: category ? await getCategory(category) : null,
    brands: brands.map(b => b.brand)
  });
});

app.get('/api/products/:id', async (req, res) => {
  const p = await db.get('SELECT * FROM products WHERE id = ? AND active = 1', +req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const thr = await lowStockThreshold();
  const row = await publicProduct(p, thr, true);
  row.category = await db.get('SELECT * FROM categories WHERE id = ?', p.category_id);
  const rel = await db.q('SELECT * FROM products WHERE category_id = ? AND id != ? AND active = 1 ORDER BY featured DESC, id LIMIT 4', p.category_id, p.id);
  row.related = await Promise.all(rel.map(r => publicProduct(r, thr)));
  res.json(row);
});

/* ---------------- vehicles / find parts ---------------- */
app.get('/api/vehicles/makes', async (req, res) => {
  res.json(await db.q('SELECT make, COUNT(*) model_count FROM vehicles GROUP BY make ORDER BY make'));
});
app.get('/api/vehicles/models', async (req, res) => {
  const { make } = req.query;
  if (!make) return res.status(400).json({ error: 'make required' });
  res.json(await db.q('SELECT model, MIN(year_start) AS year_start, MAX(year_end) AS year_end FROM vehicles WHERE make = ? GROUP BY model ORDER BY model', make));
});
app.get('/api/vehicles/engines', async (req, res) => {
  const { make, model, year } = req.query;
  if (!make || !model) return res.status(400).json({ error: 'make and model required' });
  let rows;
  if (year && parseInt(year)) {
    // engines for the generation that covers this model year
    rows = await db.q('SELECT engines FROM vehicles WHERE make = ? AND model = ? AND ? BETWEEN year_start AND year_end', make, model, +year);
  } else {
    rows = await db.q('SELECT engines FROM vehicles WHERE make = ? AND model = ?', make, model);
  }
  const engines = new Set();
  for (const r of rows) for (const e of (r.engines || '').split(',')) if (e) engines.add(e.trim());
  res.json([...engines].sort());
});

app.post('/api/parts/find', async (req, res) => {
  const { make, model, year, engine } = req.body || {};
  if (!make || !model || !year) return res.status(400).json({ error: 'make, model and year are required' });

  const yearN = parseInt(year) || 0;
  const rows = await db.q(`
    SELECT DISTINCT p.* FROM products p
    JOIN product_compatibility c ON c.product_id = p.id
    WHERE p.active = 1 AND (
      (c.make = ? AND c.model = ? AND ? BETWEEN c.year_start AND c.year_end
        AND (c.engine = '' OR c.engine LIKE '%' || ? || '%' OR ? = ''))
      OR c.make = 'Universal'
    )
  `, make, model, yearN, engine || '', engine || '');

  const thr = await lowStockThreshold();
  const items = await Promise.all(rows.map(r => publicProduct(r, thr)));
  res.json({
    make, model, year: yearN, engine: engine || '',
    total: items.length,
    items,
    universal_count: items.filter(i => i.compatibility && i.compatibility.some(c => c.make === 'Universal')).length
  });
});

/* ---------------- orders / checkout ---------------- */
app.post('/api/orders', async (req, res) => {
  const { items, customer, delivery } = req.body || {};
  if (!items || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'No items in order' });
  if (!customer || !customer.name || !customer.phone || !customer.address || !customer.city)
    return res.status(400).json({ error: 'Customer details are required' });

  try {
    const result = await db.transaction(async () => {
      // resolve items & validate stock
      const lines = [];
      for (const it of items) {
        const p = await db.get('SELECT * FROM products WHERE id = ? AND active = 1', +it.id);
        if (!p) throw Object.assign(new Error(`Product #${it.id} not found`), { status: 400 });
        const qty = Math.max(1, parseInt(it.qty) || 1);
        if (p.stock_qty < qty) throw Object.assign(new Error(`Not enough stock available for ${p.name}. Please reduce the quantity and try again.`), { status: 409 });
        lines.push({ product: p, qty });
      }

      // customer: prefer signed-in account → else match by email → else create guest
      let cust = await authCustomer(req);
      if (!cust && customer.email) {
        cust = await db.get('SELECT id FROM customers WHERE email = ?', String(customer.email).trim().toLowerCase());
      }
      if (!cust) {
        const r = await db.run('INSERT INTO customers (name, email, phone, address, city) VALUES (?,?,?,?,?)',
          customer.name, String(customer.email || '').trim().toLowerCase(), customer.phone, customer.address, customer.city);
        cust = { id: r.lastInsertRowid };
      }

      // pricing from DB settings — never from the client
      const subtotal = lines.reduce((s, l) => s + l.product.price_ghs * l.qty, 0);
      const freeOver = parseFloat(await S('free_delivery_over')) || 0;
      const accraFee = parseFloat(await S('delivery_fee_accra')) || 0;
      const nationFee = parseFloat(await S('delivery_fee_nationwide')) || 0;
      const inAccra = /accra/i.test(customer.city);
      const deliveryFee = subtotal >= freeOver ? 0 : (inAccra ? accraFee : nationFee);

      const orderNumber = 'PA-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
        String(Date.now() % 100000).padStart(5, '0');

      const r = await db.run(`INSERT INTO orders (order_number, customer_id, customer_name, customer_phone, customer_email, address, city, payment_method, payment_status, status, subtotal_ghs, delivery_ghs, total_ghs, notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        orderNumber, cust.id, customer.name, customer.phone, customer.email || '', customer.address, customer.city,
        delivery && delivery.payment_method ? delivery.payment_method : 'Cash on Delivery',
        'Pending', 'Pending', subtotal, deliveryFee, subtotal + deliveryFee,
        (delivery && delivery.notes) || '');

      for (const l of lines) {
        await db.run('INSERT INTO order_items (order_id, product_id, product_name, part_number, unit_price_ghs, qty) VALUES (?,?,?,?,?,?)',
          r.lastInsertRowid, l.product.id, l.product.name, l.product.part_number, l.product.price_ghs, l.qty);
        await db.run('UPDATE products SET stock_qty = stock_qty - ?, updated_at = datetime(\'now\') WHERE id = ?', l.qty, l.product.id);
      }
      return { id: r.lastInsertRowid, order_number: orderNumber };
    });

    const order = await db.get('SELECT * FROM orders WHERE id = ?', result.id);
    order.items = await db.q('SELECT * FROM order_items WHERE order_id = ?', order.id);
    res.status(201).json(order);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get('/api/orders/:orderNumber', async (req, res) => {
  const o = await db.get('SELECT * FROM orders WHERE order_number = ?', req.params.orderNumber);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.items = await db.q('SELECT * FROM order_items WHERE order_id = ?', o.id);
  res.json(o);
});

/* ---------------- contact messages ---------------- */
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};
  if (!name || !message) return res.status(400).json({ error: 'Name and message are required' });
  await db.run('INSERT INTO messages (name, email, phone, subject, message) VALUES (?,?,?,?,?)',
    name, email || '', phone || '', subject || '', message);
  res.status(201).json({ ok: true });
});

/* ---------------------------------------------------------------- */
/*  ADMIN API                                                        */
/* ---------------------------------------------------------------- */
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = await db.get('SELECT * FROM users WHERE username = ?', username || '');
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const [salt, hash] = user.password_hash.split(':');
  const test = crypto.createHash('sha256').update(salt + password).digest('hex');
  if (test !== hash) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: makeToken({ uid: user.id, scope: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 }), user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
});

/* ---------------------------------------------------------------- */
/*  CUSTOMER ACCOUNTS (registration / sign-in / profile / orders)    */
/* ---------------------------------------------------------------- */
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const em = String(email).trim().toLowerCase();
  const exists = await db.get('SELECT id FROM customers WHERE email = ?', em);
  if (exists) return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
  const r = await db.run('INSERT INTO customers (name, email, phone, address, city, password_hash) VALUES (?,?,?,?,?,?)',
    String(name).trim(), em, String(phone || '').trim(), '', '', hashPassword(String(password)));
  const user = await db.get('SELECT id, name, email, phone, address, city, created_at FROM customers WHERE id = ?', r.lastInsertRowid);
  res.status(201).json({ token: makeToken({ uid: user.id, scope: 'customer', exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }), user });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  const cust = await db.get('SELECT * FROM customers WHERE email = ?', em);
  if (!cust || !cust.password_hash) return res.status(401).json({ error: 'Invalid email or password' });
  const [salt, hash] = cust.password_hash.split(':');
  if (crypto.createHash('sha256').update(salt + String(password || '')).digest('hex') !== hash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const user = { id: cust.id, name: cust.name, email: cust.email, phone: cust.phone, address: cust.address, city: cust.city, created_at: cust.created_at };
  res.json({ token: makeToken({ uid: cust.id, scope: 'customer', exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }), user });
});

app.get('/api/auth/me', async (req, res) => {
  const cust = await authCustomer(req);
  if (!cust) return res.status(401).json({ error: 'Not signed in' });
  cust.orders = await db.q(`SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) item_count
    FROM orders o WHERE o.customer_id = ? ORDER BY o.id DESC LIMIT 20`, cust.id);
  res.json(cust);
});

app.put('/api/auth/me', async (req, res) => {
  const cust = await authCustomer(req);
  if (!cust) return res.status(401).json({ error: 'Not signed in' });
  const { name, phone, address, city } = req.body || {};
  await db.run('UPDATE customers SET name=?, phone=?, address=?, city=? WHERE id=?',
    String(name || cust.name).trim(), String(phone || cust.phone).trim(), String(address || cust.address).trim(), String(city || cust.city).trim(), cust.id);
  res.json(await db.get('SELECT id, name, email, phone, address, city, created_at FROM customers WHERE id = ?', cust.id));
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const totals = await db.get(`SELECT COUNT(*) orders, COALESCE(SUM(total_ghs),0) revenue,
    COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Completed') THEN total_ghs END),0) pending_revenue
    FROM orders`);
  const products = (await db.get('SELECT COUNT(*) c FROM products')).c;
  const customers = (await db.get('SELECT COUNT(*) c FROM customers')).c;
  const lowStock = await db.q('SELECT * FROM products WHERE stock_qty <= low_stock_at ORDER BY stock_qty ASC LIMIT 8');
  const recentOrders = await db.q('SELECT * FROM orders ORDER BY id DESC LIMIT 8');
  const byStatus = await db.q('SELECT status, COUNT(*) c FROM orders GROUP BY status');
  const byCategory = await db.q(`SELECT c.name, COUNT(p.id) c FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id ORDER BY c.sort_order`);
  res.json({
    ...totals, products, customers,
    low_stock: await Promise.all(lowStock.map(p => productRow(p))),
    recent_orders: recentOrders, by_status: byStatus, by_category: byCategory
  });
});

/* ---- products CRUD ---- */
app.get('/api/admin/products', requireAdmin, async (req, res) => {
  const { q, category, page = 1, per_page = 20 } = req.query;
  const where = ['1=1']; const params = {};
  if (q) { where.push('(p.name LIKE @q OR p.part_number LIKE @q OR p.brand LIKE @q)'); params.q = `%${q}%`; }
  if (category) { where.push('p.category_id = @c'); params.c = +category; }
  const p = Math.max(1, parseInt(page) || 1);
  const total = (await db.get(`SELECT COUNT(*) c FROM products p WHERE ${where.join(' AND ')}`, params)).c;
  const rows = await db.q(`SELECT p.*, c.name category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT ${per_page} OFFSET ${(p - 1) * per_page}`, params);
  res.json({ items: await Promise.all(rows.map(r => productRow(r, true))), total, page: p });
});

function productPayload(body) {
  const { part_number, name, brand, category_id, description, price_ghs, stock_qty, low_stock_at, image_url, featured, active, compatibility } = body;
  if (!part_number || !name || !brand || !category_id || price_ghs === undefined) {
    throw Object.assign(new Error('Missing required fields (part_number, name, brand, category_id, price_ghs)'), { status: 400 });
  }
  if (isNaN(+price_ghs) || +price_ghs < 0) throw Object.assign(new Error('Invalid price'), { status: 400 });
  return {
    part_number: String(part_number).trim(),
    name: String(name).trim(),
    brand: String(brand).trim(),
    category_id: +category_id,
    description: description || '',
    price_ghs: +price_ghs,
    stock_qty: Math.max(0, parseInt(stock_qty) || 0),
    low_stock_at: Math.max(1, parseInt(low_stock_at) || 10),
    image_url: image_url || '',
    featured: featured ? 1 : 0,
    active: active === undefined || active === 1 || active === '1' || active === true ? 1 : 0,
    compatibility: Array.isArray(compatibility) ? compatibility : []
  };
}

async function insertCompat(productId, list) {
  for (const c of list) {
    if (!c.make || !c.model) continue;
    await db.run('INSERT INTO product_compatibility (product_id, make, model, year_start, year_end, engine) VALUES (?,?,?,?,?,?)',
      productId, c.make, c.model, +c.year_start || 0, +c.year_end || 9999, c.engine || '');
  }
}

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const d = productPayload(req.body);
    const r = await db.run(`INSERT INTO products (part_number, name, brand, category_id, description, price_ghs, stock_qty, low_stock_at, image_url, featured, active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      d.part_number, d.name, d.brand, d.category_id, d.description, d.price_ghs, d.stock_qty, d.low_stock_at, d.image_url, d.featured, d.active);
    await insertCompat(r.lastInsertRowid, d.compatibility);
    const p = await db.get('SELECT * FROM products WHERE id = ?', r.lastInsertRowid);
    res.status(201).json(await productRow(p, true));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const d = productPayload(req.body);
    const exists = await db.get('SELECT id FROM products WHERE id = ?', +req.params.id);
    if (!exists) return res.status(404).json({ error: 'Product not found' });
    await db.run(`UPDATE products SET part_number=?, name=?, brand=?, category_id=?, description=?, price_ghs=?, stock_qty=?, low_stock_at=?, image_url=?, featured=?, active=?, updated_at=datetime('now') WHERE id=?`,
      d.part_number, d.name, d.brand, d.category_id, d.description, d.price_ghs, d.stock_qty, d.low_stock_at, d.image_url, d.featured, d.active, exists.id);
    await db.run('DELETE FROM product_compatibility WHERE product_id = ?', exists.id);
    await insertCompat(exists.id, d.compatibility);
    const p = await db.get('SELECT * FROM products WHERE id = ?', exists.id);
    res.json(await productRow(p, true));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const p = await db.get('SELECT * FROM products WHERE id = ?', +req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const row = await productRow(p, true);
  row.category_name = (await db.get('SELECT name FROM categories WHERE id = ?', p.category_id))?.name || '';
  res.json(row);
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  await db.run('DELETE FROM products WHERE id = ?', +req.params.id);
  res.json({ ok: true });
});

app.put('/api/admin/stock/:id', requireAdmin, async (req, res) => {
  const { stock_qty, low_stock_at } = req.body || {};
  await db.run('UPDATE products SET stock_qty = ?, low_stock_at = ?, updated_at = datetime(\'now\') WHERE id = ?',
    Math.max(0, parseInt(stock_qty) || 0), Math.max(1, parseInt(low_stock_at) || 10), +req.params.id);
  res.json({ ok: true });
});

/* ---- categories CRUD ---- */
app.get('/api/admin/categories', requireAdmin, async (req, res) => {
  res.json(await db.q(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) product_count FROM categories c ORDER BY c.sort_order`));
});
app.post('/api/admin/categories', requireAdmin, async (req, res) => {
  const { name, slug, description, image, sort_order } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  const r = await db.run('INSERT INTO categories (name, slug, description, image, sort_order, active) VALUES (?,?,?,?,?,1)',
    name, slug, description || '', image || '', parseInt(sort_order) || 0);
  res.status(201).json(await db.get('SELECT * FROM categories WHERE id = ?', r.lastInsertRowid));
});
app.put('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  const { name, slug, description, image, sort_order, active } = req.body;
  await db.run('UPDATE categories SET name=?, slug=?, description=?, image=?, sort_order=?, active=? WHERE id=?',
    name, slug, description || '', image || '', parseInt(sort_order) || 0, active === undefined ? 1 : (active ? 1 : 0), +req.params.id);
  res.json(await db.get('SELECT * FROM categories WHERE id = ?', +req.params.id));
});
app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  const count = (await db.get('SELECT COUNT(*) c FROM products WHERE category_id = ?', +req.params.id)).c;
  if (count) return res.status(409).json({ error: `Category has ${count} products — move or delete them first` });
  await db.run('DELETE FROM categories WHERE id = ?', +req.params.id);
  res.json({ ok: true });
});

/* ---- orders ---- */
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const { status, q, page = 1 } = req.query;
  const where = ['1=1']; const params = {};
  if (status && status !== 'all') { where.push('o.status = @s'); params.s = status; }
  if (q) { where.push('(o.order_number LIKE @q OR o.customer_name LIKE @q OR o.customer_phone LIKE @q)'); params.q = `%${q}%`; }
  const p = Math.max(1, parseInt(page) || 1);
  const total = (await db.get(`SELECT COUNT(*) c FROM orders o WHERE ${where.join(' AND ')}`, params)).c;
  const rows = await db.q(`SELECT o.* FROM orders o WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT 20 OFFSET ${(p - 1) * 20}`, params);
  const items = await Promise.all(rows.map(async o => ({ ...o, items: await db.q('SELECT * FROM order_items WHERE order_id = ?', o.id) })));
  res.json({ items, total, page: p });
});
app.put('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const { status, payment_status } = req.body || {};
  const o = await db.get('SELECT * FROM orders WHERE id = ?', +req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  await db.run('UPDATE orders SET status = ?, payment_status = ? WHERE id = ?',
    status || o.status, payment_status || o.payment_status, o.id);
  res.json(await db.get('SELECT * FROM orders WHERE id = ?', o.id));
});

/* ---- customers ---- */
app.get('/api/admin/customers', requireAdmin, async (req, res) => {
  res.json(await db.q(`
    SELECT c.id, c.name, c.email, c.phone, c.address, c.city, c.created_at,
           (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) order_count,
           (SELECT COALESCE(SUM(o.total_ghs),0) FROM orders o WHERE o.customer_id = c.id) total_spent
    FROM customers c ORDER BY c.id DESC LIMIT 200`));
});
app.get('/api/admin/customers/:id', requireAdmin, async (req, res) => {
  const c = await db.get('SELECT id, name, email, phone, address, city, created_at FROM customers WHERE id = ?', +req.params.id);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  c.orders = await db.q('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC', c.id);
  res.json(c);
});

/* ---- messages ---- */
app.get('/api/admin/messages', requireAdmin, async (req, res) => {
  res.json(await db.q('SELECT * FROM messages ORDER BY id DESC LIMIT 100'));
});
app.put('/api/admin/messages/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;
  await db.run('UPDATE messages SET status = ? WHERE id = ?', status || 'read', +req.params.id);
  res.json({ ok: true });
});

/* ---- settings ---- */
app.get('/api/admin/settings', requireAdmin, async (req, res) => res.json(await settingsAll()));
app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  await db.transaction(async () => {
    for (const [k, v] of Object.entries(req.body || {})) {
      await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, String(v));
    }
  });
  res.json(await settingsAll());
});

/* ---- vehicles ---- */
app.get('/api/admin/vehicles', requireAdmin, async (req, res) => {
  res.json(await db.q('SELECT * FROM vehicles ORDER BY make, model'));
});
app.post('/api/admin/vehicles', requireAdmin, async (req, res) => {
  const { make, model, year_start, year_end, engines } = req.body;
  if (!make || !model) return res.status(400).json({ error: 'make and model required' });
  const r = await db.run('INSERT INTO vehicles (make, model, year_start, year_end, engines) VALUES (?,?,?,?,?)',
    make, model, +year_start || 0, +year_end || 9999, Array.isArray(engines) ? engines.join(',') : (engines || ''));
  res.status(201).json(await db.get('SELECT * FROM vehicles WHERE id = ?', r.lastInsertRowid));
});
app.delete('/api/admin/vehicles/:id', requireAdmin, async (req, res) => {
  await db.run('DELETE FROM vehicles WHERE id = ?', +req.params.id);
  res.json({ ok: true });
});

/* SPA-ish fallback for unknown /api routes */
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Catch-all → static 404 page
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

/* ---------------------------------------------------------------- */
/*  Boot: init DB (with retries) → seed if empty → sync admin → listen */
/* ---------------------------------------------------------------- */
// A rejected promise in an Express 4 async handler must never take the
// whole site down — log it and keep serving (the pool reconnects).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.stack ? err.stack : err);
});

async function initWithRetry(attempts, delays) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      await db.init();
      return;
    } catch (e) {
      lastErr = e;
      console.error(`DB init attempt ${i}/${attempts} failed: ${e.message}`);
      if (i < attempts) {
        const wait = delays[i - 1] || 15000;
        console.log(`Retrying in ${Math.round(wait / 1000)}s…`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

(async () => {
  try {
    // Retry so a sleeping/cold-starting Neon compute doesn't fail the boot.
    await initWithRetry(6, [5000, 10000, 20000, 30000, 45000]);
    console.log(`Database engine: ${db.type}`);

    if ((await db.get('SELECT COUNT(*) c FROM products')).c === 0) {
      await seed();
    }

    // Admin credentials from environment variables (production setup).
    // If ADMIN_USERNAME / ADMIN_PASSWORD are set in the hosting dashboard,
    // they override the seeded defaults on EVERY boot — so credentials
    // survive restarts even on ephemeral disks.
    const uname = (process.env.ADMIN_USERNAME || '').trim();
    const pass = process.env.ADMIN_PASSWORD || '';
    if (uname && pass) {
      const existing = await db.get('SELECT id FROM users WHERE username = ?', uname);
      if (existing) {
        await db.run('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?', hashPassword(pass), existing.id);
      } else {
        await db.run('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)', uname, hashPassword(pass), 'Store Administrator', 'admin');
        if (uname !== 'admin') {
          await db.run('DELETE FROM users WHERE username = ?', 'admin');
        }
      }
      console.log(`Admin credentials synchronized from environment variables (username: "${uname}")`);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`PLUS 233 AUTOMASTER running → http://0.0.0.0:${PORT}`);
    });
  } catch (e) {
    console.error('Startup failed:', e);
    process.exit(1);
  }
})();
