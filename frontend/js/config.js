// Point this at your deployed backend once it's live (e.g. Render URL).
// For local development the frontend should use the local Node backend.
const DEFAULT_API_BASE = window.location.protocol === 'file:'
  || window.location.hostname === 'localhost'
  || window.location.hostname === '127.0.0.1'
  || !window.location.hostname
  ? 'http://localhost:4000'
  : 'https://YOUR-BACKEND-URL.onrender.com';
const API_BASE_CANDIDATES = [DEFAULT_API_BASE, 'http://localhost:4001', 'http://localhost:4002'];
let resolvedApiBase = null;

// Your Yoco hosted Payment Page. Replace with your own if this ever changes.
const YOCO_PAY_URL = 'https://pay.yoco.com/just-cell-it1';

function getToken() {
  return localStorage.getItem('token');
}
function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}
function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const candidates = resolvedApiBase
    ? [resolvedApiBase, ...API_BASE_CANDIDATES.filter((base) => base !== resolvedApiBase)]
    : API_BASE_CANDIDATES;

  let lastError = null;
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}${path}`, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && token) {
        clearSession();
        const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
        window.location.href = `login.html?next=${next}`;
        throw new Error('Your session expired — please log in again.');
      }
      if (!res.ok) {
        lastError = new Error(data.error || 'Something went wrong.');
        continue;
      }
      resolvedApiBase = base;
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Could not reach the backend.');
}

function initHeroCarousel() {
  const heroImage = document.getElementById('hero-product-image');
  const heroName = document.getElementById('hero-product-name');
  if (!heroImage || !heroName) return;

  const fallbackSlides = [
    { name: 'iPhone 15', image: 'https://images.unsplash.com/photo-1697284959429-19c9c5c7a3e2?auto=format&fit=crop&w=900&q=80' },
    { name: 'iPhone 11', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80' },
    { name: 'iPhone 14', image: 'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?auto=format&fit=crop&w=900&q=80' },
    { name: 'iPhone 13', image: 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?auto=format&fit=crop&w=900&q=80' },
    { name: 'iPhone SE', image: 'https://images.unsplash.com/photo-1616348436168-de43ad0db179?auto=format&fit=crop&w=900&q=80' },
    { name: 'iPhone 12', image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=900&q=80' }
  ];

  async function loadSlides() {
    try {
      const products = await apiFetch('/api/products');
      const slides = Array.isArray(products)
        ? products.slice(0, 6).map((product) => ({ name: product.name, image: product.image }))
        : [];
      return slides.length ? slides : fallbackSlides;
    } catch {
      return fallbackSlides;
    }
  }

  let slides = fallbackSlides;
  let currentIndex = 0;

  const showSlide = (index) => {
    const slide = slides[index];
    if (!slide) return;
    heroImage.src = slide.image;
    heroImage.alt = `${slide.name} showcase`;
    heroName.textContent = slide.name;
    heroImage.classList.remove('is-active');
    requestAnimationFrame(() => heroImage.classList.add('is-active'));
  };

  loadSlides().then((loadedSlides) => {
    slides = loadedSlides;
    showSlide(0);
    setInterval(() => {
      currentIndex = (currentIndex + 1) % slides.length;
      showSlide(currentIndex);
    }, 3200);
  });
}

function initHeaderMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const controls = document.querySelector('.header-controls');
  if (!toggle || !controls) return;

  const closeMenu = () => {
    controls.classList.remove('is-open');
    toggle.classList.remove('is-active');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const isOpen = controls.classList.toggle('is-open');
    toggle.classList.toggle('is-active', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  controls.querySelectorAll('a, button').forEach((element) => {
    element.addEventListener('click', closeMenu);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) closeMenu();
  });

  document.addEventListener('click', (event) => {
    if (!controls.contains(event.target) && !toggle.contains(event.target)) {
      closeMenu();
    }
  });
}

// Updates header nav (Sign in / Register vs. account + Log out) on any page
// that includes an element with id="nav-auth-slot".
function renderAuthSlot() {
  const slot = document.getElementById('nav-auth-slot');
  if (!slot) return;
  const user = getUser();
  if (user) {
    const adminLink = user.role === 'admin'
      ? '<a href="admin.html" class="btn btn-secondary">Admin</a>'
      : '';
    slot.innerHTML = `
      <span style="color:var(--muted); font-size:0.9rem;">Hi, ${user.name.split(' ')[0]}</span>
      ${adminLink}
      <button class="btn btn-secondary" id="logout-btn">Log out</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      try { await apiFetch('/api/logout', { method: 'POST' }); } catch {}
      clearSession();
      window.location.href = 'index.html';
    });
  } else {
    slot.innerHTML = `
      <a href="login.html" class="btn btn-secondary">Log in</a>
      <a href="register.html" class="btn btn-primary">Register</a>
    `;
  }
}
document.addEventListener('DOMContentLoaded', () => {
  renderAuthSlot();
  initHeaderMenu();
  initHeroCarousel();
});
