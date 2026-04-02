# 🔐 MajixAI Standalone Login

A self-contained, zero-dependency login system that can be dropped into any directory in this repository. The accompanying GitHub Actions workflow (`extend_login.yml`) automatically detects new sibling directories on every push and extends the login template into each one.

---

## Files

| File | Purpose |
|------|---------|
| `login.html` | Standalone login page (copy into target dir) |
| `login.js` | Login logic — SHA-256 hashing, session management, config loader |
| `login.css` | Minimal, themed stylesheet |
| `login-config.json` | Template configuration (auto-customised per directory) |
| `extend.py` | Script used by the GitHub Action to copy & configure files |

---

## How It Works

### Automatic (via GitHub Actions)

Every time a **new top-level directory** is pushed to `main`, the workflow `extend_login.yml` runs:

1. Detects which directories were **added** in the push (via `git diff --diff-filter=A`).
2. For each new directory, calls `login/extend.py <dir>`.
3. Copies `login.html`, `login.js`, `login.css` into the directory.
4. Writes a **customised** `login-config.json` (app name derived from directory name, `sessionKey` namespaced to the directory, `redirectOnSuccess` pointing at the directory's `index.html`).
5. Commits and pushes the result back to the branch.

### Manual trigger

Go to **Actions → Extend Login to New Sibling Directories → Run workflow**.  
Optionally specify a `target_dir` (e.g. `my_new_app`) and whether to `--force` overwrite existing files.

### Manual CLI

```bash
python3 login/extend.py my_new_app           # skip if files already exist
python3 login/extend.py my_new_app --force   # overwrite existing files
```

---

## Configuration (`login-config.json`)

```jsonc
{
  "appName":          "My App",          // shown in the login card header
  "appIcon":          "🔐",             // emoji shown above the app name
  "redirectOnSuccess": "index.html",     // page to redirect to after login
  "sessionKey":       "majixai_session_my_app",  // localStorage key
  "sessionDuration":  86400000,          // session TTL in ms (default: 24 h)
  "users": [
    {
      "username":     "admin",
      "passwordHash": "<SHA-256 of password>"
    }
  ],
  "theme": {
    "primaryColor": "#2c3e50",
    "accentColor":  "#3498db",
    "bgColor":      "#f5f6fa"
  }
}
```

### Generating a password hash

In a browser console:
```js
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mypassword'));
console.log([...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''));
```

Or in Python:
```python
import hashlib
print(hashlib.sha256(b'mypassword').hexdigest())
```

The default credentials are **admin / admin**. Change them before deploying to production.

---

## Protecting an existing page

Add this guard snippet to any `index.html` **before** its main content scripts:

```html
<!-- Login guard -->
<script src="login.js"></script>
<script>
  (async () => {
    const ok = await window.MajixLogin.isLoggedIn();
    if (!ok) window.location.href = 'login.html';
  })();
</script>
```

---

## Security notes

- Authentication is **client-side only** (no server required for a static GitHub Pages site). Do not use for truly sensitive data.
- Passwords are stored as SHA-256 hashes in the config file — never in plain text.
- Sessions expire after `sessionDuration` milliseconds (default 24 hours).
- For stronger security, replace with a backend session service or a third-party OAuth provider.
