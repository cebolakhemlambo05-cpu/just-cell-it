// ============================================
// API Configuration
// ============================================
const API_BASE_URL = 'https://just-cell-it-5.onrender.com';

// ============================================
// Session Management
// ============================================
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
// Admin Access Control
// ============================================
async function ensureAdminAccess() {
  try {
    const user = await apiFetch('/api/me');
    if (user.role !== 'admin') {
      window.location.href = 'catalog.html';
      return false;
    }
    return true;
  } catch {
    window.location.href = 'login.html?next=admin.html';
    return false;
  }
}

// ============================================
// Product Table Rendering
// ============================================
function productRowHtml(product) {
  return `
    <tr data-product-id="${product.id}">
      <td><input class="edit-input" data-field="name" value="${product.name}" /></td>
      <td><input class="edit-input" data-field="storage" value="${product.storage}" /></td>
      <td><input class="edit-input" data-field="color" value="${product.color}" /></td>
      <td><input class="edit-input" data-field="price" type="number" min="0" step="0.01" value="${product.price}" style="width:100px;" /></td>
      <td><input class="edit-input" data-field="stock" type="number" min="0" step="1" value="${product.stock}" style="width:80px;" /></td>
      <td><input class="edit-input" data-field="image" value="${product.image || ''}" placeholder="Image URL" style="width:140px;" /></td>
      <td><input class="edit-input" data-field="blurb" value="${product.blurb || ''}" style="width:160px;" /></td>
      <td>
        <div class="admin-actions">
          <button type="button" class="btn btn-primary save-product-btn">Save</button>
          <button type="button" class="btn delete-product-btn">Delete</button>
        </div>
        <span class="product-row-status" style="display:block; font-size:0.78rem; margin-top:4px;"></span>
      </td>
    </tr>
  `;
}

