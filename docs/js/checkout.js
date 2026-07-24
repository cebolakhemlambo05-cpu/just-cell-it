// // ============================================
// // API Configuration
// // ============================================
// const API_BASE_URL = 'https://just-cell-it-5.onrender.com';

// // ============================================
// // Constants & State
// // ============================================
// const params = new URLSearchParams(window.location.search);
// let currentProduct = null;
// let quantity = 1;

// // Your Yoco hosted Payment Page — customers are sent here after their order
// // (with delivery details) is saved on your backend.
// const YOCO_PAY_URL = 'https://pay.yoco.com/just-cell-it1';

// // ============================================
// // Helper Functions
// // ============================================
// function formatZAR(amount) {
//   return `R${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
// }

// function getToken() {
//   return localStorage.getItem('token');
// }

// function getUser() {
//   const raw = localStorage.getItem('user');
//   return raw ? JSON.parse(raw) : null;
// }

// function clearSession() {
//   localStorage.removeItem('token');
//   localStorage.removeItem('user');
// }

// function requireLogin() {
//   if (!getToken()) {
//     const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
//     window.location.href = `login.html?next=${next}`;
//     return false;
//   }
//   return true;
// }

// // ============================================
// // API Fetch Helper
// // ============================================
// async function apiFetch(path, options = {}) {
//   const token = getToken();
//   const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
//   if (token) headers.Authorization = `Bearer ${token}`;

//   const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

//   // Handle non-JSON responses
//   const contentType = response.headers.get('content-type');
//   let data;
//   if (contentType && contentType.includes('application/json')) {
//     data = await response.json();
//   } else {
//     data = await response.text();
//   }

//   if (response.status === 401 && token) {
//     clearSession();
//     const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
//     window.location.href = `login.html?next=${next}`;
//     throw new Error('Your session expired — please log in again.');
//   }

//   if (!response.ok) {
//     const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
//     throw new Error(errorMessage);
//   }

//   return data;
// }

// // ============================================
// // Order Summary
// // ============================================
// function renderSummary() {
//   const card = document.getElementById('summary-card');
//   const total = currentProduct.price * quantity;
//   card.innerHTML = `
//     <div style="display:flex; gap:16px; align-items:center; margin-bottom:20px;">
//       <img src="${currentProduct.image}" alt="${currentProduct.name}" style="width:72px; height:72px; object-fit:cover; border-radius:10px;" />
//       <div>
//         <h3 style="margin:0;">${currentProduct.name}</h3>
//         <div class="meta" style="font-family:var(--font-mono); color:var(--muted); font-size:0.82rem;">${currentProduct.storage} · ${currentProduct.color}</div>
//       </div>
//     </div>
//     <div class="summary-row">
//       <span>Quantity</span>
//       <div class="qty-control">
//         <button type="button" id="qty-minus" aria-label="Decrease quantity">–</button>
//         <span id="qty-value">${quantity}</span>
//         <button type="button" id="qty-plus" aria-label="Increase quantity">+</button>
//       </div>
//     </div>
//     <div class="summary-row"><span>Unit price</span><span>${formatZAR(currentProduct.price)}</span></div>
//     <div class="summary-row total"><span>Total</span><span>${formatZAR(total)}</span></div>
//   `;
//   document.getElementById('qty-minus').addEventListener('click', () => {
//     if (quantity > 1) { quantity--; renderSummary(); }
//   });
//   document.getElementById('qty-plus').addEventListener('click', () => {
//     if (quantity < currentProduct.stock) { quantity++; renderSummary(); }
//   });
// }

// // ============================================
// // Delivery Form
// // ============================================

// // Reads a field's value safely — returns '' instead of throwing if the
// // element isn't found, so a markup mismatch degrades to "field required"
// // rather than silently breaking every listener on the page.
// function fieldValue(id) {
//   const el = document.getElementById(id);
//   return el ? el.value.trim() : '';
// }

// function getDeliveryMethod() {
//   const checked = document.querySelector('input[name="delivery-method"]:checked');
//   return checked ? checked.value : 'address';
// }

// function toggleDeliveryFields() {
//   const method = getDeliveryMethod();
//   const addressFields = document.getElementById('address-fields');
//   const pepFields = document.getElementById('pep-fields');
//   if (addressFields) addressFields.style.display = method === 'address' ? 'block' : 'none';
//   if (pepFields) pepFields.style.display = method === 'pep' ? 'block' : 'none';
//   updatePayButtonState();
// }

// function collectDeliveryDetails() {
//   const method = getDeliveryMethod();
//   const base = {
//     method,
//     name: fieldValue('d-name'),
//     phone: fieldValue('d-phone'),
//     email: fieldValue('d-email'),
//   };

//   if (method === 'address') {
//     return {
//       ...base,
//       street: fieldValue('d-street'),
//       suburb: fieldValue('d-suburb'),
//       city: fieldValue('d-city'),
//       province: fieldValue('d-province'),
//       postalCode: fieldValue('d-postal'),
//       instructions: fieldValue('d-instructions'),
//     };
//   }

//   return {
//     ...base,
//     pepStore: fieldValue('d-pep-store'),
//     pepSuburb: fieldValue('d-pep-suburb'),
//   };
// }

// function isValidPhone(phone) {
//   const digits = phone.replace(/[\s-]/g, '');
//   return /^(\+27|0)\d{9}$/.test(digits);
// }

