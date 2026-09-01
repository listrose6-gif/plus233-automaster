/**
 * PLUS 233 AUTOMASTER — Express server
 * -------------------------------------
 * Serves the storefront + REST API backed by SQLite.
 * - Public:  /api/products, /api/categories, /api/vehicles, /api/parts/find, /api/orders
 * - Admin:   /api/admin/* (token-authenticated) — products, stock, prices, orders,
 *            customers, categories, messages, vehicles, settings
 * In production: swap the SQLite layer for PostgreSQL/MongoDB, add HTTPS,
 * rate limiting and a proper auth provider (see README).
 */
'use strict';
const path = require('path');
const express = require('express');
const crypto = require('crypto');
const db = require('./db/database');
const { seed } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Auto-seed on first boot
if (db.prepare('SELECT COUNT(*) c FROM products').get().c === 0) {
  seed();
}

// Admin credentials from environment variables (production setup).
// If ADMIN_USERNAME / ADMIN_PASSWORD are set in the hosting dashboard,
// they override the seeded defaults on EVERY boot — so credentials
// survive restarts even on ephemeral disks. The seeded 'admin/admin123'
// user is removed when a custom username is configured.
function syncAdminFromEnv() {
  const uname = (process.env.ADMIN_USERNAME || '').trim();
  const pass = process.env.ADMIN_PASSWORD || '';
  if (!uname || !pass) return; // no env config → keep seeded credentials
  const { hashPassword } = require('./db/seed');
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(uname);
  if (existing) {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(hashPassword(pass), existing.id);
  } else {
    db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)')
      .run(uname, hashPassword(pass), 'Store Administrator', 'admin');
    if (uname !== 'admin') {
      db.prepare('DELETE FROM users WHERE username = ?').run('admin');
    }
  }
  console.log(`Admin credentials synchronized from environment variables (username: "${uname}")`);
}
syncAdminFromEnv();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Graceful image fallback: until real product photos exist, serve branded placeholders.
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/images', (req, res) => res.sendFile(path.join(__dirname, 'public', 'images', 'placeholder-part.svg')));

/* ---------------------------------------------------------------- */
/*  Helpers                                                          */
/* ---------------------------------------------------------------- */
const S = (key) => { const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key); return r ? r.value : ''; };
const settingsAll = () => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
};

function productRow(p, withCompat = false) {
  const row = { ...p };
  row.in_stock = p.stock_qty > 0;
  row.stock_status = p.stock_qty <= 0 ? 'out' : (p.stock_qty <= p.low_stock_at ? 'low' : 'in');
  if (withCompat) {
    row.compatibility = db.prepare(
      'SELECT make, model, year_start, year_end, engine FROM product_compatibility WHERE product_id = ? ORDER BY make, model'
    ).all(p.id);
  }
  delete row.low_stock_at;
  return row;
}

function getCategory(slug) {
  return db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
}

