// Minimal Node.js backend for the iPhone store.
// Handles: user registration/login, product catalog, and Ozow checkout.
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
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Ozow posts as form-encoded

function getUsers() {
  return db.getUsers();
}
function getUserById(userId) {
  return db.getUserById(userId);
}

async function ensureAdminUser() {
  const adminEmail = 'admin@justcellit.com';
  const adminPassword = 'admin123456';
  const users = getUsers();
  const existingAdmin = users.find((user) => user.email.toLowerCase() === adminEmail);
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

// ---------- Ozow checkout ----------
// Docs: https://ozow.com/integrations (Payment Request Link / HTTP POST integration)
//
// The private key must NEVER be sent to the browser. This endpoint builds the
// signed request server-side and hands the browser only the final Ozow URL.
const OZOW_PAY_URL = process.env.OZOW_IS_TEST === 'false'
  ? 'https://pay.ozow.com'
  : 'https://stagingpay.ozow.com';

function ozowHash(orderedValues, privateKey) {
  const concatenated = orderedValues.join('') + privateKey;
  return crypto.createHash('sha512').update(concatenated.toLowerCase()).digest('hex');
}

app.post('/api/checkout', requireAuth, (req, res) => {
  const { productId, quantity } = req.body;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  const products = db.getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (product.stock < qty) return res.status(400).json({ error: 'Not enough stock available.' });

  const amount = (product.price * qty).toFixed(2);
  const reference = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  const orders = db.getOrders();
  orders.push({
    reference,
    userId: req.userId,
    productId,
    quantity: qty,
    amount: Number(amount),
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  db.saveOrders(orders);

  const siteCode = process.env.OZOW_SITE_CODE;
  const privateKey = process.env.OZOW_PRIVATE_KEY;
  const isTest = process.env.OZOW_IS_TEST !== 'false' ? 'true' : 'false';

  const fields = {
    SiteCode: siteCode,
    CountryCode: 'ZA',
    CurrencyCode: 'ZAR',
    Amount: amount,
    TransactionReference: reference,
    BankReference: reference.slice(0, 20), // Ozow limits this field's length
    CancelUrl: `${FRONTEND_URL}/checkout.html?status=cancelled&ref=${reference}`,
    ErrorUrl: `${FRONTEND_URL}/checkout.html?status=error&ref=${reference}`,
    SuccessUrl: `${FRONTEND_URL}/checkout.html?status=success&ref=${reference}`,
    NotifyUrl: `${req.protocol}://${req.get('host')}/api/ozow-webhook`,
    IsTest: isTest,
  };

  // Order matters: hash is generated over these values in this exact order.
  const orderedValues = [
    fields.SiteCode,
    fields.CountryCode,
    fields.CurrencyCode,
    fields.Amount,
    fields.TransactionReference,
    fields.BankReference,
    fields.CancelUrl,
    fields.ErrorUrl,
    fields.SuccessUrl,
    fields.NotifyUrl,
    fields.IsTest,
  ];
  fields.HashCheck = ozowHash(orderedValues, privateKey);

  const query = new URLSearchParams(fields).toString();
  res.json({ redirectUrl: `${OZOW_PAY_URL}/?${query}`, reference });
});

// Ozow calls this server-to-server once the payment concludes. This is the
// ONLY result that should mark an order as paid — never trust the browser
// redirect alone, since a user could fake landing on the "success" page.
app.post('/api/ozow-webhook', (req, res) => {
  const body = req.body;
  const privateKey = process.env.OZOW_PRIVATE_KEY;

  const orderedValues = [
    body.SiteCode,
    body.TransactionId,
    body.TransactionReference,
    body.Amount,
    body.Status,
    body.Optional1,
    body.Optional2,
    body.Optional3,
    body.Optional4,
    body.Optional5,
    body.CurrencyCode,
    body.IsTest,
    body.StatusMessage,
  ].map((v) => v ?? '');

  const expectedHash = ozowHash(orderedValues, privateKey);
  if (expectedHash !== (body.Hash || '').toLowerCase()) {
    return res.status(403).send('Invalid hash.');
  }

  const orders = db.getOrders();
  const order = orders.find((o) => o.reference === body.TransactionReference);
  if (!order) return res.status(404).send('Unknown order.');

  if (body.Status === 'Complete') {
    order.status = 'paid';
    const products = db.getProducts();
    const product = products.find((p) => p.id === order.productId);
    if (product) {
      product.stock = Math.max(0, product.stock - order.quantity);
      db.saveProducts(products);
    }
  } else if (body.Status === 'Cancelled') {
    order.status = 'cancelled';
  } else {
    order.status = 'failed';
  }
  db.saveOrders(orders);

  res.status(200).send('OK');
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
