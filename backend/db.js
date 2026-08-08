const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  sessions: path.join(DATA_DIR, 'sessions.json'),
  products: path.join(DATA_DIR, 'products.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
};

const state = {
  users: [],
  sessions: {},
  products: [],
  orders: [],
  messages: [],
};

let initialized = false;

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  Object.values(FILES).forEach((file) => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, file.endsWith('sessions.json') ? '{}' : '[]');
    }
  });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, file);
}

function readCollection(name) {
  return readJson(FILES[name], name === 'sessions' ? {} : []);
}

function writeCollection(name, data) {
  writeJson(FILES[name], data);
}

async function initializeDataStore() {
  ensureDataStore();
  state.users = readCollection('users');
  state.sessions = readCollection('sessions');
  state.products = readCollection('products');
  state.orders = readCollection('orders');
  state.messages = readCollection('messages');
  initialized = true;
}

function getUsers() {
  return state.users;
}

function saveUsers(users) {
  state.users = users;
  writeCollection('users', users);
}

function getUserById(userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function getSessions() {
  return state.sessions;
}

function saveSessions(sessions) {
  state.sessions = sessions;
  writeCollection('sessions', sessions);
}

function getProducts() {
  return state.products;
}

function saveProducts(products) {
  state.products = products;
  writeCollection('products', products);
}

function getProductById(productId) {
  return state.products.find((product) => product.id === productId) || null;
}

function getOrders() {
  return state.orders;
}

function saveOrders(orders) {
  state.orders = orders;
  writeCollection('orders', orders);
}

function getMessages() {
  return state.messages;
}

function saveMessages(messages) {
  state.messages = messages;
  writeCollection('messages', messages);
}

function createMessage(message) {
  const nextMessages = [...state.messages, message];
  state.messages = nextMessages;
  writeCollection('messages', nextMessages);
  return message;
}

module.exports = {
  init: initializeDataStore,
  isInitialized: () => initialized,
  getUsers,
  saveUsers,
  getUserById,
  getSessions,
  saveSessions,
  getProducts,
  saveProducts,
  getProductById,
  getOrders,
  saveOrders,
  getMessages,
  saveMessages,
  createMessage,
};

function saveOrders(orders) {
  state.orders = orders;
  writeCollection('orders', orders);
}

function getMessages() {
  return state.messages;
}

function saveMessages(messages) {
  state.messages = messages;
  writeCollection('messages', messages);
}

function createMessage(message) {
  const nextMessages = [...state.messages, message];
  state.messages = nextMessages;
  writeCollection('messages', nextMessages);
  return message;
}

module.exports = {
  init: initializeDataStore,
  isInitialized: () => initialized,
  getUsers,
  saveUsers,
  getUserById,
  getSessions,
  saveSessions,
  getProducts,
  saveProducts,
  getProductById,
  getOrders,
  saveOrders,
  getMessages,
  saveMessages,
  createMessage,
};