/* ---------------------------------------------------------------- */
/*  AUTH (prototype token auth — replace with real auth in prod)     */
/* ---------------------------------------------------------------- */
function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ uid: user.id, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString('base64');
  return payload + '.' + crypto.createHash('sha256').update(payload + '::pa233').digest('hex').slice(0, 16);
}
function authUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if (crypto.createHash('sha256').update(payload + '::pa233').digest('hex').slice(0, 16) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (data.exp < Date.now()) return null;
    return db.prepare('SELECT id, username, full_name, role FROM users WHERE id = ?').get(data.uid);
  } catch { return null; }
}
function requireAdmin(req, res, next) {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

/* ---------------------------------------------------------------- */
/*  PUBLIC API                                                       */
/* ---------------------------------------------------------------- */
app.get('/api/health', (req, res) => res.json({ ok: true, name: S('site_name') }));
app.get('/api/settings', (req, res) => res.json(settingsAll()));

app.get('/api/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
    FROM categories c WHERE c.active = 1 ORDER BY c.sort_order
  `).all();
  res.json(rows);
});

app.get('/api/products', (req, res) => {
  const { q, category, brand, featured, sort, page = 1, per_page = 12, ids, in_stock } = req.query;
  const where = ['p.active = 1'];
  const params = {};

  if (ids) {
    const list = String(ids).split(',').map(Number).filter(Boolean);
    if (!list.length) return res.json({ items: [], total: 0, page: 1, pages: 0 });
    const items = db.prepare(`SELECT * FROM products WHERE id IN (${list.map(() => '?').join(',')})`).all(...list)
      .map(p => productRow(p));
    return res.json({ items, total: items.length, page: 1, pages: 1 });
  }
  if (q) { where.push('(p.name LIKE @q OR p.part_number LIKE @q OR p.brand LIKE @q OR p.description LIKE @q)'); params.q = `%${q}%`; }
  if (category) {
    const cat = getCategory(category);
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

  const total = db.prepare(`SELECT COUNT(*) c FROM products p WHERE ${where.join(' AND ')}`).get(params).c;
  const rows = db.prepare(`SELECT p.* FROM products p WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ${pp} OFFSET ${(p - 1) * pp}`).all(params);

  const brands = db.prepare(`SELECT DISTINCT p.brand FROM products p WHERE ${where.join(' AND ')} ORDER BY p.brand`).all(params);
  res.json({
    items: rows.map(r => productRow(r)),
    total, page: p, pages: Math.max(1, Math.ceil(total / pp)),
    category: category ? getCategory(category) : null,
    brands: brands.map(b => b.brand)
  });
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const row = productRow(p, true);
  row.category = db.prepare('SELECT * FROM categories WHERE id = ?').get(p.category_id);
  row.related = db.prepare('SELECT * FROM products WHERE category_id = ? AND id != ? AND active = 1 ORDER BY featured DESC, id LIMIT 4')
    .all(p.category_id, p.id).map(r => productRow(r));
  res.json(row);
});

/* ---------------- vehicles / find parts ---------------- */
app.get('/api/vehicles/makes', (req, res) => {
  const rows = db.prepare('SELECT make, COUNT(*) model_count FROM vehicles GROUP BY make ORDER BY make').all();
  res.json(rows);
});
app.get('/api/vehicles/models', (req, res) => {
  const { make } = req.query;
  if (!make) return res.status(400).json({ error: 'make required' });
  res.json(db.prepare('SELECT DISTINCT model, year_start, year_end FROM vehicles WHERE make = ? ORDER BY model').all(make));
});
app.get('/api/vehicles/engines', (req, res) => {
  const { make, model } = req.query;
  if (!make || !model) return res.status(400).json({ error: 'make and model required' });
  const rows = db.prepare('SELECT engines FROM vehicles WHERE make = ? AND model = ?').all(make, model);
  const engines = new Set();
  for (const r of rows) for (const e of (r.engines || '').split(',')) if (e) engines.add(e.trim());
  res.json([...engines].sort());
});

app.post('/api/parts/find', (req, res) => {
  const { make, model, year, engine } = req.body || {};
  if (!make || !model || !year) return res.status(400).json({ error: 'make, model and year are required' });

  const yearN = parseInt(year) || 0;
  const rows = db.prepare(`
    SELECT DISTINCT p.* FROM products p
    JOIN product_compatibility c ON c.product_id = p.id
    WHERE p.active = 1 AND (
      (c.make = ? AND c.model = ? AND ? BETWEEN c.year_start AND c.year_end
        AND (c.engine = '' OR c.engine LIKE '%' || ? || '%' OR ? = ''))
      OR c.make = 'Universal'
    )
  `).all(make, model, yearN, engine || '', engine || '');

  const items = rows.map(r => productRow(r));
  res.json({
    make, model, year: yearN, engine: engine || '',
    total: items.length,
    items,
    universal_count: items.filter(i => i.compatibility && i.compatibility.some(c => c.make === 'Universal')).length
  });
});

/* ---------------- orders / checkout ---------------- */
app.post('/api/orders', (req, res) => {
  const { items, customer, delivery } = req.body || {};
  if (!items || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'No items in order' });
  if (!customer || !customer.name || !customer.phone || !customer.address || !customer.city)
    return res.status(400).json({ error: 'Customer details are required' });

  const tx = db.transaction(() => {
    // resolve items & validate stock
    const lines = [];
    for (const it of items) {
      const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(+it.id);
      if (!p) throw Object.assign(new Error(`Product #${it.id} not found`), { status: 400 });
      const qty = Math.max(1, parseInt(it.qty) || 1);
      if (p.stock_qty < qty) throw Object.assign(new Error(`Insufficient stock for ${p.name} (only ${p.stock_qty} left)`), { status: 409 });
      lines.push({ product: p, qty });
    }

    // customer (upsert by email+phone)
    let cust = null;
    if (customer.email) {
      cust = db.prepare('SELECT * FROM customers WHERE email = ? AND phone = ?').get(customer.email, customer.phone);
    }
    if (!cust) {
      const r = db.prepare('INSERT INTO customers (name, email, phone, address, city) VALUES (?,?,?,?,?)')
        .run(customer.name, customer.email || '', customer.phone, customer.address, customer.city);
      cust = { id: r.lastInsertRowid };
    }

    // pricing from DB settings — never from the client
    const subtotal = lines.reduce((s, l) => s + l.product.price_ghs * l.qty, 0);
    const freeOver = parseFloat(S('free_delivery_over')) || 0;
    const accraFee = parseFloat(S('delivery_fee_accra')) || 0;
    const nationFee = parseFloat(S('delivery_fee_nationwide')) || 0;
    const inAccra = /accra/i.test(customer.city);
    let deliveryFee = subtotal >= freeOver ? 0 : (inAccra ? accraFee : nationFee);

    const orderNumber = 'PA-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
      String(Date.now() % 100000).padStart(5, '0');

    const r = db.prepare(`INSERT INTO orders (order_number, customer_id, customer_name, customer_phone, customer_email, address, city, payment_method, payment_status, status, subtotal_ghs, delivery_ghs, total_ghs, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(orderNumber, cust.id, customer.name, customer.phone, customer.email || '', customer.address, customer.city,
        delivery && delivery.payment_method ? delivery.payment_method : 'Cash on Delivery',
        'Pending', 'Pending', subtotal, deliveryFee, subtotal + deliveryFee,
        (delivery && delivery.notes) || '');

    const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, part_number, unit_price_ghs, qty) VALUES (?,?,?,?,?,?)');
    const decStock = db.prepare('UPDATE products SET stock_qty = stock_qty - ?, updated_at = datetime(\'now\') WHERE id = ?');
    for (const l of lines) {
      insItem.run(r.lastInsertRowid, l.product.id, l.product.name, l.product.part_number, l.product.price_ghs, l.qty);
      decStock.run(l.qty, l.product.id);
    }
    return { id: r.lastInsertRowid, order_number: orderNumber };
  });

  try {
    const result = tx();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.id);
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.status(201).json(order);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get('/api/orders/:orderNumber', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  res.json(o);
});

/* ---------------- contact messages ---------------- */
app.post('/api/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};
  if (!name || !message) return res.status(400).json({ error: 'Name and message are required' });
  db.prepare('INSERT INTO messages (name, email, phone, subject, message) VALUES (?,?,?,?,?)')
    .run(name, email || '', phone || '', subject || '', message);
  res.status(201).json({ ok: true });
});

/* ---------------------------------------------------------------- */
/*  ADMIN API                                                        */
/* ---------------------------------------------------------------- */
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username || '');
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const [salt, hash] = user.password_hash.split(':');
  const test = crypto.createHash('sha256').update(salt + password).digest('hex');
  if (test !== hash) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: makeToken(user), user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const totals = db.prepare(`SELECT COUNT(*) orders, COALESCE(SUM(total_ghs),0) revenue,
    COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled','Completed') THEN total_ghs END),0) pending_revenue
    FROM orders`).get();
  const products = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  const customers = db.prepare('SELECT COUNT(*) c FROM customers').get().c;
  const lowStock = db.prepare('SELECT * FROM products WHERE stock_qty <= low_stock_at ORDER BY stock_qty ASC LIMIT 8').all().map(p => productRow(p));
  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 8').all();
  const byStatus = db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all();
  const byCategory = db.prepare(`SELECT c.name, COUNT(p.id) c FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id ORDER BY c.sort_order`).all();
  res.json({ ...totals, products, customers, low_stock: lowStock, recent_orders: recentOrders, by_status: byStatus, by_category: byCategory });
});

/* ---- products CRUD ---- */
app.get('/api/admin/products', requireAdmin, (req, res) => {
  const { q, category, page = 1, per_page = 20 } = req.query;
  const where = ['1=1']; const params = {};
  if (q) { where.push('(p.name LIKE @q OR p.part_number LIKE @q OR p.brand LIKE @q)'); params.q = `%${q}%`; }
  if (category) { where.push('p.category_id = @c'); params.c = +category; }
  const p = Math.max(1, parseInt(page) || 1);
  const total = db.prepare(`SELECT COUNT(*) c FROM products p WHERE ${where.join(' AND ')}`).get(params).c;
  const rows = db.prepare(`SELECT p.*, c.name category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT ${per_page} OFFSET ${(p - 1) * per_page}`).all(params);
  res.json({ items: rows.map(r => productRow(r, true)), total, page: p });
});

function productPayload(body, withId) {
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

app.post('/api/admin/products', requireAdmin, (req, res) => {
  try {
    const d = productPayload(req.body);
    const r = db.prepare(`INSERT INTO products (part_number, name, brand, category_id, description, price_ghs, stock_qty, low_stock_at, image_url, featured, active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(d.part_number, d.name, d.brand, d.category_id, d.description, d.price_ghs, d.stock_qty, d.low_stock_at, d.image_url, d.featured, d.active);
    const insC = db.prepare('INSERT INTO product_compatibility (product_id, make, model, year_start, year_end, engine) VALUES (?,?,?,?,?,?)');
    for (const c of d.compatibility) {
      insC.run(r.lastInsertRowid, c.make, c.model, +c.year_start || 0, +c.year_end || 9999, c.engine || '');
    }
    res.status(201).json(productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid), true));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const d = productPayload(req.body);
    const exists = db.prepare('SELECT id FROM products WHERE id = ?').get(+req.params.id);
    if (!exists) return res.status(404).json({ error: 'Product not found' });
    db.prepare(`UPDATE products SET part_number=?, name=?, brand=?, category_id=?, description=?, price_ghs=?, stock_qty=?, low_stock_at=?, image_url=?, featured=?, active=?, updated_at=datetime('now') WHERE id=?`)
      .run(d.part_number, d.name, d.brand, d.category_id, d.description, d.price_ghs, d.stock_qty, d.low_stock_at, d.image_url, d.featured, d.active, exists.id);
    db.prepare('DELETE FROM product_compatibility WHERE product_id = ?').run(exists.id);
    const insC = db.prepare('INSERT INTO product_compatibility (product_id, make, model, year_start, year_end, engine) VALUES (?,?,?,?,?,?)');
    for (const c of d.compatibility) {
      if (!c.make || !c.model) continue;
      insC.run(exists.id, c.make, c.model, +c.year_start || 0, +c.year_end || 9999, c.engine || '');
    }
    res.json(productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(exists.id), true));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/api/admin/products/:id', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const row = productRow(p, true);
  row.category_name = db.prepare('SELECT name FROM categories WHERE id = ?').get(p.category_id)?.name || '';
  res.json(row);
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(+req.params.id);
  res.json({ ok: true });
});

