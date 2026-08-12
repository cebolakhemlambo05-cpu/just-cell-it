require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { CONTACT_TO_EMAIL, sendContactEmail } = require('./mailer');

const app = express();
const PORT = Number(process.env.PORT || 3002);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';
const SA_PROVINCES = ['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];

function isLocalOrigin(origin) {
  if (!origin || origin === 'null') return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

app.use(cors({ origin: (origin, cb) => {
  if (isLocalOrigin(origin) || origin === FRONTEND_URL) return cb(null, true);
  cb(new Error('Not allowed by CORS'));
}}));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.json({
  message: 'MobileHub API is running.',
  endpoints: ['/api/products', '/api/register', '/api/login', '/api/checkout', '/api/payment-details'],
}));

function getUsers() { return db.getUsers(); }
function getUserById(id) { return db.getUserById(id); }

async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL || 'mhub3580@gmail.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123456';
  if (!email || !password || password.length < 8) {
    console.warn('ADMIN_PASSWORD must be at least 8 characters.');
    return;
  }
  const users = getUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  const passwordHash = await bcrypt.hash(password, 10);
  if (existing) {
    existing.role = 'admin';
    existing.passwordHash = passwordHash;
  } else {
    users.push({ id: crypto.randomUUID(), name: 'Admin', email, passwordHash, role: 'admin', createdAt: new Date().toISOString() });
  }
  db.saveUsers(users);
}

let sessions = db.getSessions();
function saveSessions() { db.saveSessions(sessions); }
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token && sessions[token];
  if (!userId) return res.status(401).json({ error: 'Not logged in.' });
  const user = getUserById(userId);
  if (!user) return res.status(401).json({ error: 'Session is no longer valid.' });
  req.userId = userId;
  req.user = user;
  req.token = token;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

app.post('/api/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const users = getUsers();
  if (users.some((u) => u.email.toLowerCase() === email)) return res.status(409).json({ error: 'An account with that email already exists.' });
  users.push({ id: crypto.randomUUID(), name, email, passwordHash: await bcrypt.hash(password, 10), role: 'customer', createdAt: new Date().toISOString() });
  db.saveUsers(users);
  res.status(201).json({ message: 'Account created. You can now log in.' });
});

app.post('/api/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = getUsers().find((u) => u.email.toLowerCase() === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Incorrect email or password.' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = user.id;
  saveSessions();
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role || 'customer' } });
});

app.post('/api/logout', requireAuth, (req, res) => {
  delete sessions[req.token];
  saveSessions();
  res.json({ message: 'Logged out.' });
});
app.get('/api/me', requireAuth, (req, res) => res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role || 'customer' }));

// Public catalog. Cache is disabled so customers always receive current stock/prices.
app.get('/api/products', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.json(db.getProducts());
});
app.get('/api/products/:id', (req, res) => {
  const product = db.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.set('Cache-Control', 'no-store');
  res.json(product);
});

app.get('/api/payment-details', (req, res) => {
  res.json({
    accountName: process.env.BANK_ACCOUNT_NAME || '',
    bankName: process.env.BANK_NAME || '',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
    branchCode: process.env.BANK_BRANCH_CODE || '',
    accountType: process.env.BANK_ACCOUNT_TYPE || 'Cheque / Current',
    whatsappNumber: process.env.WHATSAPP_NUMBER || '',
    whatsappDisplay: process.env.WHATSAPP_DISPLAY || '',
  });
});

function validateDelivery(delivery) {
  if (!delivery || typeof delivery !== 'object') return 'Delivery details are required.';
  const name = String(delivery.name || '').trim();
  const phone = String(delivery.phone || '').trim().replace(/[\s-]/g, '');
  const email = String(delivery.email || '').trim();
  if (!name) return 'Delivery name is required.';
  if (!/^(\+27|0)\d{9}$/.test(phone)) return 'A valid South African mobile number is required.';
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'A valid delivery email is required.';
  if (delivery.method === 'pep') {
    if (!String(delivery.pepStore || '').trim()) return 'Nearest PEP store is required.';
    if (!String(delivery.pepSuburb || '').trim()) return 'PEP store suburb is required.';
    return null;
  }
  if (!String(delivery.street || '').trim()) return 'Street address is required.';
  if (!String(delivery.suburb || '').trim()) return 'Suburb is required.';
  if (!String(delivery.city || '').trim()) return 'City is required.';
  if (!SA_PROVINCES.includes(delivery.province)) return 'A valid province is required.';
  if (!/^\d{4}$/.test(String(delivery.postalCode || '').trim())) return 'A valid 4-digit postal code is required.';
  return null;
}
function sanitizeDelivery(delivery) {
  const base = {
    method: delivery.method === 'pep' ? 'pep' : 'address',
    name: String(delivery.name || '').trim(),
    phone: String(delivery.phone || '').trim(),
    email: String(delivery.email || '').trim(),
  };
  return base.method === 'pep'
    ? { ...base, pepStore: String(delivery.pepStore || '').trim(), pepSuburb: String(delivery.pepSuburb || '').trim() }
    : { ...base, street: String(delivery.street || '').trim(), suburb: String(delivery.suburb || '').trim(), city: String(delivery.city || '').trim(), province: delivery.province, postalCode: String(delivery.postalCode || '').trim(), instructions: String(delivery.instructions || '').trim() };
}

