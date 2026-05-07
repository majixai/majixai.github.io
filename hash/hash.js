/**
 * MajixAI SHA-256 Toolkit  (/hash/hash.js)
 *
 * Canonical SHA-256 utility module for majixai.github.io.
 *
 * This module intentionally centralizes hashing behavior for all directories and
 * files in the repository going forward. It is tightly integrated with
 * /router/router.js and provides deterministic canonicalization helpers,
 * manifest utilities, batch hashing, and verification primitives.
 *
 * Design goals:
 *   1) Deterministic output across browsers.
 *   2) Safe-by-default normalization and canonicalization.
 *   3) Small, dependency-free implementation using Web Crypto only.
 *   4) Backward compatibility with earlier exports:
 *      - sha256
 *      - hashContent
 *      - hashRoute
 *      - verifyHash
 *
 * Requires secure context for crypto.subtle (HTTPS/localhost).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const HASH_ALGORITHM = 'SHA-256';
export const DIGEST_HEX_LENGTH = 64;
export const DIGEST_BYTES = 32;

const ROUTE_HASH_VERSION = 'route-hash:v1';

// ─────────────────────────────────────────────────────────────────────────────
// Environment / assertions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @throws {Error}
 */
function assertSubtle() {
  if (
    typeof crypto === 'undefined' ||
    typeof crypto.subtle === 'undefined' ||
    typeof crypto.subtle.digest !== 'function'
  ) {
    throw new Error(
      '[hash.js] crypto.subtle is not available. ' +
      'Serve from HTTPS or localhost.'
    );
  }
}

/**
 * @returns {TextEncoder}
 */
function getTextEncoder() {
  if (typeof TextEncoder === 'undefined') {
    throw new Error('[hash.js] TextEncoder is unavailable in this environment.');
  }
  return new TextEncoder();
}

/**
 * @returns {TextDecoder}
 */
