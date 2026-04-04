/**
 * MajixAI Admin Panel — admin.js
 *
 * Provides a full management dashboard for sites that use the MajixAI
 * standalone login system.  All site configuration is kept in
 * localStorage['majixai_admin_registry'] as an array of site objects.
 *
 * Requires the active session to have role === 'admin'.
 *
 * Dependencies: none (vanilla JS, modern browsers only).
 */

(function () {
  'use strict';

  /* ── constants ─────────────────────────────────────────────────── */

  const REGISTRY_KEY = 'majixai_admin_registry';
  const SESSION_KEY  = 'majixai_session';

  const TAB_LABELS = {
    overview: '📋 Overview',
    users:    '👥 Users',
    theme:    '🎨 Theme',
    settings: '⚙️ Settings',
    export:   '📦 Export'
  };

  /* ── helpers ────────────────────────────────────────────────────── */

  async function sha256(msg) {
    const buf  = new TextEncoder().encode(msg);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /** HTML-escape a value to prevent XSS when injecting into innerHTML. */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid() {
    return 'site_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatDuration(ms) {
    const h = ms / 3600000;
    if (h < 2)  return `${Math.round(h * 60)} minutes`;
    if (h < 48) return `${Math.round(h)} hours`;
    return `${Math.round(h / 24)} days`;
  }

  /* Log-scale slider: 0 = 15 min, 100 = 30 days */
  const LOG_MIN = Math.log(15  * 60 * 1000);
  const LOG_MAX = Math.log(30  * 24 * 3600 * 1000);

  function msToSlider(ms) {
    return Math.round(((Math.log(Math.max(ms, Math.exp(LOG_MIN))) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100);
  }
  function sliderToMs(val) {
    return Math.round(Math.exp(LOG_MIN + (Math.min(Math.max(val, 0), 100) / 100) * (LOG_MAX - LOG_MIN)));
  }

  function $(id) { return document.getElementById(id); }

  /* ── session / auth ─────────────────────────────────────────────── */

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function isAdminSession(s) {
    if (!s) return false;
    if (Date.now() - s.createdAt > (s.sessionDuration || 86400000)) return false;
    return s.role === 'admin';
  }

  /* ── registry ───────────────────────────────────────────────────── */

  function loadRegistry() {
    try { return JSON.parse(localStorage.getItem(REGISTRY_KEY) || '[]'); }
    catch { return []; }
  }

  function saveRegistry(sites) {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(sites));
  }

  function createSite(partial) {
    const base = partial.appName || 'new_site';
    return {
      id:               uid(),
      appName:          partial.appName          || 'New Site',
      appIcon:          partial.appIcon          || '🌐',
      description:      partial.description      || '',
      directory:        partial.directory        || '',
      redirectOnSuccess: partial.redirectOnSuccess || '../index.html',
      adminPage:        partial.adminPage        || '',
      sessionKey:       partial.sessionKey       || ('session_' + base.toLowerCase().replace(/\W+/g, '_')),
      sessionDuration:  partial.sessionDuration  || 86400000,
      rememberMeDefault: false,
      enabled:          true,
      users:            [],
      theme: {
        primaryColor: '#2c3e50',
        accentColor:  '#3498db',
        bgColor:      '#f5f6fa'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /** Build the JSON that goes into the target directory's login-config.json */
  function buildConfig(site) {
    const cfg = {
      appName:          site.appName,
      appIcon:          site.appIcon,
      redirectOnSuccess: site.redirectOnSuccess,
      sessionKey:       site.sessionKey,
      sessionDuration:  site.sessionDuration,
      users: site.users.map(u => {
        const out = { username: u.username, passwordHash: u.passwordHash, role: u.role || 'user' };
        if (u.displayName) out.displayName = u.displayName;
        return out;
      }),
      theme: { ...site.theme }
    };
    if (site.adminPage) cfg.adminPage = site.adminPage;
    return cfg;
  }

  /* ── app state ──────────────────────────────────────────────────── */

  const state = {
    sites:       [],
    selectedId:  null,
    activeTabs:  {}   // siteId → active tab name
  };

  /* ── modal ──────────────────────────────────────────────────────── */

  function showModal(html) {
    $('modal-box').innerHTML = html;
    $('modal-overlay').classList.remove('hidden');
  }

  function hideModal() {
    $('modal-overlay').classList.add('hidden');
    $('modal-box').innerHTML = '';
  }

  /* ── inline alerts ──────────────────────────────────────────────── */

  function showInlineAlert(el, type, msg, ttl) {
    if (!el) return;
    el.textContent = msg;
    el.className   = `inline-alert ${type} show`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.className   = 'inline-alert';
      el.textContent = '';
    }, ttl || 4000);
  }

  /* ── sidebar ─────────────────────────────────────────────────────── */

  function renderSidebar() {
    const nav   = $('site-nav');
    const empty = $('sidebar-empty');

    if (!state.sites.length) {
      nav.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    nav.innerHTML = state.sites.map(s => `
      <li class="site-nav-item${state.selectedId === s.id ? ' active' : ''}"
          data-site-id="${esc(s.id)}" tabindex="0" role="button"
          aria-label="Manage ${esc(s.appName)}">
        <span class="site-nav-icon">${esc(s.appIcon)}</span>
        <span class="site-nav-name">${esc(s.appName)}</span>
        <span class="site-nav-badge ${s.enabled ? 'on' : 'off'}">${s.enabled ? 'ON' : 'OFF'}</span>
      </li>`).join('');

    nav.querySelectorAll('.site-nav-item').forEach(item => {
      const activate = () => selectSite(item.dataset.siteId);
      item.addEventListener('click', activate);
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
    });
  }

  /* ── site selection ─────────────────────────────────────────────── */

  function selectSite(id) {
    state.selectedId = id;
    renderSidebar();
    const site = state.sites.find(s => s.id === id);
    if (!site) { showWelcome(); return; }
    if (!state.activeTabs[id]) state.activeTabs[id] = 'overview';
    renderSitePanel(site);
  }

  /* ── site panel ─────────────────────────────────────────────────── */

  function renderSitePanel(site) {
    const tab  = state.activeTabs[site.id] || 'overview';
    const main = $('admin-main');
    main.innerHTML = `
      <div class="site-panel" id="sp-${esc(site.id)}">
        <div class="site-panel-header">
          <span class="site-panel-icon">${esc(site.appIcon)}</span>
          <div class="site-panel-meta">
            <div class="site-panel-name">${esc(site.appName)}</div>
            <div class="site-panel-desc">${esc(site.description || site.directory || '—')}</div>
          </div>
          <span class="site-panel-status ${site.enabled ? 'on' : 'off'}">${site.enabled ? '● Active' : '○ Disabled'}</span>
          <div class="site-panel-actions">
            <button class="btn-danger btn-sm" id="btn-del-site">🗑 Delete Site</button>
          </div>
        </div>

        <div class="tab-bar" role="tablist">
          ${Object.entries(TAB_LABELS).map(([t, label]) => `
            <button class="tab-btn${tab === t ? ' active' : ''}" role="tab"
                    aria-selected="${tab === t}" data-tab="${t}">${label}</button>
          `).join('')}
        </div>

        <div class="tab-content">
          <div id="tab-overview"  class="tab-pane${tab === 'overview'  ? ' active' : ''}"></div>
          <div id="tab-users"     class="tab-pane${tab === 'users'     ? ' active' : ''}"></div>
          <div id="tab-theme"     class="tab-pane${tab === 'theme'     ? ' active' : ''}"></div>
          <div id="tab-settings"  class="tab-pane${tab === 'settings'  ? ' active' : ''}"></div>
          <div id="tab-export"    class="tab-pane${tab === 'export'    ? ' active' : ''}"></div>
        </div>
      </div>`;

    /* Populate the initial active tab */
    populateTab(site, tab);

    /* Tab switching */
    main.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.tab;
        state.activeTabs[site.id] = next;
        main.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        main.querySelectorAll('.tab-pane').forEach(p =>
          p.classList.toggle('active', p.id === 'tab-' + next)
        );
        populateTab(site, next);
      });
    });

    $('btn-del-site').addEventListener('click', () => confirmDeleteSite(site));
  }

  function populateTab(site, tab) {
    const pane = $('tab-' + tab);
    if (!pane || pane.dataset.loaded === 'true') return;
    pane.dataset.loaded = 'true';

    switch (tab) {
      case 'overview':  pane.innerHTML = buildOverviewTab(site);   wireOverviewTab(site);   break;
      case 'users':     pane.innerHTML = buildUsersTab(site);      wireUsersTab(site);      break;
      case 'theme':     pane.innerHTML = buildThemeTab(site);      wireThemeTab(site);      break;
      case 'settings':  pane.innerHTML = buildSettingsTab(site);   wireSettingsTab(site);   break;
      case 'export':    pane.innerHTML = buildExportTab(site);     wireExportTab(site);     break;
    }
  }

  /** Mark a tab as needing re-render on next visit (after save) */
  function invalidateTab(site, tab) {
    const pane = $('tab-' + tab);
    if (pane) delete pane.dataset.loaded;
  }

  /* ── overview tab ─────────────────────────────────────────────── */

  function buildOverviewTab(site) {
    return `
      <div class="section-title">Site Details</div>
      <div id="ov-alert" class="inline-alert"></div>
      <div class="field-row">
        <div class="field">
          <label>App Name</label>
          <input type="text" id="ov-name" value="${esc(site.appName)}">
        </div>
        <div class="field">
          <label>App Icon <span class="hint">(emoji)</span></label>
          <input type="text" id="ov-icon" value="${esc(site.appIcon)}" maxlength="4"
                 style="font-size:1.5rem;letter-spacing:.1em">
        </div>
      </div>
      <div class="field">
        <label>Description</label>
        <textarea id="ov-desc" rows="2">${esc(site.description || '')}</textarea>
      </div>
      <div class="field">
        <label>Directory Path</label>
        <input type="text" id="ov-dir" value="${esc(site.directory || '')}" placeholder="../myapp">
        <div class="hint">Relative path from repo root where login files live — for reference only.</div>
      </div>
      <div class="field">
        <label>Redirect on Successful Login</label>
        <input type="text" id="ov-redirect" value="${esc(site.redirectOnSuccess)}"
               placeholder="../myapp/index.html">
        <div class="hint">Where users are sent after clicking "Go to App".</div>
      </div>
      <div class="field">
        <div class="toggle-wrap">
          <label class="toggle">
            <input type="checkbox" id="ov-enabled" ${site.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">Login enabled for this site</span>
        </div>
      </div>
      <div class="flex-gap mt-2">
        <button class="btn-primary" id="btn-save-ov">Save Overview</button>
      </div>`;
  }

  function wireOverviewTab(site) {
    $('btn-save-ov').addEventListener('click', () => {
      const al = $('ov-alert');
      const name = $('ov-name').value.trim();
      if (!name) { showInlineAlert(al, 'error', 'App name is required.'); return; }
      site.appName          = name;
      site.appIcon          = $('ov-icon').value.trim() || '🌐';
      site.description      = $('ov-desc').value.trim();
      site.directory        = $('ov-dir').value.trim();
      site.redirectOnSuccess = $('ov-redirect').value.trim() || 'index.html';
      site.enabled          = $('ov-enabled').checked;
      site.updatedAt        = Date.now();
      saveAndRefresh(site, al, 'Overview saved.', ['export']);
    });
  }

  /* ── users tab ────────────────────────────────────────────────── */

  function buildUsersTab(site) {
    return `
      <div class="section-title">User Accounts (${site.users.length})</div>
      <div id="usr-alert" class="inline-alert"></div>
      <table class="users-table" id="usr-table">
        <thead><tr>
          <th>Username</th><th>Display Name</th><th>Role</th>
          <th>Hash preview</th><th>Actions</th>
        </tr></thead>
        <tbody id="usr-tbody">
          ${buildUserRows(site.users)}
        </tbody>
      </table>

      <div class="add-user-form" id="add-user-form">
        <h4 id="add-user-title">Add User</h4>
        <input type="hidden" id="edit-idx" value="-1">
        <div class="add-user-fields">
          <div class="field"><label>Username</label>
            <input type="text" id="nu-username" placeholder="alice" autocomplete="off"></div>
          <div class="field"><label>Display Name</label>
            <input type="text" id="nu-display"  placeholder="Alice Smith" autocomplete="off"></div>
          <div class="field"><label>Password <span class="hint">(plain — will be hashed)</span></label>
            <input type="password" id="nu-pw" placeholder="Leave blank to keep current"
                   autocomplete="new-password"></div>
          <div class="field"><label>Role</label>
            <select id="nu-role">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select></div>
        </div>
        <div class="flex-gap">
          <button class="btn-primary btn-sm" id="btn-save-user">Add User</button>
          <button class="btn-secondary btn-sm hidden" id="btn-cancel-edit">Cancel</button>
        </div>
      </div>

      <div class="hash-tool">
        <h4>🔑 Quick Password Hash Generator</h4>
        <div class="field" style="margin-bottom:8px">
          <label>Plain Password</label>
          <input type="password" id="ht-pw" placeholder="Type to hash in real time"
                 autocomplete="new-password">
        </div>
        <div class="hash-result" id="ht-out">SHA-256 hash will appear here…</div>
        <div class="flex-gap mt-2">
          <button class="btn-secondary btn-sm" id="btn-copy-ht">📋 Copy Hash</button>
        </div>
      </div>`;
  }

  function buildUserRows(users) {
    if (!users.length) {
      return '<tr><td colspan="5" style="text-align:center;color:#b2bec3;padding:24px">No users yet — add one below.</td></tr>';
    }
    return users.map((u, i) => `
      <tr>
        <td><code>${esc(u.username)}</code></td>
        <td>${esc(u.displayName || '—')}</td>
        <td><span class="role-badge ${u.role === 'admin' ? 'admin' : 'user'}">${esc(u.role || 'user')}</span></td>
        <td><code style="font-size:.74rem;color:#95a5a6">${esc(u.passwordHash.slice(0, 14))}…</code></td>
        <td>
          <button class="btn-icon" data-edit="${i}" title="Edit user">✏️</button>
          <button class="btn-icon danger" data-del="${i}" title="Delete user">🗑</button>
        </td>
      </tr>`).join('');
  }

  function wireUsersTab(site) {
    const al = $('usr-alert');

    function rebuildTable() {
      $('usr-tbody').innerHTML = buildUserRows(site.users);
      wireTableButtons();
      /* Also invalidate export so it reflects the new user list */
      invalidateTab(site, 'export');
    }

    function wireTableButtons() {
      $('usr-tbody').querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.edit, 10);
          const u = site.users[i];
          $('nu-username').value = u.username;
          $('nu-display').value  = u.displayName || '';
          $('nu-pw').value       = '';
          $('nu-role').value     = u.role || 'user';
          $('edit-idx').value    = i;
          $('add-user-title').textContent  = 'Edit User';
          $('btn-save-user').textContent   = 'Update User';
          $('btn-cancel-edit').classList.remove('hidden');
          $('nu-username').focus();
        });
      });

      $('usr-tbody').querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', () => {
          const i   = parseInt(btn.dataset.del, 10);
          const uname = site.users[i].username;
          if (!confirm(`Delete user "${uname}"? This cannot be undone.`)) return;
          site.users.splice(i, 1);
          site.updatedAt = Date.now();
          saveRegistry(state.sites);
          rebuildTable();
          showInlineAlert(al, 'success', `User "${uname}" removed.`);
        });
      });
    }

    wireTableButtons();

    $('btn-cancel-edit').addEventListener('click', () => {
      $('edit-idx').value            = -1;
      $('nu-username').value         = '';
      $('nu-display').value          = '';
      $('nu-pw').value               = '';
      $('nu-role').value             = 'user';
      $('add-user-title').textContent = 'Add User';
      $('btn-save-user').textContent  = 'Add User';
      $('btn-cancel-edit').classList.add('hidden');
    });

    $('btn-save-user').addEventListener('click', async () => {
      const username = $('nu-username').value.trim();
      const display  = $('nu-display').value.trim();
      const pw       = $('nu-pw').value;
      const role     = $('nu-role').value;
      const editIdx  = parseInt($('edit-idx').value, 10);
      const isEdit   = editIdx >= 0;

      if (!username) { showInlineAlert(al, 'error', 'Username is required.'); return; }

      const dup = site.users.findIndex(u => u.username === username);
      if (dup >= 0 && (!isEdit || dup !== editIdx)) {
        showInlineAlert(al, 'error', `Username "${username}" already exists.`); return;
      }

      let hash;
      if (pw) {
        hash = await sha256(pw);
      } else if (isEdit) {
        hash = site.users[editIdx].passwordHash;
      } else {
        showInlineAlert(al, 'error', 'Password is required for new users.'); return;
      }

      const userObj = { username, passwordHash: hash, role };
      if (display) userObj.displayName = display;

      if (isEdit) {
        site.users[editIdx] = userObj;
        showInlineAlert(al, 'success', `User "${username}" updated.`);
      } else {
        site.users.push(userObj);
        showInlineAlert(al, 'success', `User "${username}" added.`);
      }

      site.updatedAt = Date.now();
      saveRegistry(state.sites);
      rebuildTable();

      /* Reset form */
      $('edit-idx').value            = -1;
      $('nu-username').value         = '';
      $('nu-display').value          = '';
      $('nu-pw').value               = '';
      $('nu-role').value             = 'user';
      $('add-user-title').textContent = 'Add User';
      $('btn-save-user').textContent  = 'Add User';
      $('btn-cancel-edit').classList.add('hidden');
    });

    /* Real-time hash generator */
    $('ht-pw').addEventListener('input', async function () {
      $('ht-out').textContent = this.value
        ? await sha256(this.value)
        : 'SHA-256 hash will appear here…';
    });

    $('btn-copy-ht').addEventListener('click', () => {
      const h = $('ht-out').textContent;
      if (h && !h.includes('appear here')) {
        navigator.clipboard.writeText(h)
          .then(() => showInlineAlert(al, 'success', 'Hash copied to clipboard.'))
          .catch(() => showInlineAlert(al, 'error', 'Copy failed — select the hash manually.'));
      }
    });
  }

  /* ── theme tab ────────────────────────────────────────────────── */

  function buildThemeTab(site) {
    const t = site.theme || {};
    const primary = t.primaryColor || '#2c3e50';
    const accent  = t.accentColor  || '#3498db';
    const bg      = t.bgColor      || '#f5f6fa';
    return `
      <div class="section-title">Theme &amp; Colors</div>
      <div id="th-alert" class="inline-alert"></div>
      <div class="field-row">
        <div class="field">
          <label>Primary Color</label>
          <div class="color-row">
            <input type="color" id="th-pri-cp" value="${esc(primary)}">
            <input type="text"  id="th-pri-tx" value="${esc(primary)}" maxlength="7" spellcheck="false">
          </div>
        </div>
        <div class="field">
          <label>Accent Color</label>
          <div class="color-row">
            <input type="color" id="th-acc-cp" value="${esc(accent)}">
            <input type="text"  id="th-acc-tx" value="${esc(accent)}" maxlength="7" spellcheck="false">
          </div>
        </div>
      </div>
      <div class="field" style="max-width:260px">
        <label>Background Color</label>
        <div class="color-row">
          <input type="color" id="th-bg-cp" value="${esc(bg)}">
          <input type="text"  id="th-bg-tx" value="${esc(bg)}" maxlength="7" spellcheck="false">
        </div>
      </div>

      <div class="theme-preview" id="th-preview" style="background:${esc(bg)}">
        <div class="preview-card">
          <div class="preview-icon">${esc(site.appIcon)}</div>
          <div class="preview-title" id="th-prev-title" style="color:${esc(primary)}">${esc(site.appName)}</div>
          <input class="preview-input" disabled placeholder="Username">
          <input class="preview-input" type="password" disabled placeholder="Password">
          <button class="preview-btn" id="th-prev-btn" style="background:${esc(accent)}">Sign In</button>
        </div>
      </div>

      <div class="flex-gap mt-4">
        <button class="btn-primary"   id="btn-save-th">Save Theme</button>
        <button class="btn-secondary" id="btn-reset-th">Reset to Default</button>
      </div>`;
  }

  function wireThemeTab(site) {
    const al = $('th-alert');

    function syncPair(cpId, txId) {
      const cp = $(cpId), tx = $(txId);
      cp.addEventListener('input', () => { tx.value = cp.value; updatePreview(); });
      tx.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{6}$/.test(tx.value)) { cp.value = tx.value; updatePreview(); }
      });
    }

    function updatePreview() {
      const pri = $('th-pri-tx').value;
      const acc = $('th-acc-tx').value;
      const bg  = $('th-bg-tx').value;
      const wrap = $('th-preview');
      if (wrap) wrap.style.background = bg;
      const tt = $('th-prev-title'); if (tt) tt.style.color = pri;
      const pb = $('th-prev-btn');   if (pb) pb.style.background = acc;
    }

    syncPair('th-pri-cp', 'th-pri-tx');
    syncPair('th-acc-cp', 'th-acc-tx');
    syncPair('th-bg-cp',  'th-bg-tx');

    $('btn-save-th').addEventListener('click', () => {
      site.theme = {
        primaryColor: $('th-pri-tx').value,
        accentColor:  $('th-acc-tx').value,
        bgColor:      $('th-bg-tx').value
      };
      site.updatedAt = Date.now();
      saveAndRefresh(site, al, 'Theme saved.', ['export']);
    });

    $('btn-reset-th').addEventListener('click', () => {
      [['th-pri-cp','th-pri-tx','#2c3e50'],
       ['th-acc-cp','th-acc-tx','#3498db'],
       ['th-bg-cp', 'th-bg-tx', '#f5f6fa']].forEach(([cp,tx,v]) => {
        $(cp).value = v; $(tx).value = v;
      });
      updatePreview();
    });
  }

  /* ── settings tab ─────────────────────────────────────────────── */

  function buildSettingsTab(site) {
    const sv = msToSlider(site.sessionDuration || 86400000);
    return `
      <div class="section-title">Session &amp; Security Settings</div>
      <div id="st-alert" class="inline-alert"></div>
      <div class="field">
        <label>Session Storage Key</label>
        <input type="text" id="st-key" value="${esc(site.sessionKey)}" spellcheck="false">
        <div class="hint">Must be unique per site — used as the localStorage key name for sessions.</div>
      </div>
      <div class="field">
        <label>Default Session Duration
          <span class="duration-display" id="st-dur-lbl">${esc(formatDuration(site.sessionDuration || 86400000))}</span>
        </label>
        <input type="range" id="st-dur-range" min="0" max="100" value="${sv}">
        <div class="hint">Applies when "Remember Me" is not checked. Range: 15 minutes → 30 days.</div>
      </div>
      <div class="field">
        <label>Admin Page URL <span class="hint">(optional)</span></label>
        <input type="text" id="st-admin" value="${esc(site.adminPage || '')}" placeholder="admin.html">
        <div class="hint">Link shown on login page for admin-role users.</div>
      </div>
      <div class="field">
        <div class="toggle-wrap">
          <label class="toggle">
            <input type="checkbox" id="st-rem" ${site.rememberMeDefault ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">"Remember Me" pre-checked by default</span>
        </div>
      </div>
      <div class="flex-gap mt-4">
        <button class="btn-primary" id="btn-save-st">Save Settings</button>
      </div>`;
  }

  function wireSettingsTab(site) {
    const al    = $('st-alert');
    const range = $('st-dur-range');
    const lbl   = $('st-dur-lbl');

    range.addEventListener('input', () => {
      lbl.textContent = formatDuration(sliderToMs(parseInt(range.value, 10)));
    });

    $('btn-save-st').addEventListener('click', () => {
      const key = $('st-key').value.trim();
      if (!key) { showInlineAlert(al, 'error', 'Session key is required.'); return; }
      site.sessionKey       = key;
      site.sessionDuration  = sliderToMs(parseInt(range.value, 10));
      site.adminPage        = $('st-admin').value.trim();
      site.rememberMeDefault = $('st-rem').checked;
      site.updatedAt        = Date.now();
      saveAndRefresh(site, al, 'Settings saved.', ['export']);
    });
  }

  /* ── export tab ───────────────────────────────────────────────── */

  function buildExportTab(site) {
    const cfg     = buildConfig(site);
    const jsonStr = JSON.stringify(cfg, null, 2);
    const path    = site.directory ? `${site.directory}/login-config.json` : 'login-config.json';
    return `
      <div class="section-title">Export &amp; Deploy Login Config</div>
      <p class="text-muted" style="margin-bottom:14px">
        Download <code>login-config.json</code> and place it — together with
        <code>login.html</code>, <code>login.js</code>, and <code>login.css</code> — in the target
        directory. Users will then land on that directory's <code>login.html</code> before accessing
        the app.
      </p>
      <div class="export-path">📁 Suggested save path: <strong>${esc(path)}</strong></div>
      <pre class="export-json" id="ex-json">${esc(jsonStr)}</pre>
      <div class="export-actions">
        <button class="btn-primary"   id="btn-dl-cfg">⬇ Download login-config.json</button>
        <button class="btn-secondary" id="btn-cp-cfg">📋 Copy JSON</button>
      </div>
      <div id="ex-alert" class="inline-alert mt-2"></div>

      <div class="login-divider" style="margin:28px 0 22px"></div>

      <div class="section-title">Deployment Instructions</div>
      <ol class="deploy-steps">
        <li>Copy <code>login.html</code>, <code>login.js</code>, <code>login.css</code>
            from the <code>login/</code> directory into your target site directory.</li>
        <li>Save the downloaded <code>login-config.json</code> alongside those files.</li>
        <li>To protect a page, add this guard block before the page's main content scripts:
          <pre class="export-json" style="max-height:none;margin-top:8px;font-size:.75rem"
>&lt;script src="login.js"&gt;&lt;/script&gt;
&lt;script&gt;
  (async () => {
    const ok = await window.MajixLogin.isLoggedIn();
    if (!ok) window.location.href = 'login.html';
  })();
&lt;/script&gt;</pre>
        </li>
        <li>Set <code>redirectOnSuccess</code> in the config to the post-login destination page.</li>
        <li>Admin users (role = "admin") will see an <strong>Admin Panel</strong> button on the
            login success screen if <code>adminPage</code> is set in the config.</li>
      </ol>`;
  }

  function wireExportTab(site) {
    const al      = $('ex-alert');
    const cfg     = buildConfig(site);
    const jsonStr = JSON.stringify(cfg, null, 2);

    $('btn-dl-cfg').addEventListener('click', () => {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const a    = Object.assign(document.createElement('a'), {
        href:     URL.createObjectURL(blob),
        download: 'login-config.json'
      });
      a.click();
      URL.revokeObjectURL(a.href);
      showInlineAlert(al, 'success', 'Download started.');
    });

    $('btn-cp-cfg').addEventListener('click', () => {
      navigator.clipboard.writeText(jsonStr)
        .then(()  => showInlineAlert(al, 'success', 'JSON copied to clipboard.'))
        .catch(() => showInlineAlert(al, 'error',   'Copy failed — select the block manually.'));
    });
  }

  /* ── delete site confirmation ─────────────────────────────────── */

  function confirmDeleteSite(site) {
    showModal(`
      <h3 id="modal-title">🗑 Delete Site</h3>
      <p class="text-muted">
        Are you sure you want to remove <strong>${esc(site.appName)}</strong> from the admin
        registry? This only removes it from this panel — no files on disk are changed.
      </p>
      <div class="modal-actions">
        <button class="btn-secondary" id="m-cancel">Cancel</button>
        <button class="btn-danger"    id="m-confirm">Delete</button>
      </div>`);
    $('m-cancel').addEventListener('click', hideModal);
    $('m-confirm').addEventListener('click', () => {
      state.sites = state.sites.filter(s => s.id !== site.id);
      if (state.selectedId === site.id) state.selectedId = null;
      saveRegistry(state.sites);
      hideModal();
      renderSidebar();
      showWelcome();
    });
  }

  /* ── add site modal ───────────────────────────────────────────── */

  function openAddSiteModal() {
    showModal(`
      <h3 id="modal-title">＋ Add New Site</h3>
      <div id="as-alert" class="inline-alert"></div>
      <div class="field-row">
        <div class="field">
          <label>App Name</label>
          <input type="text" id="as-name" placeholder="My App" autocomplete="off">
        </div>
        <div class="field">
          <label>App Icon <span class="hint">(emoji)</span></label>
          <input type="text" id="as-icon" value="🌐" maxlength="4"
                 style="font-size:1.5rem;letter-spacing:.1em">
        </div>
      </div>
      <div class="field">
        <label>Description <span class="hint">(optional)</span></label>
        <input type="text" id="as-desc" placeholder="Short description" autocomplete="off">
      </div>
      <div class="field">
        <label>Directory Path</label>
        <input type="text" id="as-dir" placeholder="../myapp" autocomplete="off">
        <div class="hint">Where <code>login.html</code> + <code>login-config.json</code> will live.</div>
      </div>
      <div class="field">
        <label>Redirect URL after Login</label>
        <input type="text" id="as-redirect" value="../index.html" autocomplete="off">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" id="as-cancel">Cancel</button>
        <button class="btn-primary"   id="as-confirm">Create Site</button>
      </div>`);

    $('as-name').focus();
    $('as-cancel').addEventListener('click', hideModal);
    $('as-confirm').addEventListener('click', () => {
      const name = $('as-name').value.trim();
      if (!name) { showInlineAlert($('as-alert'), 'error', 'App name is required.'); return; }
      const site = createSite({
        appName:           name,
        appIcon:           $('as-icon').value.trim() || '🌐',
        description:       $('as-desc').value.trim(),
        directory:         $('as-dir').value.trim(),
        redirectOnSuccess: $('as-redirect').value.trim() || '../index.html'
      });
      state.sites.push(site);
      saveRegistry(state.sites);
      hideModal();
      renderSidebar();
      selectSite(site.id);
    });
  }

  /* ── standalone hash tool modal ──────────────────────────────── */

  function openHashToolModal() {
    showModal(`
      <h3 id="modal-title">🔑 Password Hash Generator</h3>
      <p class="text-muted" style="margin-bottom:16px">
        Type any plain-text password to instantly generate its SHA-256 hash for use in
        <code>login-config.json</code>.
      </p>
      <div class="field">
        <label>Plain Password</label>
        <input type="password" id="ght-pw" placeholder="Enter password…" autocomplete="new-password">
      </div>
      <div class="field">
        <label>SHA-256 Hash</label>
        <div class="hash-result" id="ght-out">Hash will appear here…</div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" id="ght-copy">📋 Copy Hash</button>
        <button class="btn-primary"   id="ght-close">Close</button>
      </div>`);

    $('ght-pw').addEventListener('input', async function () {
      $('ght-out').textContent = this.value
        ? await sha256(this.value)
        : 'Hash will appear here…';
    });

    $('ght-copy').addEventListener('click', () => {
      const h = $('ght-out').textContent;
      if (h && !h.includes('appear here')) navigator.clipboard.writeText(h).catch(() => {});
    });

    $('ght-close').addEventListener('click', hideModal);
    $('ght-pw').focus();
  }

  /* ── welcome view ─────────────────────────────────────────────── */

  function showWelcome() {
    $('admin-main').innerHTML = `
      <div class="welcome-panel">
        <div class="welcome-icon">🏗️</div>
        <h2>Welcome to MajixAI Admin</h2>
        <p>
          Manage login configurations for all your sites from one place.
          Select a site in the sidebar to view and edit its settings, or add a new one below.
        </p>
        <button class="btn-primary" id="btn-wlc-add">＋ Add Your First Site</button>
      </div>`;
    $('btn-wlc-add').addEventListener('click', openAddSiteModal);
  }

  /* ── save helper ──────────────────────────────────────────────── */

  function saveAndRefresh(site, alertEl, msg, invalidateTabs) {
    saveRegistry(state.sites);
    /* Update sidebar badge / name in case they changed */
    renderSidebar();
    /* Re-select to update the panel header */
    const panelName = document.querySelector('.site-panel-name');
    if (panelName) panelName.textContent = site.appName;
    const panelIcon = document.querySelector('.site-panel-icon');
    if (panelIcon) panelIcon.textContent = site.appIcon;
    const panelStatus = document.querySelector('.site-panel-status');
    if (panelStatus) {
      panelStatus.textContent  = site.enabled ? '● Active' : '○ Disabled';
      panelStatus.className    = `site-panel-status ${site.enabled ? 'on' : 'off'}`;
    }
    /* Invalidate tabs that depend on saved data */
    (invalidateTabs || []).forEach(t => invalidateTab(site, t));
    showInlineAlert(alertEl, 'success', msg);
  }

  /* ── init ─────────────────────────────────────────────────────── */

  function init() {
    const session = getSession();

    if (!isAdminSession(session)) {
      $('auth-gate').classList.remove('hidden');
      return;
    }

    $('admin-app').classList.remove('hidden');
    $('topbar-user-label').textContent = `👤 ${esc(session.username || 'admin')}`;

    state.sites = loadRegistry();
    renderSidebar();
    showWelcome();

    /* Global button wiring */
    $('btn-add-site').addEventListener('click', openAddSiteModal);
    $('btn-first-site').addEventListener('click', openAddSiteModal);
    $('btn-hash-tool').addEventListener('click', openHashToolModal);

    $('btn-signout').addEventListener('click', () => {
      localStorage.removeItem(SESSION_KEY);
      window.location.href = 'login.html';
    });

    /* Close modal on overlay click */
    $('modal-overlay').addEventListener('click', e => {
      if (e.target === $('modal-overlay')) hideModal();
    });

    /* Close modal on Escape key */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
