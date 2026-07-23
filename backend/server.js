// Minimal Node.js backend for the iPhone store.
// Handles: user registration/login, product catalog, and Yoco checkout.
//
// Storage is plain JSON files under /data. That's fine to get started and to
// understand the flow, but swap it for a real database (Postgres, SQLite via
// an ORM, etc.) before you take real customer data live.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const net = require('net');
const db = require('./db');
const { CONTACT_TO_EMAIL, sendContactEmail } = require('./mailer');

const app = express();
const DEFAULT_PORT = 4000;
const PORT = Number(process.env.PORT || DEFAULT_PORT);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

// In development, accept requests from any localhost/127.0.0.1 port so you
// don't have to keep FRONTEND_URL perfectly in sync with whatever port your
// static server (Live Server, npx serve, etc.) happens to use. Before you
// deploy for real, tighten this back down to your actual frontend URL only
// (e.g. origin: FRONTEND_URL) so random sites can't call your API.
const isLocalOrigin = (origin) => {
  if (!origin || origin === 'null') return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};
app.use(cors({
  origin: (origin, callback) => {
    if (isLocalOrigin(origin) || origin === FRONTEND_URL) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
}));

// ---------- Yoco webhook (must be registered BEFORE express.json()) ----------
// Yoco signs the webhook using the RAW request body. If express.json() runs
// first, it consumes/parses the body stream and this route would see nothing
// to verify. Because Express walks middleware/routes in registration order,
// putting this route (with its own express.raw parser) ahead of the global
// app.use(express.json()) below guarantees this exact route gets the raw
// bytes, while every other route still gets normal JSON parsing.
//
// Docs: https://developer.yoco.com/online/api-reference/webhooks/verifying-events/
function verifyYocoWebhookSignature(rawBody, headers, webhookSecret) {
  const webhookId = headers['webhook-id'];
  const webhookTimestamp = headers['webhook-timestamp'];
  const webhookSignatureHeader = headers['webhook-signature'];
  if (!webhookId || !webhookTimestamp || !webhookSignatureHeader || !webhookSecret) return false;

  // Reject anything older than ~3 minutes to guard against replay attacks.
  const timestampSeconds = Number(webhookTimestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 180) {
    return false;
  }

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ''), 'base64');
  const expectedSignature = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  // Header looks like: "v1,<base64sig> v1,<base64sig2>" — usually one entry.
  const providedSignatures = webhookSignatureHeader
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter(Boolean);

  return providedSignatures.some((sig) => {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSignature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

app.post('/api/yoco-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body.toString('utf8');
  const isValid = verifyYocoWebhookSignature(rawBody, req.headers, process.env.YOCO_WEBHOOK_SECRET);
  if (!isValid) {
    console.warn('Rejected Yoco webhook: invalid signature or stale timestamp.');
    return res.status(401).send('Invalid signature.');
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).send('Invalid payload.');
  }

  // Acknowledge event types we don't act on yet (e.g. refund.succeeded) so
  // Yoco doesn't keep retrying delivery of an event we're intentionally
  // ignoring for now.
  if (event.type !== 'payment.succeeded') {
    return res.status(200).send('OK');
  }

  const payload = event.payload || {};
  const checkoutId = payload.metadata?.checkoutId;
  const reference = payload.metadata?.reference;

  const orders = db.getOrders();
  const order = orders.find((o) => (
    (checkoutId && o.yocoCheckoutId === checkoutId)
    || (reference && o.reference === reference)
  ));

  if (!order) {
    console.warn('Yoco webhook: no matching order for checkoutId', checkoutId, 'reference', reference);
    return res.status(200).send('OK'); // acknowledge anyway so Yoco doesn't keep retrying
  }

  // Idempotency: only deduct stock the first time this order is marked paid,
  // so a retried webhook delivery can't double-deduct.
  if (order.status !== 'paid') {
    order.status = 'paid';
    const products = db.getProducts();
    const product = products.find((p) => p.id === order.productId);
    if (product) {
      product.stock = Math.max(0, product.stock - order.quantity);
      db.saveProducts(products);
    }
    db.saveOrders(orders);
  }

  res.status(200).send('OK');
});

app.use(express.json());

function getUsers() {
  return db.getUsers();
}
function getUserById(userId) {
  return db.getUserById(userId);
}

