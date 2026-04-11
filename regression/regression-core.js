/**
 * regression-core.js — PhD-Level Regression Library (Browser / Node)
 * ====================================================================
 * Pure-JS implementations of:
 *   OLS, Ridge, LASSO (coord-descent), Elastic Net, Logistic Regression,
 *   Gaussian Process Regression, Weighted Least Squares, Partial Least
 *   Squares (NIPALS), Polynomial Regression, Multivariate OLS (MOLS),
 *   Bayesian Linear Regression (conjugate Normal-InvGamma).
 *
 * Mathematical conventions follow the regression/README.md.
 * No external dependencies.
 */

'use strict';

/* =========================================================================
 * Linear Algebra Primitives
 * ========================================================================= */

const LA = (() => {
  /** Matrix–matrix product */
  function mmul(A, B) {
    const n = A.length, m = A[0].length, p = B[0].length;
    const C = Array.from({ length: n }, () => new Float64Array(p));
    for (let i = 0; i < n; i++)
      for (let k = 0; k < m; k++) {
        if (A[i][k] === 0) continue;
        for (let j = 0; j < p; j++) C[i][j] += A[i][k] * B[k][j];
      }
    return C;
  }

  /** Transpose */
  function T(A) {
    const n = A.length, m = A[0].length;
    const B = Array.from({ length: m }, () => new Float64Array(n));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) B[j][i] = A[i][j];
    return B;
  }

  /** Matrix–vector product */
  function mv(A, v) {
    return A.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
  }

  /** Dot product */
  function dot(u, v) { return u.reduce((s, a, i) => s + a * v[i], 0); }

  /** Euclidean norm */
  function norm(v) { return Math.sqrt(dot(v, v)); }

  /** Gram matrix X^T X */
  function gram(X) { return mmul(T(X), X); }

  /** Identity matrix */
  function eye(n) {
    return Array.from({ length: n }, (_, i) =>
      Float64Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  }

  /** Add two matrices */
  function madd(A, B) {
    return A.map((row, i) => row.map((v, j) => v + B[i][j]));
  }

  /** Scale matrix */
  function mscale(A, s) { return A.map(row => row.map(v => v * s)); }

  /**
   * LU decomposition with partial pivoting.
   * Returns { L, U, P } s.t. P*A = L*U.
   */
  function lu(A) {
    const n = A.length;
    const L = Array.from({ length: n }, (_, i) =>
      Float64Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    const U = A.map(row => Float64Array.from(row));
    const P = Array.from({ length: n }, (_, i) => i);

    for (let j = 0; j < n; j++) {
      let pivot = j;
      for (let i = j + 1; i < n; i++)
        if (Math.abs(U[i][j]) > Math.abs(U[pivot][j])) pivot = i;
      [U[j], U[pivot]] = [U[pivot], U[j]];
      [L[j], L[pivot]] = [L[pivot], L[j]];
      [P[j], P[pivot]] = [P[pivot], P[j]];
      L[j][j] = 1;
      if (Math.abs(U[j][j]) < 1e-14) continue;
      for (let i = j + 1; i < n; i++) {
        L[i][j] = U[i][j] / U[j][j];
        for (let k = j; k < n; k++) U[i][k] -= L[i][j] * U[j][k];
      }
    }
    return { L, U, P };
  }

  function fwdSub(L, b) {
    const n = b.length, x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = b[i];
      for (let j = 0; j < i; j++) x[i] -= L[i][j] * x[j];
      x[i] /= L[i][i];
    }
    return x;
  }

  function bwdSub(U, b) {
    const n = b.length, x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = b[i];
      for (let j = i + 1; j < n; j++) x[i] -= U[i][j] * x[j];
      x[i] /= U[i][i];
    }
    return x;
  }

  /** Solve A x = b via LU */
  function solve(A, b) {
    const { L, U, P } = lu(A);
    const bp = P.map(i => b[i]);
    const y = fwdSub(L, bp);
    return bwdSub(U, y);
  }

  /** Matrix inverse */
  function inv(A) {
    const n = A.length;
    const cols = Array.from({ length: n }, (_, j) => {
      const e = new Float64Array(n);
      e[j] = 1;
      return Array.from(solve(A, e));
    });
    return T(cols.map(c => Float64Array.from(c)));
  }

  /** Cholesky L s.t. A = L L^T */
  function cholesky(A) {
    const n = A.length;
    const L = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let s = 0;
        for (let k = 0; k < j; k++) s += L[i][k] * L[j][k];
        if (i === j) {
          const v = A[i][i] - s;
          if (v < 0) throw new Error(`Matrix not positive definite at (${i},${i})`);
          L[i][j] = Math.sqrt(v);
        } else {
          L[i][j] = (A[i][j] - s) / L[j][j];
        }
      }
    }
    return L;
  }

  function cholSolve(L, b) {
    const y = fwdSub(L, b);
    return bwdSub(T(L), y);
  }

  /** Trace */
  function trace(A) { return A.reduce((s, row, i) => s + row[i], 0); }

  /** Hat matrix H = X (X^T X)^{-1} X^T */
  function hatMatrix(X) {
    const G = gram(X);
    const Ginv = inv(G);
    return mmul(mmul(X, Ginv), T(X));
  }

  return { mmul, T, mv, dot, norm, gram, eye, madd, mscale, lu, solve, inv,
           fwdSub, bwdSub, cholesky, cholSolve, trace, hatMatrix };
})();

