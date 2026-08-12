(function () {
  const params = new URLSearchParams(location.search);
  let currentProduct = null;
  let quantity = 1;
  let bankDetails = null;

  function requireLogin() {
    if (window.MOBILEHUB.getToken()) return true;
    const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
    location.href = `login.html?next=${next}`;
    return false;
  }
  function field(id) { return document.getElementById(id)?.value.trim() || ''; }
  function deliveryMethod() { return document.querySelector('input[name="delivery-method"]:checked')?.value || 'address'; }
  function collectDelivery() {
    const method=deliveryMethod(); const base={method,name:field('d-name'),phone:field('d-phone'),email:field('d-email')};
    return method==='pep' ? {...base,pepStore:field('d-pep-store'),pepSuburb:field('d-pep-suburb')} : {...base,street:field('d-street'),suburb:field('d-suburb'),city:field('d-city'),province:field('d-province'),postalCode:field('d-postal'),instructions:field('d-instructions')};
  }
  function validPhone(v){ return /^(\+27|0)\d{9}$/.test(v.replace(/[\s-]/g,'')); }
  function validateDelivery(d){
    if(!d.name) return 'Please enter your full name.';
    if(!validPhone(d.phone)) return 'Please enter a valid South African mobile number.';
    if(!/^\S+@\S+\.\S+$/.test(d.email)) return 'Please enter a valid email address.';
    if(d.method==='pep'){ if(!d.pepStore) return 'Please enter your nearest PEP store.'; if(!d.pepSuburb) return 'Please enter the PEP store suburb.'; }
    else { if(!d.street) return 'Please enter your street address.'; if(!d.suburb) return 'Please enter your suburb.'; if(!d.city) return 'Please enter your city or town.'; if(!d.province) return 'Please select your province.'; if(!/^\d{4}$/.test(d.postalCode)) return 'Please enter a valid 4-digit postal code.'; }
    return null;
  }
  function renderSummary(){
    const card=document.getElementById('summary-card'); if(!card||!currentProduct)return;
    const total=Number(currentProduct.price)*quantity;
    card.innerHTML=`<div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;"><img src="${window.MOBILEHUB.escapeHtml(currentProduct.image||'')}" alt="${window.MOBILEHUB.escapeHtml(currentProduct.name)}" style="width:72px;height:72px;object-fit:cover;border-radius:10px;" onerror="this.style.display='none'"><div><h3 style="margin:0;">${window.MOBILEHUB.escapeHtml(currentProduct.name)}</h3><div class="meta" style="font-family:var(--font-mono);color:var(--muted);font-size:.82rem;">${window.MOBILEHUB.escapeHtml(currentProduct.storage)} · ${window.MOBILEHUB.escapeHtml(currentProduct.color)}</div></div></div>
      <div class="summary-row"><span>Quantity</span><div class="qty-control"><button type="button" id="qty-minus">−</button><span id="qty-value">${quantity}</span><button type="button" id="qty-plus">+</button></div></div>
      <div class="summary-row"><span>Unit price</span><span>${window.MOBILEHUB.formatZAR(currentProduct.price)}</span></div><div class="summary-row total"><span>Total</span><span>${window.MOBILEHUB.formatZAR(total)}</span></div>`;
    document.getElementById('qty-minus').onclick=()=>{if(quantity>1){quantity--;renderSummary();}};
    document.getElementById('qty-plus').onclick=()=>{if(quantity<Number(currentProduct.stock)){quantity++;renderSummary();}};
  }
  function updateButton(){ const btn=document.getElementById('pay-btn'); if(!btn)return; const err=validateDelivery(collectDelivery()); btn.disabled=Boolean(err)||!currentProduct; btn.textContent=err?'Complete delivery details to continue':'Place order & get bank details'; }
  function toggleFields(){ const method=deliveryMethod(); document.getElementById('address-fields').style.display=method==='address'?'block':'none'; document.getElementById('pep-fields').style.display=method==='pep'?'block':'none'; updateButton(); }
  function showError(msg){const box=document.getElementById('checkout-error'); box.textContent=msg; box.classList.add('show');}
  function showOrderCreated(result){
    document.getElementById('order-view').style.display='none'; document.getElementById('status-view').style.display='block';
    const card=document.getElementById('status-card'); const bank=bankDetails||{};
    const wa=String(bank.whatsappNumber||'').replace(/\D/g,'');
    const waText=`Hi MobileHub, I have placed an order. Amount: ${window.MOBILEHUB.formatZAR(result.amount)}. I will send my proof of payment here.`;
    card.innerHTML=`<div class="status-icon pending">✓</div><h2>Order received</h2><p style="color:var(--muted);">Your order was created successfully. Please pay by EFT using the details below. Your order is only confirmed after MobileHub verifies the payment.</p>
      <div class="bank-details"><div class="bank-list-label">Bank transfer details</div><div class="bank-details-grid">
      <div class="bank-detail-row"><span class="bank-detail-label">Account name</span><span class="bank-detail-value">${window.MOBILEHUB.escapeHtml(bank.accountName||'Not configured')}</span></div>
      <div class="bank-detail-row"><span class="bank-detail-label">Bank</span><span class="bank-detail-value">${window.MOBILEHUB.escapeHtml(bank.bankName||'Not configured')}</span></div>
      <div class="bank-detail-row"><span class="bank-detail-label">Account number</span><span class="bank-detail-value">${window.MOBILEHUB.escapeHtml(bank.accountNumber||'Not configured')}</span></div>
      <div class="bank-detail-row"><span class="bank-detail-label">Branch code</span><span class="bank-detail-value">${window.MOBILEHUB.escapeHtml(bank.branchCode||'Not configured')}</span></div>
      <div class="bank-detail-row"><span class="bank-detail-label">Account type</span><span class="bank-detail-value">${window.MOBILEHUB.escapeHtml(bank.accountType||'Cheque / Current')}</span></div>
      <div class="bank-detail-row"><span class="bank-detail-label">Amount</span><span class="bank-detail-value">${window.MOBILEHUB.formatZAR(result.amount)}</span></div></div></div>
      <p class="bank-list-hint">Please use the exact amount shown above when making your EFT payment. Do not mark the order as paid yourself.</p>
      ${wa?`<a class="btn whatsapp-order-btn" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(waText)}">💬 Send proof / chat on WhatsApp</a>`:''}
      <a href="catalog.html" class="btn btn-secondary" style="margin-top:12px;">Continue shopping</a>`;
  }
  async function createOrder(){
    const err=validateDelivery(collectDelivery()); if(err){showError(err);return;}
    const btn=document.getElementById('pay-btn'); btn.disabled=true; btn.textContent='Checking stock & creating order…';
    try{
      // The backend ignores any client price and re-fetches the current product.
      const result=await window.MOBILEHUB.apiFetch('/api/checkout',{method:'POST',body:JSON.stringify({productId:currentProduct.id,quantity,delivery:collectDelivery()})});
      // Persist the order reference in the URL so a reload cannot return the
      // customer to the delivery form.
      history.replaceState(null, '', `checkout.html?order=${encodeURIComponent(result.reference)}`);
      showOrderCreated(result);
    }catch(e){showError(e.message);btn.disabled=false;updateButton();}
  }
  async function init(){
    if(!requireLogin())return;

    // If an order was already created, keep the payment instructions visible
    // even if the browser reloads the page.
    const savedOrder = params.get('order');
    if(savedOrder){
      try{
        const [order,payment]=await Promise.all([window.MOBILEHUB.apiFetch(`/api/orders/${encodeURIComponent(savedOrder)}`),window.MOBILEHUB.apiFetch('/api/payment-details')]);
        bankDetails=payment;
        showOrderCreated({reference:order.reference,amount:order.amount});
        return;
      }catch(e){
        // If the saved order cannot be loaded, fall back to the normal checkout view.
      }
    }

    const productId=params.get('product');
    if(!productId){document.getElementById('summary-card').innerHTML='<p>No product selected. <a href="catalog.html" style="color:var(--accent)">Back to shop</a></p>';return;}
    try{
      const [product,payment]=await Promise.all([window.MOBILEHUB.apiFetch(`/api/products/${encodeURIComponent(productId)}?ts=${Date.now()}`),window.MOBILEHUB.apiFetch('/api/payment-details')]);
      currentProduct=product; bankDetails=payment; quantity=Number(product.stock)>0?1:0; renderSummary(); updateButton();
      if(Number(product.stock)<=0){showError('This product is currently out of stock. Please choose another product.');document.getElementById('pay-btn').disabled=true;}
    }catch(e){document.getElementById('summary-card').innerHTML=`<div class="alert alert-error show">${window.MOBILEHUB.escapeHtml(e.message)}<br><a href="catalog.html" style="color:var(--accent)">Back to shop</a></div>`;}
    document.querySelectorAll('input[name="delivery-method"]').forEach(r=>r.addEventListener('change',toggleFields));
    document.addEventListener('input',updateButton); document.addEventListener('change',updateButton); toggleFields();
    document.getElementById('pay-btn')?.addEventListener('click',(event)=>{event.preventDefault();createOrder();});
  }
  document.addEventListener('DOMContentLoaded',init);
})();