// Admin credentials come from your .env file (ADMIN_EMAIL / ADMIN_PASSWORD)
// instead of being hardcoded here. This means:
//   - Nothing sensitive lives in your source code / git history.
//   - You can rotate the admin password by changing .env and restarting
//     the server — it re-syncs the hash every startup.
//   - If you forget to set them, the server logs a clear warning and skips
//     creating/updating an admin account rather than falling back to a
//     known, guessable default.
async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn(
      'ADMIN_EMAIL / ADMIN_PASSWORD are not set in .env — skipping admin account setup. '
      + 'Set both (password 8+ characters) to create or update the admin account.'
    );
    return;
  }
  if (adminPassword.length < 8) {
    console.warn('ADMIN_PASSWORD must be at least 8 characters — skipping admin account setup.');
    return;
  }

  const users = getUsers();
  const existingAdmin = users.find((user) => user.email.toLowerCase() === adminEmail.toLowerCase());
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  if (existingAdmin) {
    existingAdmin.name = existingAdmin.name || 'Admin';
    existingAdmin.role = 'admin';
    existingAdmin.passwordHash = passwordHash;
  } else {
    users.push({
      id: crypto.randomUUID(),
      name: 'Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
  }

  db.saveUsers(users);
}

// ---------- sessions ----------
// Persisted to disk (not just kept in memory) so that restarting the server
// during development doesn't silently log everyone out while the frontend
// still thinks they're logged in.
let sessionsObj = db.getSessions();
function saveSessions() { db.saveSessions(sessionsObj); }

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token && sessionsObj[token];
  if (!userId) return res.status(401).json({ error: 'Not logged in.' });
  req.userId = userId;
  req.user = getUserById(userId);
  next();
}

// ---------- auth routes ----------
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const users = getUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: crypto.randomUUID(), name, email, passwordHash, role: 'customer', createdAt: new Date().toISOString() };
  users.push(user);
  db.saveUsers(users);

  res.status(201).json({ message: 'Account created. You can now log in.' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();
  const user = users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessionsObj[token] = user.id;
  saveSessions();
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role || 'customer' } });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.slice(7);
  delete sessionsObj[token];
  saveSessions();
  res.json({ message: 'Logged out.' });
});

app.get('/api/me', requireAuth, (req, res) => {
  const users = getUsers();
  const user = users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role || 'customer' });
});

// ---------- product catalog ----------
app.get('/api/products', (req, res) => {
  res.json(db.getProducts());
});

app.get('/api/products/:id', (req, res) => {
  const product = db.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
});

app.post('/api/contact', async (req, res) => {
  const { name, email, phone, subject, message, skipEmail } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }

  const contactMessage = db.createMessage({
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone || '').trim(),
    subject: String(subject || 'Website enquiry').trim(),
    message: String(message).trim(),
    status: 'new',
    createdAt: new Date().toISOString(),
  });

  if (skipEmail) {
    contactMessage.emailSent = true;
    contactMessage.emailTo = CONTACT_TO_EMAIL;
    contactMessage.emailProvider = 'EmailJS';
    db.saveMessages(db.getMessages().map((savedMessage) => (
      savedMessage.id === contactMessage.id ? contactMessage : savedMessage
    )));
  } else {
    try {
      const emailResult = await sendContactEmail(contactMessage);
      contactMessage.emailSent = emailResult.sent;
      contactMessage.emailTo = CONTACT_TO_EMAIL;
      if (!emailResult.sent) contactMessage.emailError = emailResult.reason;
      db.saveMessages(db.getMessages().map((savedMessage) => (
        savedMessage.id === contactMessage.id ? contactMessage : savedMessage
      )));
    } catch (error) {
      contactMessage.emailSent = false;
      contactMessage.emailTo = CONTACT_TO_EMAIL;
      contactMessage.emailError = error.message;
      db.saveMessages(db.getMessages().map((savedMessage) => (
        savedMessage.id === contactMessage.id ? contactMessage : savedMessage
      )));
      console.error('Contact email failed:', error.message);
    }
  }

  res.status(201).json({
    message: contactMessage.emailSent
      ? 'Thanks. We received your enquiry and emailed the store.'
      : 'Thanks. We received your enquiry. Email delivery is not configured yet.',
    contactMessage,
  });
});

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

app.get('/api/admin/dashboard', requireAuth, requireAdmin, (req, res) => {
  const products = db.getProducts();
  const orders = db.getOrders();
  const messages = db.getMessages();
  const pendingOrders = orders.filter((order) => order.status === 'pending').length;
  const lowStockProducts = products.filter((product) => Number(product.stock) <= 5).length;

  res.json({
    productsCount: products.length,
    ordersCount: orders.length,
    messagesCount: messages.length,
    pendingOrders,
    lowStockProducts,
  });
});

