/* ==================================================================
   PLUS 233 AUTOMASTER — Admin dashboard
   Manage: products (prices/stock/compatibility), orders, customers,
   categories, messages, vehicles and store settings.
   ================================================================== */
'use strict';
const esc = PA.esc;
const ADMIN_KEY = 'pa233_admin_token';

const api = {
  token: localStorage.getItem(ADMIN_KEY) || '',
  async req(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { logout(); throw new Error('Session expired — sign in again'); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get: (u) => api.req('GET', u),
  post: (u, b) => api.req('POST', u, b),
  put: (u, b) => api.req('PUT', u, b),
  del: (u) => api.req('DELETE', u)
};

function logout() { localStorage.removeItem(ADMIN_KEY); api.token = ''; render(); }

const state = {
  view: 'dashboard',
  products: { q: '', category: '', page: 1 },
  orders: { status: 'all', q: '', page: 1 },
  editingProduct: null
};

/* ================= SHELL ================= */
function shell() {
  const views = [
    ['dashboard', 'Dashboard', PA.icons.home],
    ['products', 'Products', PA.icons.box],
    ['orders', 'Orders', PA.icons.truck],
    ['customers', 'Customers', PA.icons.user],
    ['categories', 'Categories', PA.icons.filter],
    ['messages', 'Messages', PA.icons.chat],
    ['vehicles', 'Vehicles', PA.icons.car],
    ['settings', 'Settings', PA.icons.gear]
  ];
  document.getElementById('admin-app').innerHTML = `
    <div class="admin-shell">
      <aside class="admin-side">
        <a class="logo" href="/">
          <img class="logo-img" src="/images/logo.png" alt="logo">
          <span class="logo-text">
            <span class="logo-name" style="font-size:.86rem">PLUS <span>233</span> AUTOMASTER</span>
            <span class="logo-sub">Admin Panel</span>
          </span>
        </a>
        <nav class="admin-nav">
          ${views.map(([id, label, ic]) => `<a href="#${id}" class="${state.view === id ? 'active' : ''}" data-view="${id}">${ic}<span>${label}</span></a>`).join('')}
        </nav>
        <div style="margin-top:auto;display:grid;gap:8px;padding-top:14px;border-top:1px solid var(--border)">
          <a class="mini-btn" href="/" target="_blank" style="text-align:center">View Store</a>
          <button class="mini-btn danger" id="admin-logout">Sign Out</button>
        </div>
      </aside>
      <main class="admin-main">
        <div class="admin-top">
          <div>
            <h1 id="view-title">Dashboard</h1>
            <div class="who" id="view-sub"></div>
          </div>
          <button class="mini-btn" id="refresh-btn">↻ Refresh</button>
        </div>
        <div id="view-content"></div>
      </main>
    </div>
    <div class="modal-backdrop" id="modal"></div>`;
  document.querySelectorAll('.admin-nav a').forEach(a => a.addEventListener('click', () => {
    state.view = a.dataset.view;
    document.querySelectorAll('.admin-nav a').forEach(x => x.classList.toggle('active', x === a));
    renderView();
  }));
  document.getElementById('admin-logout').addEventListener('click', logout);
  document.getElementById('refresh-btn').addEventListener('click', renderView);
  renderView();
}

async function renderView() {
  const titles = {
    dashboard: ['Dashboard', 'Store overview — orders, revenue and stock alerts'],
    products: ['Products', 'Prices, stock and vehicle compatibility — all managed here'],
    orders: ['Orders', 'Confirm, process and fulfil customer orders'],
    customers: ['Customers', 'Your customer base and order history'],
    categories: ['Categories', 'Organise your catalogue'],
    messages: ['Messages', 'Enquiries from the contact form'],
    vehicles: ['Vehicles', 'Vehicle catalogue for the Find Parts selector'],
    settings: ['Settings', 'Store details, contact info and delivery fees']
  };
  document.getElementById('view-title').textContent = titles[state.view][0];
  document.getElementById('view-sub').textContent = titles[state.view][1];
  const box = document.getElementById('view-content');
  box.innerHTML = '<p style="color:var(--muted)">Loading…</p>';
  try {
    ({ dashboard: vDashboard, products: vProducts, orders: vOrders, customers: vCustomers,
       categories: vCategories, messages: vMessages, vehicles: vVehicles, settings: vSettings })[state.view](box);
  } catch (e) {
    box.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
  }
}

function openModal(html, onMount) {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="modal">${html}</div>`;
  m.classList.add('open');
  m.addEventListener('click', e => { if (e.target === m) closeModal(); });
  onMount && onMount(m);
}
function closeModal() { document.getElementById('modal').classList.remove('open'); document.getElementById('modal').innerHTML = ''; }
function modalFoot(primaryLabel, onPrimary) {
  return `<div class="modal-foot">
    <button class="mini-btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" id="modal-primary">${primaryLabel}</button>
  </div>`;
}

/* ================= DASHBOARD ================= */
async function vDashboard(box) {
  const d = await api.get('/api/admin/stats');
  const fmt = PA.fmt;
  box.innerHTML = `
    <div class="admin-grid">
      <div class="stat-card"><div class="st-label">Total Orders</div><div class="st-value">${d.orders}</div></div>
      <div class="stat-card"><div class="st-label">Revenue</div><div class="st-value blue">${fmt(d.revenue)}</div></div>
      <div class="stat-card"><div class="st-label">Pending Value</div><div class="st-value">${fmt(d.pending_revenue)}</div></div>
      <div class="stat-card"><div class="st-label">Products</div><div class="st-value">${d.products}</div></div>
      <div class="stat-card"><div class="st-label">Customers</div><div class="st-value green">${d.customers}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:18px" class="admin-two">
      <div class="admin-panel">
        <h2>Recent Orders <span class="badge">${d.recent_orders.length}</span></h2>
        <table class="admin-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${d.recent_orders.map(o => `<tr>
              <td class="t-part">${esc(o.order_number)}</td>
              <td>${esc(o.customer_name)}</td>
              <td><b>${fmt(o.total_ghs)}</b></td>
              <td><span class="tag ${statusTag(o.status)}">${esc(o.status)}</span></td>
              <td class="t-muted">${esc(String(o.created_at).slice(0, 10))}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="t-muted">No orders yet</td></tr>'}
          </tbody>
        </table>
      </div>
      <div>
        <div class="admin-panel">
          <h2>Low Stock Alerts <span class="badge danger">${d.low_stock.length}</span></h2>
          <table class="admin-table">
            <thead><tr><th>Product</th><th>Stock</th><th></th></tr></thead>
            <tbody>
              ${d.low_stock.map(p => `<tr>
                <td><div class="t-prod-name" style="font-size:.82rem">${esc(p.name)}</div><div class="t-part">${esc(p.part_number)}</div></td>
                <td><span class="tag ${p.stock_qty === 0 ? 'tag-red' : 'tag-warn'}">${p.stock_qty} left</span></td>
                <td><button class="mini-btn" data-restock="${p.id}">Restock</button></td>
              </tr>`).join('') || '<tr><td colspan="3" class="t-muted">All stock levels healthy ✓</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="admin-panel">
          <h2>Orders by Status</h2>
          <div style="display:grid;gap:8px">
            ${d.by_status.map(s => `<div style="display:flex;justify-content:space-between;font-size:.86rem"><span>${esc(s.status)}</span><b>${s.c}</b></div>`).join('') || '<span class="t-muted">No data</span>'}
          </div>
        </div>
      </div>
    </div>`;
  box.querySelectorAll('[data-restock]').forEach(b => b.addEventListener('click', () => {
    state.editingProduct = +b.dataset.restock;
    openRestock(+b.dataset.restock);
  }));
}

/* ================= PRODUCTS ================= */
async function vProducts(box) {
  const qs = new URLSearchParams();
  if (state.products.q) qs.set('q', state.products.q);
  if (state.products.category) qs.set('category', state.products.category);
  qs.set('page', state.products.page);
  const [d, cats] = await Promise.all([api.get('/api/admin/products?' + qs), api.get('/api/admin/categories')]);

  box.innerHTML = `
    <div class="admin-panel">
      <h2>All Products <span class="badge">${d.total}</span></h2>
      <div class="admin-toolbar">
        <input class="grow" id="p-q" placeholder="Search name, part number, brand…" value="${esc(state.products.q)}">
        <select id="p-cat">
          <option value="">All categories</option>
          ${cats.map(c => `<option value="${c.id}" ${+state.products.category === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" id="p-add">+ New Product</button>
      </div>
      <table class="admin-table">
        <thead><tr><th></th><th>Product</th><th>Category</th><th>Price (GH₵)</th><th>Stock</th><th>Featured</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${d.items.map(p => `<tr>
            <td><img class="t-img" src="${p.image_url || '/images/placeholder-part.jpg'}" alt=""></td>
            <td><div class="t-prod-name">${esc(p.name)}</div><div class="t-part">${esc(p.part_number)} · ${esc(p.brand)}</div>
              <div class="t-muted">${(p.compatibility || []).length} compatibility entries</div></td>
            <td class="t-muted">${esc(p.category_name)}</td>
            <td><b>${PA.fmt(p.price_ghs)}</b></td>
            <td><input class="stock-input" data-stock="${p.id}" type="number" value="${p.stock_qty}" min="0" title="Update stock">
              ${p.stock_qty <= p.low_stock_at ? '<span class="tag tag-warn">low</span>' : ''}</td>
            <td>${p.featured ? '★' : '—'}</td>
            <td>${p.active ? '<span class="tag tag-green">active</span>' : '<span class="tag tag-gray">hidden</span>'}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="mini-btn" data-edit="${p.id}">Edit</button>
              <button class="mini-btn danger" data-del="${p.id}">Delete</button>
            </td>
          </tr>`).join('') || '<tr><td colspan="8" class="t-muted">No products found</td></tr>'}
        </tbody>
      </table>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
        <button class="mini-btn" id="p-prev" ${state.products.page <= 1 ? 'disabled' : ''}>‹ Prev</button>
        <span class="t-muted" style="align-self:center">Page ${state.products.page}</span>
        <button class="mini-btn" id="p-next" ${d.items.length < 20 ? 'disabled' : ''}>Next ›</button>
      </div>
    </div>`;

  document.getElementById('p-q').addEventListener('input', debounce(() => {
    state.products.q = document.getElementById('p-q').value; state.products.page = 1; vProducts(box);
  }, 350));
  document.getElementById('p-cat').addEventListener('change', e => { state.products.category = e.target.value; state.products.page = 1; vProducts(box); });
  document.getElementById('p-add').addEventListener('click', () => openProductModal(null));
  document.getElementById('p-prev').addEventListener('click', () => { state.products.page--; vProducts(box); });
  document.getElementById('p-next').addEventListener('click', () => { state.products.page++; vProducts(box); });

  box.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openProductModal(+b.dataset.edit)));
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await api.del('/api/admin/products/' + b.dataset.del);
    PA.toast('Product deleted', 'success'); vProducts(box);
  }));
  box.querySelectorAll('[data-stock]').forEach(inp => inp.addEventListener('change', async () => {
    await api.put('/api/admin/stock/' + inp.dataset.stock, { stock_qty: parseInt(inp.value) || 0 });
    PA.toast('Stock updated', 'success');
  }));
}

