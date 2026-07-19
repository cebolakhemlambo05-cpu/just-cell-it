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

async function loadDashboard() {
  const allowed = await ensureAdminAccess();
  if (!allowed) return;

  const summary = await apiFetch('/api/admin/dashboard');
  document.getElementById('products-count').textContent = summary.productsCount;
  document.getElementById('orders-count').textContent = summary.ordersCount;
  document.getElementById('pending-count').textContent = summary.pendingOrders;
  document.getElementById('low-stock-count').textContent = summary.lowStockProducts;

  const products = await apiFetch('/api/admin/products');
  document.getElementById('products-table').innerHTML = `
    <table class="admin-table">
      <thead>
        <tr><th>Name</th><th>Storage</th><th>Stock</th><th>Price</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${products.map((product) => `
          <tr>
            <td>${product.name}</td>
            <td>${product.storage}</td>
            <td>${product.stock}</td>
            <td>R${Number(product.price).toLocaleString('en-ZA')}</td>
            <td><span class="pill">${product.stock <= 5 ? 'Low stock' : 'In stock'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

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
