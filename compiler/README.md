# /compiler — Shared Multi-Language Compiler Core

This directory is the single source of truth for client-side and server-side code compilation across every MajixAI sub-app.  
Any page can plug straight in with two lines of configuration and immediately compile or run code in JavaScript, Python, R, Java, Go, Rust, TypeScript, SQL, Bash, and many more languages.

## Files

| File | Purpose |
|------|---------|
| `compiler-core.js` | Language-adapter engine: sandboxed JS execution, HTML preview, JSON validation, and HTTP adapter for remote server-side languages |
| `index.html` | Live demo, interactive code editor, and full documentation page |
| `README.md` | This file |

---

## Quick start — adding compiler-core to any page

### 1 — Configure and load compiler-core

Set `window.COMPILER_CONFIG` **before** loading the script, then call `MajixCompiler.init()` after the DOM is ready:

```html
<script>
  window.COMPILER_CONFIG = {
    logToConsole: true,
    apiEndpoint:  '/compiler/api',   // base URL for remote languages
  };
</script>
<script src="/compiler/compiler-core.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    MajixCompiler.init();

    // Run JavaScript in the browser — no server required
    MajixCompiler.run('javascript', 'console.log("Hello!")').then(function (r) {
      console.log(r.stdout);   // "Hello!"
      console.log(r.elapsed);  // ms
    });
  });
</script>
```

---

## COMPILER_CONFIG reference

All fields are **optional**; sensible defaults are applied by `compiler-core.js`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `logToConsole` | `boolean` | `false` | Log every compile/run event to the browser console. |
| `logLevel` | `'debug'\|'info'\|'warn'\|'error'` | `'info'` | Minimum severity level for console output. |
| `historyLimit` | `number` | `100` | Maximum results kept in the in-memory log. Set `0` to disable. |
| `timeout` | `number` | `10000` | Default timeout (ms) for remote HTTP requests. `0` disables the timeout. |
| `apiEndpoint` | `string` | `'/compiler/api'` | Base URL for remote language adapters. Requests go to `{apiEndpoint}/{language}/{action}`. |
| `defaultLanguage` | `string` | `'javascript'` | Language used when none is specified. |
| `adapters` | `object` | `{}` | Extra adapters to register at `init()` time. Keys are language IDs, values are adapter objects. |
| `onCompile` | `function(result)` | `null` | Callback invoked after every successful compile or run. |
| `onError` | `function(err, lang, code)` | `null` | Callback invoked when an adapter throws. If omitted, the rejected Promise propagates normally. |

---

## Public API

After the script is loaded, `window.MajixCompiler` exposes:

### `MajixCompiler.init()`

Reads `window.COMPILER_CONFIG`, resets adapters and aliases, registers all built-in language adapters, and applies any extra adapters from `config.adapters`. Safe to call multiple times.

### `MajixCompiler.run(lang, code, options?) → Promise<Result>`

Compile and run source code for the given language.

```js
MajixCompiler.run('javascript', 'console.log(2 + 2)').then(function (r) {
  console.log(r.stdout);   // "4"
  console.log(r.status);   // "ok" | "error" | "timeout"
  console.log(r.elapsed);  // ms
});
```

### `MajixCompiler.compile(lang, code, options?) → Promise<Result>`

Compile-only (syntax-check / transpile) without executing. Not all adapters support this — if unsupported the result will have `status: 'error'` with a descriptive message.

```js
MajixCompiler.compile('javascript', 'const x = ;').then(function (r) {
  if (r.status === 'error') console.error(r.stderr);
});
```

### `MajixCompiler.register(lang, adapter, aliases?)`

Register a custom language adapter, or override a built-in one.

```js
MajixCompiler.register('brainfuck', {
  canRun: true,
  run: function (code, options) {
    return Promise.resolve({
      language: 'brainfuck',
      status:   'ok',
      stdout:   '(output here)',
      stderr:   '',
      exitCode: 0,
      elapsed:  0,
      output:   null,
      error:    null,
    });
  },
}, ['bf']);
```

### `MajixCompiler.unregister(lang)`

Remove a registered adapter.

### `MajixCompiler.isSupported(lang) → boolean`

Returns `true` if a language adapter is registered for `lang`.

```js
MajixCompiler.isSupported('rust');  // true
MajixCompiler.isSupported('cobol'); // false (unless registered)
```