app.put('/api/admin/stock/:id', requireAdmin, (req, res) => {
  const { stock_qty, low_stock_at } = req.body || {};
  db.prepare('UPDATE products SET stock_qty = ?, low_stock_at = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(Math.max(0, parseInt(stock_qty) || 0), Math.max(1, parseInt(low_stock_at) || 10), +req.params.id);
  res.json({ ok: true });
});

/* ---- categories CRUD ---- */
app.get('/api/admin/categories', requireAdmin, (req, res) => {
  res.json(db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) product_count FROM categories c ORDER BY c.sort_order`).all());
});
app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const { name, slug, description, image, sort_order } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  const r = db.prepare('INSERT INTO categories (name, slug, description, image, sort_order, active) VALUES (?,?,?,?,?,1)')
    .run(name, slug, description || '', image || '', parseInt(sort_order) || 0);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(r.lastInsertRowid));
});
app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const { name, slug, description, image, sort_order, active } = req.body;
  db.prepare('UPDATE categories SET name=?, slug=?, description=?, image=?, sort_order=?, active=? WHERE id=?')
    .run(name, slug, description || '', image || '', parseInt(sort_order) || 0, active === undefined ? 1 : (active ? 1 : 0), +req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(+req.params.id));
});
app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) c FROM products WHERE category_id = ?').get(+req.params.id).c;
  if (count) return res.status(409).json({ error: `Category has ${count} products — move or delete them first` });
  db.prepare('DELETE FROM categories WHERE id = ?').run(+req.params.id);
  res.json({ ok: true });
});

/* ---- orders ---- */
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const { status, q, page = 1 } = req.query;
  const where = ['1=1']; const params = {};
  if (status && status !== 'all') { where.push('o.status = @s'); params.s = status; }
  if (q) { where.push('(o.order_number LIKE @q OR o.customer_name LIKE @q OR o.customer_phone LIKE @q)'); params.q = `%${q}%`; }
  const p = Math.max(1, parseInt(page) || 1);
  const total = db.prepare(`SELECT COUNT(*) c FROM orders o WHERE ${where.join(' AND ')}`).get(params).c;
  const rows = db.prepare(`SELECT o.* FROM orders o WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT 20 OFFSET ${(p - 1) * 20}`).all(params);
  const items = rows.map(o => ({ ...o, items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id) }));
  res.json({ items: items, total, page: p });
});
app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status, payment_status } = req.body || {};
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(+req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  db.prepare('UPDATE orders SET status = ?, payment_status = ? WHERE id = ?')
    .run(status || o.status, payment_status || o.payment_status, o.id);
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id));
});

/* ---- customers ---- */
app.get('/api/admin/customers', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) order_count,
           (SELECT COALESCE(SUM(o.total_ghs),0) FROM orders o WHERE o.customer_id = c.id) total_spent
    FROM customers c ORDER BY c.id DESC LIMIT 200`).all();
  res.json(rows);
});
app.get('/api/admin/customers/:id', requireAdmin, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(+req.params.id);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  c.orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC').all(c.id);
  res.json(c);
});

