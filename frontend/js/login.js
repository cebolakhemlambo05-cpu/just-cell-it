(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form'); if (!form) return;
    const errorBox = document.getElementById('form-error'); const btn = document.getElementById('submit-btn');
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); errorBox.classList.remove('show'); btn.disabled = true; btn.textContent = 'Logging in…';
      try {
        const data = await window.MOBILEHUB.apiFetch('/api/login', { method:'POST', body:JSON.stringify({ email:form.email.value.trim(), password:form.password.value }) });
        window.MOBILEHUB.setSession(data.token, data.user);
        const next = new URLSearchParams(location.search).get('next');
        location.assign(next || (data.user.role === 'admin' ? 'admin.html' : 'catalog.html'));
      } catch (e) { errorBox.textContent = e.message; errorBox.classList.add('show'); btn.disabled = false; btn.textContent = 'Log in'; }
    });
  });
})();
