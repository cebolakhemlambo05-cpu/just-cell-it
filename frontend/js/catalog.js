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

function buyNow(productId) {
  if (!getToken()) {
    window.location.href = `login.html?next=checkout.html%3Fproduct%3D${productId}`;
    return;
  }
  window.location.href = `checkout.html?product=${productId}`;
}

loadProducts();
