/**
 * MajixAI SHA-256 Hash Module  (/hash/hash.js)
 *
 * Canonical SHA-256 utility for majixai.github.io.
 * Intended to be imported by every new directory/file going forward and is
 * tightly integrated with /router/router.js for route-integrity fingerprints.
 *
 * Requires a secure context (HTTPS or localhost) because it relies on the
 * Web Crypto API (crypto.subtle), which is universally available on GitHub Pages.
 *
 * Usage (ES module):
 *   import { sha256, hashRoute, hashContent, verifyHash } from '/hash/hash.js';
 *
 *   const hex  = await sha256('hello world');
 *   const rhex = await hashRoute({ path: '/best/', name: 'best' });
 *   const ok   = await verifyHash('hello world', hex);
 *
 * Usage (classic script — object attached to window.MajixHash):
 *   <script type="module" src="/hash/hash.js"></script>
 *   const hex = await window.MajixHash.sha256('hello world');
 */

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Encode a string to a Uint8Array (UTF-8).
 * @param {string} str
 * @returns {Uint8Array}
 */
function _encode(str) {
  return new TextEncoder().encode(String(str));
}

/**
 * Convert an ArrayBuffer to a lowercase hex string.
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
function _bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Assert that crypto.subtle is available and throw a descriptive error if not.
 * @throws {Error}
 */
function _assertSubtle() {
  if (
    typeof crypto === 'undefined' ||
    typeof crypto.subtle === 'undefined' ||
    typeof crypto.subtle.digest !== 'function'
  ) {
    throw new Error(
      '[hash.js] crypto.subtle is not available. ' +
      'Ensure the page is served over HTTPS or localhost.'
    );
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hex digest of any string or binary input.
 *
 * @param {string|ArrayBuffer|Uint8Array} input
 * @returns {Promise<string>}  Lowercase hex string (64 characters).
 */
export async function sha256(input) {
  _assertSubtle();
  const data =
    typeof input === 'string'
      ? _encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return _bufToHex(buf);
}

/**
 * Alias of `sha256` — hash arbitrary text/binary content.
 *
 * @param {string|ArrayBuffer|Uint8Array} content
 * @returns {Promise<string>}
 */
export async function hashContent(content) {
  return sha256(content);
}

/**
 * Compute a stable, canonical SHA-256 fingerprint for a route entry.
 * The fingerprint is derived from the route's `path` and `name` fields
 * (both normalised to lower-case), making it deterministic and independent
 * of mutable metadata like `lastUpdated`.
 *
 * @param {{ path: string, name: string }} route
 * @returns {Promise<string>}  Lowercase hex string (64 characters).
 */
export async function hashRoute(route) {
  if (!route || typeof route.path !== 'string' || typeof route.name !== 'string') {
    throw new TypeError(
      '[hash.js] hashRoute expects an object with string path and name fields.'
    );
  }
  const canonical = JSON.stringify({
    path: route.path.toLowerCase(),
    name: route.name.toLowerCase(),
  });
  return sha256(canonical);
}

/**
 * Verify that `input` hashes to the given `expected` hex digest.
 *
 * @param {string|ArrayBuffer|Uint8Array} input
 * @param {string} expected  Hex digest to compare against (case-insensitive).
 * @returns {Promise<boolean>}
 */
export async function verifyHash(input, expected) {
  const actual = await sha256(input);
  return actual === String(expected).toLowerCase();
}

// ─── Default export (convenience object) ─────────────────────────────────────

const hasher = { sha256, hashContent, hashRoute, verifyHash };
export default hasher;

// ─── Window attachment for non-module contexts ────────────────────────────────
if (typeof window !== 'undefined') {
  window.MajixHash = hasher;
}
