(function () {
  function api(path, options) { return window.MOBILEHUB.apiFetch(path, options); }

  async function ensureAdmin() {
    try {
      const u = await api('/api/me');
      if (u.role !== 'admin') { location.href = 'catalog.html'; return false; }
      return true;
    } catch {
      location.href = 'login.html?next=admin.html';
      return false;
    }
  }

  function productRow(p) {
    const e = window.MOBILEHUB.escapeHtml;
    return `<tr data-product-id="${e(p.id)}">
      <td><input class="edit-input" data-field="name" value="${e(p.name)}"></td>
      <td><input class="edit-input" data-field="storage" value="${e(p.storage)}"></td>
      <td><input class="edit-input" data-field="color" value="${e(p.color)}"></td>
      <td><input class="edit-input" data-field="price" type="number" min="0" step="0.01" value="${Number(p.price)}"></td>
      <td><input class="edit-input" data-field="stock" type="number" min="0" step="1" value="${Number(p.stock)}"></td>
      <td><input class="edit-input" data-field="image" value="${e(p.image || '')}" placeholder="Image URL"></td>
      <td><input class="edit-input" data-field="blurb" value="${e(p.blurb || '')}"></td>
      <td><button type="button" class="btn btn-primary save-product-btn">Save</button> <button type="button" class="btn delete-product-btn">Delete</button><span class="product-row-status" style="display:block;font-size:.78rem;margin-top:4px"></span></td>
    </tr>`;
  }

  async function saveRow(row) {
    const id = row.dataset.productId;
    const status = row.querySelector('.product-row-status');
    const btn = row.querySelector('.save-product-btn');
    const payload = {};
    row.querySelectorAll('.edit-input').forEach(i => payload[i.dataset.field] = i.value);
    btn.disabled = true;
    try {
      await api(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      status.textContent = 'Saved — live on the shop.';
      load();
    } catch (e) {
      status.textContent = 'Error: ' + e.message;
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteRow(row) {
    if (!confirm(`Delete "${row.querySelector('[data-field=name]').value}"?`)) return;
    try {
      await api(`/api/admin/products/${encodeURIComponent(row.dataset.productId)}`, { method: 'DELETE' });
      load();
    } catch (e) { alert(e.message); }
  }

  function renderProducts(products) {
    document.getElementById('products-table').innerHTML = `<table class="admin-table"><thead><tr><th>Name</th><th>Storage</th><th>Color</th><th>Price</th><th>Stock</th><th>Image</th><th>Blurb</th><th>Actions</th></tr></thead><tbody>${products.map(productRow).join('') || '<tr><td colspan="8">No products.</td></tr>'}</tbody></table>`;
    document.querySelectorAll('.save-product-btn').forEach(b => b.onclick = () => saveRow(b.closest('tr')));
    document.querySelectorAll('.delete-product-btn').forEach(b => b.onclick = () => deleteRow(b.closest('tr')));
  }

  function orderRow(o) {
    const e = window.MOBILEHUB.escapeHtml;
    const status = o.status;
    const actions = ['awaiting_payment', 'pending'].includes(status)
      ? `<div class="order-status-actions"><button class="btn btn-primary mark-paid" data-ref="${e(o.reference)}">Mark paid</button><button class="btn cancel-order" data-ref="${e(o.reference)}">Cancel</button></div>`
      : '';
    return `<tr><td>${e(o.reference)}</td><td>${e(o.user?.name || 'Unknown')}<br><small>${e(o.user?.email || '')}</small></td><td>${e(o.productSnapshot?.name || o.product?.name || o.productId)}</td><td>${window.MOBILEHUB.formatZAR(o.amount)}</td><td><span class="pill ${status === 'paid' ? 'pill-success' : status === 'cancelled' ? 'pill-danger' : 'pill-warning'}">${e(status)}</span></td><td>${actions}</td></tr>`;
  }

  async function setOrderStatus(ref, status) {
    try {
      await api(`/api/admin/orders/${encodeURIComponent(ref)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (e) { alert(e.message); }
  }

  function renderUsers(users) {
    const e = window.MOBILEHUB.escapeHtml;
    const rows = users.map(u => `<tr data-user-id="${e(u.id)}">
      <td>${e(u.name)}</td>
      <td>${e(u.email)}</td>
      <td>${e(u.role)}</td>
      <td>${u.createdAt ? new Date(u.createdAt).toLocaleString('en-ZA') : '—'}</td>
      <td><button type="button" class="btn delete-user-btn">Delete user</button></td>
    </tr>`).join('');
    document.getElementById('users-table').innerHTML = `<table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Registered</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No customer accounts yet.</td></tr>'}</tbody></table>`;
    document.querySelectorAll('.delete-user-btn').forEach(button => {
      button.onclick = async () => {
        const row = button.closest('tr');
        const userId = row.dataset.userId;
        const name = row.children[0].textContent;
        if (!confirm(`Delete customer account for ${name}? This cannot be undone.`)) return;
        button.disabled = true;
        try {
          await api(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
          load();
        } catch (e) {
          alert(e.message);
          button.disabled = false;
        }
      };
    });
  }

  async function load() {
    if (!(await ensureAdmin())) return;
    try {
      const [summary, products, orders, messages, users] = await Promise.all([
        api('/api/admin/dashboard'),
        api('/api/admin/products'),
        api('/api/admin/orders'),
        api('/api/admin/messages'),
        api('/api/admin/users')
      ]);

      document.getElementById('products-count').textContent = summary.productsCount;
      document.getElementById('orders-count').textContent = summary.ordersCount;
      document.getElementById('messages-count').textContent = summary.messagesCount;
      document.getElementById('pending-count').textContent = summary.pendingOrders;
      document.getElementById('low-stock-count').textContent = summary.lowStockProducts;
      document.getElementById('users-count').textContent = users.length;

      renderProducts(products);
      renderUsers(users);

      document.getElementById('orders-table').innerHTML = `<table class="admin-table"><thead><tr><th>Reference</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>${orders.map(orderRow).join('') || '<tr><td colspan="6">No orders yet.</td></tr>'}</tbody></table>`;
      document.querySelectorAll('.mark-paid').forEach(b => b.onclick = () => setOrderStatus(b.dataset.ref, 'paid'));
      document.querySelectorAll('.cancel-order').forEach(b => b.onclick = () => setOrderStatus(b.dataset.ref, 'cancelled'));

      document.getElementById('messages-table').innerHTML = `<table class="admin-table"><thead><tr><th>Date</th><th>Name</th><th>Email</th><th>Subject</th><th>Message</th></tr></thead><tbody>${messages.map(m => `<tr><td>${new Date(m.createdAt).toLocaleString('en-ZA')}</td><td>${window.MOBILEHUB.escapeHtml(m.name)}</td><td>${window.MOBILEHUB.escapeHtml(m.email)}</td><td>${window.MOBILEHUB.escapeHtml(m.subject)}</td><td>${window.MOBILEHUB.escapeHtml(m.message)}</td></tr>`).join('') || '<tr><td colspan="5">No messages.</td></tr>'}</tbody></table>`;
    } catch (e) { alert('Dashboard error: ' + e.message); }
  }

  async function createProduct(e) {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    try {
      await api('/api/admin/products', { method: 'POST', body: JSON.stringify({
        name: document.getElementById('name').value.trim(),
        storage: document.getElementById('storage').value.trim(),
        color: document.getElementById('color').value.trim(),
        price: document.getElementById('price').value,
        stock: document.getElementById('stock').value,
        image: document.getElementById('image').value.trim(),
        blurb: document.getElementById('blurb').value.trim()
      }) });
      e.target.reset();
      load();
    } catch (err) { alert(err.message); }
    finally { btn.disabled = false; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('product-form')?.addEventListener('submit', createProduct);
    load();
  });
})();