### `MajixCompiler.getSupportedLanguages() → string[]`

Returns a list of all registered canonical language identifiers.

### `MajixCompiler.history(limit?) → Result[]`

Returns a copy of the in-memory result log, most recent first.

```js
var last5 = MajixCompiler.history(5);
```

### `MajixCompiler.clearHistory()`

Clear the in-memory result log.

### `MajixCompiler.config`

Read-only reference to the current resolved configuration object.

---

## Result object

Every `compile()` and `run()` call resolves with a `Result` object:

| Field | Type | Description |
|-------|------|-------------|
| `language` | `string` | Normalised language identifier (e.g. `'python'`) |
| `status` | `'ok'\|'error'\|'timeout'` | Outcome |
| `stdout` | `string` | Captured standard output (or pretty-printed value for JSON/HTML) |
| `stderr` | `string` | Captured standard error or diagnostic messages |
| `exitCode` | `number` | `0` = success, non-zero = failure |
| `elapsed` | `number` | Time taken in milliseconds |
| `output` | `*` | Arbitrary artefact: JS return value, parsed JSON object, blob URL for HTML, etc. |
| `error` | `string\|null` | Human-readable error summary, or `null` on success |

---

## Built-in language adapters

### Browser-native (no server required)

| Language | IDs | Capability | Notes |
|----------|-----|------------|-------|
| JavaScript | `javascript`, `js` | compile, run | `compile` = syntax-check via `Function` constructor. `run` = sandboxed eval with `console.log/warn/error` capture. |
| HTML | `html`, `htm` | run | Returns a `blob:` URL. Set the URL as the `src` of a sandboxed `<iframe>` to render the preview. |
| JSON | `json` | compile, run | `compile` = validate only. `run` = validate + pretty-print. Returns the parsed object in `result.output`. |

### Remote (HTTP adapter)

All other languages use the generic HTTP adapter which POSTs to `{apiEndpoint}/{language}/{action}` with body `{ code, options }`.

Default remote languages: `python` (`py`), `r`, `java`, `typescript` (`ts`), `sql`, `bash` / `shell` / `sh`, `go`, `rust`, `c`, `cpp`, `ruby` (`rb`), `php`, `kotlin`, `swift`, `perl`, `lua`, `scala`.

The server must accept `POST /{language}/run` or `POST /{language}/compile` and respond with a JSON body matching the **Result** shape above.

---

## Adapter interface

An adapter is a plain object with:

```js
{
  canCompile: boolean,   // does this adapter support compile()?
  canRun:     boolean,   // does this adapter support run()?

  // At least one of:
  compile(code, options) → Promise<Result>,
  run(code, options)     → Promise<Result>,
}
```

---

## Examples

### Syntax-check JavaScript before saving

```js
MajixCompiler.compile('javascript', userCode).then(function (r) {
  if (r.status === 'error') {
    alert('Syntax error: ' + r.stderr);
  } else {
    saveCode(userCode);
  }
});
```

### Render HTML preview

```js
MajixCompiler.run('html', htmlCode).then(function (r) {
  if (r.status === 'ok') {
    document.getElementById('preview-frame').src = r.output; // blob URL
  }
});
```

### Run Python on a server

```js
window.COMPILER_CONFIG = { apiEndpoint: 'https://api.example.com/compile' };
MajixCompiler.init();

MajixCompiler.run('python', 'print(sum(range(10)))').then(function (r) {
  console.log(r.stdout);  // "45"
});
```

### Inline custom adapter (Markdown formatter example)

```js
MajixCompiler.register('markdown', {
  canRun: true,
  run: function (code) {
    // A simple placeholder — swap in a real Markdown parser
    return Promise.resolve({
      language: 'markdown',
      status:   'ok',
      stdout:   code.replace(/^# (.+)$/m, '<h1>$1</h1>'),
      stderr:   '',
      exitCode: 0,
      elapsed:  0,
      output:   null,
      error:    null,
    });
  },
}, ['md']);
```

### onCompile callback for telemetry

```js
window.COMPILER_CONFIG = {
  onCompile: function (result) {
    analytics.track('compile', {
      language: result.language,
      status:   result.status,
      elapsed:  result.elapsed,
    });
  },
};
```
