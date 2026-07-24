// // ============================================
// // API Configuration
// // ============================================
// const API_BASE_URL = 'https://just-cell-it-5.onrender.com';

// // ============================================
// // Login Handler
// // ============================================
// async function handleLogin(event) {
//   if (event) event.preventDefault();

//   const errorBox = document.getElementById('form-error');
//   const submitBtn = document.getElementById('submit-btn');
//   const form = document.getElementById('login-form');
//   const emailInput = document.getElementById('email');
//   const passwordInput = document.getElementById('password');

//   if (!form || !emailInput || !passwordInput) {
//     window.location.href = 'catalog.html';
//     return;
//   }

//   const email = emailInput.value.trim();
//   const password = passwordInput.value;

//   errorBox.classList.remove('show');

//   submitBtn.disabled = true;
//   submitBtn.textContent = 'Logging in…';

//   try {
//     const data = await apiFetch(`${API_BASE_URL}/api/login`, {
//       method: 'POST',
//       body: JSON.stringify({ email, password }),
//     });

//     setSession(data.token, data.user);
//     const params = new URLSearchParams(window.location.search);
//     const nextPath = params.get('next');
//     const target = nextPath || (data.user?.role === 'admin' ? 'admin.html' : 'catalog.html');
//     window.location.assign(new URL(target, window.location.href).href);
//   } catch (err) {
//     errorBox.textContent = err.message;
//     errorBox.classList.add('show');
//     submitBtn.disabled = false;
//     submitBtn.textContent = 'Log in';
//   }
// }

// window.handleLogin = handleLogin;

// // ============================================
// // Session Management
// // ============================================
// function setSession(token, user) {
//   localStorage.setItem('token', token);
//   localStorage.setItem('user', JSON.stringify(user));
// }

// function getSession() {
//   const token = localStorage.getItem('token');
//   const user = JSON.parse(localStorage.getItem('user') || 'null');
//   return { token, user };
// }

// function clearSession() {
//   localStorage.removeItem('token');
//   localStorage.removeItem('user');
// }

// // ============================================
// // API Fetch Helper Function
// // ============================================
// async function apiFetch(endpoint, options = {}) {
//   const defaultOptions = {
//     headers: {
//       'Content-Type': 'application/json',
//     },
//   };

//   const mergedOptions = {
//     ...defaultOptions,
//     ...options,
//     headers: {
//       ...defaultOptions.headers,
//       ...options.headers,
//     },
//   };

//   // If we have a token in localStorage, add it to the Authorization header
//   const token = localStorage.getItem('token');
//   if (token) {
//     mergedOptions.headers['Authorization'] = `Bearer ${token}`;
//   }

//   const response = await fetch(endpoint, mergedOptions);

//   // Handle non-JSON responses
//   const contentType = response.headers.get('content-type');
//   let data;
//   if (contentType && contentType.includes('application/json')) {
//     data = await response.json();
//   } else {
//     data = await response.text();
//   }

//   if (!response.ok) {
//     // Throw error with message from server
//     const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
//     throw new Error(errorMessage);
//   }

//   return data;
// }

// // ============================================
// // DOM Event Listeners
// // ============================================
// document.addEventListener('DOMContentLoaded', () => {
//   const form = document.getElementById('login-form');

//   if (form) {
//     form.addEventListener('submit', handleLogin);
//   }
// });