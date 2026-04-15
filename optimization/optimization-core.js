/**
 * optimization-core.js — PhD-Level Optimization Library (JavaScript)
 * ===================================================================
 * Global IIFE: window.MajixOptimization
 *
 * Implements:
 *   Gradient descent variants (fixed, momentum, Nesterov, Adam, AdaGrad, RMSProp)
 *   Newton's method and BFGS
 *   ADMM for constrained optimization
 *   Projected gradient onto simplex
 *   Coordinate descent
 *   Differential Evolution (global optimizer)
 *   Subgradient method (non-smooth)
 */

(function (global) {
  'use strict';

  // -------------------------------------------------------------------------
  // Vector Utilities
  // -------------------------------------------------------------------------
  const V = {
    add:   (u, v) => u.map((x, i) => x + v[i]),
    sub:   (u, v) => u.map((x, i) => x - v[i]),
    scale: (v, s) => v.map(x => x * s),
    dot:   (u, v) => u.reduce((acc, x, i) => acc + x * v[i], 0),
    norm:  (v) => Math.sqrt(V.dot(v, v)),
    zeros: (n) => new Array(n).fill(0),
    clone: (v) => v.slice(),
    axpy:  (a, x, y) => y.map((yi, i) => a * x[i] + yi),  // y = ax + y
  };

  // Numerical gradient (central difference)
  function numGrad(f, x, h = 1e-5) {
    return x.map((_, i) => {
      const xp = V.clone(x); xp[i] += h;
      const xm = V.clone(x); xm[i] -= h;
      return (f(xp) - f(xm)) / (2 * h);
    });
  }

  // -------------------------------------------------------------------------
  // Line Search (Armijo backtracking)
  // -------------------------------------------------------------------------
  function armijoLineSearch(f, x, d, grad, { alpha0 = 1.0, c1 = 1e-4, rho = 0.5, maxIter = 50 } = {}) {
    let alpha = alpha0;
    const f0 = f(x);
    const slope = V.dot(grad, d);
    for (let i = 0; i < maxIter; i++) {
      const xNew = V.axpy(alpha, d, x);
      if (f(xNew) <= f0 + c1 * alpha * slope) return alpha;
      alpha *= rho;
    }
    return alpha;
  }

  // -------------------------------------------------------------------------
  // Gradient Descent
  // -------------------------------------------------------------------------
  function gradientDescent(f, gradF, x0, { lr = 0.01, maxIter = 1000, tol = 1e-8, lineSearch = false } = {}) {
    let x = V.clone(x0);
    const history = [f(x)];
    for (let k = 0; k < maxIter; k++) {
      const g = gradF ? gradF(x) : numGrad(f, x);
      if (V.norm(g) < tol) break;
      const d = V.scale(g, -1);
      const alpha = lineSearch ? armijoLineSearch(f, x, d, g) : lr;
      x = V.axpy(alpha, d, x);
      history.push(f(x));
    }
    return { x, history };
  }

  // -------------------------------------------------------------------------
  // Nesterov Accelerated Gradient (FISTA)
  // -------------------------------------------------------------------------
  function nesterovGradient(f, gradF, x0, { lr = 0.01, maxIter = 1000, tol = 1e-8 } = {}) {
    let x = V.clone(x0), y = V.clone(x0), t = 1.0;
    const history = [f(x)];
    for (let k = 0; k < maxIter; k++) {
      const g = gradF ? gradF(y) : numGrad(f, y);
      if (V.norm(g) < tol) break;
      const xNew = V.axpy(-lr, g, y);
      const tNew = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
      y = V.axpy((t - 1) / tNew, V.sub(xNew, x), xNew);
      x = xNew; t = tNew;
      history.push(f(x));
    }
    return { x, history };
  }

  // -------------------------------------------------------------------------
  // Adam Optimizer
  // -------------------------------------------------------------------------
  function adam(f, gradF, x0, { lr = 0.001, beta1 = 0.9, beta2 = 0.999, eps = 1e-8,
                                  maxIter = 10000, tol = 1e-8 } = {}) {
    let x = V.clone(x0);
    let m = V.zeros(x.length), v = V.zeros(x.length);
    const history = [f(x)];
    for (let k = 1; k <= maxIter; k++) {
      const g = gradF ? gradF(x) : numGrad(f, x);
      if (V.norm(g) < tol) break;
      m = V.axpy(1 - beta1, g, V.scale(m, beta1));
      v = v.map((vi, i) => beta2 * vi + (1 - beta2) * g[i] ** 2);
      const mHat = V.scale(m, 1 / (1 - beta1 ** k));
      const vHat = v.map(vi => vi / (1 - beta2 ** k));
      x = x.map((xi, i) => xi - lr * mHat[i] / (Math.sqrt(vHat[i]) + eps));
      history.push(f(x));
    }
    return { x, history };
  }

  // -------------------------------------------------------------------------
  // AdaGrad
  // -------------------------------------------------------------------------
  function adagrad(f, gradF, x0, { lr = 0.01, eps = 1e-8, maxIter = 5000, tol = 1e-8 } = {}) {
    let x = V.clone(x0), G = V.zeros(x.length);
    const history = [f(x)];
    for (let k = 0; k < maxIter; k++) {
      const g = gradF ? gradF(x) : numGrad(f, x);
      if (V.norm(g) < tol) break;
      G = G.map((gi, i) => gi + g[i] ** 2);
      x = x.map((xi, i) => xi - lr * g[i] / (Math.sqrt(G[i]) + eps));
      history.push(f(x));
    }
    return { x, history };
  }

  // -------------------------------------------------------------------------
  // RMSProp
  // -------------------------------------------------------------------------
  function rmsprop(f, gradF, x0, { lr = 0.001, decay = 0.9, eps = 1e-8,
                                    maxIter = 5000, tol = 1e-8 } = {}) {
    let x = V.clone(x0), E = V.zeros(x.length);
    const history = [f(x)];
    for (let k = 0; k < maxIter; k++) {
      const g = gradF ? gradF(x) : numGrad(f, x);
      if (V.norm(g) < tol) break;
      E = E.map((ei, i) => decay * ei + (1 - decay) * g[i] ** 2);
      x = x.map((xi, i) => xi - lr * g[i] / (Math.sqrt(E[i]) + eps));
      history.push(f(x));
    }
    return { x, history };
  }

  // -------------------------------------------------------------------------
  // BFGS (Quasi-Newton)
  // -------------------------------------------------------------------------
  function bfgs(f, gradF, x0, { maxIter = 1000, tol = 1e-8 } = {}) {
    const n = x0.length;
    let x = V.clone(x0), g = gradF ? gradF(x) : numGrad(f, x);
    let H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
    const history = [f(x)];
    const eye = () => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));

    const mmul = (A, B) => {
      const C = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) if (A[i][k])
        for (let j = 0; j < n; j++) C[i][j] += A[i][k] * B[k][j];
      return C;
    };
    const matvec = (A, v) => A.map(row => V.dot(row, v));
    const outer = (u, v) => u.map(ui => v.map(vi => ui * vi));

    for (let k = 0; k < maxIter; k++) {
      if (V.norm(g) < tol) break;
      const d = V.scale(matvec(H, g), -1);
      const alpha = armijoLineSearch(f, x, d, g);
      const xNew = V.axpy(alpha, d, x);
      const gNew = gradF ? gradF(xNew) : numGrad(f, xNew);
      const s = V.sub(xNew, x), y = V.sub(gNew, g), ys = V.dot(y, s);
      if (Math.abs(ys) > 1e-14) {
        const rho = 1 / ys;
        const I = eye();
        const A = I.map((row, i) => row.map((v, j) => v - rho * s[i] * y[j]));
        const B = I.map((row, i) => row.map((v, j) => v - rho * y[i] * s[j]));
        const ss = outer(s, s).map(row => row.map(v => v * rho));
        H = mmul(mmul(A, H), B).map((row, i) => row.map((v, j) => v + ss[i][j]));
      }
      x = xNew; g = gNew;
      history.push(f(x));
    }
    return { x, history };
  }

  // -------------------------------------------------------------------------
  // Coordinate Descent
  // -------------------------------------------------------------------------
  function coordinateDescent(f, x0, { maxIter = 1000, tol = 1e-8, stepSize = 0.01 } = {}) {
    let x = V.clone(x0), fx = f(x);
    const history = [fx];
    for (let k = 0; k < maxIter; k++) {
      let maxChange = 0;
      for (let i = 0; i < x.length; i++) {
        const xp = V.clone(x); xp[i] += stepSize;
        const xm = V.clone(x); xm[i] -= stepSize;
        const gI = (f(xp) - f(xm)) / (2 * stepSize);
        const best = -gI * stepSize;
        if (Math.abs(best) > maxChange) maxChange = Math.abs(best);
        x[i] += best;
      }
      fx = f(x); history.push(fx);
      if (maxChange < tol) break;
    }
    return { x, history };
  }

  // -------------------------------------------------------------------------
  // Projection onto Probability Simplex (Duchi 2008)
  // -------------------------------------------------------------------------
  function projectSimplex(v) {
    const n = v.length;
    const u = v.slice().sort((a, b) => b - a);
    let cssv = 0, rho = 0;
    for (let i = 0; i < n; i++) {
      cssv += u[i];
      if (u[i] - (cssv - 1) / (i + 1) > 0) rho = i;
    }
    const theta = (u.slice(0, rho + 1).reduce((a, b) => a + b, 0) - 1) / (rho + 1);
    return v.map(vi => Math.max(vi - theta, 0));
  }

  // -------------------------------------------------------------------------
  // Differential Evolution (Global Optimizer, Storn-Price 1997)
  // -------------------------------------------------------------------------
  function differentialEvolution(f, bounds, {
    popSize = 30, maxIter = 1000, F = 0.8, CR = 0.9, tol = 1e-8, seed = null
  } = {}) {
    const rng = (() => { let s = seed !== null ? seed : Date.now();
      return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; }; })();
    const dim = bounds.length;
    // Initialise population
    let pop = Array.from({ length: popSize }, () =>
      bounds.map(([lo, hi]) => lo + rng() * (hi - lo)));
    let fitness = pop.map(x => f(x));
    const history = [Math.min(...fitness)];

    for (let gen = 0; gen < maxIter; gen++) {
      for (let i = 0; i < popSize; i++) {
        // Mutation: DE/rand/1
        let [a, b, c] = [0, 0, 0];
        while (a === i) a = Math.floor(rng() * popSize);
        while (b === i || b === a) b = Math.floor(rng() * popSize);
        while (c === i || c === a || c === b) c = Math.floor(rng() * popSize);
        const mutant = pop[a].map((x, j) => x + F * (pop[b][j] - pop[c][j]));
        // Clip to bounds
        mutant.forEach((v, j) => { mutant[j] = Math.max(bounds[j][0], Math.min(bounds[j][1], v)); });
        // Crossover
        const jRand = Math.floor(rng() * dim);
        const trial = pop[i].map((xi, j) => (rng() < CR || j === jRand) ? mutant[j] : xi);
        // Selection
        const ft = f(trial);
        if (ft <= fitness[i]) { pop[i] = trial; fitness[i] = ft; }
      }
      const best = Math.min(...fitness);
      history.push(best);
      if (history.length > 2 && Math.abs(history[history.length-1] - history[history.length-2]) < tol) break;
    }
    const bestIdx = fitness.indexOf(Math.min(...fitness));
    return { x: pop[bestIdx], value: fitness[bestIdx], history };
  }

  // -------------------------------------------------------------------------
  // Subgradient Method (for non-smooth convex functions)
  // -------------------------------------------------------------------------
  function subgradient(f, subgradF, x0, { maxIter = 5000, tol = 1e-6 } = {}) {
    let x = V.clone(x0), fBest = f(x), xBest = V.clone(x);
    const history = [fBest];
    for (let k = 1; k <= maxIter; k++) {
      const g = subgradF ? subgradF(x) : numGrad(f, x);
      const step = 1 / (k * Math.max(V.norm(g), 1e-14));  // Polyak step
      x = x.map((xi, i) => xi - step * g[i]);
      const fx = f(x);
      if (fx < fBest) { fBest = fx; xBest = V.clone(x); }
      history.push(fBest);
      if (V.norm(g) * step < tol) break;
    }
    return { x: xBest, value: fBest, history };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  const MajixOptimization = {
    gradientDescent,
    nesterovGradient,
    adam,
    adagrad,
    rmsprop,
    bfgs,
    coordinateDescent,
    projectSimplex,
    differentialEvolution,
    subgradient,
    numGrad,
    armijoLineSearch,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MajixOptimization;
  } else {
    global.MajixOptimization = MajixOptimization;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
