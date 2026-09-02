/* PLUS 233 AUTOMASTER — shop page logic */
'use strict';
const esc = PA.esc;

const state = {
  q: new URLSearchParams(location.search).get('q') || '',
  category: new URLSearchParams(location.search).get('category') || '',
  brand: '',
  sort: 'featured',
  page: 1,
  inStock: false,
  total: 0, pages: 1
};

function setParam(k, v) {
  const url = new URL(location.href);
  if (v) url.searchParams.set(k, v); else url.searchParams.delete(k);
  url.searchParams.delete('page');
  history.replaceState(null, '', url);
}

async function loadSidebar() {
  try {
    const r = await fetch('/api/categories');
    const cats = await r.json();
    document.getElementById('side-cats').innerHTML =
      `<li><a href="/shop.html" class="${!state.category ? 'active' : ''}">All Products</a></li>` +
      cats.map(c => `<li><a href="/shop.html?category=${encodeURIComponent(c.slug)}" class="${state.category === c.slug ? 'active' : ''}">${esc(c.name)}</a></li>`).join('');
  } catch { /* noop */ }
}

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  const pager = document.getElementById('pagination');
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.brand) params.set('brand', state.brand);
  if (state.sort) params.set('sort', state.sort);
  if (state.inStock) params.set('in_stock', '1');
  params.set('page', state.page);
  params.set('per_page', '12');

  grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1;padding:30px 0">Loading products…</p>';
  const r = await fetch('/api/products?' + params);
  const data = await r.json();
  state.total = data.total; state.pages = data.pages;

  document.getElementById('page-title').textContent = data.category ? esc(data.category.name) : (state.q ? `Results for “${esc(state.q)}”` : 'Shop All Products');
  document.getElementById('page-sub').textContent = data.category ? esc(data.category.description) : 'Browse genuine parts with prices in Ghana Cedis. Use the search and filters to find exactly what fits your vehicle.';
  const rc = document.getElementById('result-count');
  if (rc) rc.textContent = '';

  const crumb = document.getElementById('bc-crumb');
  crumb.innerHTML = data.category ? `<a href="/shop.html">Shop</a> › ${esc(data.category.name)}` : 'Shop';

  const block = document.getElementById('brand-block');
  const chips = document.getElementById('brand-chips');
  if (data.brands && data.brands.length) {
    block.style.display = '';
    chips.innerHTML = data.brands.map(b =>
      `<button class="${state.brand === b ? 'active' : ''}" data-brand="${esc(b)}">${esc(b)}</button>`).join('');
  } else block.style.display = 'none';

  if (!data.items.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px">
        <div style="font-size:2.4rem;margin-bottom:12px">🔧</div>
        <h3 style="margin-bottom:6px">No parts found${state.category || state.brand ? ' for these filters' : ''}</h3>
        <p style="color:var(--muted);margin-bottom:18px">Try a different search — or contact us and we'll source it for you.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" id="clear-filters">Clear filters</button>
          <a class="btn btn-primary btn-sm" href="/contact.html">Request this part</a>
        </div>
      </div>`;
    document.getElementById('clear-filters')?.addEventListener('click', () => { location.href = '/shop.html'; });
  } else {
    grid.innerHTML = data.items.map(p => PA.productCard(p)).join('');
  }

  let pagesHtml = '';
  if (data.pages > 1) {
    pagesHtml += `<button ${state.page <= 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹</button>`;
    for (let i = 1; i <= data.pages; i++) {
      if (data.pages > 9 && i > 2 && i < data.pages - 1 && Math.abs(i - state.page) > 1) {
        if (i === 3 || i === data.pages - 2) pagesHtml += '<span style="color:var(--muted);align-self:center">…</span>';
        continue;
      }
      pagesHtml += `<button class="${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    pagesHtml += `<button ${state.page >= data.pages ? 'disabled' : ''} data-page="${state.page + 1}">›</button>`;
  }
  pager.innerHTML = pagesHtml;
  pager.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => {
    state.page = +b.dataset.page;
    setParam('page', state.page > 1 ? state.page : '');
    loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

function init() {
  const qs = new URLSearchParams(location.search);
  state.q = qs.get('q') || '';
  state.category = qs.get('category') || '';
  state.page = parseInt(qs.get('page')) || 1;
  document.getElementById('shop-q').value = state.q;
  document.getElementById('shop-sort').value = state.sort;

  document.getElementById('shop-search-form').addEventListener('submit', e => {
    e.preventDefault();
    state.q = document.getElementById('shop-q').value.trim();
    state.page = 1;
    setParam('q', state.q);
    loadProducts();
  });

  document.getElementById('shop-sort').addEventListener('change', e => {
    state.sort = e.target.value; state.page = 1; loadProducts();
  });

  document.getElementById('in-stock-only').addEventListener('change', e => {
    state.inStock = e.target.checked; state.page = 1; loadProducts();
  });

  document.getElementById('filter-toggle').addEventListener('click', () => {
    const sb = document.getElementById('shop-sidebar');
    sb.style.display = sb.style.display === 'none' ? '' : 'none';
  });

  document.getElementById('brand-chips').addEventListener('click', e => {
    const b = e.target.closest('[data-brand]');
    if (!b) return;
    state.brand = state.brand === b.dataset.brand ? '' : b.dataset.brand;
    state.page = 1;
    loadProducts();
  });

  loadSidebar();
  loadProducts();
}

document.addEventListener('DOMContentLoaded', init);
