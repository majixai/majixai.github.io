# /cos — Cosine Calculations of Any Order in N-Space

Shared library for computing cosine of **any order** in **any number of dimensions** across the entire MajixAI GitHub Pages site.  Plug it into any sub-directory with one `<script>` tag.

---

## Files

| File | Purpose |
|------|---------|
| `cos-core.js` | Core library — global `MajixCos` object (IIFE, no ES modules required) |
| `index.html` | Interactive demo — Taylor series, vector/tensor cosine, Gram matrix, decomposition, and more |
| `sw.js` | PWA service worker (delegates to `/pwa/sw-core.js`) |
| `manifest.json` | PWA manifest |

---

## Quick start

```html
<!-- 1. Optionally configure before loading -->
<script>
  window.COS_CONFIG = {
    defaultSeriesOrder: 12,   // Taylor-series terms (default: 10)
    precision: 1e-14,         // numerical zero threshold (default: 1e-14)
  };
</script>

<!-- 2. Load the library -->
<script src="/cos/cos-core.js"></script>

<!-- 3. Use MajixCos anywhere -->
<script>
  const sim = MajixCos.cosVec([1, 0, 0], [0, 1, 0]); // 0 (orthogonal)
  const ang = MajixCos.cosAngle([1, 1], [1, 0]);       // π/4 ≈ 0.7854 rad
</script>
```

---

## API Reference

### Initialisation

```js
MajixCos.init([config])
```

Apply / merge configuration.  Called automatically at load time if `window.COS_CONFIG` is defined.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultSeriesOrder` | `number` | `10` | Default number of Taylor-series terms |
| `precision` | `number` | `1e-14` | Numerical zero threshold for norm guards |

---

### Taylor series — cos(x) to any order

```js
MajixCos.cosSeries(x, order)
```

Approximates **cos(x)** using the Taylor series:

```
cos(x) = Σ_{k=0}^{order} (-1)^k · x^(2k) / (2k)!
```

| Param | Type | Description |
|-------|------|-------------|
| `x` | `number` | Angle in radians |
| `order` | `number?` | Number of terms (default `defaultSeriesOrder`) |

Returns `number`.

```js
MajixCos.cosSeriesError(x, order)  // relative error vs Math.cos()
```

---

### Cosine similarity in n-space

```js
MajixCos.cosVec(a, b)         // similarity ∈ [-1, 1]
MajixCos.cosAngle(a, b)       // angle (radians) ∈ [0, π]
MajixCos.cosDistance(a, b)    // 1 − similarity ∈ [0, 2]
```

Works for any dimension `n ≥ 1`.  Returns `0` when either vector is the zero vector.

---

### Higher-order tensor cosine

```js
MajixCos.cosTensor(A, B)
```

Generalised cosine for tensors of **any rank** (order-1 = vectors, order-2 = matrices, order-k = k-tensors).  Uses the Frobenius inner product after flattening:

```
cos(A, B) = ⟨A, B⟩_F / (‖A‖_F · ‖B‖_F)
```

```js
// 2-D matrix (order-2 tensor) in ℝ^{2×3}
MajixCos.cosTensor([[1,2,3],[4,5,6]], [[7,8,9],[1,2,3]]);
```

---

### Generalised dot product & norm

```js
MajixCos.dot(A, B)          // element-wise inner product (flattened)
MajixCos.norm(v, p)         // Lp norm (p=2 Euclidean, p=1 Manhattan, p=Infinity Chebyshev)
```

---

### Projections & decompositions

```js
MajixCos.project(direction, v)
// → number[]  (projection of v onto direction)

MajixCos.decompose(v, direction)
// → { parallel: number[], perpendicular: number[] }
```

---

### Gram matrix & batch similarity

```js
MajixCos.gram(vectors)               // m×m pairwise cosine matrix
MajixCos.batchCosSimilarity(matrix)  // alias for gram()
```

---

### Direction cosines & axis angles

```js
MajixCos.directionCosines(v)  // unit vector components (one cosine per axis)
MajixCos.axisAngles(v)        // angle (radians) to each coordinate axis
```

The **direction cosines** of v are the cosines of the angles between v and each
coordinate axis — equal to the components of the unit vector v̂ = v / ‖v‖.

---

### Weighted & soft cosine

```js
MajixCos.weightedCosVec(a, b, weights)
// Rescales each dimension before cosine — useful for feature-weighted similarity

MajixCos.softCosSimilarity(a, b, S)
// Uses a feature-similarity matrix S to account for inter-dimension correlations
```

---

### Tensor metadata

```js
MajixCos.tensorOrder(T)   // rank/order of a nested array (1, 2, 3, …)
MajixCos.tensorShape(T)   // shape array, e.g. [3, 4] for a 3×4 matrix
```

---

## Examples

### Taylor series convergence

```js
const x = Math.PI / 4;

for (let order = 1; order <= 10; order++) {
  const approx = MajixCos.cosSeries(x, order);
  const err    = MajixCos.cosSeriesError(x, order);
  console.log(`order ${order}: ${approx.toFixed(10)}  error=${err.toExponential(2)}`);
}
```

### High-dimensional cosine similarity

```js
// 1000-dimensional vectors
const n = 1000;
const a = Array.from({ length: n }, () => Math.random() - 0.5);
const b = Array.from({ length: n }, () => Math.random() - 0.5);

console.log(MajixCos.cosVec(a, b));    // ~0 for random high-dim vectors
console.log(MajixCos.cosAngle(a, b));  // ~π/2
```

### 3-D tensor cosine

```js
// Two 2×2×3 tensors
const T1 = [[[1,2,3],[4,5,6]],[[7,8,9],[0,1,2]]];
const T2 = [[[9,8,7],[6,5,4]],[[3,2,1],[9,0,1]]];

console.log(MajixCos.cosTensor(T1, T2));  // Frobenius cosine similarity
console.log(MajixCos.tensorOrder(T1));    // 3
console.log(MajixCos.tensorShape(T1));    // [2, 2, 3]
```

### Gram matrix

```js
const vecs = [[1,0,0],[0,1,0],[0,0,1],[1,1,0]];
const G = MajixCos.gram(vecs);
// G[0][3] = cosVec([1,0,0],[1,1,0]) = 1/√2 ≈ 0.7071
```

---

## Integration with other MajixAI libraries

`/cos/cos-core.js` is a standalone global script — no dependency on ES modules.
It works alongside:

- **`/tensor/`** — use `MajixCos.cosTensor()` to compare financial feature tensors
- **`/events/`** — emit cosine computation results via `MajixEvents`
- **`/pwa/`** — offline caching via `sw.js` + `/pwa/sw-core.js`

---

## Mathematical background

| Concept | Formula |
|---------|---------|
| Cosine similarity (vectors) | cos(θ) = (a · b) / (‖a‖ · ‖b‖) |
| Cosine (Taylor series, N terms) | Σ_{k=0}^{N} (−1)^k x^{2k} / (2k)! |
| Frobenius cosine (tensors) | ⟨A,B⟩_F / (‖A‖_F · ‖B‖_F) |
| Direction cosines (n-space) | cos αᵢ = vᵢ / ‖v‖ |
| Soft cosine | ⟨a,b⟩_S / √(⟨a,a⟩_S · ⟨b,b⟩_S) |
| Projection of b onto a | (a · b / ‖a‖²) · a |
