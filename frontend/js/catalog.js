// ============================================
// API Configuration
// ============================================
const API_BASE_URL = 'https://just-cell-it-5.onrender.com';

// ============================================
// Helper Functions
// ============================================
function stockTier(stock) {
  if (stock <= 0) return 'low';
  if (stock <= 5) return 'low';
  if (stock <= 12) return 'ok';
  return 'high';
}

function stockLabel(stock) {
  if (stock <= 0) return 'Out of stock';
  if (stock <= 5) return `Only ${stock} left`;
  return `${stock} in stock`;
}

function formatZAR(amount) {
  return `R${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
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
// Load Products
// ============================================
async function loadProducts() {
  const grid = document.getElementById('product-grid');
  const emptyState = document.getElementById('empty-state');
  try {
    const products = await apiFetch('/api/products');
    grid.innerHTML = products.map((p) => `
      <div class="card">
        <div class="thumb"><img src="${p.image}" alt="${p.name} in ${p.color}" loading="lazy" /></div>
        <h3>${p.name}</h3>
        <div class="meta">${p.storage} · ${p.color}</div>
        <p class="blurb">${p.blurb}</p>
        <div class="stock-label">
          <span class="stock-bars ${stockTier(p.stock)}"><span></span><span></span><span></span><span></span></span>
          ${stockLabel(p.stock)}
        </div>
        <div class="price-row">
          <span class="price">${formatZAR(p.price)}</span>
          <button class="btn btn-primary" ${p.stock <= 0 ? 'disabled' : ''} onclick="buyNow('${p.id}')">
            ${p.stock <= 0 ? 'Sold out' : 'Buy now'}
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    emptyState.style.display = 'block';
  }
}

// ============================================
// Buy Now Handler
// ============================================
function buyNow(productId) {
  if (!getToken()) {
    window.location.href = `login.html?next=checkout.html%3Fproduct%3D${productId}`;
    return;
  }
  window.location.href = `checkout.html?product=${productId}`;
}

// ============================================
// Initialize
// ============================================
loadProducts();