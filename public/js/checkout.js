/* PLUS 233 AUTOMASTER — checkout */
'use strict';
const esc = PA.esc;

async function render() {
  const box = document.getElementById('checkout-content');
  const cart = PA.getCart();

  if (!cart.length) {
    box.innerHTML = `
      <div class="cart-empty">
        ${PA.icons.cart}
        <h2>Nothing to check out</h2>
        <p>Your cart is empty — add some genuine parts first.</p>
        <a class="btn btn-primary" href="/shop.html">Shop Products</a>
      </div>`;
    return;
  }

  // Re-validate against the server (live prices & stock)
  const ids = cart.map(i => i.id).join(',');
  const r = await fetch('/api/products?ids=' + ids);
  const data = await r.json();
  const byId = Object.fromEntries(data.items.map(p => [p.id, p]));
  const s = await PA.settings();

  // prefill from signed-in account
  let acct = null;
  try {
    const tok = localStorage.getItem('pa233_customer_token');
    if (tok) {
      const mr = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + tok } });
      if (mr.ok) acct = await mr.json();
    }
  } catch { /* guest checkout is fine */ }

  const subtotal = cart.reduce((acc, i) => {
    const p = byId[i.id];
    if (!p) return acc;
    return acc + p.price_ghs * i.qty;
  }, 0);
  const freeOver = parseFloat(s.free_delivery_over || '1500') || 0;
  const accraFee = parseFloat(s.delivery_fee_accra || '40') || 0;
  const nationFee = parseFloat(s.delivery_fee_nationwide || '90') || 0;

  box.innerHTML = `
  <div class="checkout-layout">
    <form id="checkout-form" novalidate>
      <div class="form-card" style="margin-bottom:16px">
        <h3><span class="step-num">1</span> Contact &amp; Delivery Details</h3>
        <div class="form-grid">
          <div class="field">
            <label for="co-name">Full Name *</label>
            <input id="co-name" type="text" placeholder="e.g. Kwame Mensah" required>
          </div>
          <div class="field">
            <label for="co-phone">Phone Number *</label>
            <input id="co-phone" type="tel" placeholder="e.g. 024 000 0000" required>
          </div>
          <div class="field full">
            <label for="co-email">Email (optional — for order updates)</label>
            <input id="co-email" type="email" placeholder="you@example.com">
          </div>
          <div class="field full">
            <label for="co-address">Delivery Address *</label>
            <input id="co-address" type="text" placeholder="House number, street, landmark" required>
          </div>
          <div class="field">
            <label for="co-city">City / Town *</label>
            <input id="co-city" type="text" placeholder="e.g. Accra, Kumasi, Takoradi…" required>
          </div>
          <div class="field">
            <label for="co-notes">Order Notes</label>
            <input id="co-notes" type="text" placeholder="e.g. Call on arrival (optional)">
          </div>
        </div>
      </div>

      <div class="form-card">
        <h3><span class="step-num">2</span> Payment Method</h3>
        <div class="pay-options">
          <label class="pay-option selected">
            <input type="radio" name="pay" value="Cash on Delivery" checked>
            <div>${PA.icons.cash}<div><b>Cash on Delivery</b><small>Pay cash when your parts arrive</small></div></div>
          </label>
          <label class="pay-option">
            <input type="radio" name="pay" value="Mobile Money (MoMo)">
            <div>${PA.icons.phone}<div><b>Mobile Money (MoMo)</b><small>MTN / Telecel / AT — pay via mobile money</small></div></div>
          </label>
          <label class="pay-option">
            <input type="radio" name="pay" value="Bank Transfer">
            <div>${PA.icons.bank}<div><b>Bank Transfer</b><small>We confirm payment before dispatch</small></div></div>
          </label>
          <label class="pay-option">
            <input type="radio" name="pay" value="Card Payment">
            <div>${PA.icons.card}<div><b>Card Payment</b><small>Visa / Mastercard (coming soon)</small></div></div>
          </label>
        </div>
      </div>
    </form>

    <aside class="cart-summary">
      <h3>Order Summary</h3>
      <div class="checkout-items">
        ${cart.map(i => {
          const p = byId[i.id];
          if (!p) return '';
          const out = p.stock_status === 'out';
          return `
          <div class="co-item">
            <img src="${p.image_url || '/images/placeholder-part.jpg'}" alt="">
            <div>
              <div class="co-name">${esc(p.name)}</div>
              <div class="co-meta">${esc(p.part_number)} · Qty ${i.qty} · ${PA.fmt(p.price_ghs)} each</div>
              ${out ? '<div style="color:var(--danger);font-size:.74rem">⚠ Out of stock — remove from cart</div>' : ''}
            </div>
            <span class="co-line">${PA.fmt(p.price_ghs * i.qty)}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="sum-row" style="margin-top:14px"><span>Subtotal</span><span id="co-subtotal">${PA.fmt(subtotal)}</span></div>
      <div class="sum-row"><span>Delivery</span><span id="co-delivery">—</span></div>
      <div class="sum-row"><span>Delivery type</span><span id="co-delivery-type" style="font-size:.8rem">calculated from city</span></div>
      <div class="sum-row total"><span>Total</span><span id="co-total">${PA.fmt(subtotal)}</span></div>
      <div class="sum-note">${PA.icons.shield}<span>Delivery is free on orders over ${PA.fmt(freeOver)}. Your part number, price and stock are verified by our system before the order is placed.</span></div>
      <button class="btn btn-primary btn-block" id="place-order" style="font-size:1rem;padding:15px">PLACE ORDER — ${PA.fmt(subtotal)}</button>
      <a class="btn btn-ghost btn-block" href="/cart.html" style="margin-top:8px">Back to Cart</a>
    </aside>
  </div>`;

  /* live delivery fee on city input */
  const cityEl = document.getElementById('co-city');
  const deliveryEl = document.getElementById('co-delivery');
  const totalEl = document.getElementById('co-total');
  const typeEl = document.getElementById('co-delivery-type');
  const btn = document.getElementById('place-order');

  function updateFee() {
    const city = cityEl.value.trim();
    if (!city) { deliveryEl.textContent = '—'; typeEl.textContent = 'enter your city'; btn.textContent = `PLACE ORDER — ${PA.fmt(subtotal)}`; return; }
    const inAccra = /accra/i.test(city);
    const fee = subtotal >= freeOver ? 0 : (inAccra ? accraFee : nationFee);
    deliveryEl.textContent = fee === 0 ? 'FREE' : PA.fmt(fee);
    typeEl.textContent = subtotal >= freeOver ? 'FREE delivery (order over ' + PA.fmt(freeOver) + ')' : (inAccra ? 'Within Accra' : 'Nationwide');
    totalEl.textContent = PA.fmt(subtotal + fee);
    btn.textContent = `PLACE ORDER — ${PA.fmt(subtotal + fee)}`;
  }
  cityEl.addEventListener('input', updateFee);
  updateFee();

  /* prefill from signed-in account */
  if (acct) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
    set('co-name', acct.name);
    set('co-phone', acct.phone);
    set('co-email', acct.email);
    set('co-address', acct.address);
    set('co-city', acct.city);
    const note = document.querySelector('.cart-summary .sum-note');
    if (note) note.innerHTML = `${PA.icons.user}<span>Signed in as <b style="color:var(--text)">${esc(acct.email)}</b> — your order will be linked to your account.</span>`;
    updateFee();
  }

  /* payment method selection */
  document.querySelectorAll('.pay-option').forEach(opt => opt.addEventListener('click', () => {
    document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    opt.querySelector('input').checked = true;
  }));

  btn.addEventListener('click', async () => {
    const name = document.getElementById('co-name').value.trim();
    const phone = document.getElementById('co-phone').value.trim();
    const address = document.getElementById('co-address').value.trim();
    const city = cityEl.value.trim();
    const email = document.getElementById('co-email').value.trim();
    const notes = document.getElementById('co-notes').value.trim();
    const pay = document.querySelector('input[name="pay"]:checked')?.value || 'Cash on Delivery';

    if (!name || !phone || !address || !city) {
      PA.toast('Please fill in your name, phone, address and city', 'error');
      return;
    }
    if (!/^[0-9+\s]{6,}$/.test(phone)) {
      PA.toast('Please enter a valid phone number', 'error');
      return;
    }

    btn.disabled = true; btn.textContent = 'Placing order…';

    const items = cart.map(i => ({ id: i.id, qty: i.qty }));
    try {
      const headers = { 'Content-Type': 'application/json' };
      const tok = localStorage.getItem('pa233_customer_token');
      if (tok) headers.Authorization = 'Bearer ' + tok;
      const res = await fetch('/api/orders', {
        method: 'POST', headers,
        body: JSON.stringify({ items, customer: { name, phone, email, address, city }, delivery: { payment_method: pay, notes } })
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || 'Could not place order');

      PA.clearCart();
      showSuccess(order);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'PLACE ORDER';
      PA.toast(e.message, 'error');
    }
  });

  function showSuccess(order) {
    box.innerHTML = `
      <div class="success-screen">
        <div class="check-circle">${PA.icons.check}</div>
        <h1>Order Placed Successfully!</h1>
        <p>Thank you, <b>${esc(order.customer_name)}</b>. Your order has been received and is being prepared.</p>
        <div class="order-num">Order #${esc(order.order_number)}</div>
        <p style="font-size:.9rem">Total: <b style="color:#fff">${PA.fmt(order.total_ghs)}</b> · ${esc(order.payment_method)}</p>
        <p style="font-size:.9rem">Delivery to: ${esc(order.address)}, ${esc(order.city)}</p>
        <p style="font-size:.86rem;color:var(--muted)">We'll call you on <b style="color:var(--text-2)">${esc(order.customer_phone)}</b> to confirm delivery.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <a class="btn btn-primary" href="/track-order.html?order=${esc(order.order_number)}">Track My Order</a>
          <a class="btn btn-outline" href="/shop.html">Continue Shopping</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

document.addEventListener('DOMContentLoaded', render);
