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
    statusEl.textContent = 'Saved — live on the shop now.';
    statusEl.style.color = 'var(--brand-dim, green)';
  } catch (err) {
    statusEl.textContent = err.message || 'Could not save changes.';
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
    statusEl.textContent = err.message || 'Could not delete product.';
    statusEl.style.color = '#c0392b';
  }
}

async function loadDashboard() {
  const allowed = await ensureAdminAccess();
  if (!allowed) return;

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
            <td><span class="pill">${order.status}</span></td>
          </tr>
        `).join('')}
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
}

async function createProduct(event) {
  event.preventDefault();
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
}

document.addEventListener('DOMContentLoaded', () => {
  renderAuthSlot();
  loadDashboard();
  document.getElementById('product-form').addEventListener('submit', createProduct);
});