async function openProductModal(id) {
  const cats = await api.get('/api/admin/categories');
  let p = null;
  if (id) p = await api.get('/api/admin/products/' + id);
  p = p || { part_number: '', name: '', brand: '', category_id: cats[0] ? cats[0].id : '', description: '', price_ghs: '', stock_qty: 0, low_stock_at: 10, image_url: '', featured: 0, active: 1, compatibility: [] };

  const compRows = (p.compatibility && p.compatibility.length ? p.compatibility : [{ make: '', model: '', year_start: '', year_end: '', engine: '' }])
    .map(c => compatRow(c)).join('');

  openModal(`
    <div class="modal-head"><h3>${id ? 'Edit Product' : 'New Product'}</h3>
      <button class="icon-btn" onclick="closeModal()">${PA.icons.close}</button></div>
    <div class="modal-body" style="grid-template-columns:1fr 1fr">
      <div class="field"><label>Part Number *</label><input id="f-pn" value="${esc(p.part_number)}" placeholder="e.g. NGK-BKR6E-11"></div>
      <div class="field"><label>Brand *</label><input id="f-brand" value="${esc(p.brand)}" placeholder="e.g. NGK"></div>
      <div class="field full" style="grid-column:1/-1"><label>Product Name *</label><input id="f-name" value="${esc(p.name)}" placeholder="e.g. NGK BKR6E-11 Spark Plug"></div>
      <div class="field"><label>Category *</label>
        <select id="f-cat">${cats.map(c => `<option value="${c.id}" ${+p.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Price (GH₵) *</label><input id="f-price" type="number" min="0" step="0.01" value="${p.price_ghs}"></div>
      <div class="field"><label>Stock Quantity</label><input id="f-stock" type="number" min="0" value="${p.stock_qty}"></div>
      <div class="field"><label>Low-stock alert at</label><input id="f-low" type="number" min="1" value="${p.low_stock_at}"></div>
      <div class="field full" style="grid-column:1/-1"><label>Image URL (optional)</label><input id="f-img" value="${esc(p.image_url)}" placeholder="/images/… or https://…"></div>
      <div class="field full" style="grid-column:1/-1"><label>Description</label><textarea id="f-desc" style="min-height:70px">${esc(p.description)}</textarea></div>
      <label style="display:flex;gap:8px;align-items:center;color:var(--text-2);font-size:.9rem"><input type="checkbox" id="f-featured" ${p.featured ? 'checked' : ''} style="accent-color:var(--blue)"> Featured product</label>
      <label style="display:flex;gap:8px;align-items:center;color:var(--text-2);font-size:.9rem"><input type="checkbox" id="f-active" ${p.active ? 'checked' : ''} style="accent-color:var(--blue)"> Active (visible in store)</label>
      <div class="full" style="grid-column:1/-1">
        <label style="font-size:.74rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Vehicle Compatibility</label>
        <div class="compat-editor" id="comp-editor" style="margin-top:8px">
          ${compRows}
        </div>
        <button class="mini-btn" id="comp-add" style="margin-top:8px">+ Add compatibility row</button>
        <div class="t-muted" style="margin-top:6px;font-size:.76rem">Use "Universal" as Make to fit all vehicles. Year fields optional (leave empty = all years).</div>
      </div>
    </div>
    ${modalFoot(id ? 'Save Changes' : 'Create Product', '')}`,
    (m) => {
      document.getElementById('comp-add').addEventListener('click', () => {
        document.getElementById('comp-editor').insertAdjacentHTML('beforeend', compatRow({ make: '', model: '', year_start: '', year_end: '', engine: '' }));
      });
      m.querySelector('.compat-editor').addEventListener('click', e => {
        const del = e.target.closest('.del-c');
        if (del && m.querySelectorAll('.compat-row').length > 1) del.closest('.compat-row').remove();
      });
      document.getElementById('modal-primary').addEventListener('click', async () => {
        const data = {
          part_number: val('f-pn'), name: val('f-name'), brand: val('f-brand'),
          category_id: +val('f-cat'), price_ghs: parseFloat(val('f-price')),
          stock_qty: parseInt(val('f-stock')), low_stock_at: parseInt(val('f-low')) || 10,
          image_url: val('f-img'), description: val('f-desc'),
          featured: document.getElementById('f-featured').checked ? 1 : 0,
          active: document.getElementById('f-active').checked ? 1 : 0,
          compatibility: [...m.querySelectorAll('.compat-row')].map(r => ({
            make: r.querySelector('.c-make').value.trim(),
            model: r.querySelector('.c-model').value.trim(),
            year_start: r.querySelector('.c-ys').value,
            year_end: r.querySelector('.c-ye').value,
            engine: r.querySelector('.c-eng').value.trim()
          })).filter(c => c.make || c.model)
        };
        if (!data.part_number || !data.name || !data.brand || isNaN(data.price_ghs)) {
          PA.toast('Fill in part number, name, brand and price', 'error'); return;
        }
        try {
          if (id) await api.put('/api/admin/products/' + id, data);
          else await api.post('/api/admin/products', data);
          PA.toast('Product saved ✓', 'success');
          closeModal(); vProducts(box);
        } catch (e) { PA.toast(e.message, 'error'); }
      });
    });
}

function compatRow(c) {
  return `<div class="compat-row">
    <input class="c-make" placeholder="Make (or Universal)" value="${esc(c.make || '')}">
    <input class="c-model" placeholder="Model" value="${esc(c.model || '')}">
    <input class="c-ys" placeholder="From" value="${esc(c.year_start || '')}">
    <input class="c-ye" placeholder="To" value="${esc(c.year_end && c.year_end < 9999 ? c.year_end : '')}">
    <input class="c-eng" placeholder="Engines (e.g. 1.6L|1.8L)" value="${esc(c.engine || '')}">
    <button class="del-c" type="button" title="Remove row">${PA.icons.trash}</button>
  </div>`;
}

function openRestock(id) {
  openModal(`
    <div class="modal-head"><h3>Restock Product</h3><button class="icon-btn" onclick="closeModal()">${PA.icons.close}</button></div>
    <div class="modal-body">
      <div class="field"><label>New stock quantity</label><input id="r-qty" type="number" min="0" value="50"></div>
    </div>
    ${modalFoot('Update Stock', '')}`,
    (m) => {
      document.getElementById('modal-primary').addEventListener('click', async () => {
        await api.put('/api/admin/stock/' + id, { stock_qty: parseInt(document.getElementById('r-qty').value) || 0 });
        PA.toast('Stock updated', 'success'); closeModal(); renderView();
      });
    });
}

/* ================= ORDERS ================= */
async function vOrders(box) {
  const qs = new URLSearchParams({ status: state.orders.status, page: state.orders.page });
  if (state.orders.q) qs.set('q', state.orders.q);
  const d = await api.get('/api/admin/orders?' + qs);
  const STATUSES = ['Pending', 'Confirmed', 'Processing', 'Out for Delivery', 'Delivered', 'Completed', 'Cancelled'];
  box.innerHTML = `
    <div class="admin-panel">
      <h2>Orders <span class="badge">${d.total}</span></h2>
      <div class="admin-toolbar">
        <select id="o-status">
          <option value="all">All statuses</option>
          ${STATUSES.map(s => `<option ${state.orders.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <input class="grow" id="o-q" placeholder="Search order number, customer name or phone…" value="${esc(state.orders.q)}">
      </div>
      <div style="display:grid;gap:12px">
        ${d.items.map(o => `
        <div style="border:1px solid var(--border);border-radius:12px;background:var(--bg-2);padding:14px 16px">
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <span class="t-part" style="font-size:.9rem">${esc(o.order_number)}</span>
            <span class="tag ${statusTag(o.status)}">${esc(o.status)}</span>
            <span class="tag tag-gray">${esc(o.payment_method)} · ${esc(o.payment_status)}</span>
            <span style="margin-left:auto;font-weight:800">${PA.fmt(o.total_ghs)}</span>
          </div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:.86rem;color:var(--text-2)">
            <span>👤 ${esc(o.customer_name)} · ${esc(o.customer_phone)}</span>
            <span>📍 ${esc(o.address)}, ${esc(o.city)}</span>
            <span>🗓 ${esc(String(o.created_at).replace('T', ' ').slice(0, 16))}</span>
          </div>
          <div style="margin-top:8px;font-size:.84rem;color:var(--text-2)">
            ${o.items.map(i => `${esc(i.product_name)} <span class="t-muted">× ${i.qty} · ${PA.fmt(i.unit_price_ghs)}</span>`).join('<br>')}
          </div>
          ${o.notes ? `<div class="t-muted" style="margin-top:6px;font-size:.8rem">📝 ${esc(o.notes)}</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">
            <select class="o-status-select" data-order="${o.id}" style="background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 10px;font-size:.83rem">
              ${STATUSES.map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <select class="o-pay-select" data-order="${o.id}" style="background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 10px;font-size:.83rem">
              ${['Pending', 'Paid', 'Failed', 'Refunded'].map(s => `<option ${o.payment_status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>`).join('') || '<p class="t-muted">No orders found</p>'}
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
        <button class="mini-btn" id="o-prev" ${state.orders.page <= 1 ? 'disabled' : ''}>‹ Prev</button>
        <span class="t-muted" style="align-self:center">Page ${state.orders.page}</span>
        <button class="mini-btn" id="o-next" ${d.items.length < 20 ? 'disabled' : ''}>Next ›</button>
      </div>
    </div>`;

  document.getElementById('o-status').addEventListener('change', e => { state.orders.status = e.target.value; state.orders.page = 1; vOrders(box); });
  document.getElementById('o-q').addEventListener('input', debounce(() => {
    state.orders.q = document.getElementById('o-q').value; state.orders.page = 1; vOrders(box);
  }, 350));
  document.getElementById('o-prev').addEventListener('click', () => { state.orders.page--; vOrders(box); });
  document.getElementById('o-next').addEventListener('click', () => { state.orders.page++; vOrders(box); });

  box.querySelectorAll('.o-status-select').forEach(sl => sl.addEventListener('change', async e => {
    await api.put('/api/admin/orders/' + e.target.dataset.order + '/status', { status: e.target.value });
    PA.toast('Order status updated', 'success');
  }));
  box.querySelectorAll('.o-pay-select').forEach(sl => sl.addEventListener('change', async e => {
    await api.put('/api/admin/orders/' + e.target.dataset.order + '/status', { payment_status: e.target.value });
    PA.toast('Payment status updated', 'success');
  }));
}

/* ================= CUSTOMERS ================= */
async function vCustomers(box) {
  const d = await api.get('/api/admin/customers');
  box.innerHTML = `
    <div class="admin-panel">
      <h2>Customers <span class="badge">${d.length}</span></h2>
      <table class="admin-table">
        <thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>City</th><th>Orders</th><th>Total Spent</th><th></th></tr></thead>
        <tbody>
          ${d.map(c => `<tr>
            <td><div class="t-prod-name">${esc(c.name)}</div><div class="t-muted">${esc(String(c.created_at).slice(0, 10))}</div></td>
            <td>${esc(c.phone)}</td>
            <td class="t-muted">${esc(c.email || '—')}</td>
            <td class="t-muted">${esc(c.city || '—')}</td>
            <td>${c.order_count}</td>
            <td><b>${PA.fmt(c.total_spent)}</b></td>
            <td><button class="mini-btn" data-cust="${c.id}">History</button></td>
          </tr>`).join('') || '<tr><td colspan="7" class="t-muted">No customers yet</td></tr>'}
        </tbody>
      </table>
    </div>`;
  box.querySelectorAll('[data-cust]').forEach(b => b.addEventListener('click', async () => {
    const c = await api.get('/api/admin/customers/' + b.dataset.cust);
    openModal(`
      <div class="modal-head"><h3>${esc(c.name)} — Order History</h3><button class="icon-btn" onclick="closeModal()">${PA.icons.close}</button></div>
      <div class="modal-body">
        <div class="t-muted" style="font-size:.86rem">${esc(c.phone)} · ${esc(c.email || 'no email')} · ${esc(c.address || '')}, ${esc(c.city || '')}</div>
        ${c.orders.map(o => `<div style="border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--bg-2)">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <span class="t-part">${esc(o.order_number)}</span>
            <span class="tag ${statusTag(o.status)}">${esc(o.status)}</span>
            <b>${PA.fmt(o.total_ghs)}</b>
          </div>
          <div class="t-muted" style="font-size:.8rem;margin-top:4px">${esc(String(o.created_at).replace('T', ' ').slice(0, 16))} · ${esc(o.payment_method)}</div>
        </div>`).join('') || '<p class="t-muted">No orders</p>'}
      </div>`);
  }));
}

/* ================= CATEGORIES ================= */
async function vCategories(box) {
  const d = await api.get('/api/admin/categories');
  box.innerHTML = `
    <div class="admin-panel">
      <h2>Categories <span class="badge">${d.length}</span></h2>
      <div class="admin-toolbar"><button class="btn btn-primary btn-sm" id="c-add">+ New Category</button></div>
      <table class="admin-table">
        <thead><tr><th></th><th>Name</th><th>Slug</th><th>Products</th><th>Order</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${d.map(c => `<tr>
            <td><img class="t-img" src="${c.image || '/images/placeholder-cat.jpg'}" alt=""></td>
            <td class="t-prod-name">${esc(c.name)}</td>
            <td class="t-part">${esc(c.slug)}</td>
            <td>${c.product_count}</td>
            <td>${c.sort_order}</td>
            <td>${c.active ? '<span class="tag tag-green">active</span>' : '<span class="tag tag-gray">hidden</span>'}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="mini-btn" data-edit="${c.id}">Edit</button>
              <button class="mini-btn danger" data-del="${c.id}">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  document.getElementById('c-add').addEventListener('click', () => openCatModal(null));
  box.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openCatModal(+b.dataset.edit)));
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.del('/api/admin/categories/' + b.dataset.del);
      PA.toast('Category deleted', 'success'); vCategories(box);
    } catch (e) { PA.toast(e.message, 'error'); }
  }));
}

