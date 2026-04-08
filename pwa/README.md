# /pwa — Shared PWA Infrastructure

This directory is the single source of truth for Progressive Web App plumbing across every MajixAI sub-app. Any new app can plug straight in with two lines of configuration.

## Files

| File | Purpose |
|------|---------|
| `sw-core.js` | Unified service-worker logic (install / activate / fetch strategies) |
| `manifest-template.json` | Starter template for a new app's `manifest.json` |

---

## How to add PWA support to a new directory

### 1 — Create your `manifest.json`

Copy `pwa/manifest-template.json` into your app directory and fill in `name`, `short_name`, `description`, `theme_color`, `background_color`, and the `icons` array.

```jsonc
// myapp/manifest.json
{
  "name": "My App",
  "short_name": "MyApp",
  ...
}
```

### 2 — Create your `sw.js`

```js
// myapp/sw.js
self.SW_CONFIG = {
  cacheVersion:  'myapp-v1',          // bump on breaking cache changes
  appShellFiles: ['./', './index.html', './manifest.json'],
  // optional — only list hosts your app actually uses:
  trustedCdnHosts: ['cdn.jsdelivr.net'],
};
importScripts('/pwa/sw-core.js');
```

### 3 — Register the service worker in your HTML

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
</script>
```

### 4 — Link the manifest in `<head>`

```html
<link rel="manifest" href="./manifest.json">
<meta name="theme-color" content="#your-theme-color">
```

---

## SW_CONFIG reference

All fields are **optional**; sensible defaults are applied by `sw-core.js`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `cacheVersion` | `string` | `'majixai-pwa-v1'` | Cache-name prefix. Bump to invalidate all caches. |
| `appShellFiles` | `string[]` | `['./', './index.html']` | Files pre-cached on install. |
| `trustedCdnHosts` | `string[]` | Common CDNs | Hostnames served cache-first. |
| `imageCdnHosts` | `string[]` | `[]` | Image hostnames served stale-while-revalidate (offline slideshow). |
| `subappModules` | `Object` | `{}` | `{ subappName: [paths] }` — modules cached on-demand when a subapp is navigated to. |
| `networkFirstExtensions` | `string[]` | `['.dat']` | File extensions always served network-first. |
| `bypassHosts` | `string[]` | `[]` | Hostnames the SW leaves completely unhandled (e.g. live APIs). |

---

## Cache strategy summary

| Scenario | Strategy |
|----------|---------|
| Navigation (HTML pages) | Network-first → cache fallback |
| Same-origin static assets | Cache-first → network fill |
| Trusted CDN resources | Cache-first → network fill |
| Image CDN resources | Stale-while-revalidate |
| `networkFirstExtensions` files | Network-first → cache fallback |
| `bypassHosts` | Browser default (no SW intercept) |
| All other cross-origin | Direct `fetch()` |

---

## Advanced: app-specific message handlers

Apps that need extra service-worker functionality (e.g. background-sync task queues) can add additional event listeners **after** calling `importScripts`:

```js
// myapp/sw.js
self.SW_CONFIG = { cacheVersion: 'myapp-v1', appShellFiles: [...] };
importScripts('/pwa/sw-core.js');

// App-specific message channel
self.addEventListener('message', (event) => {
  if (event.data?.type === 'MY_ACTION') { /* ... */ }
});
```
