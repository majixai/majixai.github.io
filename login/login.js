/**
 * MajixAI Standalone Login — login.js
 *
 * Self-contained login logic.  Reads config from login-config.json
 * (relative to the page), hashes passwords with SHA-256 via SubtleCrypto,
 * and stores a timestamped session token in localStorage.
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
      if (Date.now() - session.createdAt > config.sessionDuration) {
        localStorage.removeItem(config.sessionKey);
        return false;
      }
      return !!session.username;
    } catch {
      return false;
    }
  }

  function createSession(config, username) {
    localStorage.setItem(config.sessionKey, JSON.stringify({
      username,
      createdAt: Date.now(),
      appName: config.appName
    }));
  }

  function logout(config) {
    localStorage.removeItem(config.sessionKey);
  }

  function showAlert(el, type, msg) {
    el.textContent = msg;
    el.className = 'alert ' + type + ' show';
  }

  function hideAlert(el) {
    el.className = 'alert';
    el.textContent = '';
  }

  /* ── render ───────────────────────────────────────────────────── */

  function renderAlreadyLoggedIn(config) {
    const session = JSON.parse(localStorage.getItem(config.sessionKey) || '{}');
    document.querySelector('.login-card').innerHTML = `
      <div class="login-header">
        <span class="icon">${config.appIcon || '🔐'}</span>
        <h1>${config.appName}</h1>
        <p>Welcome back, <strong>${session.username || 'user'}</strong></p>
      </div>
      <div class="already-logged">
        <p>You are already signed in.</p>
        <a href="${config.redirectOnSuccess}">Continue to App →</a>
      </div>
      <div class="login-footer">
        <a href="#" id="logout-link">Sign out</a>
      </div>`;

    document.getElementById('logout-link').addEventListener('click', e => {
      e.preventDefault();
      logout(config);
      location.reload();
    });
  }

  function renderLoginForm(config, onSubmit) {
    const header = document.getElementById('login-app-name');
    const icon   = document.getElementById('login-app-icon');
    if (header) header.textContent = config.appName;
    if (icon)   icon.textContent   = config.appIcon || '🔐';
    document.title = config.appName;

    const form  = document.getElementById('login-form');
    const alert = document.getElementById('login-alert');
    const btn   = document.getElementById('login-btn');

    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      hideAlert(alert);
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      if (!username || !password) {
        showAlert(alert, 'error', 'Please enter both username and password.');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Signing in…';

      try {
        await onSubmit(username, password);
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

    renderLoginForm(config, async (username, password) => {
      const hash  = await sha256(password);
      const alert = document.getElementById('login-alert');

      const user = (config.users || []).find(
        u => u.username === username && u.passwordHash === hash
      );

      if (!user) {
        showAlert(alert, 'error', 'Invalid username or password.');
        return;
      }

      createSession(config, username);
      showAlert(alert, 'success', 'Login successful! Redirecting…');

      setTimeout(() => {
        window.location.href = config.redirectOnSuccess;
      }, 900);
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
