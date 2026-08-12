(function () {
  const fallbackImage = 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=900&q=80';
  const grid = document.getElementById('product-grid');
  const status = document.getElementById('catalog-status');

  function stockTier(stock) { const n = Number(stock); if (n <= 5) return 'low'; if (n <= 12) return 'ok'; return 'high'; }
  function stockLabel(stock) { const n = Number(stock); if (n <= 0) return 'Out of stock'; if (n <= 5) return `Only ${n} left`; return `${n} in stock`; }

  function render(products) {
    if (!Array.isArray(products)) throw new Error('Invalid product response.');
    if (!products.length) {
      grid.innerHTML = '<div class="catalog-status">No products are currently listed. Please check back soon.</div>';
      return;
    }
    grid.innerHTML = products.map((p) => {
      const id = window.MOBILEHUB.escapeHtml(p.id);
      const name = window.MOBILEHUB.escapeHtml(p.name);
      const color = window.MOBILEHUB.escapeHtml(p.color);
      const storage = window.MOBILEHUB.escapeHtml(p.storage);
      const blurb = window.MOBILEHUB.escapeHtml(p.blurb || 'Pre-owned device available now.');
      const image = window.MOBILEHUB.escapeHtml(p.image || fallbackImage);
      const stock = Number(p.stock) || 0;
      return `<article class="card">
        <div class="thumb"><img src="${image}" alt="${name} in ${color}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'"></div>
        <h3>${name}</h3>
        <div class="meta">${storage} · ${color}</div>
        <p class="blurb">${blurb}</p>
        <div class="stock-label"><span class="stock-bars ${stockTier(stock)}"><span></span><span></span><span></span><span></span></span>${stockLabel(stock)}</div>
        <div class="price-row"><span class="price">${window.MOBILEHUB.formatZAR(p.price)}</span>
          <button class="btn btn-primary buy-btn" data-product-id="${id}" ${stock <= 0 ? 'disabled' : ''}>${stock <= 0 ? 'Sold out' : 'Buy now'}</button>
        </div>
      </article>`;
    }).join('');
    grid.querySelectorAll('.buy-btn').forEach((btn) => btn.addEventListener('click', () => {
      const productId = btn.dataset.productId;
      if (!window.MOBILEHUB.getToken()) {
        window.location.href = `login.html?next=${encodeURIComponent(`checkout.html?product=${productId}`)}`;
        return;
      }
      window.location.href = `checkout.html?product=${encodeURIComponent(productId)}`;
    }));
  }

  async function loadProducts(attempt = 1) {
    status?.classList.remove('error');
    if (status) status.textContent = attempt === 1 ? 'Loading products…' : 'Reconnecting to the store…';
    try {
      const products = await window.MOBILEHUB.apiFetch(`/api/products?ts=${Date.now()}`);
      render(products);
      if (status) status.textContent = `${products.length} product${products.length === 1 ? '' : 's'} available.`;
    } catch (error) {
      if (attempt < 3) { setTimeout(() => loadProducts(attempt + 1), 700 * attempt); return; }
      if (status) { status.classList.add('error'); status.innerHTML = `We couldn't load the live catalogue. <button class="btn btn-secondary" id="retry-products" type="button">Try again</button>`; document.getElementById('retry-products').addEventListener('click', () => loadProducts(1)); }
      console.error('Catalog load failed:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => loadProducts());
})();