function openCatModal(id) {
  const cats = [];
  openModal(`
    <div class="modal-head"><h3>${id ? 'Edit Category' : 'New Category'}</h3><button class="icon-btn" onclick="closeModal()">${PA.icons.close}</button></div>
    <div class="modal-body">
      <div class="field"><label>Name *</label><input id="cat-name"></div>
      <div class="field"><label>Slug * (URL — e.g. spark-plugs)</label><input id="cat-slug"></div>
      <div class="field"><label>Image URL</label><input id="cat-img" placeholder="/images/…"></div>
      <div class="field"><label>Sort order</label><input id="cat-order" type="number" value="0"></div>
      <div class="field full" style="grid-column:1/-1"><label>Description</label><textarea id="cat-desc" style="min-height:60px"></textarea></div>
      <label style="display:flex;gap:8px;align-items:center;color:var(--text-2)"><input type="checkbox" id="cat-active" checked style="accent-color:var(--blue)"> Active</label>
    </div>
    ${modalFoot(id ? 'Save' : 'Create', '')}`,
    async (m) => {
      if (id) {
        const d = await api.get('/api/admin/categories');
        const c = d.find(x => x.id === id);
        if (c) {
          document.getElementById('cat-name').value = c.name;
          document.getElementById('cat-slug').value = c.slug;
          document.getElementById('cat-img').value = c.image || '';
          document.getElementById('cat-order').value = c.sort_order;
          document.getElementById('cat-desc').value = c.description || '';
          document.getElementById('cat-active').checked = !!c.active;
        }
      }
      document.getElementById('modal-primary').addEventListener('click', async () => {
        const body = {
          name: val('cat-name'), slug: val('cat-slug'), image: val('cat-img'),
          sort_order: parseInt(val('cat-order')) || 0, description: val('cat-desc'),
          active: document.getElementById('cat-active').checked ? 1 : 0
        };
        if (!body.name || !body.slug) { PA.toast('Name and slug required', 'error'); return; }
        if (id) await api.put('/api/admin/categories/' + id, body);
        else await api.post('/api/admin/categories', body);
        PA.toast('Category saved ✓', 'success'); closeModal(); vCategories(box);
      });
    });
}

