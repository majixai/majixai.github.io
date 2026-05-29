# /actions — Shared Action Dispatcher Core

This directory is the single source of truth for client-side action dispatching across every MajixAI sub-app.  
Any page can plug straight in with two lines of configuration and get a namespaced action bus with middleware, history, async support, and localStorage persistence — for free.

## Files

| File | Purpose |
|------|---------|
| `actions-core.js` | Unified action dispatcher: namespacing, middleware pipeline, handler registration, action history, async dispatch, localStorage persistence |
| `index.html` | Live demo and full documentation page |
| `extend.py` | Script used by GitHub Actions to wire new directories to `/actions/actions-core.js` and create starter README files |
| `README.md` | This file |

---

## Quick start — adding actions-core to any page

### 1 — Configure and load actions-core

Set `window.ACTIONS_CONFIG` **before** loading the script, then call `MajixActions.init()` after the DOM is ready:

```html
<script>
  window.ACTIONS_CONFIG = {
    namespace:    'myapp',       // all types become 'myapp/...'
    logToConsole: true,          // helpful during development
    persistHistory: true,        // replay actions on reload
  };
</script>
<script src="/actions/actions-core.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    MajixActions.init();

    // Register handlers
    MajixActions.on('search', function (payload) {
      console.log('search for:', payload.query);
    });

    // Dispatch an action
    MajixActions.dispatch('search', { query: 'SPY' });
  });
</script>
```

---

## ACTIONS_CONFIG reference

All fields are **optional**; sensible defaults are applied by `actions-core.js`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `namespace` | `string` | `'majix'` | Prefix prepended to every action type (`namespace/type`). Use a unique value per app. |
| `historyLimit` | `number` | `200` | Maximum actions kept in the in-memory log. Set `0` to disable history. |
| `persistHistory` | `boolean` | `false` | Persist history to localStorage on every dispatch. |
| `storageKey` | `string` | `'majixActionsHistory'` | localStorage key for persisted history. |
| `logToConsole` | `boolean` | `false` | Log every dispatch to the browser console. |
| `logLevel` | `'debug'\|'info'\|'warn'\|'error'` | `'info'` | Minimum severity level for console output. |
| `onDispatch` | `function(action)` | `null` | Callback called synchronously after every successful dispatch. |
| `onError` | `function(err, action)` | `null` | Callback called when a handler throws. If omitted, errors are re-thrown. |
| `middleware` | `function[]` | `[]` | Array of middleware functions `(action, next) => void` run before handlers. |

---

## Public API

After the script is loaded, `window.MajixActions` exposes:

### `MajixActions.init()`

Reads `window.ACTIONS_CONFIG`, sets up middleware, and loads any persisted history. Safe to call multiple times (re-initializes configuration).

### `MajixActions.on(type, handler) → unsubscribe`

Register a handler for the given action type(s). `type` may be a string or an array of strings.  
Use `'*'` as a wildcard to receive every dispatched action.  
Returns an **unsubscribe function** — call it to remove the handler.

```js
var off = MajixActions.on('data/load', function (payload) { /* ... */ });
off(); // removes the handler
```

### `MajixActions.once(type, handler) → unsubscribe`

Register a one-time handler. Automatically removed after the first invocation.

### `MajixActions.dispatch(type, payload?, meta?) → result`

Dispatch an action through the middleware pipeline and into registered handlers.  
`type` is auto-namespaced. Returns the handler's return value (or `undefined`).

```js
MajixActions.dispatch('data/load', { ticker: 'SPY' });
```

### `MajixActions.dispatchAsync(type, payload?, meta?) → Promise`

Like `dispatch`, but always returns a `Promise`. Useful when handlers perform async work.

```js
await MajixActions.dispatchAsync('data/save', { rows: [...] });
```

### `MajixActions.use(middlewareFn)`

Append a middleware function to the pipeline. Middleware runs in insertion order.

```js
MajixActions.use(function (action, next) {
  console.time(action.type);
  next(action);
  console.timeEnd(action.type);
});
```

### `MajixActions.off(type?)`

