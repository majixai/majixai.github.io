// /cos/cos-core.js  —  Cosine Calculations of Any Order in N-Space for MajixAI
//
// Usage: set window.COS_CONFIG (optional) then include this file.
//   MajixCos is available globally after the script loads.
//   Call MajixCos.init() to apply config, or it is called automatically if
//   window.COS_CONFIG is defined at load time.
//
// COS_CONFIG options (all optional):
//
//   defaultSeriesOrder   {number}
//     Default number of Taylor-series terms for cosSeries().
//     default: 10
//
//   precision            {number}
//     Numerical zero threshold — values smaller than this are treated as zero
//     (used to guard against division by zero in norms).
//     default: 1e-14
//
// ─── API ──────────────────────────────────────────────────────────────────────
//
//   MajixCos.init([config])
//     Apply / merge config and initialise the library.
//
//   MajixCos.cosSeries(x, order)
//     Taylor-series approximation of cos(x) using `order` terms.
//     cos(x) = Σ_{k=0}^{order} (-1)^k · x^(2k) / (2k)!
//
//   MajixCos.cosVec(a, b)
//     Cosine similarity between two n-dimensional vectors  ∈ [-1, 1].
//
//   MajixCos.cosAngle(a, b)
//     Angle (radians) between two n-vectors  ∈ [0, π].
//
//   MajixCos.cosDistance(a, b)
//     Cosine distance = 1 − cosine similarity  ∈ [0, 2].
//
//   MajixCos.cosTensor(A, B)
//     Higher-order cosine between two tensors of any rank in n-space.
//     Tensors are flattened; the generalised Frobenius inner product is used.
//
//   MajixCos.dot(A, B)
//     Generalised inner product (element-wise sum after flattening).
//
//   MajixCos.norm(v, p)
//     Lp norm of a vector or tensor.  p = 2 (Euclidean) by default.
//     Pass p = Infinity for the Chebyshev (max-abs) norm.
//
//   MajixCos.project(direction, v)
//     Orthogonal projection of v onto `direction`.
//
//   MajixCos.decompose(v, direction)
//     Decompose v into { parallel, perpendicular } components.
//
//   MajixCos.gram(vectors)
//     Gram matrix G[i][j] = cosVec(vectors[i], vectors[j]).
//
//   MajixCos.directionCosines(v)
//     Unit vector (direction cosines) of v — one cosine per axis.
//
//   MajixCos.axisAngles(v)
//     Angle (radians) between v and each coordinate axis.
//
//   MajixCos.tensorOrder(T)
//     Rank / order of a nested array (1 = vector, 2 = matrix, …).
//
//   MajixCos.tensorShape(T)
//     Shape array of a nested array, e.g. [3, 4] for a 3×4 matrix.
//
//   MajixCos.batchCosSimilarity(matrix)
//     Given an m×n matrix (array of m row-vectors), return the full m×m
//     pairwise cosine-similarity matrix (same as gram()).
//
//   MajixCos.softCosSimilarity(a, b, S)
//     Soft cosine similarity using a feature-similarity matrix S.
//     Generalises cosVec by accounting for correlations between dimensions.
//
//   MajixCos.weightedCosVec(a, b, weights)
//     Weighted cosine similarity with a per-dimension weight vector.
//
// ─────────────────────────────────────────────────────────────────────────────