/* ---- messages ---- */
app.get('/api/admin/messages', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 100').all());
});
app.put('/api/admin/messages/:id', requireAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status || 'read', +req.params.id);
  res.json({ ok: true });
});

/* ---- settings ---- */
app.get('/api/admin/settings', requireAdmin, (req, res) => res.json(settingsAll()));
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const tx = db.transaction(() => {
    const upd = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [k, v] of Object.entries(req.body || {})) upd.run(k, String(v));
  });
  tx();
  res.json(settingsAll());
});

/* ---- vehicles ---- */
app.get('/api/admin/vehicles', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM vehicles ORDER BY make, model').all());
});
app.post('/api/admin/vehicles', requireAdmin, (req, res) => {
  const { make, model, year_start, year_end, engines } = req.body;
  if (!make || !model) return res.status(400).json({ error: 'make and model required' });
  const r = db.prepare('INSERT INTO vehicles (make, model, year_start, year_end, engines) VALUES (?,?,?,?,?)')
    .run(make, model, +year_start || 0, +year_end || 9999, Array.isArray(engines) ? engines.join(',') : (engines || ''));
  res.status(201).json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(r.lastInsertRowid));
});
app.delete('/api/admin/vehicles/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(+req.params.id);
  res.json({ ok: true });
});

/* SPA-ish fallback for unknown /api routes */
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Catch-all → static 404 page
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PLUS 233 AUTOMASTER running → http://0.0.0.0:${PORT}`);
});
