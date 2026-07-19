const params = new URLSearchParams(window.location.search);
let currentProduct = null;
let quantity = 1;

function formatZAR(amount) {
  return `R${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function requireLogin() {
  if (!getToken()) {
    const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
    window.location.href = `login.html?next=${next}`;
    return false;
  }
  return true;
}

function renderSummary() {
  const card = document.getElementById('summary-card');
  const total = currentProduct.price * quantity;
  card.innerHTML = `
    <div style="display:flex; gap:16px; align-items:center; margin-bottom:20px;">
      <img src="${currentProduct.image}" alt="${currentProduct.name}" style="width:72px; height:72px; object-fit:cover; border-radius:10px;" />
      <div>
        <h3 style="margin:0;">${currentProduct.name}</h3>
        <div class="meta" style="font-family:var(--font-mono); color:var(--muted); font-size:0.82rem;">${currentProduct.storage} · ${currentProduct.color}</div>
      </div>
    </div>
    <div class="summary-row">
      <span>Quantity</span>
      <div class="qty-control">
        <button type="button" id="qty-minus" aria-label="Decrease quantity">–</button>
        <span id="qty-value">${quantity}</span>
        <button type="button" id="qty-plus" aria-label="Increase quantity">+</button>
      </div>
    </div>
    <div class="summary-row"><span>Unit price</span><span>${formatZAR(currentProduct.price)}</span></div>
    <div class="summary-row total"><span>Total</span><span>${formatZAR(total)}</span></div>
  `;
  document.getElementById('qty-minus').addEventListener('click', () => {
    if (quantity > 1) { quantity--; renderSummary(); }
  });
  document.getElementById('qty-plus').addEventListener('click', () => {
    if (quantity < currentProduct.stock) { quantity++; renderSummary(); }
  });
}

function goToYoco() {
  const btn = document.getElementById('pay-btn');
  btn.disabled = true;
  btn.textContent = 'Redirecting to Yoco…';

  const amount = (currentProduct.price * quantity).toFixed(2);
  // A short, unique reference so you can match this payment to the order
  // when you check your Yoco dashboard (or a future webhook integration).
  const reference = `ORD-${Date.now()}`;

  const url = new URL(YOCO_PAY_URL);
  url.searchParams.set('amount', amount);
  url.searchParams.set('reference', reference);
  window.location.href = url.toString();
}

function showCheckoutError(message) {
  let box = document.getElementById('checkout-error');
  if (!box) {
    box = document.createElement('div');
    box.id = 'checkout-error';
    box.className = 'alert alert-error show';
    document.querySelector('.pay-card').prepend(box);
  }
  box.textContent = message;
  box.classList.add('show');
}

function initOrderView() {
  const productId = params.get('product');
  if (!productId) {
    document.getElementById('summary-card').innerHTML = `<p>No product selected. <a href="catalog.html" style="color:var(--accent)">Back to shop</a></p>`;
    return;
  }
  apiFetch(`/api/products/${productId}`)
    .then((product) => { currentProduct = product; renderSummary(); })
    .catch(() => {
      document.getElementById('summary-card').innerHTML = `<p>Couldn't load that product. <a href="catalog.html" style="color:var(--accent)">Back to shop</a></p>`;
    });

  document.getElementById('pay-btn').addEventListener('click', () => {
    if (!currentProduct) return;
    goToYoco();
  });
}

function renderStatus(status, reference) {
  document.getElementById('order-view').style.display = 'none';
  document.getElementById('status-view').style.display = 'block';
  const card = document.getElementById('status-card');

  const views = {
    success: {
      icon: '✓', cls: 'success', title: 'Payment received',
      body: `Your order <strong>${reference}</strong> is confirmed. We'll email you when it ships.`,
    },
    pending: {
      icon: '⋯', cls: 'pending', title: 'Payment pending',
      body: `We're waiting on final confirmation from your bank for order <strong>${reference}</strong>. This can take a minute — refresh if it doesn't update.`,
    },
    cancelled: {
      icon: '✕', cls: 'error', title: 'Payment cancelled',
      body: `You cancelled the payment for order <strong>${reference}</strong>. No money was deducted.`,
    },
    error: {
      icon: '!', cls: 'error', title: 'Payment failed',
      body: `Something went wrong processing order <strong>${reference}</strong>. No money was deducted — please try again.`,
    },
  };
  const v = views[status] || views.error;
  card.innerHTML = `
    <div class="status-icon ${v.cls}">${v.icon}</div>
    <h2>${v.title}</h2>
    <p style="color:var(--muted);">${v.body}</p>
    <a href="catalog.html" class="btn btn-primary" style="margin-top:16px;">Continue shopping</a>
  `;
}

function initStatusView(status, reference) {
  renderStatus(status, reference);
  // Note: this basic Yoco Payment Page integration doesn't report payment
  // status back to the server, so this reflects the URL only. Upgrading to
  // Yoco's full API + webhooks later would let this check a real order record.
}

if (!requireLogin()) {
  // redirecting to login
} else {
  const status = params.get('status');
  const reference = params.get('ref');
  if (status && reference) {
    initStatusView(status, reference);
  } else {
    initOrderView();
  }
}
