/* PLUS 233 AUTOMASTER — product detail page */
'use strict';
const esc = PA.esc;

async function load() {
  const id = new URLSearchParams(location.search).get('id');
  const box = document.getElementById('pd-content');
  if (!id) { box.innerHTML = '<p style="color:var(--muted)">No product selected. <a href="/shop.html" style="color:var(--blue-2)">Browse the shop →</a></p>'; return; }
  const r = await fetch('/api/products/' + id);
  if (!r.ok) { box.innerHTML = '<p style="color:var(--muted)">Product not found. <a href="/shop.html" style="color:var(--blue-2)">Browse the shop →</a></p>'; return; }
  const p = await r.json();
  const out = p.stock_status === 'out';

  document.title = p.name + ' — PLUS 233 AUTOMASTER';
  document.getElementById('pd-breadcrumb').innerHTML =
    `<a href="/">Home</a> › <a href="/shop.html">Shop</a> › <a href="/shop.html?category=${esc(p.category.slug)}">${esc(p.category.name)}</a> › <span>${esc(p.name)}</span>`;

  box.innerHTML = `
  <div class="pd-layout">
    <div class="pd-gallery">
      <div class="pd-main-img">
        <img src="${p.image_url || '/images/placeholder-part.jpg'}" alt="${esc(p.name)}">
      </div>
    </div>
    <div class="pd-info">
      <div class="pd-brand-row">
        <span class="pd-brand">${esc(p.brand)}</span>
        ${PA.stockPill(p)}
      </div>
      <h1 class="pd-title">${esc(p.name)}</h1>
      <div class="pd-pn">Part No. ${esc(p.part_number)}</div>
      <div class="pd-price-row">
        <span class="pd-price"><small>GH₵</small>${PA.fmtNum(p.price_ghs)}</span>
        <span style="color:var(--muted);font-size:.86rem">${p.featured ? '★ Featured product' : 'Genuine quality assured'}</span>
      </div>
      <p class="pd-desc">${esc(p.description)}</p>

      <div class="pd-meta">
        <div class="pd-meta-item">${PA.icons.shield}<div><b>100% Genuine</b>Quality checked &amp; guaranteed</div></div>
        <div class="pd-meta-item">${PA.icons.truck}<div><b>Delivery</b>Accra &amp; nationwide</div></div>
        <div class="pd-meta-item">${PA.icons.cash}<div><b>Payment</b>Cash on delivery available</div></div>
        <div class="pd-meta-item">${PA.icons.headset}<div><b>Support</b>Fitment help before you buy</div></div>
      </div>

      ${p.compatibility && p.compatibility.length ? `
      <div class="pd-compat">
        <h4>${PA.icons.car} Vehicle Compatibility</h4>
        <div class="compat-list">${PA.compatList(p)}</div>
      </div>` : ''}

      <div class="pd-buy-row">
        <div class="qty-stepper">
          <button class="pd-minus" type="button">−</button>
          <input id="pd-qty" type="number" value="1" min="1" max="${Math.max(1, p.stock_qty)}" aria-label="Quantity">
          <button class="pd-plus" type="button">+</button>
        </div>
        <button class="btn btn-outline" id="pd-add" ${out ? 'disabled' : ''}>${PA.icons.cart} Add to Cart</button>
        <button class="btn btn-primary" id="pd-buy" ${out ? 'disabled' : ''}>Buy Now</button>
      </div>
      ${out ? '<p style="color:var(--danger);font-size:.86rem;margin-top:6px">This item is currently out of stock. Contact us to check restock timing.</p>' : ''}
    </div>
  </div>`;

  const qty = document.getElementById('pd-qty');
  document.querySelector('.pd-minus').addEventListener('click', () => qty.value = Math.max(1, (parseInt(qty.value) || 1) - 1));
  document.querySelector('.pd-plus').addEventListener('click', () => qty.value = Math.min(p.stock_qty, (parseInt(qty.value) || 1) + 1));

  document.getElementById('pd-add').addEventListener('click', () => {
    PA.addToCart(p.id, parseInt(qty.value) || 1, { name: p.name, price: p.price_ghs, image: p.image_url, part_number: p.part_number });
    PA.toast('Added to cart ✓', 'success');
  });
  document.getElementById('pd-buy').addEventListener('click', () => {
    PA.addToCart(p.id, parseInt(qty.value) || 1, { name: p.name, price: p.price_ghs, image: p.image_url, part_number: p.part_number });
    location.href = '/checkout.html';
  });

  if (p.related && p.related.length) {
    document.getElementById('related-grid').innerHTML = p.related.map(x => PA.productCard(x)).join('');
  } else {
    document.getElementById('related-sec').style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', load);