Remove all handlers for the given action type. Omit `type` to remove **all** handlers.

### `MajixActions.history(limit?) → action[]`

Returns a copy of the in-memory action log, most recent first.

```js
var last10 = MajixActions.history(10);
```

### `MajixActions.clearHistory()`

Clear the in-memory log and the localStorage entry (if `persistHistory` is enabled).

### `MajixActions.hasHandler(type) → boolean`

Returns `true` if at least one handler is registered for the given type.

### `MajixActions.config`

Read-only reference to the current resolved configuration object.

---

## Middleware

Middleware functions receive `(action, next)` and must call `next(action)` to continue the pipeline.  
They may mutate the action object before passing it on:

```js
// Timestamp middleware (already built-in via meta.timestamp, but as example)
MajixActions.use(function (action, next) {
  action.meta.processedAt = Date.now();
  next(action);
});

// Logging middleware
MajixActions.use(function (action, next) {
  console.group('[action]', action.type);
  next(action);
  console.groupEnd();
});

// Auth guard middleware
MajixActions.use(function (action, next) {
  if (action.type.startsWith('admin/') && !isAdminUser()) {
    console.warn('Blocked admin action — not authorized');
    return;  // don't call next → action is cancelled
  }
  next(action);
});
```

---

## Examples

### Minimal — button click dispatches an action

```html
<button id="refresh-btn">Refresh</button>

<script>
  window.ACTIONS_CONFIG = { namespace: 'dashboard', logToConsole: true };
</script>
<script src="/actions/actions-core.js"></script>
<script>
  MajixActions.init();
  MajixActions.on('refresh', function () {
    location.reload();
  });
  document.getElementById('refresh-btn').addEventListener('click', function () {
    MajixActions.dispatch('refresh');
  });
</script>
```

### Async data fetch

```js
MajixActions.on('data/fetch', function (payload) {
  return fetch('/api/data?ticker=' + payload.ticker)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      MajixActions.dispatch('data/loaded', data);
    });
});

MajixActions.dispatch('data/fetch', { ticker: 'AAPL' });
```

### Replay persisted history on reload

```js
window.ACTIONS_CONFIG = { namespace: 'myapp', persistHistory: true };
// ...
MajixActions.init();

// After init, history() contains actions from the previous session
MajixActions.history().reverse().forEach(function (a) {
  console.log('Previous action:', a.type, a.meta.timestamp);
});
```

---

## Automatic extension for new directories

This repository includes `.github/workflows/extend_actions.yml`.

On push to `main`, it detects newly added top-level directories and runs:

```bash
python3 actions/extend.py <target_dir>
```

The extender:

1. Patches `<target_dir>/index.html` to ensure `MajixActions` is available and initialized.
2. Writes `<target_dir>/README.md` (when missing) with action-workflow guidance that points back to this `/actions/README.md`.

Manual trigger is also available from **Actions → Extend Actions to New Sibling Directories** with optional `target_dir` and `force` inputs.

---

## Recommended Modifications, Enhancements & Optimizations

The items below are prioritized suggestions for improving the `/actions` runtime, tooling, and related workflows. They are grouped by file so each contribution is self-contained.

---

### `actions-core.js`

#### Modifications

| # | Area | Recommendation |
|---|------|----------------|
| M1 | **Re-initialization safety** | `init()` silently re-initializes when called more than once. Add an explicit `reset()` method and make `init()` a true no-op when already initialized (unless `{ force: true }` is passed). |
| M2 | **Wildcard handler separation** | Wildcard (`'*'`) handlers currently share the same `_handlers` map. Move them to a dedicated `_wildcardHandlers` array to avoid `_ns('*')` collisions and make the intent clearer. |
| M3 | **`once` namespace duplication** | `once()` calls `_ns(type)` and then passes the already-namespaced key to `on()`, which calls `_ns()` again, producing a double-prefixed type. Pass the raw type through `on()` only, not through both. |

#### Enhancements