/* =========================================================================
 * OLS — Ordinary Least Squares
 * ========================================================================= */

class OLS {
  /**
   * @param {boolean} fitIntercept
   */
  constructor(fitIntercept = true) {
    this.fitIntercept = fitIntercept;
    this.coef = null;
    this.intercept = 0;
    this.residuals = null;
    this.sigma2 = 0;
  }

  _addIntercept(X) {
    return X.map(row => [1, ...row]);
  }

  fit(X, y) {
    const Xd = this.fitIntercept ? this._addIntercept(X) : X.map(r => [...r]);
    const n = Xd.length, p = Xd[0].length;
    const XtX = LA.gram(Xd);
    const Xty = LA.mv(LA.T(Xd), y);
    const beta = Array.from(LA.solve(XtX, Xty));

    this.residuals = y.map((yi, i) => yi - LA.dot(Xd[i], beta));
    const rss = LA.dot(this.residuals, this.residuals);
    this.sigma2 = rss / (n - p);

    if (this.fitIntercept) {
      this.intercept = beta[0];
      this.coef = beta.slice(1);
    } else {
      this.coef = beta;
    }
    this._betaFull = beta;
    this._XtXinv = LA.inv(XtX);
    this._Xd = Xd;
    this._y = y;
    this._n = n;
    this._p = p;
    return this;
  }

  predict(X) {
    const Xd = this.fitIntercept ? this._addIntercept(X) : X;
    return Xd.map(row => LA.dot(row, this._betaFull));
  }

  /** Homoskedastic standard errors */
  standardErrors() {
    return Array.from({ length: this._p }, (_, j) =>
      Math.sqrt(this.sigma2 * this._XtXinv[j][j]));
  }

  rSquared() {
    const yBar = this._y.reduce((s, v) => s + v, 0) / this._n;
    const tss = this._y.reduce((s, v) => s + (v - yBar) ** 2, 0);
    const rss = LA.dot(this.residuals, this.residuals);
    return tss > 0 ? 1 - rss / tss : 0;
  }

  adjRSquared() {
    const r2 = this.rSquared();
    return 1 - (1 - r2) * (this._n - 1) / (this._n - this._p);
  }

  fStatistic() {
    const r2 = this.rSquared();
    const k = this._p - (this.fitIntercept ? 1 : 0);
    if (k <= 0) return NaN;
    return (r2 / k) / ((1 - r2) / (this._n - this._p));
  }

  leverage() {
    const H = LA.hatMatrix(this._Xd);
    return H.map((row, i) => row[i]);
  }

