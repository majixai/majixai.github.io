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

## Login page features

The login page (`login.html`) is intentionally self-contained and enriched:

| Feature | Details |
|---------|---------|
| **Show / hide password** | Eye-icon toggle inside the password field |
| **Remember Me** | Checkbox extends the session to 30 days instead of the default 24 hours |
| **Explicit navigation** | After a successful login a **"Go to App →"** button is shown — the user navigates only when they click it. There is no automatic redirect. |
| **Admin Panel button** | Admin-role users also see an orange **"⚙ Admin Panel →"** button after login |
| **Session info** | When already logged in the card shows the session expiry countdown, signed-in username, and app name before the navigation buttons |
| **Privacy strip** | A small notice below the form explains that passwords are SHA-256 hashed and no data is sent to a server |

---

## Admin Panel (`admin.html`)

A full-featured management dashboard accessible only to users whose session has `role === "admin"`.

### Accessing the admin panel

1. Log in with an admin-role account — an orange **"⚙ Admin Panel →"** button appears after login.
2. Or navigate directly to `login/admin.html` (you will be redirected to `login.html` if not authenticated as admin).

### Features

| Section | What you can do |
|---------|-----------------|
| **Managed Sites sidebar** | See all configured sites at a glance with ON/OFF status badges; click any site to open its full management panel |
| **＋ Add Site** | Wizard to register a new site: name, icon, description, directory path, redirect URL |
| **Overview tab** | Edit app name, icon, description, directory reference, redirect URL; toggle login on/off |
| **Users tab** | Full CRUD for user accounts (username, display name, role, password); inline SHA-256 hash generator that updates in real time |
| **Theme tab** | Color pickers for primary, accent, and background colors with a live miniature login-card preview |
| **Settings tab** | Session storage key, session duration (log-scale slider from 15 min → 30 days), admin page URL, Remember-Me default |
| **Export tab** | View the generated `login-config.json` with syntax highlighting; one-click download or copy-to-clipboard; step-by-step deployment instructions |
| **🔑 Hash Generator** | Global tool (top bar button) for generating SHA-256 hashes independently of any site |
| **Delete Site** | Remove a site from the registry (files on disk are not touched) |

### How site data is stored

All site configurations are stored in `localStorage['majixai_admin_registry']` as a JSON array.
No server is needed — the admin panel is fully client-side.

### Giving a user admin access

In any `login-config.json`, add `"role": "admin"` to the user object:

```json
{
  "username": "admin",
  "passwordHash": "<SHA-256 hash>",
  "role": "admin",
  "displayName": "Administrator"
}
```

Also set `"adminPage": "admin.html"` at the top level so the Admin Panel button appears after login.


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
  "appName":          "My App",                       // shown in the login card header
  "appIcon":          "🔐",                           // emoji shown above the app name
  "redirectOnSuccess": "index.html",                  // page to navigate to after login
  "adminPage":        "admin.html",                   // (optional) shown to admin-role users
  "sessionKey":       "majixai_session_my_app",       // localStorage key
  "sessionDuration":  86400000,                       // session TTL in ms (default: 24 h)
  "users": [
    {
      "username":     "admin",
      "passwordHash": "<SHA-256 of password>",
      "role":         "admin",                        // "admin" | "user" (default: "user")
      "displayName":  "Administrator"                 // optional friendly name
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
