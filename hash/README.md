# hash — MajixAI SHA-256 Toolkit

The `hash/` directory is the canonical, shared hashing foundation for this repository.
It standardizes SHA-256 behavior for all current and future modules, and it is tightly
integrated with the router for deterministic route fingerprints and integrity checks.

> **Policy:** New directories/files that need hashing should import from
> `/hash/hash.js` instead of implementing custom hashing logic.

---

## Table of contents

1. [Why this module exists](#why-this-module-exists)
2. [Directory layout](#directory-layout)
3. [Quick start](#quick-start)
4. [Core principles](#core-principles)
5. [API reference](#api-reference)
   - [Constants](#constants)
   - [Normalization and canonicalization](#normalization-and-canonicalization)
   - [Core SHA-256 functions](#core-sha-256-functions)
   - [Route hashing and verification](#route-hashing-and-verification)
   - [File, batch, and manifest utilities](#file-batch-and-manifest-utilities)
   - [Digest comparison and format conversion](#digest-comparison-and-format-conversion)
6. [Router integration](#router-integration)
7. [Hash Suite UI (`hash/index.html`)](#hash-suite-ui-hashindexhtml)
8. [Manifest workflow examples](#manifest-workflow-examples)
9. [Security notes](#security-notes)
10. [Performance notes](#performance-notes)
11. [Migration notes](#migration-notes)
12. [Troubleshooting](#troubleshooting)
13. [Conventions for future contributors](#conventions-for-future-contributors)

---

## Why this module exists

Historically, many codebases accumulate ad-hoc hash snippets. That causes subtle issues:

- Different encodings or normalization defaults.
- Inconsistent output formats (hex vs base64 vs base64url).
- Non-deterministic object hashing due to unsorted JSON keys.
- Fragile route fingerprint logic spread across pages.

`/hash/hash.js` solves this by providing one canonical API that is deterministic,
well-scoped, and dependency-free.

---

## Directory layout

| File | Purpose |
|---|---|
| `hash.js` | Core toolkit (SHA-256, canonical JSON, route hashing, verify, batch, manifests) |
| `index.html` | Interactive Hash Suite UI for text/JSON/files/batch/routes/manifest verification |
| `README.md` | Documentation and implementation contract |

---

## Quick start

```js
import {
  sha256,
  hashJson,
  hashRoute,
  verifyHash,
  createManifest,
  verifyManifest,
} from '/hash/hash.js';

const digest = await sha256('hello world');
const jsonDigest = await hashJson({ b: 2, a: 1 });
const routeDigest = await hashRoute({ path: '/best/', name: 'best' });
const ok = await verifyHash('hello world', digest);
```

Router usage:

```js
import router from '/router/router.js';

await router.ready();
const hash = router.getRouteHash('/best/');
const all = router.getRouteHashes();
const manifest = router.exportRouteHashManifest();
const integrity = await router.verifyRouteIntegrity();
```

---

## Core principles

1. **Single source of truth**
   - All hashing should route through `/hash/hash.js`.
2. **Determinism first**
   - Canonical JSON and normalized text reduce cross-environment drift.
3. **No external dependencies**
   - Uses native Web Crypto (`crypto.subtle`) only.
4. **Backwards compatibility**
   - Existing usage of `sha256`, `hashContent`, `hashRoute`, `verifyHash` remains valid.
5. **Router integrity by default**
   - Route hash generation and verification are built-in.

---

## API reference

### Constants

#### `HASH_ALGORITHM`

```js
HASH_ALGORITHM === 'SHA-256'
```

#### `DIGEST_HEX_LENGTH`

```js
DIGEST_HEX_LENGTH === 64
```

#### `DIGEST_BYTES`

```js
DIGEST_BYTES === 32
```

---

### Normalization and canonicalization

#### `normalizeText(text, options)`

Normalize plain text before hashing.

Options:

- `unicode`: `'NFC' | 'NFD' | 'NFKC' | 'NFKD' | 'none'` (default `'NFC'`)
- `lineEndings`: `'preserve' | 'lf' | 'crlf'` (default `'preserve'`)
- `trim`: `boolean` (default `false`)

```js
const normalized = normalizeText(input, {
  unicode: 'NFC',
  lineEndings: 'lf',
  trim: true,
});
```

#### `toCanonicalJson(value, space = 0)`

Produces stable JSON by recursively sorting object keys and normalizing supported
container types (Map/Set/Date, etc.).

```js
const stable = toCanonicalJson({ b: 2, a: 1 });
// => '{"a":1,"b":2}'
```

---

### Core SHA-256 functions

#### `sha256(input, options)`

Generic hashing function.

Input types supported:

- `string`
- `ArrayBuffer`
- typed arrays / `DataView`
- `Blob` / `File`

Options:

- `output`: `'hex' | 'base64' | 'base64url' | 'bytes'` (default `'hex'`)
- `encoding`: currently `'utf-8'` only for string inputs
- `normalize`: forwarded to `normalizeText` for string inputs

```js
const hex = await sha256('hello');
const b64 = await sha256('hello', { output: 'base64' });
```

#### `hashContent(content, options)`

Alias of `sha256` retained for compatibility.

#### Convenience helpers

- `sha256Hex(input, options)`
- `sha256Base64(input, options)`
- `sha256Base64Url(input, options)`
- `sha256Bytes(input, options)`

---

### Route hashing and verification

#### `hashRoute(route, options)`

Generates route fingerprint from deterministic canonical payload.

Required fields:

- `route.path` (string)
- `route.name` (string)

Optional include flags:

- `includeCategory` (default `false`)
- `includeDescription` (default `false`)

Output format:

- `output: 'hex' | 'base64' | 'base64url' | 'bytes'` (default `'hex'`)

Canonical payload includes a version marker (`route-hash:v1`) and lowercased
path/name.

```js
const digest = await hashRoute({ path: '/best/', name: 'best' });
```

#### `verifyRouteHash(route, expected, options)`

Verifies route digest against expected value.

```js
const ok = await verifyRouteHash(route, expectedHex);
```

---

### File, batch, and manifest utilities

#### `hashBlob(blob, options)` / `hashFile(file, options)`

Hashes browser `Blob`/`File` objects directly.

#### `hashBatch(items, options)`

Bounded-parallel hashing for many items.

Input shape:

```ts
type BatchHashItem = {
  key: string;
  input: string | ArrayBuffer | TypedArray | DataView | Blob | Uint8Array;
}
```

Options:

- `concurrency` (default `4`, clamped 1..32)
- `output` format

Returns result array preserving input order:

```js
[
  { key: 'a', ok: true, digest: '...' },
  { key: 'b', ok: false, error: '...' }
]
```

#### `createManifest(items, options)`

Creates sorted digest manifest object:

```json
{
  "algorithm": "SHA-256",
  "format": "hex",
  "generatedAt": "2026-...",
  "entries": {
    "alpha": "...",
    "beta": "..."
  }
}
```

#### `verifyManifest(manifest, resolver, options)`

Verifies manifest by resolving live input per key.

- `manifest.entries[key]` = expected digest
- `resolver(key)` => input to hash now

Returns summary:

- `ok`
- `checked`
- `matched`
- `mismatched[]`
- `errors{}`

---

### Digest comparison and format conversion

#### `verifyHash(input, expected, options)`

Verifies a computed digest against expected digest with optional timing-safe compare.

Options:

- `format`: `'hex' | 'base64' | 'base64url'` (default `'hex'`)
- `timingSafe`: `boolean` (default `true`)
- string normalization options where applicable

#### `equalsDigest(actual, expected, options)`

Direct digest-to-digest comparator.

#### `convertDigestFormat(digest, from, to)`

Converts digest between `hex`, `base64`, and `base64url`.

#### `encodeUtf8(text)` / `decodeUtf8(bytes)`

UTF-8 convenience helpers.

---

## Router integration

`router/router.js` consumes `hashRoute` and stores per-route digests in-memory.

### Router hash methods

- `router.getRouteHash(input)`
  - Returns hash for a route path or route name.
- `router.getRouteHashes()`
  - Returns all hashes as sorted plain object keyed by route path.
- `router.exportRouteHashManifest()`
  - Returns manifest payload with metadata and count.
- `router.verifyRouteIntegrity()`
  - Rehashes in-memory route objects and checks against stored values.

### Recommended usage pattern

```js
await router.ready();

const manifest = router.exportRouteHashManifest();
if (!manifest.count) {
  console.warn('No route hashes available yet.');
}

const integrity = await router.verifyRouteIntegrity();
if (!integrity.ok) {
  console.error('Route integrity issues:', integrity);
}
```

---

## Hash Suite UI (`hash/index.html`)

The page provides six sections:

1. **Text SHA-256**
   - format select, Unicode normalization, line ending strategy, trim option,
     expected digest verification.
2. **Canonical JSON Hash**
   - JSON parse/canonicalize/hash in one flow.
3. **File Hashing**
   - multi-file hashing with result table and manifest export.
4. **Batch Text Hashing**
   - `key|value` line format, parallel hashing, JSON output.
5. **Router Route Integrity**
   - inspect route hashes, filter list, run integrity verification.
6. **Manifest Verification**
   - validate pasted manifest + resolver map using `verifyManifest()`.

This UI is intentionally “ops friendly”: it doubles as both documentation and
runtime diagnostics surface.

---

## Manifest workflow examples

### Example A — Build a text manifest

```js
import { createManifest } from '/hash/hash.js';

const manifest = await createManifest([
  { key: 'intro', input: 'Hello world' },
  { key: 'about', input: 'MajixAI' },
]);
```

### Example B — Verify the manifest later

```js
import { verifyManifest } from '/hash/hash.js';

const result = await verifyManifest(manifest, async (key) => {
  const map = {
    intro: 'Hello world',
    about: 'MajixAI',
  };
  return map[key];
});
```

### Example C — Export route hash manifest

```js
import router from '/router/router.js';

await router.ready();
const routeManifest = router.exportRouteHashManifest();
```

---

## Security notes

1. **Secure context required**
   - `crypto.subtle` requires HTTPS or localhost.
2. **Timing-safe comparison support**
   - `verifyHash`/`equalsDigest` can compare in timing-safe mode.
3. **Do not treat raw hash as authentication**
   - For signed authenticity, use a proper signature/HMAC protocol.
4. **Canonicalization matters**
   - If producer and verifier normalize differently, digests can differ.
5. **Manifest trust boundary**
   - A manifest is only as trustworthy as its transport/source control process.

---

## Performance notes

- Batch and manifest utilities support bounded concurrency (1..32).
- File hashing reads file bytes and uses native digest implementation.
- Use compact canonical JSON for large payloads when readability is not required.
- Router route hashing is done once at initialization and reused via map lookups.

---

## Migration notes

If you already have custom SHA-256 helpers, migrate to this module:

1. Replace local hashing calls with `sha256` or convenience functions.
2. For object hashing, use `hashJson` instead of `JSON.stringify(obj)` + hash.
3. For route fingerprints, use `hashRoute` only.
4. Replace naive `===` comparisons with `verifyHash` where practical.
5. For collections, use `hashBatch` and optionally `createManifest`.

---

## Troubleshooting

### `crypto.subtle is not available`

- Ensure page runs under HTTPS or localhost.
- Confirm browser supports Web Crypto.

### JSON hashing throws circular structure error

- `toCanonicalJson` does not support cyclic object graphs.
- Pre-flatten or prune cyclic references first.

### File hashes differ from external tool

Check:

- output format mismatch (hex/base64/base64url)
- newline normalization assumptions
- hidden encoding conversions in external pipeline

### Route integrity mismatch

- Ensure route path/name values match canonical values used at initialization.
- Check for runtime mutation of route objects.

---

## Conventions for future contributors

1. **Always import from `/hash/hash.js` for SHA-256 work.**
2. **Prefer `hashJson` for object payloads.**
3. **Prefer `hashRoute` for route records and keep fields stable.**
4. **Use manifest helpers for reproducible multi-item checks.**
5. **If adding new hash-related UI, wire it to existing toolkit exports rather than duplicating logic.**
6. **Keep output deterministic and explicit about format + normalization.**

---

## Minimal usage snippets

### Text

```js
import { sha256 } from '/hash/hash.js';
const digest = await sha256('hello');
```

### JSON

```js
import { hashJson } from '/hash/hash.js';
const digest = await hashJson({ z: 1, a: 2 });
```

### File

```js
import { hashFile } from '/hash/hash.js';
const digest = await hashFile(file);
```

### Route

```js
import { hashRoute } from '/hash/hash.js';
const digest = await hashRoute({ path: '/hash/', name: 'hash' });
```

### Batch

```js
import { hashBatch } from '/hash/hash.js';
const rows = await hashBatch([
  { key: 'x', input: 'one' },
  { key: 'y', input: 'two' },
]);
```

### Manifest

```js
import { createManifest, verifyManifest } from '/hash/hash.js';

const manifest = await createManifest([
  { key: 'k1', input: 'payload-1' },
]);

const verification = await verifyManifest(manifest, async (key) => {
  if (key === 'k1') return 'payload-1';
  throw new Error('Unknown key');
});
```

---

## Final note

The `hash/` toolkit is intentionally broad so teams can solve most hashing,
verification, and deterministic digest needs in one place. Keep extending this
module carefully and compatibly so it remains a stable foundation across the
repository.