  cooksDistance() {
    const h = this.leverage();
    return this.residuals.map((e, i) =>
      (e ** 2 * h[i]) / (this._p * this.sigma2 * (1 - h[i]) ** 2));
  }

  /** HC0 (White) heteroskedasticity-robust standard errors */
  hc0SE() {
    const { _Xd: X, residuals: e, _XtXinv: Inv, _n: n, _p: p } = this;
    const meat = Array.from({ length: p }, () => new Float64Array(p));
    for (let i = 0; i < n; i++)
      for (let r = 0; r < p; r++)
        for (let c = 0; c < p; c++)
          meat[r][c] += e[i] ** 2 * X[i][r] * X[i][c];
    const V = LA.mmul(LA.mmul(Inv, meat), Inv);
    return Array.from({ length: p }, (_, j) => Math.sqrt(Math.max(0, V[j][j])));
  }
}

/* =========================================================================
 * Ridge Regression
 * ========================================================================= */

class Ridge {
  constructor(lambda = 1.0, fitIntercept = true) {
    this.lambda = lambda;
    this.fitIntercept = fitIntercept;
    this.coef = null;
    this.intercept = 0;
  }

  fit(X, y) {
    const n = X.length, p = X[0].length;
    let Xc, yc, xMean, yMean;
    if (this.fitIntercept) {
      xMean = Array.from({ length: p }, (_, j) =>
        X.reduce((s, r) => s + r[j], 0) / n);
      yMean = y.reduce((s, v) => s + v, 0) / n;
      Xc = X.map(r => r.map((v, j) => v - xMean[j]));
      yc = y.map(v => v - yMean);
    } else {
      xMean = new Array(p).fill(0);
      yMean = 0;
      Xc = X; yc = y;
    }
    const XtX = LA.gram(Xc);
    const reg = LA.madd(XtX, LA.mscale(LA.eye(p), this.lambda));
    const Xty = LA.mv(LA.T(Xc), yc);
    this.coef = Array.from(LA.solve(reg, Xty));
    this.intercept = this.fitIntercept
      ? yMean - LA.dot(this.coef, xMean) : 0;
    this._Xc = Xc; this._yc = yc;
    return this;
  }

  predict(X) {
    return X.map(row => LA.dot(row, this.coef) + this.intercept);
  }

  gcvScore() {
    const n = this._Xc.length;
    const H = hatMatrixRidge(this._Xc, this.lambda);
    const yHat = LA.mv(H, this._yc);
    const resid = this._yc.map((v, i) => v - yHat[i]);
    const rss = LA.dot(resid, resid);
    const trH = LA.trace(H);
    const d = (1 - trH / n) ** 2;
    return d < 1e-14 ? Infinity : (rss / n) / d;
  }
}

function hatMatrixRidge(X, lambda) {
  const p = X[0].length;
  const XtX = LA.gram(X);
  const reg = LA.madd(XtX, LA.mscale(LA.eye(p), lambda));
  return LA.mmul(LA.mmul(X, LA.inv(reg)), LA.T(X));
}

/* =========================================================================
 * LASSO — Cyclic Coordinate Descent
 * ========================================================================= */

class LASSO {
  constructor(lambda = 0.1, maxIter = 1000, tol = 1e-6, fitIntercept = true) {
    this.lambda = lambda;
    this.maxIter = maxIter;
    this.tol = tol;
    this.fitIntercept = fitIntercept;
    this.coef = null;
    this.intercept = 0;
    this.nIter = 0;
  }

  static softThreshold(z, t) {
    return z > t ? z - t : z < -t ? z + t : 0;
  }

