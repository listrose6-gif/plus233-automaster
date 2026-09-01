/* PLUS 233 AUTOMASTER — customer account (sign in / register / profile / orders) */
'use strict';
const esc = PA.esc;
const ACC_KEY = 'pa233_customer_token';

function getToken() { return localStorage.getItem(ACC_KEY) || ''; }
function setToken(t) { if (t) localStorage.setItem(ACC_KEY, t); else localStorage.removeItem(ACC_KEY); }

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  const r = await fetch(path, { ...opts, headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

function statusTag(s) {
  return ({ 'Pending': 'tag-warn', 'Confirmed': 'tag-blue', 'Processing': 'tag-blue', 'Out for Delivery': 'tag-blue',
    'Delivered': 'tag-green', 'Completed': 'tag-green', 'Cancelled': 'tag-red' })[s] || 'tag-gray';
}

/* ---------------- signed-out view: sign in + create account ---------------- */
function renderSignedOut(root) {
  root.innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;align-items:start">
    <div class="form-card">
      <h3>Sign In</h3>
      <form id="login-form" class="form-grid" style="grid-template-columns:1fr">
        <div class="field">
          <label for="li-email">Email</label>
          <input id="li-email" type="email" placeholder="you@example.com" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="li-pass">Password</label>
          <input id="li-pass" type="password" placeholder="••••••••" autocomplete="current-password" required>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Sign In</button>
        <p class="sum-note">${PA.icons.truck}<span>No account yet? <a href="#create-account" id="go-register" style="color:var(--blue-2);font-weight:700">Create one free</a> — or track an order with your <a href="/track-order.html" style="color:var(--blue-2)">order number</a>.</span></p>
      </form>
    </div>

    <div class="form-card" id="create-account">
      <h3>Create Account</h3>
      <form id="reg-form" class="form-grid" style="grid-template-columns:1fr">
        <div class="field">
          <label for="rg-name">Full Name *</label>
          <input id="rg-name" type="text" placeholder="e.g. Kwame Mensah" autocomplete="name" required>
        </div>
        <div class="field">
          <label for="rg-email">Email *</label>
          <input id="rg-email" type="email" placeholder="you@example.com" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="rg-phone">Phone</label>
          <input id="rg-phone" type="tel" placeholder="024 000 0000" autocomplete="tel">
        </div>
        <div class="field">
          <label for="rg-pass">Password (min 6 characters) *</label>
          <input id="rg-pass" type="password" placeholder="Choose a strong password" autocomplete="new-password" minlength="6" required>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Create Account</button>
      </form>
    </div>

    <div class="form-card">
      <h3>Why Create an Account?</h3>
      <ul style="list-style:none;display:grid;gap:10px;color:var(--text-2);font-size:.9rem">
        <li>🚗 Save your vehicle details for faster Find Parts checks</li>
        <li>📦 View all your orders and track deliveries in one place</li>
        <li>⚡ Checkout faster with your saved details</li>
        <li>🔒 Order as a guest anytime — an account is optional</li>
      </ul>
      <p style="color:var(--muted);font-size:.78rem;margin-top:12px">Need help? <a href="/contact.html" style="color:var(--blue-2)">Contact our support team</a>.</p>
    </div>
  </div>`;

  document.getElementById('go-register')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('create-account').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('li-email').value.trim();
    const password = document.getElementById('li-pass').value;
    if (!email || !password) { PA.toast('Enter your email and password', 'error'); return; }
    try {
      const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setToken(d.token);
      PA.toast(`Welcome back, ${esc(d.user.name.split(' ')[0])}! 👋`, 'success');
      init();
    } catch (err) { PA.toast(err.message, 'error'); }
  });

  document.getElementById('reg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('rg-name').value.trim();
    const email = document.getElementById('rg-email').value.trim();
    const phone = document.getElementById('rg-phone').value.trim();
    const password = document.getElementById('rg-pass').value;
    if (!name || !email || password.length < 6) { PA.toast('Fill in name, email and a password of 6+ characters', 'error'); return; }
    try {
      const d = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, phone }) });
      setToken(d.token);
      PA.toast('Account created — welcome to PLUS 233 AUTOMASTER! 🎉', 'success');
      init();
    } catch (err) { PA.toast(err.message, 'error'); }
  });
}

/* ---------------- signed-in view: profile + orders ---------------- */
function renderSignedIn(root, me) {
  root.innerHTML = `
  <div class="form-card" style="margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(145deg,rgba(0,166,255,.25),rgba(0,166,255,.06));border:1px solid rgba(0,166,255,.35);display:flex;align-items:center;justify-content:center;color:var(--blue-2);font-weight:900;font-size:1.3rem">
        ${esc((me.name || '?').charAt(0).toUpperCase())}
      </div>
      <div style="flex:1">
        <h3 style="margin:0">Welcome, ${esc(me.name.split(' ')[0])} 👋</h3>
        <p style="color:var(--muted);font-size:.85rem;margin-top:2px">${esc(me.email)} · Member since ${esc(String(me.created_at || '').slice(0, 10))}</p>
      </div>
      <button class="btn btn-outline btn-sm" id="signout">Sign Out</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;align-items:start">
    <div class="form-card">
      <h3>My Details</h3>
      <form id="profile-form" class="form-grid" style="grid-template-columns:1fr">
        <div class="field">
          <label for="pf-name">Full Name</label>
          <input id="pf-name" type="text" value="${esc(me.name || '')}">
        </div>
        <div class="field">
          <label for="pf-email">Email</label>
          <input id="pf-email" type="email" value="${esc(me.email || '')}" disabled style="opacity:.6">
        </div>
        <div class="field">
          <label for="pf-phone">Phone</label>
          <input id="pf-phone" type="tel" value="${esc(me.phone || '')}" placeholder="024 000 0000">
        </div>
        <div class="field">
          <label for="pf-address">Delivery Address</label>
          <input id="pf-address" type="text" value="${esc(me.address || '')}" placeholder="House number, street, landmark">
        </div>
        <div class="field">
          <label for="pf-city">City / Town</label>
          <input id="pf-city" type="text" value="${esc(me.city || '')}" placeholder="e.g. Accra">
        </div>
        <button class="btn btn-primary" type="submit">Save Changes</button>
      </form>
      <p class="sum-note" style="margin-top:12px">${PA.icons.shield}<span>Your details are pre-filled at checkout to make ordering faster.</span></p>
    </div>

    <div class="form-card">
      <h3>My Orders <span class="badge" style="margin-left:auto;background:var(--blue-dim);color:var(--blue-2);font-size:.74rem;padding:3px 10px;border-radius:999px">${me.orders.length}</span></h3>
      <div id="my-orders" style="display:grid;gap:10px;max-height:480px;overflow-y:auto;padding-right:4px">
        ${me.orders.length ? me.orders.map(o => `
          <a href="/track-order.html?order=${esc(o.order_number)}" style="display:block;border:1px solid var(--border);border-radius:11px;padding:13px 14px;background:var(--bg-2);transition:border-color .13s" class="order-card">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="t-part" style="font-family:ui-monospace,Consolas,monospace;font-size:.84rem">${esc(o.order_number)}</span>
              <span class="tag ${statusTag(o.status)}">${esc(o.status)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:8px;margin-top:7px;font-size:.83rem;color:var(--text-2)">
              <span>${o.item_count} item${o.item_count === 1 ? '' : 's'} · ${esc(String(o.created_at).replace('T', ' ').slice(0, 10))}</span>
              <b style="color:#fff">${PA.fmt(o.total_ghs)}</b>
            </div>
            <div style="margin-top:6px;color:var(--blue-2);font-size:.78rem">Track delivery →</div>
          </a>`).join('') : `
          <div style="text-align:center;padding:30px 12px;color:var(--muted)">
            <div style="font-size:2rem;margin-bottom:8px">🛒</div>
            No orders yet — when you shop, they'll appear here.
            <div style="margin-top:14px"><a class="btn btn-primary btn-sm" href="/shop.html">Shop Products</a></div>
          </div>`}
      </div>
    </div>
  </div>`;

  document.getElementById('signout').addEventListener('click', () => {
    setToken('');
    PA.toast('Signed out. See you soon!', 'info');
    init();
  });

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const d = await api('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: document.getElementById('pf-name').value.trim(),
          phone: document.getElementById('pf-phone').value.trim(),
          address: document.getElementById('pf-address').value.trim(),
          city: document.getElementById('pf-city').value.trim()
        })
      });
      PA.toast('Details saved ✓', 'success');
      renderSignedIn(root, d);
    } catch (err) { PA.toast(err.message, 'error'); }
  });
}

async function init() {
  const root = document.getElementById('account-root');
  if (!root) return;
  const sub = document.getElementById('account-hero-sub');
  if (!getToken()) {
    sub.textContent = 'Sign in or create an account to save your details, check out faster and track your orders in one place.';
    renderSignedOut(root);
    return;
  }
  sub.textContent = 'Manage your details and track your orders.';
  root.innerHTML = '<p style="color:var(--muted)">Loading your account…</p>';
  try {
    const me = await api('/api/auth/me');
    renderSignedIn(root, me);
  } catch (err) {
    setToken(''); // expired/invalid session → back to sign-in
    renderSignedOut(root);
  }
}

document.addEventListener('DOMContentLoaded', init);
