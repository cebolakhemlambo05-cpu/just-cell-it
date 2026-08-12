(function () {
  function renderAuthSlot() {
    const slot = document.getElementById('nav-auth-slot');
    if (!slot) return;
    const user = window.MOBILEHUB.getUser();
    if (user) {
      const firstName = String(user.name || 'Customer').split(' ')[0];
      slot.innerHTML = `
        <span style="color:var(--muted);font-size:.9rem;">Hi, ${window.MOBILEHUB.escapeHtml(firstName)}</span>
        ${user.role === 'admin' ? '<a href="admin.html" class="btn btn-secondary">Admin</a>' : ''}
        <button class="btn btn-secondary" id="logout-btn" type="button">Log out</button>`;
      document.getElementById('logout-btn')?.addEventListener('click', async () => {
        try { await window.MOBILEHUB.apiFetch('/api/logout', { method:'POST' }); } catch {}
        window.MOBILEHUB.clearSession();
        window.location.href = 'index.html';
      });
    } else {
      slot.innerHTML = '<a href="login.html" class="btn btn-secondary">Log in</a><a href="register.html" class="btn btn-primary">Register</a>';
    }
  }

  function initHeaderMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const controls = document.querySelector('.header-controls');
    if (!toggle || !controls) return;
    const close = () => {
      controls.classList.remove('is-open');
      toggle.classList.remove('is-active');
      toggle.setAttribute('aria-expanded','false');
    };
    toggle.addEventListener('click', () => {
      const open = controls.classList.toggle('is-open');
      toggle.classList.toggle('is-active', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    controls.querySelectorAll('a,button').forEach((el) => el.addEventListener('click', close));
    window.addEventListener('resize', () => { if (window.innerWidth > 860) close(); });
    document.addEventListener('click', (e) => {
      if (!controls.contains(e.target) && !toggle.contains(e.target)) close();
    });
  }

  async function initWhatsApp() {
    let number = String(window.MOBILEHUB.WHATSAPP_NUMBER || '');

    // Try the backend as a fallback so the same configured number is used
    // everywhere. The button itself is still rendered if the number is not
    // configured, so customers can see where WhatsApp support is available.
    if (!number) {
      try {
        const details = await window.MOBILEHUB.apiFetch('/api/payment-details');
        number = String(details.whatsappNumber || '');
      } catch {}
    }

    number = number.replace(/\D/g, '');
    const validNumber = /^\d{10,15}$/.test(number);

    let button = document.getElementById('whatsapp-float');
    if (!button) {
      button = document.createElement('a');
      button.id = 'whatsapp-float';
      button.className = 'whatsapp-float';
      button.target = '_blank';
      button.rel = 'noopener noreferrer';
      button.setAttribute('aria-label', 'Chat with MobileHub on WhatsApp');
      button.title = 'Chat with MobileHub on WhatsApp';
      button.innerHTML = `
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path fill="currentColor" d="M19.11 17.18c-.28-.14-1.64-.81-1.9-.9-.26-.1-.45-.14-.64.14-.19.28-.73.9-.89 1.09-.16.19-.33.21-.61.07-.28-.14-1.17-.43-2.23-1.38-.82-.73-1.38-1.63-1.54-1.9-.16-.28-.02-.43.12-.57.13-.13.28-.33.42-.49.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.64-1.55-.87-2.12-.23-.56-.46-.49-.64-.5h-.54c-.19 0-.49.07-.75.35-.26.28-.98.96-.98 2.34 0 1.38 1 2.71 1.14 2.9.14.19 1.97 3.01 4.77 4.22.67.29 1.19.46 1.6.59.67.21 1.28.18 1.76.11.54-.08 1.64-.67 1.87-1.31.23-.65.23-1.2.16-1.31-.07-.12-.26-.19-.54-.33z"/>
          <path fill="currentColor" d="M16.01 3.2c-7.07 0-12.81 5.73-12.81 12.78 0 2.26.59 4.46 1.72 6.4L3.08 28.8l6.56-1.72a12.78 12.78 0 0 0 6.37 1.68h.01c7.06 0 12.8-5.73 12.8-12.78S23.07 3.2 16.01 3.2zm0 23.43h-.01a10.63 10.63 0 0 1-5.42-1.49l-.39-.23-3.89 1.02 1.04-3.79-.25-.39a10.62 10.62 0 1 1 8.92 4.88z"/>
        </svg>
        <span class="whatsapp-float-label">WhatsApp</span>`;
      document.body.appendChild(button);
    }

    if (validNumber) {
      button.href = `https://wa.me/${number}?text=${encodeURIComponent('Hi MobileHub, I would like help with an iPhone.')}`;
      button.classList.remove('is-unconfigured');
      button.onclick = null;
      button.title = 'Chat with MobileHub on WhatsApp';
    } else {
      button.href = '#';
      button.classList.add('is-unconfigured');
      button.title = 'WhatsApp support is not configured yet';
      button.onclick = (event) => {
        event.preventDefault();
        window.alert('WhatsApp support is not configured yet. Please contact MobileHub by email.');
      };
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderAuthSlot();
    initHeaderMenu();
    initWhatsApp();
  });
})();