  fit(X, y) {
    const n = X.length, p = X[0].length;
    let Xc, yc, xMean, yMean;
    if (this.fitIntercept) {
      xMean = Array.from({ length: p }, (_, j) =>
        X.reduce((s, r) => s + r[j], 0) / n);
      yMean = y.reduce((s, v) => s + v, 0) / n;
      Xc = X.map(r => r.map((v, j) => v - xMean[j]));
      yc = y.map(v => v - yMean);
    } else {
      xMean = new Array(p).fill(0);
      yMean = 0; Xc = X; yc = [...y];
    }
    const beta = new Float64Array(p);
    const colNorm2 = Array.from({ length: p }, (_, j) =>
      Xc.reduce((s, r) => s + r[j] ** 2, 0));
    const resid = [...yc];

    for (let iter = 0; iter < this.maxIter; iter++) {
      let maxDelta = 0;
      for (let j = 0; j < p; j++) {
        if (colNorm2[j] < 1e-14) continue;
        const rj = Xc.reduce((s, r, i) => s + r[j] * (resid[i] + r[j] * beta[j]), 0);
        const newBj = LASSO.softThreshold(rj / n, this.lambda) / (colNorm2[j] / n);
        const delta = newBj - beta[j];
        if (Math.abs(delta) > maxDelta) maxDelta = Math.abs(delta);
        for (let i = 0; i < n; i++) resid[i] -= Xc[i][j] * delta;
        beta[j] = newBj;
      }
      this.nIter = iter + 1;
      if (maxDelta < this.tol) break;
    }
    this.coef = Array.from(beta);
    this.intercept = this.fitIntercept
      ? yMean - LA.dot(this.coef, xMean) : 0;
    return this;
  }

  predict(X) {
    return X.map(row => LA.dot(row, this.coef) + this.intercept);
  }
}

/* =========================================================================
 * Elastic Net
 * ========================================================================= */

class ElasticNet {
  constructor(lam1 = 0.1, lam2 = 0.1, maxIter = 1000, tol = 1e-6,
              fitIntercept = true) {
    this.lam1 = lam1; this.lam2 = lam2;
    this.maxIter = maxIter; this.tol = tol;
    this.fitIntercept = fitIntercept;
    this.coef = null; this.intercept = 0;
  }

  static softThreshold(z, t) {
    return z > t ? z - t : z < -t ? z + t : 0;
  }

  fit(X, y) {
    const n = X.length, p = X[0].length;
    let Xc, yc, xMean, yMean;
    if (this.fitIntercept) {
      xMean = Array.from({ length: p }, (_, j) =>
        X.reduce((s, r) => s + r[j], 0) / n);
      yMean = y.reduce((s, v) => s + v, 0) / n;
      Xc = X.map(r => r.map((v, j) => v - xMean[j]));
      yc = y.map(v => v - yMean);
    } else {
      xMean = new Array(p).fill(0); yMean = 0; Xc = X; yc = [...y];
    }
    const beta = new Float64Array(p);
    const colNorm2 = Array.from({ length: p }, (_, j) =>
      Xc.reduce((s, r) => s + r[j] ** 2, 0));
    const resid = [...yc];

    for (let iter = 0; iter < this.maxIter; iter++) {
      let maxDelta = 0;
      for (let j = 0; j < p; j++) {
        const cn = colNorm2[j];
        if (cn < 1e-14) continue;
        const rj = Xc.reduce((s, r, i) => s + r[j] * (resid[i] + r[j] * beta[j]), 0);
        const denom = cn / n + this.lam2;
        const newBj = ElasticNet.softThreshold(rj / n, this.lam1) / denom;
        const delta = newBj - beta[j];
        if (Math.abs(delta) > maxDelta) maxDelta = Math.abs(delta);
        for (let i = 0; i < n; i++) resid[i] -= Xc[i][j] * delta;
        beta[j] = newBj;
      }
      if (maxDelta < this.tol) break;
    }
    this.coef = Array.from(beta);
    this.intercept = this.fitIntercept
      ? yMean - LA.dot(this.coef, xMean) : 0;
    return this;
  }

  predict(X) {
    return X.map(row => LA.dot(row, this.coef) + this.intercept);
  }
}

/* =========================================================================
 * Logistic Regression (Newton–Raphson / IRLS)
 * ========================================================================= */

