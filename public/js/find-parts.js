/* PLUS 233 AUTOMASTER — find parts page (vehicle compatibility) */
'use strict';
const esc = PA.esc;
const fp = { make: '', model: '', year: '', engine: '' };

async function loadMakes() {
  const el = document.getElementById('fp-make');
  const r = await fetch('/api/vehicles/makes');
  const makes = await r.json();
  el.innerHTML = '<option value="">Select Make…</option>' + makes.map(m => `<option value="${esc(m.make)}">${esc(m.make)}</option>`).join('');
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
  const start = info ? info.ys : 2000;
  const end = info && info.ye < 9999 ? info.ye : new Date().getFullYear();
  const years = [];
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
  document.getElementById('fp-submit').disabled = !(fp.make && fp.model && fp.year);
}

async function search() {
  const box = document.getElementById('fp-results');
  box.innerHTML = '<p style="color:var(--muted)">Searching compatible parts…</p>';
  const r = await fetch('/api/parts/find', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fp)
  });
  const data = await r.json();
  if (data.error) { box.innerHTML = `<p style="color:var(--danger)">${esc(data.error)}</p>`; return; }

  const parts = data.items;
  box.innerHTML = `
    <div class="results-toolbar">
      <span class="vehicle-chip">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
        ${esc(data.make)} ${esc(data.model)} · ${data.year}${data.engine ? ' · ' + esc(data.engine) : ''}
      </span>
      <button class="btn btn-outline btn-sm" id="fp-change">Change vehicle</button>
      <span class="result-count" style="margin-left:auto">${parts.length} compatible part${parts.length === 1 ? '' : 's'} found</span>
    </div>
    ${parts.length ? '' : `<div class="results-note">${PA.icons.alert}<div><b>No exact matches found.</b> Contact us and we'll source the right genuine part for your ${esc(data.make)} ${esc(data.model)}.</div></div>`}
    <div class="products-grid">${parts.map(p => PA.productCard(p)).join('')}</div>`;

  document.getElementById('fp-change')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function init() {
  const qs = new URLSearchParams(location.search);
  loadMakes();
  const makeEl = document.getElementById('fp-make');
  const modelEl = document.getElementById('fp-model');
  const yearEl = document.getElementById('fp-year');
  const engEl = document.getElementById('fp-engine');

  makeEl.addEventListener('change', () => { fp.make = makeEl.value; fp.model = fp.year = fp.engine = ''; loadModels(fp.make); updateSubmit(); });
  modelEl.addEventListener('change', () => { fp.model = modelEl.value; fp.year = fp.engine = ''; loadYears(fp.model); updateSubmit(); });
  yearEl.addEventListener('change', () => { fp.year = yearEl.value; fp.engine = ''; loadEngines(fp.make, fp.model, fp.year); updateSubmit(); });
  engEl.addEventListener('change', () => { fp.engine = engEl.value; });

  document.getElementById('fp-submit').addEventListener('click', () => {
    if (fp.make && fp.model && fp.year) search();
  });

  // deep-link: prefill from URL (e.g. homepage finder)
  if (qs.get('make') && qs.get('model') && qs.get('year')) {
    loadMakes().then(async () => {
      makeEl.value = qs.get('make'); fp.make = qs.get('make');
      await loadModels(fp.make);
      modelEl.value = qs.get('model'); fp.model = qs.get('model');
      loadYears(fp.model);
      yearEl.value = qs.get('year'); fp.year = qs.get('year');
      await loadEngines(fp.make, fp.model, fp.year);
      if (qs.get('engine')) { engEl.value = qs.get('engine'); fp.engine = qs.get('engine'); }
      updateSubmit();
      search();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
