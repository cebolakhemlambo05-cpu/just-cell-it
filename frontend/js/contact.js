// ============================================
// API Configuration
// ============================================
const API_BASE_URL = window.MOBILEHUB_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : window.location.origin
);

// ============================================
// Contact Form Handler
// ============================================
async function handleContactSubmit(event) {
  event.preventDefault();

  const form = document.getElementById('contact-form');
  const errorBox = document.getElementById('contact-error');
  const successBox = document.getElementById('contact-success');
  const submitBtn = document.getElementById('contact-submit');

  errorBox.classList.remove('show');
  successBox.classList.remove('show');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    subject: form.subject.value,
    message: form.message.value.trim(),
  };

  try {
    const sentWithEmailJs = await sendWithEmailJs(form);

    const response = await apiFetch(`${API_BASE_URL}/api/contact`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, skipEmail: sentWithEmailJs }),
    });

    successBox.textContent = sentWithEmailJs
      ? 'Thanks. Your enquiry was sent to MobileHub.'
      : response.message;
    successBox.classList.add('show');
    form.reset();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.add('show');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send message';
  }
}

// ============================================
// EmailJS Helpers
// ============================================
function isEmailJsReady() {
  const config = window.EMAILJS_CONFIG || {};
  return Boolean(
    window.emailjs
      && config.publicKey
      && config.serviceId
      && config.templateId
      && !config.publicKey.startsWith('YOUR_')
      && !config.serviceId.startsWith('YOUR_')
      && !config.templateId.startsWith('YOUR_')
  );
}

async function sendWithEmailJs(form) {
  if (!isEmailJsReady()) return false;

  const config = window.EMAILJS_CONFIG;
  await emailjs.sendForm(config.serviceId, config.templateId, form, {
    publicKey: config.publicKey,
  });
  return true;
}

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

// ============================================
// DOM Event Listeners
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (form) form.addEventListener('submit', handleContactSubmit);
});