| # | Area | Recommendation |
|---|------|----------------|
| E1 | **Event replay / time-travel** | Expose `MajixActions.replay(actions?)` that re-dispatches a snapshot (defaults to `history()`) through the current middleware pipeline — useful for debugging and automated testing. |
| E2 | **Priority handlers** | Add an optional `priority` number to `on()` so that critical handlers (e.g. auth guards) always run before lower-priority ones, without relying on registration order. |
| E3 | **`dispatch` return shape** | When multiple handlers are registered `dispatch()` returns an array; with one it returns a scalar. Normalize the return value to always be an array (or always a single value when `singleResult: true` is in config) to avoid downstream `Array.isArray` checks. |
| E4 | **Typed error class** | Replace bare `throw err` with a custom `MajixActionsError` that attaches the offending `action` object, making `onError` handlers more useful without needing a closure. |
| E5 | **`sessionStorage` option** | Add `persistStorage: 'session'` alongside the existing `'local'` (default) option so history only survives the tab session, which is safer for sensitive financial payloads. |

#### Optimizations

| # | Area | Recommendation |
|---|------|----------------|
| O1 | **Handler lookup cost** | `_handlers[type]` is looked up twice for every dispatch (once for the typed list, once for `'*'`). Cache the combined array reference per type in a `_resolvedHandlers` map, invalidated only when `on()`/`off()` changes that type. |
| O2 | **History trim strategy** | `splice(0, delta)` is `O(n)` on large arrays. Replace with a circular buffer (pre-allocated array + head/tail indices) so history writes stay `O(1)`. |
| O3 | **Middleware slice** | `_middleware.slice()` copies the entire pipeline on every dispatch. Convert to an index-walking loop over the original array to eliminate the allocation hot path. |
| O4 | **localStorage serialization** | `JSON.stringify(_history)` serializes the entire log on every dispatch when `persistHistory` is `true`. Batch writes with a debounced flush (e.g. 300 ms) to reduce I/O pressure during rapid dispatch sequences. |

---

### `extend.py`

#### Modifications

| # | Area | Recommendation |
|---|------|----------------|
| M1 | **Idempotency guard** | The current `--force` flag is all-or-nothing. Add `--force-index` and `--force-readme` flags so callers can selectively overwrite only one artifact without risking the other. |
| M2 | **Encoding fallback** | `errors="replace"` silently corrupts non-UTF-8 bytes in `index.html`. Use `errors="strict"` by default and emit a clear warning when a decode error is caught, so corrupt files are never silently patched. |

#### Enhancements

| # | Area | Recommendation |
|---|------|----------------|
| E1 | **Dry-run mode** | Add `--dry-run` to print what would change without writing any files, enabling safe CI previews. |
| E2 | **Batch mode** | Accept multiple `target_dir` positional arguments so the workflow can process several directories in a single Python process invocation, reducing subprocess overhead. |
| E3 | **Validation step** | After patching `index.html`, run a quick `html.parser`-based sanity check (via `html.parser` from the stdlib) to confirm the patched file is still valid HTML before writing. |
| E4 | **Structured output** | Emit a JSON summary to stdout (one object per target) so the calling workflow can parse results without screen-scraping log lines. |

#### Optimizations

| # | Area | Recommendation |
|---|------|----------------|
| O1 | **Regex pre-compilation** | `re.search` and `re.sub` patterns are recompiled on each call. Compile `BODY_RE = re.compile(r"</body>", re.IGNORECASE)` once at module level. |
| O2 | **Single read/write** | `index_path.read_text` / `index_path.write_text` use separate file handles. Use `pathlib.Path.open` in `r+` mode with a single lock if concurrent runs are possible in the Actions matrix. |

---

### `metatrader5_setup.py`

#### Modifications

| # | Area | Recommendation |
|---|------|----------------|
| M1 | **Version pinning** | Add an optional `--version <x.y.z>` argument so CI can pin to a known-good release (`pip install MetaTrader5==5.0.x`) and avoid surprise breakages from upstream releases. |
| M2 | **Exit-code propagation** | `subprocess.run` without `check=False` swallows the exit code when pip aborts mid-install. Add `try/except subprocess.CalledProcessError` when using `check=True`, or keep `check=False` and document why. |

