// ── Auth ─────────────────────────────────────────────────
  (function checkAuth() {
    if (!localStorage.getItem('recall_token')) {
      window.location.href = '/auth.html';
    }
    const user = JSON.parse(localStorage.getItem('recall_user') || '{}');
    const initials = (user.email || '?').slice(0, 2).toUpperCase();
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
      avatar.textContent = initials;
      avatar.title = user.email || '';
    }
    const menuEmail = document.getElementById('userMenuEmail');
    if (menuEmail) menuEmail.textContent = user.email || '';
  })();

  function toggleUserMenu() {
    document.getElementById('userMenu').classList.toggle('open');
  }

  // Close user menu when clicking outside
  document.addEventListener('click', e => {
    const menu   = document.getElementById('userMenu');
    const avatar = document.getElementById('userAvatar');
    if (menu && !menu.contains(e.target) && e.target !== avatar) {
      menu.classList.remove('open');
    }
  });

  function authFetch(url, options = {}) {
    // Local mode — route to on-device SQLite, no network needed
    if (localStorage.getItem('recall_mode') === 'local') {
      // Binary uploads can't go through the local JSON-based API
      if (url.includes('/parse-apkg')) {
        return Promise.resolve({
          ok: false, status: 400,
          json: () => Promise.resolve({ error: 'Anki .apkg import requires a server connection. You are currently in local-only mode.' })
        });
      }
      return LocalAPI.handle(url, options);
    }
    // Server mode — same-origin API
    const token = localStorage.getItem('recall_token');
    return fetch(url, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (res.status === 401) {
        localStorage.removeItem('recall_token');
        localStorage.removeItem('recall_user');
        window.location.href = '/auth.html';
      }
      return res;
    });
  }

  function logout() {
    localStorage.removeItem('recall_token');
    localStorage.removeItem('recall_user');
    localStorage.removeItem('recall_mode');
    localStorage.removeItem('recall_server');
    window.location.href = '/auth.html';
  }

  // ── Dark mode ────────────────────────────────────────────
  function applyDark(on) {
    document.body.classList.toggle('dark', on);
    const btn = document.getElementById('darkToggle');
    if (btn) btn.textContent = on ? '☀️' : '🌙';
  }

  function toggleDark() {
    const on = !document.body.classList.contains('dark');
    localStorage.setItem('darkMode', on ? '1' : '0');
    applyDark(on);
  }

  function initDark() {
    applyDark(localStorage.getItem('darkMode') === '1');
  }
