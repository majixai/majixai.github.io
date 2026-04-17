/**
 * MajixAI Standalone Login — login.js
 *
 * Self-contained login logic.  Reads config from login-config.json
 * (relative to the page), hashes passwords with SHA-256 via SubtleCrypto,
 * and stores a timestamped session token in localStorage.
 *
 * After a successful login the page shows an explicit "Go to App" button —
 * the user navigates only when they click it (no automatic redirect).
 *
 * Dependencies: none (vanilla JS, modern browsers only).
 */

(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────────── */

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function getConfigUrl() {
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      if (s.src.endsWith('/login.js') || s.src === 'login.js') {
        return s.src.replace(/login\.js$/, 'login-config.json');
      }
    }
    return 'login-config.json';
  }

  async function loadConfig() {
    try {
      const res = await fetch(getConfigUrl(), { cache: 'no-cache' });
      if (!res.ok) throw new Error('Config not found');
      return await res.json();
    } catch {
      return {
        appName: document.title || 'Login',
        appIcon: '🔐',
        redirectOnSuccess: 'index.html',
        sessionKey: 'majixai_session',
        sessionDuration: 86400000,
        users: [],
        theme: {}
      };
    }
  }

  function applyTheme(theme) {
    if (!theme) return;
    const root = document.documentElement;
    if (theme.primaryColor) root.style.setProperty('--primary', theme.primaryColor);
    if (theme.accentColor)  root.style.setProperty('--accent',  theme.accentColor);
    if (theme.bgColor)      root.style.setProperty('--bg',      theme.bgColor);
  }

  function isLoggedIn(config) {
    try {
      const raw = localStorage.getItem(config.sessionKey);
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (Date.now() - session.createdAt > session.sessionDuration) {
        localStorage.removeItem(config.sessionKey);
        return false;
      }
      return !!session.username;
    } catch {
      return false;
    }
  }

  function createSession(config, user, rememberMe) {
    const duration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : config.sessionDuration;
    localStorage.setItem(config.sessionKey, JSON.stringify({
      username:        user.username,
      role:            user.role || 'user',
      displayName:     user.displayName || user.username,
      createdAt:       Date.now(),
      sessionDuration: duration,
      appName:         config.appName
    }));
  }

  function getSession(config) {
    try {
      return JSON.parse(localStorage.getItem(config.sessionKey) || '{}');
    } catch {
      return {};
    }
  }

  function logout(config) {
    localStorage.removeItem(config.sessionKey);
  }

  function getNiceHashCredsStorageKey(config) {
    return `${config.sessionKey || 'majixai_session'}_nicehash_api`;
  }

  function loadNiceHashCreds(config) {
    try {
      const raw = localStorage.getItem(getNiceHashCredsStorageKey(config));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveNiceHashCreds(config, creds) {
    const currencyRaw = String(creds.balanceCurrency || '').trim().toUpperCase();
    try {
      localStorage.setItem(getNiceHashCredsStorageKey(config), JSON.stringify({
        key: String(creds.key || '').trim(),
        orgId: String(creds.orgId || '').trim(),
        balanceCurrency: currencyRaw || 'BTC'
      }));
    } catch {
      /* best effort */
    }
  }

  function showAlert(el, type, msg) {
    el.textContent = msg;
    el.className = 'alert ' + type + ' show';
  }

  function hideAlert(el) {
    el.className = 'alert';
    el.textContent = '';
  }

  function formatExpiry(session) {
    const expiresAt = session.createdAt + session.sessionDuration;
    const ms = expiresAt - Date.now();
    if (ms <= 0) return 'expired';
    const hours = Math.floor(ms / 3600000);
    if (hours < 1) {
      const mins = Math.floor(ms / 60000);
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    }
    if (hours < 48) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''}`;
  }

  /* ── render ───────────────────────────────────────────────────── */

  function renderAlreadyLoggedIn(config) {
    const session = getSession(config);
    const expiry  = formatExpiry(session);

    const adminBtn = (session.role === 'admin' && config.adminPage)
      ? `<a class="btn-go" href="${config.adminPage}"
            style="background:#e67e22;margin-top:10px">⚙ Admin Panel →</a>`
      : '';

    document.querySelector('.login-card').innerHTML = `
      <div class="login-header">
        <span class="icon">${config.appIcon || '🔐'}</span>
        <h1>${config.appName}</h1>
        <p>Welcome back, <strong>${session.username || 'user'}</strong>.</p>
      </div>
      <div class="already-logged">
        <p>You are already signed in. Click the button below to continue.</p>
        <div class="session-info">
          <strong>Session expires in:</strong> ${expiry}<br>
          <strong>Signed in as:</strong> ${session.username || '—'}<br>
          <strong>App:</strong> ${session.appName || config.appName}
        </div>
        <a class="btn-go" href="${config.redirectOnSuccess}">Go to App →</a>
        ${adminBtn}
      </div>
      <div class="login-divider"></div>
      <div class="login-footer">
        <a href="#" id="logout-link">Sign out &amp; switch account</a>
      </div>`;

    document.getElementById('logout-link').addEventListener('click', e => {
      e.preventDefault();
      logout(config);
      location.reload();
    });
  }

  function wireShowPasswordToggle() {
    const toggle = document.getElementById('toggle-password');
    const pwInput = document.getElementById('password');
    const icon = document.getElementById('toggle-pw-icon');
    if (!toggle || !pwInput) return;

    toggle.addEventListener('click', () => {
      const isHidden = pwInput.type === 'password';
      pwInput.type = isHidden ? 'text' : 'password';
      icon.textContent = isHidden ? '🙈' : '👁';
      toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  }

  function renderLoginForm(config, onSubmit) {
    const header = document.getElementById('login-app-name');
    const icon   = document.getElementById('login-app-icon');
    if (header) header.textContent = config.appName;
    if (icon)   icon.textContent   = config.appIcon || '🔐';
    document.title = config.appName;
    const savedCreds = loadNiceHashCreds(config);
    const keyEl = document.getElementById('nh-api-key');
    const secEl = document.getElementById('nh-api-secret');
    const orgEl = document.getElementById('nh-org-id');
    const curEl = document.getElementById('nh-balance-currency');
    if (keyEl) keyEl.value = savedCreds.key || '';
    if (secEl) secEl.value = '';
    if (orgEl) orgEl.value = savedCreds.orgId || '';
    if (curEl) curEl.value = savedCreds.balanceCurrency || 'BTC';

    wireShowPasswordToggle();

    const form  = document.getElementById('login-form');
    const alert = document.getElementById('login-alert');
    const btn   = document.getElementById('login-btn');

    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      hideAlert(alert);
      const username   = document.getElementById('username').value.trim();
      const password   = document.getElementById('password').value;
      const rememberMe = document.getElementById('remember-me')
                           ? document.getElementById('remember-me').checked
                           : false;
      const niceHashCreds = {
        key: document.getElementById('nh-api-key')?.value || '',
        secret: document.getElementById('nh-api-secret')?.value || '',
        orgId: document.getElementById('nh-org-id')?.value || '',
        balanceCurrency: document.getElementById('nh-balance-currency')?.value || 'BTC'
      };

      if (!username || !password) {
        showAlert(alert, 'error', 'Please enter both username and password.');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Signing in…';

      try {
        await onSubmit(username, password, rememberMe, niceHashCreds);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });
  }

  /* ── main ─────────────────────────────────────────────────────── */

  async function init() {
    const config = await loadConfig();
    applyTheme(config.theme);

    if (isLoggedIn(config)) {
      renderAlreadyLoggedIn(config);
      return;
    }

    renderLoginForm(config, async (username, password, rememberMe, niceHashCreds) => {
      const hash  = await sha256(password);
      const alert = document.getElementById('login-alert');

      const user = (config.users || []).find(
        u => u.username === username && u.passwordHash === hash
      );

      if (!user) {
        showAlert(alert, 'error', 'Invalid username or password.');
        return;
      }

      createSession(config, user, rememberMe);
      saveNiceHashCreds(config, niceHashCreds || {});

      /* Hide the form and show an explicit "Go to App" button — no auto-redirect */
      const form = document.getElementById('login-form');
      if (form) form.style.display = 'none';

      const infoStrip = document.querySelector('.login-info');
      if (infoStrip) infoStrip.style.display = 'none';

      showAlert(alert, 'success', `✔ Signed in as ${username}. Click the button below to continue.`);

      const goBtn = document.createElement('a');
      goBtn.href      = config.redirectOnSuccess;
      goBtn.className = 'btn-go';
      goBtn.textContent = 'Go to App →';
      alert.insertAdjacentElement('afterend', goBtn);

      if (user.role === 'admin' && config.adminPage) {
        const adminBtn = document.createElement('a');
        adminBtn.href      = config.adminPage;
        adminBtn.className = 'btn-go';
        adminBtn.style.background = '#e67e22';
        adminBtn.style.marginTop  = '10px';
        adminBtn.textContent = '⚙ Admin Panel →';
        goBtn.insertAdjacentElement('afterend', adminBtn);
      }
    });
  }

  /* expose helpers for guard pages */
  window.MajixLogin = {
    isLoggedIn: function (sessionKey, duration) {
      return loadConfig().then(cfg => {
        if (sessionKey) cfg.sessionKey = sessionKey;
        if (duration)   cfg.sessionDuration = duration;
        return isLoggedIn(cfg);
      });
    },
    logout: function () {
      return loadConfig().then(cfg => logout(cfg));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