class LogisticRegression {
  constructor(maxIter = 100, tol = 1e-8, fitIntercept = true, reg = 0) {
    this.maxIter = maxIter; this.tol = tol;
    this.fitIntercept = fitIntercept; this.reg = reg;
    this.coef = null; this.intercept = 0; this.nIter = 0;
  }

  static sigmoid(z) {
    return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
  }

  fit(X, y) {
    const Xd = this.fitIntercept ? X.map(r => [1, ...r]) : X.map(r => [...r]);
    const n = Xd.length, p = Xd[0].length;
    const beta = new Float64Array(p);

    for (let iter = 0; iter < this.maxIter; iter++) {
      const mu = Xd.map(r => LogisticRegression.sigmoid(LA.dot(r, beta)));
      const W = mu.map((m, i) => m * (1 - m));
      const XtWX = Array.from({ length: p }, (_, r) =>
        Array.from({ length: p }, (_, c) =>
          Xd.reduce((s, row, i) => s + row[r] * W[i] * row[c], 0)));
      if (this.reg > 0) for (let j = 0; j < p; j++) XtWX[j][j] += this.reg;
      const grad = Array.from({ length: p }, (_, j) =>
        Xd.reduce((s, row, i) => s + row[j] * (y[i] - mu[i]), 0)
        - (this.reg > 0 ? this.reg * beta[j] : 0));
      let delta;
      try { delta = Array.from(LA.solve(XtWX, grad)); }
      catch { break; }
      for (let j = 0; j < p; j++) beta[j] += delta[j];
      this.nIter = iter + 1;
      if (LA.norm(delta) < this.tol) break;
    }
    if (this.fitIntercept) {
      this.intercept = beta[0];
      this.coef = Array.from(beta.slice(1));
    } else {
      this.coef = Array.from(beta);
    }
    this._betaFull = Array.from(beta);
    this._Xd = Xd;
    return this;
  }

  predictProba(X) {
    const Xd = this.fitIntercept ? X.map(r => [1, ...r]) : X;
    return Xd.map(r => LogisticRegression.sigmoid(LA.dot(r, this._betaFull)));
  }

  predict(X, threshold = 0.5) {
    return this.predictProba(X).map(p => p >= threshold ? 1 : 0);
  }
}

/* =========================================================================
 * Gaussian Process Regression
 * ========================================================================= */

class GaussianProcessRegressor {
  /**
   * @param {Function} kernel  (x1: number[], x2: number[]) => number
   * @param {number}   noiseVar
   */
  constructor(kernel, noiseVar = 1e-4) {
    this.kernel = kernel;
    this.noiseVar = noiseVar;
    this._XTrain = null;
    this._alpha = null;
    this._L = null;
  }

  _buildK(X1, X2) {
    return X1.map(r1 => X2.map(r2 => this.kernel(r1, r2)));
  }

  fit(X, y) {
    const n = X.length;
    const K = this._buildK(X, X);
    for (let i = 0; i < n; i++) K[i][i] += this.noiseVar;
    this._L = LA.cholesky(K);
    this._alpha = Array.from(LA.cholSolve(this._L, y));
    this._XTrain = X;
    this._yTrain = y;
    return this;
  }

  predict(Xstar) {
    const Ks = this._buildK(Xstar, this._XTrain);
    const mu = Ks.map(row => LA.dot(row, this._alpha));
    const Kss = Xstar.map(x => this.kernel(x, x));
    const L = this._L;
    const variances = Ks.map((row, i) => {
      const v = Array.from(LA.fwdSub(L, row));
      return Math.max(0, Kss[i] - LA.dot(v, v));
    });
    return { mu, variances };
  }

  logMarginalLikelihood() {
    const n = this._yTrain.length;
    const logDet = this._L.reduce((s, row, i) => s + Math.log(row[i]), 0);
    const dataFit = 0.5 * LA.dot(this._yTrain, this._alpha);
    return -dataFit - logDet - 0.5 * n * Math.log(2 * Math.PI);
  }
}

/* =========================================================================
 * Kernel Factories
 * ========================================================================= */