/* ================= MESSAGES ================= */
async function vMessages(box) {
  const d = await api.get('/api/admin/messages');
  box.innerHTML = `
    <div class="admin-panel">
      <h2>Contact Messages <span class="badge ${d.filter(m => m.status === 'new').length ? 'danger' : ''}">${d.length}</span></h2>
      <div style="display:grid;gap:12px">
        ${d.map(m => `<div style="border:1px solid var(--border);border-radius:12px;background:var(--bg-2);padding:14px 16px;${m.status === 'new' ? 'border-left:3px solid var(--blue)' : ''}">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <b>${esc(m.name)}</b>
            <span class="t-muted">${esc(m.phone || '')} ${m.phone && m.email ? '·' : ''} ${esc(m.email || '')}</span>
            <span class="tag ${m.status === 'new' ? 'tag-blue' : 'tag-gray'}" style="margin-left:auto">${esc(m.status)}</span>
            <span class="t-muted">${esc(String(m.created_at).replace('T', ' ').slice(0, 16))}</span>
          </div>
          ${m.subject ? `<div class="t-prod-name" style="margin-top:6px;font-size:.9rem">${esc(m.subject)}</div>` : ''}
          <p style="color:var(--text-2);font-size:.88rem;margin-top:4px">${esc(m.message)}</p>
          <button class="mini-btn" data-read="${m.id}" style="margin-top:8px">Mark as read</button>
        </div>`).join('') || '<p class="t-muted">No messages yet</p>'}
      </div>
    </div>`;
  box.querySelectorAll('[data-read]').forEach(b => b.addEventListener('click', async () => {
    await api.put('/api/admin/messages/' + b.dataset.read, { status: 'read' });
    vMessages(box);
  }));
}

