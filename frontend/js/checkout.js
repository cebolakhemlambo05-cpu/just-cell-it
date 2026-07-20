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

// ---------- delivery form ----------

function getDeliveryMethod() {
  const checked = document.querySelector('input[name="delivery-method"]:checked');
  return checked ? checked.value : 'address';
}

function toggleDeliveryFields() {
  const method = getDeliveryMethod();
  document.getElementById('address-fields').style.display = method === 'address' ? 'block' : 'none';
  document.getElementById('pep-fields').style.display = method === 'pep' ? 'block' : 'none';
  updatePayButtonState();
}

function collectDeliveryDetails() {
  const method = getDeliveryMethod();
  const base = {
    method,
    name: document.getElementById('d-name').value.trim(),
    phone: document.getElementById('d-phone').value.trim(),
    email: document.getElementById('d-email').value.trim(),
  };

  if (method === 'address') {
    return {
      ...base,
      street: document.getElementById('d-street').value.trim(),
      suburb: document.getElementById('d-suburb').value.trim(),
      city: document.getElementById('d-city').value.trim(),
      province: document.getElementById('d-province').value,
      postalCode: document.getElementById('d-postal').value.trim(),
      instructions: document.getElementById('d-instructions').value.trim(),
    };
  }

  return {
    ...base,
    pepStore: document.getElementById('d-pep-store').value.trim(),
    pepSuburb: document.getElementById('d-pep-suburb').value.trim(),
  };
}

function isValidPhone(phone) {
  // Basic SA mobile check: 10 digits, optionally with spaces/dashes/leading +27
  const digits = phone.replace(/[\s-]/g, '');
  return /^(\+27|0)\d{9}$/.test(digits);
}

function validateDelivery(details) {
  if (!details.name) return 'Please enter your full name.';
  if (!details.phone || !isValidPhone(details.phone)) return 'Please enter a valid South African mobile number.';
  if (!details.email || !/^\S+@\S+\.\S+$/.test(details.email)) return 'Please enter a valid email address.';

  if (details.method === 'address') {
    if (!details.street) return 'Please enter your street address.';
    if (!details.suburb) return 'Please enter your suburb.';
    if (!details.city) return 'Please enter your city or town.';
    if (!details.province) return 'Please select your province.';
    if (!/^\d{4}$/.test(details.postalCode)) return 'Please enter a valid 4-digit postal code.';
  } else {
    if (!details.pepStore) return 'Please enter your nearest PEP store.';
    if (!details.pepSuburb) return 'Please enter the suburb of that PEP store.';
  }

  return null;
}

function updatePayButtonState() {
  const btn = document.getElementById('pay-btn');
  const details = collectDeliveryDetails();
  const error = validateDelivery(details);
  btn.disabled = Boolean(error);
  btn.textContent = error ? 'Complete delivery details to continue' : 'Pay Now';
}

function attachDeliveryListeners() {
  document.querySelectorAll('input[name="delivery-method"]').forEach((radio) => {
    radio.addEventListener('change', toggleDeliveryFields);
  });
  document.getElementById('delivery-card').addEventListener('input', updatePayButtonState);
  document.getElementById('delivery-card').addEventListener('change', updatePayButtonState);
  toggleDeliveryFields();
}

// ---------- payment ----------

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

  attachDeliveryListeners();

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