app.get('/api/admin/products', requireAuth, requireAdmin, (req, res) => {
  res.json(db.getProducts());
});

app.post('/api/admin/products', requireAuth, requireAdmin, (req, res) => {
  const { name, storage, color, price, stock, image, blurb } = req.body;
  if (!name || !storage || !color || price == null || stock == null) {
    return res.status(400).json({ error: 'Name, storage, color, price and stock are required.' });
  }

  const products = db.getProducts();
  const normalizeId = (value) => (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase();

  const baseId = normalizeId(`${name}-${storage}-${color}`) || `product-${Date.now()}`;
  let id = baseId;
  let index = 1;
  while (products.some((product) => product.id === id)) {
    index += 1;
    id = `${baseId}-${index}`;
  }

  const newProduct = {
    id,
    name,
    storage,
    color,
    price: Number(price),
    stock: Number(stock),
    image: image || '',
    blurb: blurb || '',
    createdAt: new Date().toISOString(),
  };

  products.push(newProduct);
  db.saveProducts(products);
  res.status(201).json(newProduct);
});

// Update an existing product (name, storage, color, price, stock, image,
// blurb). Only fields present in the request body are changed. Because
// catalog.js and checkout.js always fetch fresh from /api/products /
// /api/products/:id, any change saved here shows up on the customer side
// immediately on their next page load/refresh.
app.put('/api/admin/products/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, storage, color, price, stock, image, blurb } = req.body;

  const products = db.getProducts();
  const product = products.find((p) => p.id === id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  if (name != null && String(name).trim() !== '') product.name = String(name).trim();
  if (storage != null && String(storage).trim() !== '') product.storage = String(storage).trim();
  if (color != null && String(color).trim() !== '') product.color = String(color).trim();
  if (image != null) product.image = String(image).trim();
  if (blurb != null) product.blurb = String(blurb).trim();

  if (price != null) {
    const numPrice = Number(price);
    if (Number.isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ error: 'Price must be a valid non-negative number.' });
    }
    product.price = numPrice;
  }

  if (stock != null) {
    const numStock = Number(stock);
    if (Number.isNaN(numStock) || numStock < 0) {
      return res.status(400).json({ error: 'Stock must be a valid non-negative number.' });
    }
    product.stock = numStock;
  }

  db.saveProducts(products);
  res.json(product);
});

// Delete a product entirely.
app.delete('/api/admin/products/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const products = db.getProducts();
  const exists = products.some((p) => p.id === id);
  if (!exists) return res.status(404).json({ error: 'Product not found.' });

  const remaining = products.filter((p) => p.id !== id);
  db.saveProducts(remaining);
  res.json({ message: 'Product deleted.' });
});

app.get('/api/admin/orders', requireAuth, requireAdmin, (req, res) => {
  const orders = db.getOrders();
  const users = getUsers();
  const products = db.getProducts();
  const userMap = users.reduce((map, user) => ({ ...map, [user.id]: user }), {});
  const productMap = products.reduce((map, product) => ({ ...map, [product.id]: product }), {});

  res.json(orders.map((order) => ({
    ...order,
    user: userMap[order.userId] ? {
      id: userMap[order.userId].id,
      name: userMap[order.userId].name,
      email: userMap[order.userId].email,
    } : null,
    product: productMap[order.productId] || null,
  })));
});