function getTextDecoder() {
  if (typeof TextDecoder === 'undefined') {
    throw new Error('[hash.js] TextDecoder is unavailable in this environment.');
  }
  return new TextDecoder();
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guards / conversion helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {*} v
 * @returns {boolean}
 */
function isArrayBufferView(v) {
  return v && typeof v === 'object' && ArrayBuffer.isView(v);
}

/**
 * @param {*} v
 * @returns {boolean}
 */
function isBlobLike(v) {
  return typeof Blob !== 'undefined' && v instanceof Blob;
}

/**
 * Convert ArrayBuffer / TypedArray to Uint8Array.
 *
 * @param {ArrayBuffer|DataView|TypedArray|Uint8Array} input
 * @returns {Uint8Array}
 */
function asUint8(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (isArrayBufferView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError('[hash.js] Expected binary input (ArrayBuffer/TypedArray).');
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const clean = String(hex || '').trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new TypeError('[hash.js] Invalid hex digest.');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * @param {string} b64
 * @returns {Uint8Array}
 */
function base64ToBytes(b64) {
  const binary = atob(String(b64));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * @param {string} b64url
 * @returns {Uint8Array}
 */
function base64UrlToBytes(b64url) {
  const padded = String(b64url)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const needed = (4 - (padded.length % 4)) % 4;
  return base64ToBytes(padded + '='.repeat(needed));
}

/**
 * Normalize text before hashing when requested.
 *
 * @param {string} text
 * @param {object} [opt]
 * @param {'NFC'|'NFD'|'NFKC'|'NFKD'|'none'} [opt.unicode='NFC']
 * @param {'preserve'|'lf'|'crlf'} [opt.lineEndings='preserve']
 * @param {boolean} [opt.trim=false]
 * @returns {string}
 */
export function normalizeText(text, opt = {}) {
  const {
    unicode = 'NFC',
    lineEndings = 'preserve',
    trim = false,
  } = opt;

  let out = String(text ?? '');

  if (unicode !== 'none' && typeof out.normalize === 'function') {
    out = out.normalize(unicode);
  }

  if (lineEndings === 'lf') {
    out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  } else if (lineEndings === 'crlf') {
    out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
  }

  if (trim) out = out.trim();
  return out;
}

/**
 * Convert supported input types into Uint8Array.
 *
 * @param {string|ArrayBuffer|TypedArray|DataView|Blob|Uint8Array} input
 * @param {object} [opt]
 * @param {string} [opt.encoding='utf-8']
 * @param {object} [opt.normalize]
 * @returns {Promise<Uint8Array>}
 */
async function inputToBytes(input, opt = {}) {
  const { encoding = 'utf-8', normalize } = opt;

  if (typeof input === 'string') {
    const text = normalize ? normalizeText(input, normalize) : input;
    if (encoding.toLowerCase() !== 'utf-8' && encoding.toLowerCase() !== 'utf8') {
      throw new TypeError('[hash.js] Only utf-8 encoding is currently supported.');
    }
    return getTextEncoder().encode(text);
  }

  if (isBlobLike(input)) {
    const buf = await input.arrayBuffer();
    return new Uint8Array(buf);
  }

  return asUint8(input);
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonicalization helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable sort object keys recursively.
 *
 * @param {*} value
 * @param {WeakSet<object>} [seen]
 * @returns {*}
 */
function canonicalizeValue(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'bigint') return value.toString();
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    return value;
  }

  if (seen.has(value)) {
    throw new TypeError('[hash.js] Cannot canonicalize circular structures.');
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(v => canonicalizeValue(v, seen));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Set) {
    return Array.from(value).map(v => canonicalizeValue(v, seen)).sort();
  }

  if (value instanceof Map) {
    const entries = Array.from(value.entries()).map(([k, v]) => [String(k), canonicalizeValue(v, seen)]);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return Object.fromEntries(entries);
  }

  const out = {};
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    out[key] = canonicalizeValue(value[key], seen);
  }
  return out;
}

/**
 * Stable JSON serialization helper.
 *
 * @param {*} value
 * @param {number} [space=0]
 * @returns {string}
 */
export function toCanonicalJson(value, space = 0) {
  return JSON.stringify(canonicalizeValue(value), null, space);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core digest functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Digest bytes with SHA-256.
 *
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
async function digestBytes(bytes) {
  assertSubtle();
  const buffer = await crypto.subtle.digest(HASH_ALGORITHM, bytes);
  return new Uint8Array(buffer);
}

/**
 * @typedef {'hex'|'base64'|'base64url'|'bytes'} HashOutputFormat
 */

/**
 * Convert digest bytes into requested output format.
 *
 * @param {Uint8Array} bytes
 * @param {HashOutputFormat} output
 * @returns {string|Uint8Array}
 */
function formatDigest(bytes, output) {
  if (output === 'bytes') return bytes;
  if (output === 'base64') return bytesToBase64(bytes);
  if (output === 'base64url') return bytesToBase64Url(bytes);
  return bytesToHex(bytes);
}

/**
 * Generic SHA-256 function.
 *
 * @param {string|ArrayBuffer|TypedArray|DataView|Blob|Uint8Array} input
 * @param {object} [opt]
 * @param {HashOutputFormat} [opt.output='hex']
 * @param {string} [opt.encoding='utf-8']
 * @param {object} [opt.normalize]
 * @returns {Promise<string|Uint8Array>}
 */
export async function sha256(input, opt = {}) {
  const {
    output = 'hex',
    encoding = 'utf-8',
    normalize,
  } = opt;

  const bytes = await inputToBytes(input, { encoding, normalize });
  const digest = await digestBytes(bytes);
  return formatDigest(digest, output);
}

/**
 * Backward-compatible alias.
 *
 * @param {string|ArrayBuffer|TypedArray|DataView|Blob|Uint8Array} content
 * @param {object} [opt]
 * @returns {Promise<string|Uint8Array>}
 */
export async function hashContent(content, opt = {}) {
  return sha256(content, opt);
}

/**
 * SHA-256 hex convenience helper.
 *
 * @param {string|ArrayBuffer|TypedArray|DataView|Blob|Uint8Array} input
 * @param {object} [opt]
 * @returns {Promise<string>}
 */
export async function sha256Hex(input, opt = {}) {
  return /** @type {Promise<string>} */ (sha256(input, { ...opt, output: 'hex' }));
}

/**
 * SHA-256 base64 convenience helper.
 *
 * @param {string|ArrayBuffer|TypedArray|DataView|Blob|Uint8Array} input
 * @param {object} [opt]
 * @returns {Promise<string>}
 */
export async function sha256Base64(input, opt = {}) {
  return /** @type {Promise<string>} */ (sha256(input, { ...opt, output: 'base64' }));
}

/**
 * SHA-256 base64url convenience helper.
 *
 * @param {string|ArrayBuffer|TypedArray|DataView|Blob|Uint8Array} input
 * @param {object} [opt]
 * @returns {Promise<string>}
 */
export async function sha256Base64Url(input, opt = {}) {
  return /** @type {Promise<string>} */ (sha256(input, { ...opt, output: 'base64url' }));
}

/**
 * SHA-256 raw-bytes convenience helper.
 *
 * @param {string|ArrayBuffer|TypedArray|DataView|Blob|Uint8Array} input
 * @param {object} [opt]
 * @returns {Promise<Uint8Array>}
 */
export async function sha256Bytes(input, opt = {}) {
  return /** @type {Promise<Uint8Array>} */ (sha256(input, { ...opt, output: 'bytes' }));
}

/**
 * Hash canonical JSON payload.
 *
 * @param {*} value
 * @param {object} [opt]
 * @param {HashOutputFormat} [opt.output='hex']
 * @param {number} [opt.space=0]
 * @returns {Promise<string|Uint8Array>}
 */
export async function hashJson(value, opt = {}) {
  const {
    output = 'hex',
    space = 0,
  } = opt;
  const canonical = toCanonicalJson(value, space);
  return sha256(canonical, { output, normalize: { unicode: 'NFC', lineEndings: 'lf', trim: false } });
}

/**
 * Backward-compatible route hash helper.
 *
 * @param {{path:string,name:string,category?:string,desc?:string}} route
 * @param {object} [opt]
 * @param {boolean} [opt.includeCategory=false]
 * @param {boolean} [opt.includeDescription=false]
 * @param {HashOutputFormat} [opt.output='hex']
 * @returns {Promise<string|Uint8Array>}
 */
export async function hashRoute(route, opt = {}) {
  if (!route || typeof route.path !== 'string' || typeof route.name !== 'string') {
    throw new TypeError('[hash.js] hashRoute expects string `path` and `name` fields.');
  }

  const {
    includeCategory = false,
    includeDescription = false,
    output = 'hex',
  } = opt;

  const payload = {
    version: ROUTE_HASH_VERSION,
    path: route.path.trim().toLowerCase(),
    name: route.name.trim().toLowerCase(),
  };

  if (includeCategory) {
    payload.category = String(route.category || '').trim().toLowerCase();
  }
  if (includeDescription) {
    payload.desc = String(route.desc || '').trim();
  }

  return hashJson(payload, { output });
}

/**
 * Hash File/Blob contents.
 *
 * @param {Blob} blob
 * @param {object} [opt]
 * @returns {Promise<string|Uint8Array>}
 */
export async function hashBlob(blob, opt = {}) {
  if (!isBlobLike(blob)) {
    throw new TypeError('[hash.js] hashBlob expects a Blob/File object.');
  }
  return sha256(blob, opt);
}

/**
 * Alias for clarity in UI callers.
 *
 * @param {File} file
 * @param {object} [opt]
 * @returns {Promise<string|Uint8Array>}
 */
export async function hashFile(file, opt = {}) {
  return hashBlob(file, opt);
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification / comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constant-time byte equality helper.
 *
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {boolean}
 */
function timingSafeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] ^ b[i]);
  }
  return diff === 0;
}