#### Enhancements

| # | Area | Recommendation |
|---|------|----------------|
| E1 | **Post-install verification** | After a successful pip install, call `python -c "import MetaTrader5; print(MetaTrader5.__version__)"` within the same script so failures are surfaced as a Python exception rather than relying on a separate workflow step. |
| E2 | **Requirements file support** | Accept `--requirements <file>` to install from a requirements file alongside MetaTrader5, enabling a single script call to set up the full environment. |
| E3 | **Progress reporting** | Pass `--progress-bar on` to pip (or capture stdout/stderr separately) so GitHub Actions folds the pip output cleanly under a collapsible step group. |

#### Optimizations

| # | Area | Recommendation |
|---|------|----------------|
| O1 | **Re-use pip cache** | The workflow does not set `cache-dependency-path` for `actions/setup-python`. Add a lightweight `requirements-metatrader5.txt` containing only `MetaTrader5` (pinned) and point the cache key at it so repeated runs skip the download entirely. |
| O2 | **Skip redundant install** | Before calling pip, check `importlib.util.find_spec("MetaTrader5")` and compare the installed version against the target. Skip the install entirely when already up-to-date (unless `--upgrade` is explicitly requested). |

---

### `.github/workflows/metatrader5_setup.yml`

#### Modifications

| # | Area | Recommendation |
|---|------|----------------|
| M1 | **Runner pinning** | `windows-latest` rolls forward automatically. Pin to `windows-2022` (or `windows-2019`) to guarantee a stable environment until an explicit update is desired. |
| M2 | **Python version matrix** | MetaTrader5 binaries exist for Python 3.7–3.11. Add a `strategy.matrix.python-version` so a single manual dispatch validates all supported interpreters. |

#### Enhancements

| # | Area | Recommendation |
|---|------|----------------|
| E1 | **Job summary** | Append a `$GITHUB_STEP_SUMMARY` block (as used in `extend_actions.yml`) that reports the installed package version and whether an upgrade actually occurred. |
| E2 | **Scheduled auto-upgrade check** | Add a weekly `schedule` trigger that runs with `upgrade: true` and opens a PR (or commits) only when a newer version is available, keeping the package current without manual intervention. |
| E3 | **Artifact upload** | Upload `pip show MetaTrader5` output as an artifact so the exact installed metadata is accessible from the workflow run page without re-running the job. |

#### Optimizations

| # | Area | Recommendation |
|---|------|----------------|
| O1 | **pip cache** | Wire `cache: 'pip'` with `cache-dependency-path` pointing at a pinned `requirements-metatrader5.txt` (see `metatrader5_setup.py → O1` above) to avoid re-downloading the package on every run. |
| O2 | **Conditional verify step** | The verification step (`import MetaTrader5`) always runs even when the install step fails. Add `if: success()` to skip it cleanly and avoid a misleading secondary error. |

---

### General `/actions` directory

| # | Area | Recommendation |
|---|------|----------------|
| G1 | **Automated tests** | Add a `tests/` sub-directory with a Jest (or plain Node `assert`) test suite for `actions-core.js` and a Python `unittest` suite for `extend.py` and `metatrader5_setup.py`. Wire them to a new `actions_ci.yml` workflow. |
| G2 | **CHANGELOG** | Maintain a `CHANGELOG.md` in this directory to track breaking changes to `actions-core.js` (especially namespace behaviour and return-shape differences). |
| G3 | **Version header** | Add a `version` constant (e.g. `MajixActions.VERSION = '1.0.0'`) to `actions-core.js` so consuming pages can assert a minimum runtime version at startup. |
| G4 | **CSP compatibility** | Document (or enforce) that `actions-core.js` is written to be compatible with strict Content Security Policy — no `eval`, no `new Function` — so sub-apps can safely set `script-src 'self'`. |
| G5 | **Module export** | Wrap the IIFE with a UMD or ES-module guard so `actions-core.js` can be imported with `import`/`require` in Node test environments without needing `jsdom`. |
