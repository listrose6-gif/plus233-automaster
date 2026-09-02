/* PLUS 233 AUTOMASTER — cart page */
'use strict';
const esc = PA.esc;

async function render() {
  const box = document.getElementById('cart-content');
  const cart = PA.getCart();

  if (!cart.length) {
    box.innerHTML = `
      <div class="cart-empty">
        ${PA.icons.cart}
        <h2>Your cart is empty</h2>
        <p>Browse genuine parts, check compatibility with your vehicle, and add what you need.</p>
        <a class="btn btn-primary" href="/shop.html">Shop Products</a>
        <a class="btn btn-outline" href="/find-parts.html" style="margin-left:8px">Find Parts for My Car</a>
      </div>`;
    document.getElementById('cart-suggest').style.display = '';
    loadSuggestions();
    return;
  }

  const ids = cart.map(i => i.id).join(',');
  let products = [];
  try {
    const r = await fetch('/api/products?ids=' + ids);
    const data = await r.json();
    products = data.items;
  } catch { /* keep local data */ }

  const byId = Object.fromEntries(products.map(p => [p.id, p]));
  const subtotal = cart.reduce((s, i) => s + (byId[i.id] ? byId[i.id].price_ghs : i.price || 0) * i.qty, 0);
  const s = await PA.settings();
  const freeOver = parseFloat((s.free_delivery_over) || '1500') || 0;
  const accraFee = parseFloat((s.delivery_fee_accra) || '40') || 0;
  const nationFee = parseFloat((s.delivery_fee_nationwide) || '90') || 0;

  box.innerHTML = `
  <div class="cart-layout">
    <div>
      <div class="cart-items">
        ${cart.map(i => {
          const p = byId[i.id];
          const price = p ? p.price_ghs : (i.price || 0);
          const img = p ? p.image_url : i.image;
          const name = p ? p.name : i.name;
          const pn = p ? p.part_number : i.part_number;
          const out = p && p.stock_status === 'out';
          const maxQty = 99;
          return `
          <div class="cart-item" data-cid="${i.id}">
            <a href="/product.html?id=${i.id}"><img src="${img || '/images/placeholder-part.jpg'}" alt="${esc(name)}"></a>
            <div>
              <div class="ci-name"><a href="/product.html?id=${i.id}">${esc(name)}</a></div>
              <div class="ci-meta">${esc(pn || '')}</div>
              <div class="ci-price">${PA.fmt(price)} each</div>
              ${out ? '<div style="color:var(--danger);font-size:.78rem">Out of stock — remove to check out</div>' : ''}
            </div>
            <div class="ci-right">
              <div class="qty-stepper">
                <button class="c-minus" data-id="${i.id}" type="button">−</button>
                <input class="c-qty" data-id="${i.id}" type="number" value="${i.qty}" min="1" max="${maxQty}" aria-label="Quantity">
                <button class="c-plus" data-id="${i.id}" type="button">+</button>
              </div>
              <span class="ci-line">${PA.fmt(price * i.qty)}</span>
              <button class="remove-btn" data-remove="${i.id}" type="button">${PA.icons.trash} Remove</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <aside class="cart-summary">
      <h3>Order Summary</h3>
      <div class="sum-row"><span>Subtotal (${PA.cartCount()} item${PA.cartCount() === 1 ? '' : 's'})</span><span>${PA.fmt(subtotal)}</span></div>
      <div class="sum-row"><span>Delivery (Accra)</span><span>${PA.fmt(subtotal >= freeOver ? 0 : accraFee)}</span></div>
      <div class="sum-row"><span>Delivery (Nationwide)</span><span>${PA.fmt(subtotal >= freeOver ? 0 : nationFee)}</span></div>
      <div class="sum-row total"><span>Total</span><span>${PA.fmt(subtotal)}<small> + delivery</small></span></div>
      <div class="sum-note">${PA.icons.truck}<span>Delivery is calculated at checkout — free on orders over ${PA.fmt(freeOver)}. <a href="/delivery.html" style="color:var(--blue-2)">Delivery info</a></span></div>
      <button class="btn btn-primary btn-block" id="go-checkout">Proceed to Checkout</button>
      <a class="btn btn-ghost btn-block" href="/shop.html" style="margin-top:8px">Continue Shopping</a>
    </aside>
  </div>`;

  document.getElementById('go-checkout').addEventListener('click', () => location.href = '/checkout.html');
  document.getElementById('cart-suggest').style.display = '';
  loadSuggestions();

  box.querySelectorAll('.c-minus').forEach(b => b.addEventListener('click', () => {
    const id = +b.dataset.id;
    const item = PA.getCart().find(i => i.id === id);
    if (item) PA.setQty(id, item.qty - 1);
    render();
  }));
  box.querySelectorAll('.c-plus').forEach(b => b.addEventListener('click', () => {
    const id = +b.dataset.id;
    const item = PA.getCart().find(i => i.id === id);
    if (item) PA.setQty(id, item.qty + 1);
    render();
  }));
  box.querySelectorAll('.c-qty').forEach(inp => inp.addEventListener('change', () => {
    PA.setQty(+inp.dataset.id, parseInt(inp.value) || 1);
    render();
  }));
  box.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
    PA.removeFromCart(+b.dataset.remove);
    PA.toast('Removed from cart');
    render();
  }));
}

async function loadSuggestions() {
  const grid = document.getElementById('suggest-grid');
  try {
    const r = await fetch('/api/products?featured=1&per_page=4&in_stock=1');
    const data = await r.json();
    grid.innerHTML = data.items.map(p => PA.productCard(p)).join('');
  } catch { /* noop */ }
}

document.addEventListener('DOMContentLoaded', render);
PA.onCart(render);