// function validateDelivery(details) {
//   if (!details.name) return 'Please enter your full name.';
//   if (!details.phone || !isValidPhone(details.phone)) return 'Please enter a valid South African mobile number.';
//   if (!details.email || !/^\S+@\S+\.\S+$/.test(details.email)) return 'Please enter a valid email address.';

//   if (details.method === 'address') {
//     if (!details.street) return 'Please enter your street address.';
//     if (!details.suburb) return 'Please enter your suburb.';
//     if (!details.city) return 'Please enter your city or town.';
//     if (!details.province) return 'Please select your province.';
//     if (!/^\d{4}$/.test(details.postalCode)) return 'Please enter a valid 4-digit postal code.';
//   } else {
//     if (!details.pepStore) return 'Please enter your nearest PEP store.';
//     if (!details.pepSuburb) return 'Please enter the suburb of that PEP store.';
//   }

//   return null;
// }

// function updatePayButtonState() {
//   const btn = document.getElementById('pay-btn');
//   if (!btn) return;
//   const details = collectDeliveryDetails();
//   const error = validateDelivery(details);
//   btn.disabled = Boolean(error);
//   btn.textContent = error ? 'Complete delivery details to continue' : 'Pay Now';
// }

// function attachDeliveryListeners() {
//   document.querySelectorAll('input[name="delivery-method"]').forEach((radio) => {
//     radio.addEventListener('change', toggleDeliveryFields);
//   });

//   document.addEventListener('input', updatePayButtonState);
//   document.addEventListener('change', updatePayButtonState);

//   toggleDeliveryFields();
// }

// // ============================================
// // Payment Processing - NO API CALL
// // ============================================
// function processOrder() {
//   const btn = document.getElementById('pay-btn');
  
//   const delivery = collectDeliveryDetails();
//   const error = validateDelivery(delivery);
  
//   if (error) {
//     showCheckoutError(error);
//     return;
//   }

//   // ✅ Simply redirect to Yoco Payment Page - NO API call
//   window.location.href = YOCO_PAY_URL;
// }

// function goToYoco() {
//   // Kept for backwards compatibility — processOrder() does the real work.
//   processOrder();
// }

// function showCheckoutError(message) {
//   let box = document.getElementById('checkout-error');
//   if (!box) {
//     box = document.createElement('div');
//     box.id = 'checkout-error';
//     box.className = 'alert alert-error show';
//     const payCard = document.querySelector('.pay-card');
//     if (payCard) payCard.prepend(box);
//   }
//   box.textContent = message;
//   box.classList.add('show');
// }

// // ============================================
// // Status View
// // ============================================
// function renderStatus(status, reference) {
//   const orderView = document.getElementById('order-view');
//   const statusView = document.getElementById('status-view');
//   if (orderView) orderView.style.display = 'none';
//   if (statusView) statusView.style.display = 'block';
//   const card = document.getElementById('status-card');
//   if (!card) return;

//   const views = {
//     success: {
//       icon: '✓', cls: 'success', title: 'Payment received',
//       body: `Your order <strong>${reference}</strong> is confirmed. We'll email you when it ships.`,
//     },
//     pending: {
//       icon: '⋯', cls: 'pending', title: 'Payment pending',
//       body: `We're waiting on final confirmation from your bank for order <strong>${reference}</strong>. This can take a minute — refresh if it doesn't update.`,
//     },
//     cancelled: {
//       icon: '✕', cls: 'error', title: 'Payment cancelled',
//       body: `You cancelled the payment for order <strong>${reference}</strong>. No money was deducted.`,
//     },
//     error: {
//       icon: '!', cls: 'error', title: 'Payment failed',
//       body: `Something went wrong processing order <strong>${reference}</strong>. No money was deducted — please try again.`,
//     },
//   };
//   const v = views[status] || views.error;
//   card.innerHTML = `
//     <div class="status-icon ${v.cls}">${v.icon}</div>
//     <h2>${v.title}</h2>
//     <p style="color:var(--muted);">${v.body}</p>
//     <a href="catalog.html" class="btn btn-primary" style="margin-top:16px;">Continue shopping</a>
//   `;
// }

// function initStatusView(status, reference) {
//   renderStatus(status, reference);
// }

// // ============================================
// // Order View
// // ============================================
// function initOrderView() {
//   const productId = params.get('product');
//   if (!productId) {
//     document.getElementById('summary-card').innerHTML = `<p>No product selected. <a href="catalog.html" style="color:var(--accent)">Back to shop</a></p>`;
//     return;
//   }

//   apiFetch(`/api/products/${productId}`)
//     .then((product) => {
//       currentProduct = product;
//       renderSummary();
//     })
//     .catch(() => {
//       document.getElementById('summary-card').innerHTML = `<p>Couldn't load that product. <a href="catalog.html" style="color:var(--accent)">Back to shop</a></p>`;
//     });

//   attachDeliveryListeners();

//   const payBtn = document.getElementById('pay-btn');
//   if (payBtn) {
//     payBtn.addEventListener('click', () => {
//       if (!currentProduct) return;
//       processOrder();
//     });
//   }
// }

// // ============================================
// // Initialize Page
// // ============================================
// if (!requireLogin()) {
//   // redirecting to login
// } else {
//   const status = params.get('status');
//   // const reference = params.get('ref');
//   if (status && reference) {
//     initStatusView(status, reference);
//   } else {
//     initOrderView();
//   }
// }