# hash — SHA-256 Module

A lightweight SHA-256 utility for **majixai.github.io** built on the browser's
native `crypto.subtle` (Web Crypto API).  It is the **canonical hashing module**
for the site and is tightly integrated with `/router/router.js`, which uses it to
attach a stable fingerprint to every route entry at startup.

---

## Files

| File | Purpose |
|---|---|
| `hash.js` | Core ES module — `sha256`, `hashContent`, `hashRoute`, `verifyHash` |
| `index.html` | Interactive SHA-256 calculator + route-fingerprint browser |
| `README.md` | This file |

---

## API (`hash/hash.js`)

```js
import { sha256, hashContent, hashRoute, verifyHash } from '/hash/hash.js';
```

### `sha256(input)` → `Promise<string>`

Compute the SHA-256 hex digest of any string, `ArrayBuffer`, or `Uint8Array`.

```js
const hex = await sha256('hello world');
// → 'b94d27b9934d3e08a52e52d7da7dabfa...'
```

### `hashContent(content)` → `Promise<string>`

Alias of `sha256`.  Use this when hashing arbitrary file or page content.

```js
const hex = await hashContent(someArrayBuffer);
```

### `hashRoute(route)` → `Promise<string>`

Generate a stable fingerprint for a route entry.  The digest is derived from
the route's `path` and `name` fields only (both lower-cased), so it is
independent of mutable metadata like `lastUpdated`.

```js
const hex = await hashRoute({ path: '/best/', name: 'best' });
```

### `verifyHash(input, expected)` → `Promise<boolean>`

Confirm that `input` hashes to the given `expected` digest (case-insensitive).

```js
const ok = await verifyHash('hello world', hex); // true
```

---

## Router integration

`/router/router.js` imports `hashRoute` from this module and calls it for every
route during initialisation.  The computed digests are stored in a private `Map`
and exposed via:

```js
import router from '/router/router.js';
await router.ready();
const hex = router.getRouteHash('/best/');  // 64-char hex string or null
```

---

## Usage in new directories / files

Every new directory or file added to the site going forward should import from
this module whenever SHA-256 hashing is needed:

```js
import { sha256, hashContent } from '/hash/hash.js';
```

This ensures a single consistent hashing implementation across the codebase.

---

## Requirements

The module requires a **secure context** (HTTPS or `localhost`) because
`crypto.subtle` is only available under those conditions.  GitHub Pages always
serves over HTTPS, so this is satisfied in production.