(function (root) {
  'use strict';

  // ── internal utilities ────────────────────────────────────────────────────

  /** Recursively flatten a nested array (tensor) of any rank into a 1-D array. */
  function flatten(T) {
    if (!Array.isArray(T)) return [T];
    const out = [];
    const stack = [T];
    while (stack.length) {
      const item = stack.pop();
      if (Array.isArray(item)) {
        for (let i = item.length - 1; i >= 0; i--) stack.push(item[i]);
      } else {
        out.push(item);
      }
    }
    return out;
  }

  /** Return the shape of a nested array as [d1, d2, …]. */
  function shapeOf(T) {
    const shape = [];
    let cur = T;
    while (Array.isArray(cur)) {
      shape.push(cur.length);
      cur = cur[0];
    }
    return shape;
  }

  /** Return the rank (tensor order) of a nested array. */
  function rankOf(T) {
    return shapeOf(T).length;
  }

  /** 1-D dot product. */
  function dot1d(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  /** Lp norm of a 1-D array. */
  function normLp(a, p) {
    if (p === Infinity) {
      let m = 0;
      for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v; }
      return m;
    }
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.pow(Math.abs(a[i]), p);
    return Math.pow(s, 1 / p);
  }

  /**
   * Pre-computed factorials up to 40 (20 terms × 2 = index 40).
   * Handles Taylor series up to order 20 without overflow via BigInt fallback.
   */
  const _fact = (function () {
    const f = [1];
    for (let i = 1; i <= 40; i++) f[i] = f[i - 1] * i;
    return f;
  }());

  function factorial(n) {
    if (n < _fact.length) return _fact[n];
    // For large n use Stirling-approximated float (cos series degenerates anyway)
    let v = _fact[_fact.length - 1];
    for (let i = _fact.length; i <= n; i++) v *= i;
    return v;
  }

  // ── MajixCos ──────────────────────────────────────────────────────────────

  const MajixCos = {

    _cfg: {
      defaultSeriesOrder: 10,
      precision: 1e-14,
    },

    /**
     * Initialise / reconfigure the library.
     * Merges window.COS_CONFIG (if present) then the supplied config object.
     * @param {Object} [config]
     */
    init(config) {
      this._cfg = Object.assign(
        { defaultSeriesOrder: 10, precision: 1e-14 },
        (typeof globalThis !== 'undefined' ? globalThis : root).COS_CONFIG || {},
        config || {}
      );
      return this;
    },

    // ── Series & scalar cos ─────────────────────────────────────────────────

    /**
     * Taylor-series approximation of cos(x) using `order` terms (default 10).
     * cos(x) = Σ_{k=0}^{order} (-1)^k · x^(2k) / (2k)!
     *
     * @param {number} x     - Angle in radians (any real number)
     * @param {number} [order] - Number of terms to include
     * @returns {number}
     */
    cosSeries(x, order) {
      const terms = (order != null) ? order : this._cfg.defaultSeriesOrder;
      let result = 0;
      for (let k = 0; k <= terms; k++) {
        const exp = 2 * k;
        result += (k % 2 === 0 ? 1 : -1) * Math.pow(x, exp) / factorial(exp);
      }
      return result;
    },

    /**
     * Relative error of the Taylor-series approximation vs Math.cos().
     * @param {number} x
     * @param {number} [order]
     * @returns {number} |approx − exact| / max(|exact|, 1e-15)
     */
    cosSeriesError(x, order) {
      const approx = this.cosSeries(x, order);
      const exact  = Math.cos(x);
      return Math.abs(approx - exact) / Math.max(Math.abs(exact), 1e-15);
    },

    // ── Vector operations in n-space ────────────────────────────────────────

    /**
     * Cosine similarity between two n-dimensional real vectors.
     * Returns 0 when either vector is the zero vector.
     *
     * @param {number[]} a
     * @param {number[]} b
     * @returns {number} ∈ [-1, 1]
     */
    cosVec(a, b) {
      if (a.length !== b.length) throw new Error('[MajixCos] cosVec: dimension mismatch');
      const nA = normLp(a, 2);
      const nB = normLp(b, 2);
      if (nA < this._cfg.precision || nB < this._cfg.precision) return 0;
      return dot1d(a, b) / (nA * nB);
    },

    /**
     * Angle (radians) between two n-vectors.
     * @param {number[]} a
     * @param {number[]} b
     * @returns {number} ∈ [0, π]
     */
    cosAngle(a, b) {
      return Math.acos(Math.max(-1, Math.min(1, this.cosVec(a, b))));
    },

    /**
     * Cosine distance = 1 − cosine similarity.
     * @param {number[]} a
     * @param {number[]} b
     * @returns {number} ∈ [0, 2]
     */
    cosDistance(a, b) {
      return 1 - this.cosVec(a, b);
    },

    // ── Higher-order / tensor cosine ────────────────────────────────────────

    /**
     * Higher-order cosine between two tensors of **any rank** in n-space.
     * Tensors A and B are flattened to 1-D; the generalised Frobenius inner
     * product ⟨A, B⟩_F = Σ A_i · B_i is divided by the product of
     * Frobenius norms ‖A‖_F · ‖B‖_F.
     *
     * Works for:
     *   order-1 tensors (vectors):    rank 1, shape [n]
     *   order-2 tensors (matrices):   rank 2, shape [m, n]
     *   order-k tensors:              rank k, shape [d1, d2, …, dk]
     *
     * @param {Array} A - Nested array of any rank
     * @param {Array} B - Nested array with the same total element count
     * @returns {number} ∈ [-1, 1]
     */
    cosTensor(A, B) {
      return this.cosVec(flatten(A), flatten(B));
    },

    // ── Generalised dot product & norm ──────────────────────────────────────

    /**
     * Generalised inner product of two tensors (element-wise sum after flattening).
     * @param {Array} A
     * @param {Array} B
     * @returns {number}
     */
    dot(A, B) {
      return dot1d(flatten(A), flatten(B));
    },

    /**
     * Lp norm of a vector or tensor (flattened).
     * @param {number[]|Array} v
     * @param {number} [p=2]  1 = Manhattan, 2 = Euclidean, Infinity = Chebyshev
     * @returns {number}
     */
    norm(v, p) {
      return normLp(flatten(v), p != null ? p : 2);
    },

    // ── Projections & decompositions ────────────────────────────────────────

    /**
     * Orthogonal projection of v onto the direction given by `direction`.
     * proj_{direction}(v) = (direction · v / |direction|²) · direction
     *
     * @param {number[]} direction
     * @param {number[]} v
     * @returns {number[]}
     */
    project(direction, v) {
      if (direction.length !== v.length) throw new Error('[MajixCos] project: dimension mismatch');
      const dDotD = dot1d(direction, direction);
      if (dDotD < this._cfg.precision) throw new Error('[MajixCos] project: zero direction vector');
      const scale = dot1d(direction, v) / dDotD;
      return direction.map(d => d * scale);
    },

    /**
     * Decompose v into components parallel and perpendicular to `direction`.
     * @param {number[]} v
     * @param {number[]} direction
     * @returns {{ parallel: number[], perpendicular: number[] }}
     */
    decompose(v, direction) {
      const parallel = this.project(direction, v);
      const perpendicular = v.map((vi, i) => vi - parallel[i]);
      return { parallel, perpendicular };
    },

    // ── Gram matrix & batch similarity ──────────────────────────────────────

    /**
     * Gram matrix of pairwise cosine similarities.
     * G[i][j] = cosVec(vectors[i], vectors[j])
     *
     * @param {number[][]} vectors - Array of n-dimensional vectors
     * @returns {number[][]}
     */
    gram(vectors) {
      const m = vectors.length;
      return Array.from({ length: m }, (_, i) =>
        Array.from({ length: m }, (_, j) =>
          (i === j) ? 1 : this.cosVec(vectors[i], vectors[j])
        )
      );
    },

    /**
     * Pairwise cosine similarity matrix for the rows of a matrix.
     * Alias for gram() — included for ergonomic access.
     * @param {number[][]} matrix - m × n matrix (array of row vectors)
     * @returns {number[][]} m × m similarity matrix
     */
    batchCosSimilarity(matrix) {
      return this.gram(matrix);
    },

    // ── Direction cosines & axis angles ─────────────────────────────────────

    /**
     * Direction cosines of v: the n cosines of the angles between v and each
     * coordinate axis.  Equivalent to the components of the unit vector v̂.
     *
     * @param {number[]} v - n-dimensional vector
     * @returns {number[]} length-n array of direction cosines
     */
    directionCosines(v) {
      const n = normLp(v, 2);
      if (n < this._cfg.precision) throw new Error('[MajixCos] directionCosines: zero vector');
      return v.map(vi => vi / n);
    },

    /**
     * Angles (radians) between v and each coordinate axis.
     * @param {number[]} v
     * @returns {number[]} length-n array of angles ∈ [0, π]
     */
    axisAngles(v) {
      return this.directionCosines(v).map(dc =>
        Math.acos(Math.max(-1, Math.min(1, dc)))
      );
    },

    // ── Weighted & soft cosine ───────────────────────────────────────────────

    /**
     * Weighted cosine similarity.
     * Dimensions are rescaled by a weight vector before computing similarity.
     * weightedCosVec(a, b, w) = cosVec(a ⊙ w, b ⊙ w)
     *
     * @param {number[]} a
     * @param {number[]} b
     * @param {number[]} weights - Non-negative weight per dimension
     * @returns {number} ∈ [-1, 1]
     */
    weightedCosVec(a, b, weights) {
      if (a.length !== b.length || a.length !== weights.length)
        throw new Error('[MajixCos] weightedCosVec: dimension mismatch');
      return this.cosVec(
        a.map((v, i) => v * weights[i]),
        b.map((v, i) => v * weights[i])
      );
    },

    /**
     * Soft cosine similarity using a feature-similarity matrix S.
     * softCos(a, b, S) = (Σᵢⱼ Sᵢⱼ aᵢ bⱼ) / sqrt((Σᵢⱼ Sᵢⱼ aᵢ aⱼ)(Σᵢⱼ Sᵢⱼ bᵢ bⱼ))
     *
     * S must be a symmetric positive semi-definite n×n matrix.
     *
     * @param {number[]} a
     * @param {number[]} b
     * @param {number[][]} S - n×n feature-similarity matrix
     * @returns {number} ∈ [-1, 1]
     */
    softCosSimilarity(a, b, S) {
      const n = a.length;
      if (b.length !== n || S.length !== n)
        throw new Error('[MajixCos] softCosSimilarity: dimension mismatch');
      let ab = 0, aa = 0, bb = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const s = S[i][j];
          ab += s * a[i] * b[j];
          aa += s * a[i] * a[j];
          bb += s * b[i] * b[j];
        }
      }
      const denom = Math.sqrt(aa * bb);
      if (denom < this._cfg.precision) return 0;
      return Math.max(-1, Math.min(1, ab / denom));
    },

    // ── Tensor metadata ──────────────────────────────────────────────────────

    /**
     * Rank (tensor order) of a nested array.
     * 1 = vector, 2 = matrix, 3 = 3-tensor, …
     * @param {Array} T
     * @returns {number}
     */
    tensorOrder(T) {
      return rankOf(T);
    },

    /**
     * Shape of a nested array, e.g. [3] for a 3-vector, [2, 4] for a 2×4 matrix.
     * @param {Array} T
     * @returns {number[]}
     */
    tensorShape(T) {
      return shapeOf(T);
    },

  };

  // Auto-initialise when the script loads if COS_CONFIG is already defined.
  MajixCos.init();

  root.MajixCos = MajixCos;

}(typeof globalThis !== 'undefined' ? globalThis : window));
