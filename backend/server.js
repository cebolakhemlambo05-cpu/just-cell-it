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
const fs = require('fs');
const path = require('path');
const net = require('net');

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

// ---------- tiny JSON "database" ----------
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
if (!fs.existsSync(USERS_FILE)) writeJson(USERS_FILE, []);
if (!fs.existsSync(ORDERS_FILE)) writeJson(ORDERS_FILE, []);

function getUsers() {
  return readJson(USERS_FILE, []);
}
function getUserById(userId) {
  return getUsers().find((u) => u.id === userId) || null;
}

async function ensureAdminUser() {
  return;
}

// ---------- sessions ----------
// Persisted to disk (not just kept in memory) so that restarting the server
// during development doesn't silently log everyone out while the frontend
// still thinks they're logged in.
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
if (!fs.existsSync(SESSIONS_FILE)) writeJson(SESSIONS_FILE, {});
let sessionsObj = readJson(SESSIONS_FILE, {});
function saveSessions() { writeJson(SESSIONS_FILE, sessionsObj); }

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
  writeJson(USERS_FILE, users);

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
  res.json(readJson(PRODUCTS_FILE, []));
});

app.get('/api/products/:id', (req, res) => {
  const product = readJson(PRODUCTS_FILE, []).find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
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

  const products = readJson(PRODUCTS_FILE, []);
  const product = products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (product.stock < qty) return res.status(400).json({ error: 'Not enough stock available.' });

  const amount = (product.price * qty).toFixed(2);
  const reference = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  const orders = readJson(ORDERS_FILE, []);
  orders.push({
    reference,
    userId: req.userId,
    productId,
    quantity: qty,
    amount: Number(amount),
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  writeJson(ORDERS_FILE, orders);

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

  const orders = readJson(ORDERS_FILE, []);
  const order = orders.find((o) => o.reference === body.TransactionReference);
  if (!order) return res.status(404).send('Unknown order.');

  if (body.Status === 'Complete') {
    order.status = 'paid';
    const products = readJson(PRODUCTS_FILE, []);
    const product = products.find((p) => p.id === order.productId);
    if (product) {
      product.stock = Math.max(0, product.stock - order.quantity);
      writeJson(PRODUCTS_FILE, products);
    }
  } else if (body.Status === 'Cancelled') {
    order.status = 'cancelled';
  } else {
    order.status = 'failed';
  }
  writeJson(ORDERS_FILE, orders);

  res.status(200).send('OK');
});

// Lets the checkout page poll for the current status of an order.
app.get('/api/orders/:reference', requireAuth, (req, res) => {
  const orders = readJson(ORDERS_FILE, []);
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