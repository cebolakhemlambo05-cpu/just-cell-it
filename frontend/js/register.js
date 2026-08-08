// ============================================
// API Configuration
// ============================================
const API_BASE_URL = window.MOBILEHUB_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : window.location.origin
);

// ============================================
// Register Form Handler
// ============================================
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('form-error');
  const successBox = document.getElementById('form-success');
  const submitBtn = document.getElementById('submit-btn');
  errorBox.classList.remove('show');
  successBox.classList.remove('show');

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (password.length < 8) {
    errorBox.textContent = 'Password must be at least 8 characters.';
    errorBox.classList.add('show');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account…';

  try {
    await apiFetch(`${API_BASE_URL}/api/register`, {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    successBox.textContent = 'Account created! Redirecting you to log in…';
    successBox.classList.add('show');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('show');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create account';
  }
});

// ============================================
// API Fetch Helper Function
// ============================================
async function apiFetch(endpoint, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  // If we have a token in localStorage, add it to the Authorization header
  const token = localStorage.getItem('token');
  if (token) {
    mergedOptions.headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, mergedOptions);

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // Throw error with message from server
    const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}