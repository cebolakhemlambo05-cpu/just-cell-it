(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('register-form'); if (!form) return;
    const errorBox = document.getElementById('form-error'); const successBox = document.getElementById('form-success'); const btn = document.getElementById('submit-btn');
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); errorBox.classList.remove('show'); successBox.classList.remove('show');
      const payload = { name:form.name.value.trim(), email:form.email.value.trim(), password:form.password.value };
      if (payload.password.length < 8) { errorBox.textContent='Password must be at least 8 characters.'; errorBox.classList.add('show'); return; }
      btn.disabled=true; btn.textContent='Creating account…';
      try { await window.MOBILEHUB.apiFetch('/api/register',{method:'POST',body:JSON.stringify(payload)}); successBox.textContent='Account created! Redirecting you to log in…'; successBox.classList.add('show'); setTimeout(()=>location.href='login.html',1000); }
      catch(e){ errorBox.textContent=e.message; errorBox.classList.add('show'); btn.disabled=false; btn.textContent='Create account'; }
    });
  });
})();
