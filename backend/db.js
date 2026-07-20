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

ensureDataStore();

module.exports = {
  getUsers: () => readCollection('users'),
  saveUsers: (users) => writeCollection('users', users),
  getUserById: (userId) => readCollection('users').find((user) => user.id === userId) || null,

  getSessions: () => readCollection('sessions'),
  saveSessions: (sessions) => writeCollection('sessions', sessions),

  getProducts: () => readCollection('products'),
  saveProducts: (products) => writeCollection('products', products),
  getProductById: (productId) => readCollection('products').find((product) => product.id === productId) || null,

  getOrders: () => readCollection('orders'),
  saveOrders: (orders) => writeCollection('orders', orders),

  getMessages: () => readCollection('messages'),
  saveMessages: (messages) => writeCollection('messages', messages),
  createMessage: (message) => {
    const messages = readCollection('messages');
    messages.push(message);
    writeCollection('messages', messages);
    return message;
  },
};
