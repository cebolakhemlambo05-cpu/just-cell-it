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
    await apiFetch('/api/register', {
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