function renderProductsTable(products) {
  document.getElementById('products-table').innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Name</th><th>Storage</th><th>Color</th><th>Price</th><th>Stock</th><th>Image URL</th><th>Blurb</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${products.map(productRowHtml).join('') || '<tr><td colspan="8">No products yet.</td></tr>'}
      </tbody>
    </table>
  `;

  document.querySelectorAll('.save-product-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => saveProductRow(e.target.closest('tr')));
  });
  document.querySelectorAll('.delete-product-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => deleteProductRow(e.target.closest('tr')));
  });
}

// ============================================
// Product CRUD Operations
// ============================================
async function saveProductRow(row) {
  const id = row.dataset.productId;
  const statusEl = row.querySelector('.product-row-status');
  const saveBtn = row.querySelector('.save-product-btn');

  const payload = {};
  row.querySelectorAll('.edit-input').forEach((input) => {
    payload[input.dataset.field] = input.value;
  });

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  statusEl.textContent = '';
  statusEl.style.color = '';

  try {
    await apiFetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    statusEl.textContent = '✅ Saved — live on the shop now.';
    statusEl.style.color = 'var(--brand-dim, green)';
  } catch (err) {
    statusEl.textContent = '❌ ' + (err.message || 'Could not save changes.');
    statusEl.style.color = '#c0392b';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

async function deleteProductRow(row) {
  const id = row.dataset.productId;
  const name = row.querySelector('[data-field="name"]').value;
  if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;

  const deleteBtn = row.querySelector('.delete-product-btn');
  deleteBtn.disabled = true;
  deleteBtn.textContent = 'Deleting...';

  try {
    await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    loadDashboard();
  } catch (err) {
    deleteBtn.disabled = false;
    deleteBtn.textContent = 'Delete';
    const statusEl = row.querySelector('.product-row-status');
    statusEl.textContent = '❌ ' + (err.message || 'Could not delete product.');
    statusEl.style.color = '#c0392b';
  }
}

// ============================================
// Create Product
// ============================================
async function createProduct(event) {
  event.preventDefault();
  
  const submitBtn = document.getElementById('create-product-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  try {
    const payload = {
      name: document.getElementById('name').value.trim(),
      storage: document.getElementById('storage').value.trim(),
      color: document.getElementById('color').value.trim(),
      price: document.getElementById('price').value,
      stock: document.getElementById('stock').value,
      image: document.getElementById('image').value.trim(),
      blurb: document.getElementById('blurb').value.trim(),
    };

    await apiFetch('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    document.getElementById('product-form').reset();
    loadDashboard();
  } catch (err) {
    alert('Error creating product: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Product';
  }
}

// ============================================
// Load Dashboard
// ============================================
async function loadDashboard() {
  const allowed = await ensureAdminAccess();
  if (!allowed) return;

  try {
    const summary = await apiFetch('/api/admin/dashboard');
    document.getElementById('products-count').textContent = summary.productsCount;
    document.getElementById('orders-count').textContent = summary.ordersCount;
    document.getElementById('messages-count').textContent = summary.messagesCount;
    document.getElementById('pending-count').textContent = summary.pendingOrders;
    document.getElementById('low-stock-count').textContent = summary.lowStockProducts;

    const products = await apiFetch('/api/admin/products');
    renderProductsTable(products);

    const orders = await apiFetch('/api/admin/orders');
    document.getElementById('orders-table').innerHTML = `
      <table class="admin-table">
        <thead>
          <tr><th>Reference</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${orders.map((order) => `
            <tr>
              <td>${order.reference}</td>
              <td>${order.user?.name || 'Unknown'}</td>
              <td>${order.product?.name || order.productId}</td>
              <td>R${Number(order.amount).toLocaleString('en-ZA')}</td>
              <td><span class="pill ${order.status === 'paid' ? 'pill-success' : 'pill-warning'}">${order.status}</span></td>
            </tr>
          `).join('') || '<tr><td colspan="5">No orders yet.</td></tr>'}
        </tbody>
      </table>
    `;

    const messages = await apiFetch('/api/admin/messages');
    document.getElementById('messages-table').innerHTML = `
      <table class="admin-table">
        <thead>
          <tr><th>Date</th><th>Name</th><th>Email</th><th>Subject</th><th>Message</th></tr>
        </thead>
        <tbody>
          ${messages.map((message) => `
            <tr>
              <td>${new Date(message.createdAt).toLocaleDateString('en-ZA')}</td>
              <td>${message.name}</td>
              <td>${message.email}</td>
              <td>${message.subject}</td>
              <td>${message.message}</td>
            </tr>
          `).join('') || '<tr><td colspan="5">No messages yet.</td></tr>'}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error('Error loading dashboard:', err);
    alert('Error loading dashboard: ' + err.message);
  }
}

// ============================================
// Render Auth Slot (from main.js)
// ============================================
function renderAuthSlot() {
  const slot = document.getElementById('nav-auth-slot');
  if (!slot) return;
  const user = getUser();
  if (user) {
    const adminLink = user.role === 'admin'
      ? '<a href="admin.html" class="btn btn-secondary">Admin</a>'
      : '';
    slot.innerHTML = `
      <span style="color:var(--muted); font-size:0.9rem;">Hi, ${user.name.split(' ')[0]}</span>
      ${adminLink}
      <button class="btn btn-secondary" id="logout-btn">Log out</button>
    `;
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { await apiFetch('/api/logout', { method: 'POST' }); } catch {}
        clearSession();
        window.location.href = 'index.html';
      });
    }
  } else {
    slot.innerHTML = `
      <a href="login.html" class="btn btn-secondary">Log in</a>
      <a href="register.html" class="btn btn-primary">Register</a>
    `;
  }
}

// ============================================
// DOM Event Listeners
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  renderAuthSlot();
  loadDashboard();
  const form = document.getElementById('product-form');
  if (form) {
    form.addEventListener('submit', createProduct);
  }
});