/**
 * Compare digests in supported formats.
 *
 * @param {string} actual
 * @param {string} expected
 * @param {object} [opt]
 * @param {'hex'|'base64'|'base64url'} [opt.format='hex']
 * @param {boolean} [opt.timingSafe=true]
 * @returns {boolean}
 */
export function equalsDigest(actual, expected, opt = {}) {
  const {
    format = 'hex',
    timingSafe = true,
  } = opt;

  const a = String(actual || '').trim();
  const e = String(expected || '').trim();

  if (!timingSafe) {
    return a.toLowerCase() === e.toLowerCase();
  }

  try {
    let ab;
    let eb;
    if (format === 'base64') {
      ab = base64ToBytes(a);
      eb = base64ToBytes(e);
    } else if (format === 'base64url') {
      ab = base64UrlToBytes(a);
      eb = base64UrlToBytes(e);
    } else {
      ab = hexToBytes(a.toLowerCase());
      eb = hexToBytes(e.toLowerCase());
    }
    return timingSafeEqualBytes(ab, eb);
  } catch (_) {
    return false;
  }
}

/**
 * Verify input against expected digest.
 *
 * @param {string|ArrayBuffer|TypedArray|DataView|Blob|Uint8Array} input
 * @param {string} expected
 * @param {object} [opt]
 * @param {'hex'|'base64'|'base64url'} [opt.format='hex']
 * @param {boolean} [opt.timingSafe=true]
 * @param {string} [opt.encoding='utf-8']
 * @param {object} [opt.normalize]
 * @returns {Promise<boolean>}
 */
