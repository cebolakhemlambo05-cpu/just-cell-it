const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  products: path.join(DATA_DIR, 'products.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
  sessions: path.join(DATA_DIR, 'sessions.json'),
};

const DEFAULT_PRODUCTS = [
  {
    id: 'iphone-15-128gb-black', name: 'iPhone 15', storage: '128GB', color: 'Black',
    price: 11999, stock: 3,
    image: 'https://images.unsplash.com/photo-1697284959429-19c9c5c7a3e2?auto=format&fit=crop&w=900&q=80',
    blurb: 'Pre-owned iPhone 15 in excellent condition.', createdAt: new Date().toISOString(),
  },
  {
    id: 'iphone-14-128gb-blue', name: 'iPhone 14', storage: '128GB', color: 'Blue',
    price: 8999, stock: 5,
    image: 'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?auto=format&fit=crop&w=900&q=80',
    blurb: 'Genuine pre-owned iPhone 14, ready to ship.', createdAt: new Date().toISOString(),
  },
  {
    id: 'iphone-13-128gb-midnight', name: 'iPhone 13', storage: '128GB', color: 'Midnight',
    price: 6999, stock: 8,
    image: 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?auto=format&fit=crop&w=900&q=80',
    blurb: 'Reliable pre-owned iPhone 13 with great battery life.', createdAt: new Date().toISOString(),
  },
];

function ensureFile(file, fallback) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
}

function read(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function write(file, value) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, file);
}

async function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  ensureFile(FILES.users, []);
  ensureFile(FILES.products, DEFAULT_PRODUCTS);
  ensureFile(FILES.orders, []);
  ensureFile(FILES.messages, []);
  ensureFile(FILES.sessions, {});
}

const api = {
  init,
  getUsers: () => read(FILES.users, []),
  saveUsers: (v) => write(FILES.users, v),
  getUserById: (id) => api.getUsers().find((u) => u.id === id),
  getProducts: () => read(FILES.products, DEFAULT_PRODUCTS),
  saveProducts: (v) => write(FILES.products, v),
  getProductById: (id) => api.getProducts().find((p) => p.id === id),
  getOrders: () => read(FILES.orders, []),
  saveOrders: (v) => write(FILES.orders, v),
  getMessages: () => read(FILES.messages, []),
  saveMessages: (v) => write(FILES.messages, v),
  createMessage: (message) => {
    const messages = api.getMessages();
    messages.push(message);
    api.saveMessages(messages);
    return message;
  },
  getSessions: () => read(FILES.sessions, {}),
  saveSessions: (v) => write(FILES.sessions, v),
};

module.exports = api;
