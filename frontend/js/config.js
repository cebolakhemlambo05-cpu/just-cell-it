(function () {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const configured = window.MOBILEHUB_API_URL || 'https://just-cell-it-5.onrender.com';
  const bases = [
    configured,
    isLocal ? 'http://localhost:3002' : window.location.origin,
    isLocal ? 'http://localhost:3001' : '',
    isLocal ? 'http://localhost:4000' : '',
    isLocal ? 'http://localhost:4001' : '',
    isLocal ? 'http://localhost:4002' : ''
  ].filter(Boolean);

  window.MOBILEHUB = window.MOBILEHUB || {};
  window.MOBILEHUB.apiBases = [...new Set(bases)];
  window.MOBILEHUB.resolvedApiBase = null;
  window.MOBILEHUB.WHATSAPP_NUMBER = typeof window.MOBILEHUB_WHATSAPP_NUMBER !== 'undefined' ? window.MOBILEHUB_WHATSAPP_NUMBER : '';

  window.MOBILEHUB.getToken = function () { return localStorage.getItem('token'); };
  window.MOBILEHUB.getUser = function () {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  };
  window.MOBILEHUB.setSession = function (token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  };
  window.MOBILEHUB.clearSession = function () {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  window.MOBILEHUB.apiFetch = async function (path, options) {
    const opts = options || {};
    const token = window.MOBILEHUB.getToken();
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    const candidates = window.MOBILEHUB.resolvedApiBase
      ? [window.MOBILEHUB.resolvedApiBase, ...window.MOBILEHUB.apiBases.filter((b) => b !== window.MOBILEHUB.resolvedApiBase)]
      : window.MOBILEHUB.apiBases;

    let lastError = null;
    for (const base of candidates) {
      try {
        const response = await fetch(`${base}${path}`, { ...opts, headers, cache: 'no-store' });
        const type = response.headers.get('content-type') || '';
        const data = type.includes('application/json') ? await response.json() : await response.text();

        if (response.status === 401 && token) {
          window.MOBILEHUB.clearSession();
          const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
          window.location.href = `login.html?next=${next}`;
          throw new Error('Your session expired — please log in again.');
        }
        if (!response.ok) {
          const err = new Error(data && (data.error || data.message) || `Request failed with status ${response.status}`);
          err.status = response.status;
          lastError = err;
          // Do not keep trying different servers for a real API response such as 404/400.
          if (response.status < 500) throw err;
          continue;
        }
        window.MOBILEHUB.resolvedApiBase = base;
        return data;
      } catch (error) {
        lastError = error;
        if (error && error.status && error.status < 500) throw error;
      }
    }
    throw lastError || new Error('Could not reach the MobileHub backend.');
  };

  window.MOBILEHUB.formatZAR = function (amount) {
    return `R${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  window.MOBILEHUB.escapeHtml = function (value) {
    return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  };
})();
