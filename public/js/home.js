/* PLUS 233 AUTOMASTER — homepage logic */
'use strict';
const esc = PA.esc;

/* ---------- category cards ---------- */
async function loadCategories() {
  const grid = document.getElementById('cat-grid');
  if (!grid) return;
  try {
    const r = await fetch('/api/categories');
    const cats = await r.json();
    grid.innerHTML = cats.map(c => `
      <a class="cat-card" href="/shop.html?category=${encodeURIComponent(c.slug)}">
        <img src="${c.image || '/images/placeholder-cat.jpg'}" alt="${esc(c.name)}" loading="lazy">
        <div class="cat-body">
          <div class="cat-name">${esc(c.name)}</div>
          <div class="cat-count">${PA.icons.arrowRight}<span>${c.product_count || 0} products</span></div>
        </div>
      </a>`).join('');
  } catch {
    grid.innerHTML = '<p style="color:var(--muted)">Categories are loading…</p>';
  }
}

/* ---------- featured products ---------- */
async function loadFeatured() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  try {
    const r = await fetch('/api/products?featured=1&per_page=8&sort=featured');
    const data = await r.json();
    grid.innerHTML = data.items.map(p => PA.productCard(p)).join('') ||
      '<p style="color:var(--muted)">Featured products coming soon.</p>';
  } catch {
    grid.innerHTML = '<p style="color:var(--muted)">Products are loading…</p>';
  }
}

/* ---------- hero search ---------- */
function initHeroSearch() {
  const form = document.getElementById('hero-search');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = document.getElementById('hero-search-input').value.trim();
    location.href = '/shop.html' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
}

/* ---------- vehicle finder cascading selects ---------- */
const fp = { make: null, model: null, year: null, engine: null };

async function loadMakes() {
  const el = document.getElementById('fp-make');
  try {
    const r = await fetch('/api/vehicles/makes');
    const makes = await r.json();
    el.innerHTML = '<option value="">Select Make…</option>' + makes.map(m => `<option value="${esc(m.make)}">${esc(m.make)} (${m.model_count})</option>`).join('');
  } catch { /* noop */ }
}

async function loadModels(make) {
  const el = document.getElementById('fp-model');
  const yearEl = document.getElementById('fp-year');
  const engEl = document.getElementById('fp-engine');
  el.disabled = !make; yearEl.disabled = true; engEl.disabled = true;
  yearEl.innerHTML = '<option value="">Select Year…</option>';
  engEl.innerHTML = '<option value="">Any Engine</option>';
  if (!make) { el.innerHTML = '<option value="">Select Model…</option>'; return; }
  const r = await fetch('/api/vehicles/models?make=' + encodeURIComponent(make));
  const models = await r.json();
  el.innerHTML = '<option value="">Select Model…</option>' + models.map(m => `<option value="${esc(m.model)}">${esc(m.model)}</option>`).join('');
  el.dataset.years = JSON.stringify(models.map(m => ({ model: m.model, ys: m.year_start, ye: m.year_end })));
}

function loadYears(model) {
  const yearEl = document.getElementById('fp-year');
  const engEl = document.getElementById('fp-engine');
  engEl.disabled = true;
  engEl.innerHTML = '<option value="">Any Engine</option>';
  if (!model) { yearEl.disabled = true; yearEl.innerHTML = '<option value="">Select Year…</option>'; return; }
  const modelEl = document.getElementById('fp-model');
  const list = JSON.parse(modelEl.dataset.years || '[]');
  const info = list.find(m => m.model === model);
  const years = [];
  const start = info ? info.ys : 2000;
  const end = info && info.ye < 9999 ? info.ye : new Date().getFullYear();
  for (let y = end; y >= start; y--) years.push(y);
  yearEl.innerHTML = '<option value="">Select Year…</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  yearEl.disabled = false; // year is the next step — engine waits for the year
}

async function loadEngines(make, model, year) {
  const engEl = document.getElementById('fp-engine');
  if (!make || !model) return;
  if (!year) { engEl.disabled = true; engEl.innerHTML = '<option value="">Any Engine</option>'; return; }
  const r = await fetch(`/api/vehicles/engines?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(year)}`);
  const engines = await r.json();
  engEl.innerHTML = '<option value="">Any Engine</option>' + engines.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
  engEl.disabled = false;
}

function updateSubmit() {
  const btn = document.getElementById('fp-submit');
  const hint = document.getElementById('fp-hint');
  btn.disabled = !(fp.make && fp.model && fp.year);
  if (!btn.disabled) hint.textContent = `${fp.make} · ${fp.model} · ${fp.year}${fp.engine ? ' · ' + fp.engine : ''}`;
  else hint.textContent = 'e.g. Toyota · Corolla · 2012 · 1.8L';
}

function initFinder() {
  if (!document.getElementById('fp-make')) return;
  loadMakes();
  const makeEl = document.getElementById('fp-make');
  const modelEl = document.getElementById('fp-model');
  const yearEl = document.getElementById('fp-year');
  const engEl = document.getElementById('fp-engine');

  makeEl.addEventListener('change', () => {
    fp.make = makeEl.value; fp.model = fp.year = fp.engine = '';
    loadModels(fp.make); updateSubmit();
  });
  modelEl.addEventListener('change', () => {
    fp.model = modelEl.value; fp.year = fp.engine = '';
    loadYears(fp.model); updateSubmit();
  });
  yearEl.addEventListener('change', () => { fp.year = yearEl.value; fp.engine = ''; loadEngines(fp.make, fp.model, fp.year); updateSubmit(); });
  engEl.addEventListener('change', () => { fp.engine = engEl.value; updateSubmit(); });

  document.getElementById('fp-submit').addEventListener('click', () => {
    if (!(fp.make && fp.model && fp.year)) return;
    location.href = `/find-parts.html?make=${encodeURIComponent(fp.make)}&model=${encodeURIComponent(fp.model)}&year=${fp.year}${fp.engine ? '&engine=' + encodeURIComponent(fp.engine) : ''}`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadFeatured();
  initHeroSearch();
  initFinder();
});