const Kernels = {
  rbf(lengthScale = 1.0, amplitude = 1.0) {
    return (x, xp) => {
      const d2 = x.reduce((s, v, i) => s + (v - xp[i]) ** 2, 0);
      return amplitude ** 2 * Math.exp(-d2 / (2 * lengthScale ** 2));
    };
  },

  matern52(lengthScale = 1.0, amplitude = 1.0) {
    return (x, xp) => {
      const r = Math.sqrt(x.reduce((s, v, i) => s + (v - xp[i]) ** 2, 0));
      const t = Math.sqrt(5) * r / lengthScale;
      return amplitude ** 2 * (1 + t + t ** 2 / 3) * Math.exp(-t);
    };
  },

  rationalQuadratic(alpha = 1.0, lengthScale = 1.0, amplitude = 1.0) {
    return (x, xp) => {
      const r2 = x.reduce((s, v, i) => s + (v - xp[i]) ** 2, 0);
      return amplitude ** 2 * (1 + r2 / (2 * alpha * lengthScale ** 2)) ** (-alpha);
    };
  },

  linear(bias = 0.0, variance = 1.0) {
    return (x, xp) =>
      variance * x.reduce((s, v, i) => s + v * xp[i], 0) + bias ** 2;
  },

  periodic(period = 1.0, lengthScale = 1.0, amplitude = 1.0) {
    return (x, xp) => {
      const r = Math.sqrt(x.reduce((s, v, i) => s + (v - xp[i]) ** 2, 0));
      const sinTerm = Math.sin(Math.PI * r / period) / lengthScale;
      return amplitude ** 2 * Math.exp(-2 * sinTerm ** 2);
    };
  }
};

/* =========================================================================
 * Weighted Least Squares
 * ========================================================================= */

class WLS {
  /**
   * β̂_WLS = (X^T W X)^{-1} X^T W y
   * @param {boolean} fitIntercept
   */
  constructor(fitIntercept = true) {
    this.fitIntercept = fitIntercept;
    this.coef = null; this.intercept = 0;
  }

  fit(X, y, weights) {
    const Xd = this.fitIntercept ? X.map(r => [1, ...r]) : X.map(r => [...r]);
    const n = Xd.length, p = Xd[0].length;
    // X^T W X
    const XtWX = Array.from({ length: p }, (_, r) =>
      Array.from({ length: p }, (_, c) =>
        Xd.reduce((s, row, i) => s + row[r] * weights[i] * row[c], 0)));
    const XtWy = Array.from({ length: p }, (_, j) =>
      Xd.reduce((s, row, i) => s + row[j] * weights[i] * y[i], 0));
    const beta = Array.from(LA.solve(XtWX, XtWy));
    if (this.fitIntercept) {
      this.intercept = beta[0]; this.coef = beta.slice(1);
    } else {
      this.coef = beta;
    }
    this._betaFull = beta; this._Xd = Xd;
    return this;
  }

  predict(X) {
    const Xd = this.fitIntercept ? X.map(r => [1, ...r]) : X;
    return Xd.map(row => LA.dot(row, this._betaFull));
  }
}

/* =========================================================================
 * Polynomial Regression
 * ========================================================================= */

class PolynomialRegression {
  /**
   * Fits univariate polynomial regression of given degree.
   * Feature map: φ(x) = [1, x, x², …, x^degree]
   * @param {number} degree
   */
  constructor(degree = 2) {
    this.degree = degree;
    this._ols = new OLS(false);
  }

  _features(X) {
    return X.map(row => {
      const x = row[0];
      return Array.from({ length: this.degree + 1 }, (_, k) => x ** k);
    });
  }

  fit(X, y) { this._ols.fit(this._features(X), y); return this; }
  predict(X) { return this._ols.predict(this._features(X)); }
  get coef() { return this._ols._betaFull; }
}

/* =========================================================================
 * Exports
 * ========================================================================= */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LA, OLS, Ridge, LASSO, ElasticNet, LogisticRegression,
    GaussianProcessRegressor, Kernels, WLS, PolynomialRegression,
    hatMatrixRidge };
}