// JSON-file storage needs an application-level lock to prevent two simultaneous
// checkout requests from both seeing the same stock quantity.
let checkoutQueue = Promise.resolve();
function withCheckoutLock(task) {
  const run = checkoutQueue.then(task, task);
  checkoutQueue = run.catch(() => undefined);
  return run;
}

// Server is authoritative: product is fetched again here, stock is checked,
// current price is calculated here, and ONLY after those checks does the order
// get created. The browser never supplies a trusted price or total.
app.post('/api/checkout', requireAuth, async (req, res) => {
  try {
    const result = await withCheckoutLock(async () => {
      const productId = String(req.body.productId || '').trim();
      const qty = Number.parseInt(req.body.quantity, 10);
      const quantity = Number.isInteger(qty) && qty > 0 ? qty : 1;
      if (!productId) throw Object.assign(new Error('Product is required.'), { status: 400 });
      if (quantity > 20) throw Object.assign(new Error('Maximum quantity per order is 20.'), { status: 400 });

      const deliveryError = validateDelivery(req.body.delivery);
      if (deliveryError) throw Object.assign(new Error(deliveryError), { status: 400 });

      // Re-fetch the authoritative product immediately before creating the order.
      const products = db.getProducts();
      const product = products.find((p) => p.id === productId);
      if (!product) throw Object.assign(new Error('Product not found.'), { status: 404 });

      const stock = Number(product.stock);
      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error('This product has an invalid price. Please contact us.'), { status: 409 });
      if (!Number.isInteger(stock) || stock < quantity) throw Object.assign(new Error(`Only ${Math.max(0, stock)} unit(s) are currently available.`), { status: 409 });

      const total = Number((unitPrice * quantity).toFixed(2));
      const reference = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const order = {
        reference,
        userId: req.userId,
        productId: product.id,
        productSnapshot: { name: product.name, storage: product.storage, color: product.color, unitPrice },
        quantity,
        amount: total,
        paymentMethod: 'bank_transfer',
        status: 'awaiting_payment',
        delivery: sanitizeDelivery(req.body.delivery),
        createdAt: new Date().toISOString(),
      };

      // Reserve the stock at the same time as order creation. It prevents two
      // customers buying the last unit while you wait for the EFT payment.
      product.stock = stock - quantity;
      db.saveProducts(products);
      const orders = db.getOrders();
      orders.push(order);
      db.saveOrders(orders);
      return { reference, amount: total, product: order.productSnapshot, quantity, status: order.status };
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Could not create the order.' });
  }
});

app.get('/api/orders/:reference', requireAuth, (req, res) => {
  const order = db.getOrders().find((o) => o.reference === req.params.reference && o.userId === req.userId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json(order);
});

app.post('/api/contact', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const phone = String(req.body.phone || '').trim();
  const subject = String(req.body.subject || 'Website enquiry').trim();
  const message = String(req.body.message || '').trim();
  if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and message are required.' });
  const contactMessage = db.createMessage({ id: crypto.randomUUID(), name, email, phone, subject, message, status: 'new', createdAt: new Date().toISOString() });
  try {
    const result = await sendContactEmail(contactMessage);
    contactMessage.emailSent = result.sent;
    contactMessage.emailTo = CONTACT_TO_EMAIL;
    db.saveMessages(db.getMessages().map((m) => m.id === contactMessage.id ? contactMessage : m));
  } catch (error) {
    contactMessage.emailSent = false;
    contactMessage.emailError = error.message;
    db.saveMessages(db.getMessages().map((m) => m.id === contactMessage.id ? contactMessage : m));
  }
  res.status(201).json({ message: 'Thanks. We received your enquiry.', contactMessage });
});

app.get('/api/admin/dashboard', requireAuth, requireAdmin, (req, res) => {
  const products = db.getProducts();
  const orders = db.getOrders();
  const messages = db.getMessages();
  res.json({
    productsCount: products.length,
    ordersCount: orders.length,
    messagesCount: messages.length,
    pendingOrders: orders.filter((o) => ['awaiting_payment', 'pending'].includes(o.status)).length,
    lowStockProducts: products.filter((p) => Number(p.stock) <= 5).length,
  });
});
app.get('/api/admin/products', requireAuth, requireAdmin, (req, res) => res.json(db.getProducts()));

function normalizeId(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').toLowerCase();
}
app.post('/api/admin/products', requireAuth, requireAdmin, (req, res) => {
  const name = String(req.body.name || '').trim();
  const storage = String(req.body.storage || '').trim();
  const color = String(req.body.color || '').trim();
  const price = Number(req.body.price);
  const stock = Number(req.body.stock);
  if (!name || !storage || !color || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) return res.status(400).json({ error: 'Name, storage, color, valid price and whole-number stock are required.' });
  const products = db.getProducts();
  const baseId = normalizeId(`${name}-${storage}-${color}`) || `product-${Date.now()}`;
  let id = baseId; let n = 1;
  while (products.some((p) => p.id === id)) id = `${baseId}-${++n}`;
  const product = { id, name, storage, color, price, stock, image: String(req.body.image || '').trim(), blurb: String(req.body.blurb || '').trim(), createdAt: new Date().toISOString() };
  products.push(product); db.saveProducts(products); res.status(201).json(product);
});
app.put('/api/admin/products/:id', requireAuth, requireAdmin, (req, res) => {
  const products = db.getProducts();
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (req.body.name != null && String(req.body.name).trim()) product.name = String(req.body.name).trim();
  if (req.body.storage != null && String(req.body.storage).trim()) product.storage = String(req.body.storage).trim();
  if (req.body.color != null && String(req.body.color).trim()) product.color = String(req.body.color).trim();
  if (req.body.image != null) product.image = String(req.body.image).trim();
  if (req.body.blurb != null) product.blurb = String(req.body.blurb).trim();
  if (req.body.price != null) { const p = Number(req.body.price); if (!Number.isFinite(p) || p < 0) return res.status(400).json({ error: 'Price must be a valid non-negative number.' }); product.price = p; }
  if (req.body.stock != null) { const s = Number(req.body.stock); if (!Number.isInteger(s) || s < 0) return res.status(400).json({ error: 'Stock must be a whole non-negative number.' }); product.stock = s; }
  db.saveProducts(products); res.json(product);
});
app.delete('/api/admin/products/:id', requireAuth, requireAdmin, (req, res) => {
  const products = db.getProducts();
  if (!products.some((p) => p.id === req.params.id)) return res.status(404).json({ error: 'Product not found.' });
  db.saveProducts(products.filter((p) => p.id !== req.params.id));
  res.json({ message: 'Product deleted.' });
});

app.get('/api/admin/orders', requireAuth, requireAdmin, (req, res) => {
  const users = Object.fromEntries(getUsers().map((u) => [u.id, u]));
  const products = Object.fromEntries(db.getProducts().map((p) => [p.id, p]));
  const orders = db.getOrders().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders.map((o) => ({ ...o, user: users[o.userId] ? { id: users[o.userId].id, name: users[o.userId].name, email: users[o.userId].email } : null, product: products[o.productId] || o.productSnapshot || null })));
});