export async function verifyHash(input, expected, opt = {}) {
  const {
    format = 'hex',
    timingSafe = true,
    encoding = 'utf-8',
    normalize,
  } = opt;

  const actual = await sha256(input, {
    output: format,
    encoding,
    normalize,
  });

  return equalsDigest(
    /** @type {string} */ (actual),
    expected,
    { format, timingSafe }
  );
}

/**
 * Verify canonical route digest.
 *
 * @param {{path:string,name:string,category?:string,desc?:string}} route
 * @param {string} expected
 * @param {object} [opt]
 * @returns {Promise<boolean>}
 */
export async function verifyRouteHash(route, expected, opt = {}) {
  const actual = await hashRoute(route, { ...opt, output: 'hex' });
  return equalsDigest(/** @type {string} */ (actual), expected, { format: 'hex', timingSafe: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch + manifest helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BatchHashItem
 * @property {string} key
 * @property {string|ArrayBuffer|TypedArray|DataView|Blob|Uint8Array} input
 */

/**
 * @typedef {Object} BatchHashResult
 * @property {string} key
 * @property {boolean} ok
 * @property {string=} digest
 * @property {string=} error
 */

/**
 * Hash many entries in bounded parallelism.
 *
 * @param {BatchHashItem[]} items
 * @param {object} [opt]
 * @param {number} [opt.concurrency=4]
 * @param {HashOutputFormat} [opt.output='hex']
 * @returns {Promise<BatchHashResult[]>}
 */
export async function hashBatch(items, opt = {}) {
  const {
    concurrency = 4,
    output = 'hex',
  } = opt;

  if (!Array.isArray(items)) {
    throw new TypeError('[hash.js] hashBatch expects an array of items.');
  }

  const out = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex;
      nextIndex += 1;
      const item = items[i];

      try {
        const digest = await sha256(item.input, { output });
        out[i] = { key: item.key, ok: true, digest: /** @type {string} */ (digest) };
      } catch (err) {
        out[i] = {
          key: item?.key ?? `item-${i}`,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  const n = Math.max(1, Math.min(32, Math.floor(concurrency)));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

/**
 * Build a deterministic manifest object from key/input entries.
 *
 * @param {BatchHashItem[]} items
 * @param {object} [opt]
 * @param {'hex'|'base64'|'base64url'} [opt.format='hex']
 * @param {number} [opt.concurrency=4]
 * @returns {Promise<{algorithm:string, format:string, generatedAt:string, entries:Record<string,string>}>}
 */
export async function createManifest(items, opt = {}) {
  const {
    format = 'hex',
    concurrency = 4,
  } = opt;

  const hashed = await hashBatch(items, { output: format, concurrency });
  const entries = {};
  for (const row of hashed) {
    if (row.ok && typeof row.digest === 'string') {
      entries[row.key] = row.digest;
    }
  }

  const sortedEntries = Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))
  );

  return {
    algorithm: HASH_ALGORITHM,
    format,
    generatedAt: new Date().toISOString(),
    entries: sortedEntries,
  };
}

/**
 * Verify a digest manifest against resolved live inputs.
 *
 * @param {{algorithm?:string, format?:'hex'|'base64'|'base64url', entries:Record<string,string>}} manifest
 * @param {(key:string)=>Promise<string|ArrayBuffer|TypedArray|DataView|Blob|Uint8Array>} resolver
 * @param {object} [opt]
 * @param {number} [opt.concurrency=4]
 * @returns {Promise<{ok:boolean, checked:number, matched:number, mismatched:string[], errors:Record<string,string>}>}
 */
export async function verifyManifest(manifest, resolver, opt = {}) {
  if (!manifest || typeof manifest !== 'object' || !manifest.entries) {
    throw new TypeError('[hash.js] verifyManifest expects a manifest with entries.');
  }
  if (typeof resolver !== 'function') {
    throw new TypeError('[hash.js] verifyManifest expects an async resolver(key).');
  }

  const format = manifest.format || 'hex';
  const keys = Object.keys(manifest.entries);
  const mismatched = [];
  const errors = {};
  let matched = 0;

  const items = keys.map(key => ({ key, input: key }));
  let nextIndex = 0;
  const concurrency = Math.max(1, Math.min(32, Math.floor(opt.concurrency ?? 4)));

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex;
      nextIndex += 1;
      const key = items[i].key;

      try {
        const liveInput = await resolver(key);
        const ok = await verifyHash(liveInput, manifest.entries[key], { format, timingSafe: true });
        if (ok) matched += 1;
        else mismatched.push(key);
      } catch (err) {
        errors[key] = err instanceof Error ? err.message : String(err);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const checked = keys.length;
  const ok = mismatched.length === 0 && Object.keys(errors).length === 0;
  return {
    ok,
    checked,
    matched,
    mismatched: mismatched.sort((a, b) => a.localeCompare(b)),
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers for interop / debugging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert digest string in known format to another format.
 *
 * @param {string} digest
 * @param {'hex'|'base64'|'base64url'} from
 * @param {'hex'|'base64'|'base64url'} to
 * @returns {string}
 */
export function convertDigestFormat(digest, from, to) {
  if (from === to) return String(digest);

  let bytes;
  if (from === 'hex') bytes = hexToBytes(String(digest).toLowerCase());
  else if (from === 'base64') bytes = base64ToBytes(String(digest));
  else bytes = base64UrlToBytes(String(digest));

  if (to === 'hex') return bytesToHex(bytes);
  if (to === 'base64') return bytesToBase64(bytes);
  return bytesToBase64Url(bytes);
}

/**
 * Decode bytes as UTF-8 text.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function decodeUtf8(bytes) {
  return getTextDecoder().decode(asUint8(bytes));
}

/**
 * Encode text as UTF-8 bytes.
 *
 * @param {string} text
 * @returns {Uint8Array}
 */
export function encodeUtf8(text) {
  return getTextEncoder().encode(String(text));
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export + window attachment
// ─────────────────────────────────────────────────────────────────────────────

const hasher = {
  HASH_ALGORITHM,
  DIGEST_HEX_LENGTH,
  DIGEST_BYTES,

  normalizeText,
  toCanonicalJson,

  sha256,
  sha256Hex,
  sha256Base64,
  sha256Base64Url,
  sha256Bytes,

  hashContent,
  hashJson,
  hashRoute,
  hashBlob,
  hashFile,

  verifyHash,
  verifyRouteHash,
  equalsDigest,

  hashBatch,
  createManifest,
  verifyManifest,

  convertDigestFormat,
  encodeUtf8,
  decodeUtf8,
};

export default hasher;

if (typeof window !== 'undefined') {
  window.MajixHash = hasher;
}