/* ================= VEHICLES ================= */
async function vVehicles(box) {
  const d = await api.get('/api/admin/vehicles');
  const makes = [...new Set(d.map(v => v.make))].sort();
  box.innerHTML = `
    <div class="admin-panel">
      <h2>Vehicle Catalogue <span class="badge">${d.length}</span></h2>
      <p class="t-muted" style="margin-bottom:14px;font-size:.86rem">These vehicles power the "Find Parts for Your Vehicle" selector. Add or remove models as your catalogue grows.</p>
      <div class="admin-toolbar">
        <input id="v-make" placeholder="Make e.g. Toyota" style="flex:1">
        <input id="v-model" placeholder="Model e.g. Camry" style="flex:1">
        <input id="v-ys" placeholder="Year from" style="width:110px">
        <input id="v-ye" placeholder="Year to" style="width:110px">
        <input id="v-eng" placeholder="Engines e.g. 1.6L,1.8L" style="flex:1">
        <button class="btn btn-primary btn-sm" id="v-add">+ Add</button>
      </div>
      ${makes.map(make => `
        <div style="margin-bottom:16px">
          <h3 style="font-size:.85rem;letter-spacing:.14em;text-transform:uppercase;color:var(--blue-2);margin-bottom:8px">${esc(make)}</h3>
          <table class="admin-table">
            <thead><tr><th>Model</th><th>Years</th><th>Engines</th><th></th></tr></thead>
            <tbody>
              ${d.filter(v => v.make === make).map(v => `<tr>
                <td class="t-prod-name">${esc(v.model)}</td>
                <td class="t-muted">${v.year_start}${v.year_end < 9999 ? ' – ' + v.year_end : ' – present'}</td>
                <td class="t-muted">${esc((v.engines || '').replace(/,/g, ', '))}</td>
                <td style="text-align:right"><button class="mini-btn danger" data-del="${v.id}">Delete</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`).join('')}
    </div>`;

  document.getElementById('v-add').addEventListener('click', async () => {
    const make = val('v-make'), model = val('v-model');
    if (!make || !model) { PA.toast('Make and model required', 'error'); return; }
    await api.post('/api/admin/vehicles', {
      make, model,
      year_start: parseInt(val('v-ys')) || 0,
      year_end: parseInt(val('v-ye')) || 9999,
      engines: val('v-eng')
    });
    PA.toast('Vehicle added ✓', 'success');
    vVehicles(box);
  });
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Remove this vehicle?')) return;
    await api.del('/api/admin/vehicles/' + b.dataset.del);
    PA.toast('Vehicle removed', 'success');
    vVehicles(box);
  }));
}

/* ================= SETTINGS ================= */
async function vSettings(box) {
  const s = await api.get('/api/admin/settings');
  const F = (key, label, ph, type = 'text') => `
    <div class="field"><label>${label}</label>
      <input id="s-${key}" type="${type}" value="${esc(s[key] || '')}" placeholder="${esc(ph || '')}"></div>`;
  box.innerHTML = `
    <div class="admin-panel">
      <h2>Store Settings</h2>
      <div class="form-grid">
        ${F('site_name', 'Site Name', 'PLUS 233 AUTOMASTER')}
        ${F('motto', 'Motto', 'Home of Trusted Parts. Superior Performance.')}
        ${F('phone', 'Phone', '+233 …')}
        ${F('email', 'Email', 'sales@…')}
        ${F('address', 'Address', '28 Chemu Rd, Accra, Down-Right')}
        ${F('hours', 'Opening Hours', 'Mon – Sat: 8AM – 6PM')}
        ${F('maps_url', 'Google Maps URL', 'https://…')}
        ${F('facebook_url', 'Facebook URL', 'https://…')}
        ${F('facebook_label', 'Facebook Label', 'Plus Auto master')}
        ${F('instagram_url', 'Instagram URL', 'https://…')}
        ${F('instagram_label', 'Instagram Label', 'PluS 233 Auto Master')}
        ${F('tiktok_url', 'TikTok URL', 'https://…')}
        ${F('tiktok_label', 'TikTok Label', 'PluS 233 Auto Master')}
        ${F('delivery_fee_accra', 'Delivery Fee — Accra (GH₵)', '40', 'number')}
        ${F('delivery_fee_nationwide', 'Delivery Fee — Nationwide (GH₵)', '90', 'number')}
        ${F('free_delivery_over', 'Free Delivery Over (GH₵)', '1500', 'number')}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-primary" id="s-save">Save Settings</button>
      </div>
    </div>`;
  document.getElementById('s-save').addEventListener('click', async () => {
    const keys = ['site_name', 'motto', 'phone', 'email', 'address', 'hours', 'maps_url',
      'facebook_url', 'facebook_label', 'instagram_url', 'instagram_label', 'tiktok_url', 'tiktok_label',
      'delivery_fee_accra', 'delivery_fee_nationwide', 'free_delivery_over'];
    const body = {};
    keys.forEach(k => { const el = document.getElementById('s-' + k); if (el) body[k] = el.value; });
    await api.put('/api/admin/settings', body);
    PA.toast('Settings saved ✓', 'success');
  });
}

/* ================= LOGIN ================= */
function renderLogin() {
  document.getElementById('admin-app').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <a class="logo" href="/">
          <img class="logo-img" src="/images/logo.png" alt="logo">
          <span class="logo-text"><span class="logo-name">PLUS <span>233</span> AUTOMASTER</span></span>
        </a>
        <h1>Admin Dashboard</h1>
        <div class="sub">Sign in to manage your store</div>
        <form id="login-form" class="form-grid" style="grid-template-columns:1fr">
          <div class="field"><label>Username</label><input id="l-user" autocomplete="username"></div>
          <div class="field"><label>Password</label><input id="l-pass" type="password" autocomplete="current-password"></div>
          <button class="btn btn-primary btn-block" type="submit">Sign In</button>
          <div class="login-hint">Sign in with the username &amp; password configured in your hosting environment (ADMIN_USERNAME / ADMIN_PASSWORD).</div>
        </form>
      </div>
    </div>`;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const d = await api.post('/api/admin/login', {
        username: document.getElementById('l-user').value.trim(),
        password: document.getElementById('l-pass').value
      });
      localStorage.setItem(ADMIN_KEY, d.token);
      api.token = d.token;
      render();
    } catch (err) {
      PA.toast(err.message, 'error');
    }
  });
}

/* ================= helpers ================= */
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function statusTag(s) {
  return ({ 'Pending': 'tag-warn', 'Confirmed': 'tag-blue', 'Processing': 'tag-blue', 'Out for Delivery': 'tag-blue',
    'Delivered': 'tag-green', 'Completed': 'tag-green', 'Cancelled': 'tag-red' })[s] || 'tag-gray';
}

function render() {
  if (!api.token) return renderLogin();
  shell();
}

document.addEventListener('DOMContentLoaded', render);
window.closeModal = closeModal;
