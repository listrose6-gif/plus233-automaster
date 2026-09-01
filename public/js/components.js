/* ==================================================================
   PLUS 233 AUTOMASTER — shared frontend library
   Cart store · settings · icons · header/footer renderers · toasts
   ================================================================== */
'use strict';

const PA = (() => {
  /* ---------- settings ---------- */
  let _settings = null;
  async function settings(force) {
    if (_settings && !force) return _settings;
    try {
      const r = await fetch('/api/settings');
      _settings = await r.json();
    } catch { _settings = {}; }
    return _settings;
  }

  /* ---------- currency ---------- */
  const fmt = (n) => {
    const v = Number(n || 0);
    return 'GH₵' + v.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  const fmtNum = (n) => Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  /* ---------- cart store (localStorage) ---------- */
  const CART_KEY = 'pa233_cart_v1';
  let cart = [];
  let cartListeners = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { cart = []; }

  function save() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    cartListeners.forEach(fn => { try { fn(cart); } catch {} });
    const el = document.getElementById('cart-count');
    if (el) {
      const n = cart.reduce((s, i) => s + i.qty, 0);
      el.textContent = n > 99 ? '99+' : n;
      el.classList.toggle('show', n > 0);
    }
  }
  function getCart() { return cart; }
  function onCart(fn) { cartListeners.push(fn); }
  function addToCart(id, qty = 1, meta = {}) {
    const item = cart.find(i => i.id === id);
    if (item) item.qty = Math.min(99, item.qty + qty);
    else cart.push({ id, qty, name: meta.name || '', price: meta.price || 0, image: meta.image || '', part_number: meta.part_number || '' });
    save();
  }
  function setQty(id, qty) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty = Math.max(1, Math.min(99, qty));
    save();
  }
  function removeFromCart(id) { cart = cart.filter(i => i.id !== id); save(); }
  function clearCart() { cart = []; save(); }
  function cartCount() { return cart.reduce((s, i) => s + i.qty, 0); }
  function cartSubtotal() { return cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0); }

  /* ---------- toasts ---------- */
  function toast(msg, type = 'info') {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toast-wrap'; document.body.appendChild(wrap); }
    const icons = {
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>',
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
    };
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = icons[type] || icons.info + '<div>' + msg + '</div>';
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 3400);
  }

  /* ---------- icons ---------- */
  const icons = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="21" r="1.6"/><circle cx="19" cy="21" r="1.6"/><path d="M2.5 3h2l2.7 12.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L22 7H6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 16l1.5-4.5A2 2 0 018.4 10h7.2a2 2 0 011.9 1.5L19 16M5 16h14M5 16v2.5M19 16v2.5M6.5 12h11"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.13.96.36 1.9.7 2.8a2 2 0 01-.45 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.45c.9.34 1.84.57 2.8.7a2 2 0 011.7 2.05z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 4h14v13H1zM15 9h4l4 4v4h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a4 4 0 005.3 5.3L21 13.6a4 4 0 01-5.6-5.6L14.7 6.3z"/><path d="M14.7 6.3a4 4 0 00-5.6 5.6L3 18l3 3 6.1-6.1a4 4 0 005.6-5.6"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 13a8 8 0 0116 0"/><rect x="2.5" y="13" width="4.5" height="7" rx="2"/><rect x="17" y="13" width="4.5" height="7" rx="2"/><path d="M19 20a3 3 0 01-3 3h-3"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.6 13.4L11 3.8A2 2 0 009.6 3H4a1 1 0 00-1 1v5.6A2 2 0 003.8 11l9.6 9.6a2 2 0 002.8 0l4.4-4.4a2 2 0 000-2.8z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M3 10h18M5 10l7-7 7 7M5 10v7M19 10v7M9 10v7M15 10v7"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4m0 4h.01"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.46H15.2c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.9h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.8" cy="6.2" r="1.3" fill="currentColor" stroke="none"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.6 7.3a5.9 5.9 0 01-3.5-1.1 6 6 0 01-2.3-3.2h-3.3v13.1a3.2 3.2 0 11-2.2-3V9.7a6.5 6.5 0 102 12.7 6.5 6.5 0 006.5-6.5V9.9a8.9 8.9 0 003.5 1.6V8.1c-.2 0-.5-.1-.7-.2V7.3z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.55-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h.01a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.01a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9.5z"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'
  };

  /* ---------- stock helpers ---------- */
  const stockLabel = (p) => p.stock_status === 'out' ? 'Out of Stock' : (p.stock_status === 'low' ? `Only ${p.stock_qty} left` : 'In Stock');
  const stockPill = (p) => {
    if (p.stock_status === 'out') return '<span class="stock-pill stock-out"><span class="dot"></span>Out of stock</span>';
    if (p.stock_status === 'low') return `<span class="stock-pill stock-low"><span class="dot"></span>Only ${p.stock_qty} left</span>`;
    return '<span class="stock-pill stock-in"><span class="dot"></span>In stock</span>';
  };
  const compatSummary = (p) => {
    if (!p.compatibility || !p.compatibility.length) return '';
    const univ = p.compatibility.find(c => c.make === 'Universal');
    if (univ) return 'Universal fit';
    const c = p.compatibility[0];
    const yrs = c.year_start ? `${c.year_start}${c.year_end && c.year_end < 9999 ? '–' + c.year_end : '+'}` : '';
    return `${c.make} ${c.model}${yrs ? ' ' + yrs : ''}${c.engine ? ' · ' + c.engine.split('|')[0] : ''}`;
  };
  const compatList = (p) => {
    if (!p.compatibility || !p.compatibility.length) return '';
    const rows = p.compatibility.map(c => {
      if (c.make === 'Universal') return '<div class="compat-item"><span style="color:var(--success)">✓</span> Universal — fits all vehicles</div>';
      const yrs = c.year_start ? `${c.year_start}–${c.year_end >= 9999 ? 'present' : c.year_end}` : 'All years';
      return `<div class="compat-item"><span style="color:var(--success)">✓</span> <div><b>${c.make} ${c.model}</b> · ${yrs}${c.engine ? ' · ' + c.engine.split('|').join(' / ') : ''}</div></div>`;
    }).join('');
    return rows;
  };

  /* ---------- product card ---------- */
  function productCard(p) {
    const out = p.stock_status === 'out';
    return `
    <article class="pcard" data-id="${p.id}">
      <a class="pcard-img-wrap" href="/product.html?id=${p.id}">
        ${p.featured ? '<span class="pcard-badge badge-featured">★ Featured</span>' : ''}
        ${stockPill(p)}
        <img src="${p.image_url || '/images/placeholder-part.jpg'}" alt="${esc(p.name)}" loading="lazy">
      </a>
      <div class="pcard-body">
        <div class="pcard-brand">${esc(p.brand)}</div>
        <div class="pcard-name"><a href="/product.html?id=${p.id}">${esc(p.name)}</a></div>
        <div class="pcard-pn">Part No. ${esc(p.part_number)}</div>
        ${p.compatibility ? `<div class="pcard-compat">${icons.car}<span>${esc(compatSummary(p))}</span></div>` : ''}
        <div class="pcard-foot">
          <span class="price"><small>GH₵</small>${fmtNum(p.price_ghs)}</span>
        </div>
        <div class="pcard-actions">
          <div class="qty-stepper">
            <button class="q-minus" data-id="${p.id}" type="button">−</button>
            <input class="q-input" data-id="${p.id}" type="number" value="1" min="1" max="${Math.max(1, p.stock_qty)}" aria-label="Quantity">
            <button class="q-plus" data-id="${p.id}" type="button">+</button>
          </div>
          <button class="add-cart-btn" data-add="${p.id}" ${out ? 'disabled' : ''} type="button">${icons.cart} Add</button>
        </div>
        <button class="buy-now-btn btn-block" data-buy="${p.id}" ${out ? 'disabled' : ''} type="button">Buy Now</button>
      </div>
    </article>`;
  }

  /* ---------- header ---------- */
  const NAV_LINKS = [
    ['/', 'Home'], ['/shop.html', 'Shop'], ['/categories.html', 'Categories'],
    ['/find-parts.html', 'Find Parts for My Car'], ['/about.html', 'About'], ['/contact.html', 'Contact']
  ];

  function initHeader(active) {
    const s = window.__PA_SETTINGS__ || {};
    const el = document.getElementById('site-header');
    if (!el) return;
    el.innerHTML = `
      <div class="topbar">
        <div class="container">
          <div class="topbar-motto">${icons.shield}<span><b>Home of Trusted Parts.</b> <span class="hide-sm">Superior Performance.</span></span></div>
          <div class="topbar-right">
            <a href="/find-parts.html">${icons.car}<span class="hide-sm"> Vehicle Compatibility</span></a>
            <a href="/delivery.html">${icons.truck}<span class="hide-sm"> Nationwide Delivery</span></a>
          </div>
        </div>
      </div>
      <div class="container header-main">
        <a class="logo" href="/" aria-label="PLUS 233 AUTOMASTER home">
          <img class="logo-img" src="/images/logo.png" alt="PLUS 233 AUTOMASTER logo">
          <span class="logo-text">
            <span class="logo-name">PLUS <span>233</span> AUTOMASTER</span>
            <span class="logo-sub">Trusted Parts · Superior Performance</span>
          </span>
        </a>
        <nav class="nav" aria-label="Main navigation">
          ${NAV_LINKS.map(([href, label]) => `<a href="${href}" class="${href === active ? 'active' : ''}">${label}</a>`).join('')}
        </nav>
        <div class="header-actions">
          <button class="icon-btn" id="search-open" aria-label="Search products">${icons.search}</button>
          <a class="icon-btn" href="/account.html" aria-label="Account">${icons.user}</a>
          <a class="icon-btn" href="/cart.html" aria-label="Shopping cart">${icons.cart}<span class="cart-count" id="cart-count"></span></a>
          <button class="icon-btn burger" id="burger" aria-label="Open menu">${icons.menu}</button>
        </div>
      </div>
      <div class="search-overlay" id="search-overlay">
        <div class="search-box">
          <div class="search-input-row">
            ${icons.search}
            <input id="search-input" type="text" placeholder="Search by product, part number, vehicle or model…" autocomplete="off">
            <button class="icon-btn" id="search-close" aria-label="Close search">${icons.close}</button>
          </div>
          <div class="search-results" id="search-results"></div>
        </div>
      </div>
      <div class="drawer" id="drawer">
        <div class="drawer-backdrop" data-drawer-close></div>
        <div class="drawer-panel">
          <div class="drawer-head">
            <img class="logo-img" src="/images/logo.png" alt="logo" style="width:38px;height:38px">
            <button class="icon-btn" data-drawer-close aria-label="Close menu">${icons.close}</button>
          </div>
          ${NAV_LINKS.map(([href, label]) => {
            const ic = label === 'Home' ? icons.home : label === 'Shop' ? icons.box : label === 'Categories' ? icons.filter : label === 'Find Parts for My Car' ? icons.car : label === 'About' ? icons.shield : icons.phone;
            return `<a class="d-link" href="${href}">${ic}${label}</a>`;
          }).join('')}
          <div class="d-divider"></div>
          <div class="d-label">Customer</div>
          <a class="d-link" href="/cart.html">${icons.cart}Cart</a>
          <a class="d-link" href="/account.html">${icons.user}My Account / Login</a>
          <a class="d-link" href="/track-order.html">${icons.truck}Track My Order</a>
          <div class="d-divider"></div>
          <div class="d-label">Follow us</div>
          <div class="d-social">
            <a href="${esc((s.facebook_url || '#'))}" target="_blank" rel="noopener" aria-label="Facebook — Plus Auto master">${icons.facebook}</a>
            <a href="${esc((s.instagram_url || '#'))}" target="_blank" rel="noopener" aria-label="Instagram — PluS 233 Auto Master">${icons.instagram}</a>
            <a href="${esc((s.tiktok_url || '#'))}" target="_blank" rel="noopener" aria-label="TikTok — PluS 233 Auto Master">${icons.tiktok}</a>
          </div>
          <div class="d-divider"></div>
          <div class="d-label">Contact</div>
          <a class="d-link" href="tel:${esc(s.phone || '')}">${icons.phone}${esc(s.phone || '+233 …')}</a>
          <a class="d-link" href="${esc((s.maps_url || '#'))}" target="_blank" rel="noopener">${icons.pin}${esc(s.address || '28 Chemu Rd, Accra')}</a>
        </div>
      </div>`;

    /* wire-up */
    document.getElementById('burger').addEventListener('click', () => document.getElementById('drawer').classList.add('open'));
    document.querySelectorAll('[data-drawer-close]').forEach(b => b.addEventListener('click', () => document.getElementById('drawer').classList.remove('open')));
    const so = document.getElementById('search-overlay');
    const si = document.getElementById('search-input');
    document.getElementById('search-open').addEventListener('click', () => { so.classList.add('open'); setTimeout(() => si.focus(), 60); });
    document.getElementById('search-close').addEventListener('click', () => so.classList.remove('open'));
    so.addEventListener('click', e => { if (e.target === so) so.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') so.classList.remove('open'); });

    let debounce;
    si.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => liveSearch(si.value), 220);
    });
    save();
    onCart(() => {});
    // account icon indicator when signed in
    const accLink = el.querySelector('a[href="/account.html"]');
    if (accLink && localStorage.getItem('pa233_customer_token')) accLink.classList.add('logged-in');
  }

  async function liveSearch(q) {
    const box = document.getElementById('search-results');
    if (!q || q.trim().length < 2) { box.innerHTML = '<div class="search-empty">Type at least 2 characters to search products, part numbers or brands.</div>'; return; }
    const r = await fetch('/api/products?q=' + encodeURIComponent(q.trim()) + '&per_page=7');
    const data = await r.json();
    if (!data.items.length) { box.innerHTML = '<div class="search-empty">No products found for “' + esc(q) + '”. Try a part number like “BKR6E”.</div>'; return; }
    box.innerHTML = data.items.map(p => `
      <a class="search-hit" href="/product.html?id=${p.id}">
        <img src="${p.image_url || '/images/placeholder-part.jpg'}" alt="">
        <div>
          <div class="hit-name">${esc(p.name)}</div>
          <div class="hit-meta">${esc(p.brand)} · ${esc(p.part_number)} · ${esc(compatSummary(p))}</div>
        </div>
        <span class="hit-price">${fmt(p.price_ghs)}</span>
      </a>`).join('') +
      `<a class="search-hit" href="/shop.html?q=${encodeURIComponent(q.trim())}"><div class="hit-name" style="color:var(--blue-2)">View all results →</div></a>`;
  }

  /* ---------- footer ---------- */
  function initFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    const s = window.__PA_SETTINGS__ || {};
    el.innerHTML = `
    <div class="footer">
      <div class="container">
        <div class="footer-main">
          <div class="footer-brand">
            <a class="logo" href="/">
              <img class="logo-img" src="/images/logo.png" alt="PLUS 233 AUTOMASTER">
              <span class="logo-text">
                <span class="logo-name">PLUS <span>233</span> AUTOMASTER</span>
                <span class="logo-sub">Accra · Ghana</span>
              </span>
            </a>
            <p class="footer-motto">“Home of Trusted Parts. Superior Performance.”</p>
            <p class="footer-about">Genuine automotive parts, accessories, lubricants and oils — retail & wholesale — delivered across Ghana. Find your part, check compatibility and order online with confidence.</p>
            <div class="social-row">
              <a class="social-btn" href="${esc(s.facebook_url || '#')}" target="_blank" rel="noopener" aria-label="Facebook — Plus Auto master" title="Facebook: Plus Auto master">${icons.facebook}</a>
              <a class="social-btn" href="${esc(s.instagram_url || '#')}" target="_blank" rel="noopener" aria-label="Instagram — PluS 233 Auto Master" title="Instagram: PluS 233 Auto Master">${icons.instagram}</a>
              <a class="social-btn" href="${esc(s.tiktok_url || '#')}" target="_blank" rel="noopener" aria-label="TikTok — PluS 233 Auto Master" title="TikTok: PluS 233 Auto Master">${icons.tiktok}</a>
            </div>
          </div>
          <div>
            <h4>Quick Links</h4>
            <ul class="footer-links">
              <li><a href="/shop.html">Shop</a></li>
              <li><a href="/categories.html">Categories</a></li>
              <li><a href="/find-parts.html">Find Parts</a></li>
              <li><a href="/about.html">About Us</a></li>
              <li><a href="/contact.html">Contact</a></li>
              <li><a href="/track-order.html">Track Order</a></li>
            </ul>
          </div>
          <div>
            <h4>Policies</h4>
            <ul class="footer-links">
              <li><a href="/delivery.html">Delivery Information</a></li>
              <li><a href="/returns.html">Return Policy</a></li>
              <li><a href="/terms.html">Terms &amp; Conditions</a></li>
              <li><a href="/privacy.html">Privacy Policy</a></li>
              <li><a href="/admin/">Admin Dashboard</a></li>
            </ul>
          </div>
          <div>
            <h4>Contact Us</h4>
            <ul class="footer-contact">
              <li>${icons.pin}<span><a href="${esc(s.maps_url || '#')}" target="_blank" rel="noopener">${esc(s.address || '28 Chemu Rd, Accra, Down-Right')}</a></span></li>
              <li>${icons.phone}<a href="tel:${esc(s.phone || '')}">${esc(s.phone || '+233 …')}</a></li>
              <li>${icons.mail}<a href="mailto:${esc(s.email || '')}">${esc(s.email || 'sales@plus233automaster.com')}</a></li>
              <li>${icons.clock}<span>${esc(s.hours || 'Mon – Sat: 8:00 AM – 6:00 PM')}</span></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© ${new Date().getFullYear()} PLUS 233 AUTOMASTER — Home of Trusted Parts. Superior Performance. All rights reserved.</p>
          <div class="pay-strip">${icons.shield} Secure ordering &nbsp;·&nbsp; ${icons.truck} Nationwide delivery &nbsp;·&nbsp; ${icons.cash} Pay on delivery</div>
        </div>
      </div>
    </div>`;
  }

  /* ---------- misc ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function init(active) {
    const s = await settings();
    window.__PA_SETTINGS__ = s;
    document.documentElement.style.setProperty('--setting-phone', s.phone || '');
    initHeader(active);
    initFooter();
  }

  return {
    settings, fmt, fmtNum, getCart, onCart, addToCart, setQty, removeFromCart, clearCart, cartCount, cartSubtotal,
    toast, icons, stockLabel, stockPill, compatSummary, compatList, productCard, esc, init, save
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  PA.init(document.body.dataset.active || '/');
  // global delegation for qty steppers / add-to-cart / buy-now on any page
  document.addEventListener('click', (e) => {
    const minus = e.target.closest('.q-minus');
    const plus = e.target.closest('.q-plus');
    const add = e.target.closest('[data-add]');
    const buy = e.target.closest('[data-buy]');
    if (minus || plus) {
      const id = +((minus || plus).dataset.id);
      const input = document.querySelector(`.q-input[data-id="${id}"]`);
      if (!input) return;
      const v = Math.max(1, (parseInt(input.value) || 1) + (plus ? 1 : -1));
      input.value = v;
    }
    if (add) {
      const id = +add.dataset.add;
      const input = document.querySelector(`.q-input[data-id="${id}"]`);
      const qty = input ? parseInt(input.value) || 1 : 1;
      const card = add.closest('.pcard');
      const name = card ? card.querySelector('.pcard-name')?.textContent.trim() : '';
      const price = card ? parseFloat(card.querySelector('.price')?.textContent.replace(/[^0-9.]/g, '') || 0) : 0;
      const img = card ? card.querySelector('img')?.src : '';
      const pn = card ? card.querySelector('.pcard-pn')?.textContent.replace('Part No. ', '') : '';
      PA.addToCart(id, qty, { name, price, image: img, part_number: pn });
      PA.toast('Added to cart ✓', 'success');
    }
    if (buy) {
      const id = +buy.dataset.buy;
      const input = document.querySelector(`.q-input[data-id="${id}"]`);
      const qty = input ? parseInt(input.value) || 1 : 1;
      const card = buy.closest('.pcard');
      const name = card ? card.querySelector('.pcard-name')?.textContent.trim() : '';
      const price = card ? parseFloat(card.querySelector('.price')?.textContent.replace(/[^0-9.]/g, '') || 0) : 0;
      const img = card ? card.querySelector('img')?.src : '';
      const pn = card ? card.querySelector('.pcard-pn')?.textContent.replace('Part No. ', '') : '';
      PA.addToCart(id, qty, { name, price, image: img, part_number: pn });
      location.href = '/checkout.html';
    }
  });
});