// Manual EFT workflow: only an authenticated admin can confirm payment.
app.patch('/api/admin/orders/:reference/status', requireAuth, requireAdmin, (req, res) => {
  const nextStatus = String(req.body.status || '').trim();
  if (!['paid', 'cancelled'].includes(nextStatus)) return res.status(400).json({ error: 'Status must be paid or cancelled.' });
  const orders = db.getOrders();
  const order = orders.find((o) => o.reference === req.params.reference);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status === nextStatus) return res.json(order);
  if (order.status === 'paid' && nextStatus === 'cancelled') return res.status(409).json({ error: 'A paid order cannot be cancelled from this button.' });
  if (order.status === 'cancelled' && nextStatus === 'paid') return res.status(409).json({ error: 'A cancelled order cannot be marked paid.' });

  if (nextStatus === 'cancelled' && ['awaiting_payment', 'pending'].includes(order.status)) {
    const products = db.getProducts();
    const product = products.find((p) => p.id === order.productId);
    if (product) { product.stock = Number(product.stock || 0) + Number(order.quantity || 0); db.saveProducts(products); }
  }
  order.status = nextStatus;
  order.updatedAt = new Date().toISOString();
  db.saveOrders(orders);
  res.json(order);
});

app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const users = getUsers()
    .filter((u) => (u.role || 'customer') !== 'admin')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || 'customer',
      createdAt: u.createdAt,
    }));
  res.json(users);
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  const userId = String(req.params.id || '').trim();
  if (!userId) return res.status(400).json({ error: 'User ID is required.' });
  if (userId === req.userId) return res.status(400).json({ error: 'You cannot delete your own admin account.' });

  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if ((user.role || 'customer') === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be deleted here.' });

  db.saveUsers(users.filter((u) => u.id !== userId));

  // Immediately invalidate every active session belonging to the deleted user.
  let changed = false;
  Object.keys(sessions).forEach((token) => {
    if (sessions[token] === userId) {
      delete sessions[token];
      changed = true;
    }
  });
  if (changed) saveSessions();

  res.json({ message: 'User deleted.' });
});

app.get('/api/admin/messages', requireAuth, requireAdmin, (req, res) => res.json(db.getMessages().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))));

(async () => {
  await db.init();
  await ensureAdminUser();
  app.listen(PORT, '0.0.0.0', () => console.log(`MobileHub backend running on http://localhost:${PORT}`));
})();
