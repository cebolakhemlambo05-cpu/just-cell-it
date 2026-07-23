// ============================================
// API Configuration
// ============================================
const API_BASE_URL = 'https://just-cell-it-5.onrender.com';

// ============================================
// Constants & State
// ============================================
const params = new URLSearchParams(window.location.search);
let currentProduct = null;
let quantity = 1;

// Your Yoco hosted Payment Page
const YOCO_PAY_URL = 'https://pay.yoco.com/just-cell-it1';

// ============================================
// Helper Functions
// ============================================
function formatZAR(amount) {
  return `R${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function requireLogin() {
  if (!getToken()) {
    const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
    window.location.href = `login.html?next=${next}`;
    return false;
  }
  return true;
}

// ============================================
// API Fetch Helper
// ============================================
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (response.status === 401 && token) {
    clearSession();
    const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
    window.location.href = `login.html?next=${next}`;
    throw new Error('Your session expired — please log in again.');
  }

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}

// ============================================
// Order Summary
// ============================================
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

// ============================================
// Delivery Form
// ============================================
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

// ============================================
// Payment Processing
// ============================================
async function processOrder() {
  const btn = document.getElementById('pay-btn');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  const delivery = collectDeliveryDetails();
  const error = validateDelivery(delivery);
  if (error) {
    showCheckoutError(error);
    btn.disabled = false;
    btn.textContent = 'Pay Now';
    return;
  }

  try {
    const response = await apiFetch('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        productId: currentProduct.id,
        quantity: quantity,
        delivery: delivery,
      }),
    });

    // Redirect to Yoco payment page
    if (response.redirectUrl) {
      window.location.href = response.redirectUrl;
    } else {
      throw new Error('No redirect URL received from server');
    }
  } catch (err) {
    showCheckoutError(err.message || 'Could not start payment. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Pay Now';
  }
}

function goToYoco() {
  // This is now handled by processOrder() which uses the backend API
  // Keep this for backwards compatibility
  processOrder();
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

// ============================================
// Status View
// ============================================
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
}

// ============================================
// Order View
// ============================================
function initOrderView() {
  const productId = params.get('product');
  if (!productId) {
    document.getElementById('summary-card').innerHTML = `<p>No product selected. <a href="catalog.html" style="color:var(--accent)">Back to shop</a></p>`;
    return;
  }
  
  apiFetch(`/api/products/${productId}`)
    .then((product) => { 
      currentProduct = product; 
      renderSummary(); 
    })
    .catch(() => {
      document.getElementById('summary-card').innerHTML = `<p>Couldn't load that product. <a href="catalog.html" style="color:var(--accent)">Back to shop</a></p>`;
    });

  attachDeliveryListeners();

  document.getElementById('pay-btn').addEventListener('click', () => {
    if (!currentProduct) return;
    processOrder();
  });
}

// ============================================
// Initialize Page
// ============================================
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