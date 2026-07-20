async function handleLogin(event) {
  if (event) event.preventDefault();

  const errorBox = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  if (!form || !emailInput || !passwordInput) {
    window.location.href = 'catalog.html';
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  errorBox.classList.remove('show');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in…';

  try {
    const data = await apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setSession(data.token, data.user);
    const params = new URLSearchParams(window.location.search);
    const nextPath = params.get('next');
    const target = nextPath || (data.user?.role === 'admin' ? 'admin.html' : 'catalog.html');
    window.location.assign(new URL(target, window.location.href).href);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('show');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';
  }
}

window.handleLogin = handleLogin;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');

  if (form) {
    form.addEventListener('submit', handleLogin);
  }
});
