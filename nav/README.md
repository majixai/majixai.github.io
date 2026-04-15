# /nav — Shared Menu Processing Core

This directory is the single source of truth for menu / navigation link processing across every MajixAI sub-app.  
Any page can plug straight in with two lines of configuration, getting IndexedDB + localStorage + sessionStorage + cookie persistence, clipboard copy, and a self-rendering link list — for free.

## Files

| File | Purpose |
|------|---------|
| `nav-core.js` | Unified menu JS: storage helpers (IndexedDB, localStorage, sessionStorage, cookies), clipboard utility, link rendering, add/remove links |
| `README.md` | This file |

---

## Quick start — adding nav-core to any page

### 1 — Add an anchor element

Put a `<ul id="menu-list">` (or any element matching your selector) in your HTML where links should appear, and optionally an empty container for the add-link form:

```html
<ul id="menu-list"></ul>
<div id="add-link-container"></div>
```

### 2 — Configure and load nav-core

Set `window.MENU_CONFIG` **before** loading the script, then call `MajixNav.init()` after the DOM is ready:

```html
<script>
  window.MENU_CONFIG = {
    storageKey: 'myapp-links',   // unique key so each app has its own links
    initialLinks: [
      { name: 'Home',   url: 'index.html' },
      { name: 'GitHub', url: 'https://github.com/majixai' },
    ],
  };
</script>
<script src="/nav/nav-core.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    MajixNav.init();
  });
</script>
```

That's it. Links are persisted automatically across IndexedDB, localStorage, sessionStorage, and a cookie. The user can add new links via the injected form, and remove any link with the `×` button.

---

## MENU_CONFIG reference

All fields are **optional**; sensible defaults are applied by `nav-core.js`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `storageKey` | `string` | `'majixNavLinks'` | Key used for localStorage and sessionStorage. Use a unique value per app so link lists don't collide. |
| `dbName` | `string` | `'MajixNavDB'` | IndexedDB database name. |
| `dbStoreName` | `string` | `'links'` | IndexedDB object-store name. |
| `cookieName` | `string` | `'majixNavLinks'` | Cookie name for cookie-based persistence. |
| `cookieMaxAge` | `number` | `31536000` | Cookie max-age in seconds (default 1 year). |
| `menuListSelector` | `string` | `'#menu-list'` | CSS selector for the `<ul>`/`<ol>` that receives rendered `<li>` items. |
| `addFormSelector` | `string` | `'#add-link-container'` | CSS selector for the container where nav-core injects the add-link form. Omit or point at a non-existent element to skip the form. |
| `initialLinks` | `{name, url, [type]}[]` | `[]` | Seed links used when no persisted links exist yet. |
| `onLinkClick` | `function(link, event)` | `null` | Callback fired when a rendered link `<li>` is clicked (not the delete button). |
| `copyOnClick` | `boolean` | `true` | Copy `[name](url)` Markdown to the clipboard on link click. |
| `persistMethods` | `string[]` | `['indexedDB','sessionStorage','cookie','localStorage']` | Storage back-ends to write to. Remove entries you don't want. |

---

## Public API

After the script is loaded `window.MajixNav` exposes:

### `MajixNav.init() → Promise<Array>`

Reads `window.MENU_CONFIG`, loads persisted links (priority: IndexedDB → localStorage → sessionStorage → cookie → `initialLinks`), renders them, and wires the add-link form.  
Returns a Promise that resolves with the loaded link array.

### `MajixNav.addLink(link)`

Add a link object `{ name, url, [type] }` to all configured storage back-ends and render it in the list. If a link with the same URL already exists, it is updated in storage but not duplicated in the DOM.

### `MajixNav.removeLink(url)`

Remove a link by URL from all storage back-ends and the DOM.

### `MajixNav.copyToClipboard(text) → Promise<void>`

Copy arbitrary text to the clipboard. Uses the async Clipboard API where available, with a `<textarea>` + `execCommand` fallback for older browsers.

### `MajixNav.storage`

Low-level storage helpers for advanced use:

```js
MajixNav.storage.saveToIndexedDB(link)
MajixNav.storage.loadFromIndexedDB()          // → Promise<Array>
MajixNav.storage.saveToLocal(links)
MajixNav.storage.loadFromLocal()              // → Array
MajixNav.storage.saveToSession(links)
MajixNav.storage.loadFromSession()            // → Array
MajixNav.storage.saveToCookie(links)
MajixNav.storage.loadFromCookie()             // → Array
```

### `MajixNav.config`

Read-only reference to the current resolved configuration object.

---

## Examples

### Minimal — just render a fixed link list

```html
<ul id="menu-list"></ul>

<script>
  window.MENU_CONFIG = {
    storageKey:   'example-links',
    persistMethods: [],           // don't persist — static list only
    copyOnClick:  false,
    initialLinks: [
      { name: 'Dashboard', url: '/dashboard' },
      { name: 'Settings',  url: '/settings' },
    ],
  };
</script>
<script src="/nav/nav-core.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    MajixNav.init();
  });
</script>
```

### With custom click handler (iframe loader)

```html
<ul id="menu-list"></ul>
<iframe id="content-frame" src="about:blank"></iframe>

<script>
  window.MENU_CONFIG = {
    storageKey: 'iframe-nav',
    onLinkClick: function (link, event) {
      event.preventDefault();
      document.getElementById('content-frame').src = link.url;
    },
    copyOnClick: false,
    initialLinks: [
      { name: 'Charts',  url: 'charts.html' },
      { name: 'Reports', url: 'reports.html' },
    ],
  };
</script>
<script src="/nav/nav-core.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    MajixNav.init();
  });
</script>
```

### Programmatic add / remove

```js
// After MajixNav.init() has been called:
MajixNav.addLink({ name: 'New Page', url: '/new-page' });
MajixNav.removeLink('/new-page');
```

### Copy to clipboard standalone

```js
MajixNav.copyToClipboard('Hello world').then(function () {
  console.log('Copied!');
});
```

---

## Migrating existing menu.html files

Pages that currently inline the `saveLinkToIndexedDB` / `saveLinkToSession` / `saveLinkToCookies` / `copyToClipboard` helpers can be simplified to:

```diff
-<script>
-function saveLinkToIndexedDB(link) { ... }
-function saveLinkToSession(link) { ... }
-function saveLinkToCookies(link) { ... }
-function copyToClipboard(text) { ... }
-$('#add-link-btn').on('click', function() { ... });
-$('#menu-list').on('click', 'li', function() { ... });
-</script>
+<script>
+  window.MENU_CONFIG = { storageKey: 'my-app-links', initialLinks: [...] };
+</script>
+<script src="/nav/nav-core.js"></script>
+<script>
+  document.addEventListener('DOMContentLoaded', function () { MajixNav.init(); });
+</script>
```