app.get('/api/admin/messages', requireAuth, requireAdmin, (req, res) => {
  res.json(db.getMessages().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// ---------- South African provinces (delivery validation) ----------
const SA_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];

// Validates the delivery details submitted from checkout.html before an
// order is created. Returns an error message string, or null if valid.
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

  // Default / 'address' method
  if (!String(delivery.street || '').trim()) return 'Street address is required.';
  if (!String(delivery.suburb || '').trim()) return 'Suburb is required.';
  if (!String(delivery.city || '').trim()) return 'City is required.';
  if (!SA_PROVINCES.includes(delivery.province)) return 'A valid province is required.';
  if (!/^\d{4}$/.test(String(delivery.postalCode || '').trim())) return 'A valid 4-digit postal code is required.';

  return null;
}

// Strips the delivery object down to known fields only, so nothing
// unexpected gets written to storage.
function sanitizeDelivery(delivery) {
  const base = {
    method: delivery.method === 'pep' ? 'pep' : 'address',
    name: String(delivery.name || '').trim(),
    phone: String(delivery.phone || '').trim(),
    email: String(delivery.email || '').trim(),
  };

  if (base.method === 'pep') {
    return {
      ...base,
      pepStore: String(delivery.pepStore || '').trim(),
      pepSuburb: String(delivery.pepSuburb || '').trim(),
    };
  }

  return {
    ...base,
    street: String(delivery.street || '').trim(),
    suburb: String(delivery.suburb || '').trim(),
    city: String(delivery.city || '').trim(),
    province: delivery.province,
    postalCode: String(delivery.postalCode || '').trim(),
    instructions: String(delivery.instructions || '').trim(),
  };
}

// ---------- Yoco checkout ----------
// Docs: https://developer.yoco.com/guides/online-payments/accepting-a-payment
//
// Flow: 1) your server creates a Checkout via Yoco's API and gets back a
// redirectUrl, 2) the browser is sent to that Yoco-hosted page, 3) Yoco
// notifies your server via the /api/yoco-webhook route above once payment
// actually succeeds — that webhook is the ONLY thing allowed to mark an
// order 'paid' and deduct stock. The success/cancel/failure redirect URLs
// below are for the customer's browser experience ONLY; never trust them to
// confirm payment (a customer could land on the "success" URL without
// paying by editing the address bar).
const YOCO_API_BASE = 'https://payments.yoco.com/api';

app.post('/api/checkout', requireAuth, async (req, res) => {
  const { productId, quantity, delivery } = req.body;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  const deliveryError = validateDelivery(delivery);
  if (deliveryError) return res.status(400).json({ error: deliveryError });

  const products = db.getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (product.stock < qty) return res.status(400).json({ error: 'Not enough stock available.' });

  const amountRands = product.price * qty;
  const amountCents = Math.round(amountRands * 100); // Yoco expects the smallest currency unit
  const reference = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  let yocoCheckout;
  try {
    const yocoRes = await fetch(`${YOCO_API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: 'ZAR',
        successUrl: `${FRONTEND_URL}/checkout.html?status=success&ref=${reference}`,
        cancelUrl: `${FRONTEND_URL}/checkout.html?status=cancelled&ref=${reference}`,
        failureUrl: `${FRONTEND_URL}/checkout.html?status=error&ref=${reference}`,
        metadata: { reference },
      }),
    });

    yocoCheckout = await yocoRes.json();
    if (!yocoRes.ok) {
      console.error('Yoco checkout creation failed:', yocoCheckout);
      return res.status(502).json({ error: 'Could not start payment. Please try again.' });
    }
  } catch (error) {
    console.error('Yoco checkout request error:', error.message);
    return res.status(502).json({ error: 'Could not reach the payment provider. Please try again.' });
  }

  const orders = db.getOrders();
  orders.push({
    reference,
    yocoCheckoutId: yocoCheckout.id,
    userId: req.userId,
    productId,
    quantity: qty,
    amount: Number(amountRands.toFixed(2)),
    status: 'pending',
    delivery: sanitizeDelivery(delivery),
    createdAt: new Date().toISOString(),
  });
  db.saveOrders(orders);

  res.status(201).json({ redirectUrl: yocoCheckout.redirectUrl, reference });
});

// Lets the checkout page poll for the current status of an order.
app.get('/api/orders/:reference', requireAuth, (req, res) => {
  const orders = db.getOrders();
  const order = orders.find((o) => o.reference === req.params.reference && o.userId === req.userId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json(order);
});

async function getAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 10; port += 1) {
    const available = await new Promise((resolve) => {
      const tester = net.createServer();
      tester.once('error', () => resolve(false));
      tester.once('listening', () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, '127.0.0.1');
    });

    if (available) return port;
  }

  throw new Error('No available local ports found.');
}

async function startServer() {
  await ensureAdminUser();

  try {
    const port = await getAvailablePort(PORT || DEFAULT_PORT);
    const server = app.listen(port, '127.0.0.1', () => {
      console.log(`iPhone store backend running on http://127.0.0.1:${port}`);
      process.env.REACT_APP_BACKEND_PORT = String(port);
    });
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is busy. Please stop the other process and try again.`);
      }
      throw error;
    });
  } catch (error) {
    console.error('Failed to start backend:', error.message);
    process.exit(1);
  }
}

startServer();