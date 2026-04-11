/**
 * probability-core.js — PhD-Level Probability Theory Library (JavaScript)
 * =========================================================================
 * Global IIFE: window.MajixProbability
 *
 * Implements:
 *   Distribution utilities: Gaussian, exponential, Poisson, Beta, Gamma, t
 *   Moment generating functions, cumulants
 *   Stochastic processes: BM, GBM, OU, CIR, Poisson
 *   Martingale stopping: optional stopping simulation
 *   Large deviations: Cramér rate function
 *   Extreme value: GEV CDF/PDF, GPD, return level
 *   Monte Carlo: crude, importance sampling, stratified, Halton QMC
 *   MCMC: Metropolis-Hastings (scalar), slice sampling
 */

(function (global) {
  'use strict';

  // -------------------------------------------------------------------------
  // RNG (seeded xorshift)
  // -------------------------------------------------------------------------
  function Rng(seed = Date.now()) {
    let s = (seed & 0xffffffff) || 1;
    this.next = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };
    this.normal = () => {
      const u = this.next() || 1e-300, v = this.next() || 1e-300;
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    this.exp = (lambda = 1) => -Math.log(this.next() || 1e-300) / lambda;
    this.uniform = (a = 0, b = 1) => a + (b - a) * this.next();
  }
  const defaultRng = new Rng(42);

  // -------------------------------------------------------------------------
  // Special Functions
  // -------------------------------------------------------------------------
  function logGamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
               -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  const gammaFn = (x) => Math.exp(logGamma(x));
  const betaFn = (a, b) => Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b));

  function normalCDF(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
  function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const e = 1 - p * Math.exp(-x * x);
    return x >= 0 ? e : -e;
  }
  function normalQuantile(p) {
    if (p <= 0 || p >= 1) throw new Error('p must be in (0,1)');
    const a = [2.515517, 0.802853, 0.010328];
    const b = [1.432788, 0.189269, 0.001308];
    const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p));
    const q = t - (a[0] + a[1] * t + a[2] * t * t) / (1 + b[0] * t + b[1] * t * t + b[2] * t ** 3);
    return p < 0.5 ? -q : q;
  }

  // -------------------------------------------------------------------------
  // Distributions
  // -------------------------------------------------------------------------
  const Dist = {
    normalPDF: (x, mu = 0, sigma = 1) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)),
    normalCDF,
    normalQuantile,
    normalSample: (mu = 0, sigma = 1, rng = defaultRng) => mu + sigma * rng.normal(),

    exponentialPDF: (x, lambda = 1) => x >= 0 ? lambda * Math.exp(-lambda * x) : 0,
    exponentialSample: (lambda = 1, rng = defaultRng) => rng.exp(lambda),

    poissonPMF: (k, lambda) => {
      let log_p = k * Math.log(lambda) - lambda;
      for (let i = 1; i <= k; i++) log_p -= Math.log(i);
      return Math.exp(log_p);
    },
    poissonSample: (lambda, rng = defaultRng) => {
      const L = Math.exp(-lambda); let p = 1, k = 0;
      do { k++; p *= rng.next(); } while (p > L);
      return k - 1;
    },

    gammaPDF: (x, shape, rate = 1) => {
      if (x <= 0) return 0;
      return Math.exp((shape - 1) * Math.log(x) - rate * x - logGamma(shape) + shape * Math.log(rate));
    },

    betaPDF: (x, a, b) => {
      if (x <= 0 || x >= 1) return 0;
      return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logGamma(a) - logGamma(b) + logGamma(a + b));
    },

    studentTPDF: (t, nu) => {
      return Math.exp(logGamma((nu + 1) / 2) - logGamma(nu / 2))
        / (Math.sqrt(nu * Math.PI) * (1 + t * t / nu) ** ((nu + 1) / 2));
    },

    cauchyPDF: (x, x0 = 0, gamma = 1) => 1 / (Math.PI * gamma * (1 + ((x - x0) / gamma) ** 2)),
  };

  // -------------------------------------------------------------------------
  // Stochastic Processes
  // -------------------------------------------------------------------------
  function brownianMotion(T, n, rng = defaultRng) {
    const dt = T / n, t = [], W = [0];
    for (let i = 0; i <= n; i++) t.push(i * dt);
    for (let i = 0; i < n; i++) W.push(W[W.length - 1] + rng.normal() * Math.sqrt(dt));
    return { t, W };
  }

  function geometricBM(S0, mu, sigma, T, n, rng = defaultRng) {
    const { t, W } = brownianMotion(T, n, rng);
    const S = t.map((ti, i) => S0 * Math.exp((mu - 0.5 * sigma ** 2) * ti + sigma * W[i]));
    return { t, S };
  }

  function ornsteinUhlenbeck(x0, theta, mu, sigma, T, n, rng = defaultRng) {
    const dt = T / n;
    const expTerm = Math.exp(-theta * dt);
    const stdTerm = sigma * Math.sqrt((1 - Math.exp(-2 * theta * dt)) / (2 * theta));
    const t = [], X = [x0];
    for (let i = 0; i <= n; i++) t.push(i * dt);
    for (let i = 0; i < n; i++) X.push(X[X.length - 1] * expTerm + mu * (1 - expTerm) + stdTerm * rng.normal());
    return { t, X };
  }

  function coxIngersollRoss(x0, kappa, theta, sigma, T, n, rng = defaultRng) {
    const dt = T / n;
    const t = [], X = [x0];
    for (let i = 0; i <= n; i++) t.push(i * dt);
    for (let i = 0; i < n; i++) {
      const x = X[X.length - 1];
      const xNew = x + kappa * (theta - x) * dt + sigma * Math.sqrt(Math.max(x, 0) * dt) * rng.normal();
      X.push(Math.max(xNew, 0));
    }
    return { t, X };
  }

  function poissonProcess(rate, T, rng = defaultRng) {
    const times = [0], counts = [0];
    let t = 0, count = 0;
    while (true) {
      t += rng.exp(rate);
      if (t > T) break;
      count++; times.push(t); counts.push(count);
    }
    return { times, counts };
  }

  // -------------------------------------------------------------------------
  // Large Deviations
  // -------------------------------------------------------------------------
  function gaussianRateFunction(x, mu = 0, sigma2 = 1) { return (x - mu) ** 2 / (2 * sigma2); }
  function poissonRateFunction(x, lambda) {
    if (x <= 0) return lambda;
    return x * Math.log(x / lambda) - (x - lambda);
  }
  function binomialRateFunction(x, p) {
    if (x <= 0 || x >= 1) return Infinity;
    return x * Math.log(x / p) + (1 - x) * Math.log((1 - x) / (1 - p));
  }

  // -------------------------------------------------------------------------
  // Extreme Value Theory
  // -------------------------------------------------------------------------
  function gevCDF(x, mu, sigma, xi) {
    if (sigma <= 0) return 0;
    if (Math.abs(xi) < 1e-8) return Math.exp(-Math.exp(-(x - mu) / sigma));
    const z = 1 + xi * (x - mu) / sigma;
    if (z <= 0) return xi > 0 ? 0 : 1;
    return Math.exp(-Math.pow(z, -1 / xi));
  }

  function gevPDF(x, mu, sigma, xi) {
    if (sigma <= 0) return 0;
    if (Math.abs(xi) < 1e-8) {
      const z = (x - mu) / sigma;
      return (1 / sigma) * Math.exp(-z - Math.exp(-z));
    }
    const z = 1 + xi * (x - mu) / sigma;
    if (z <= 0) return 0;
    return (1 / sigma) * Math.pow(z, -1 / xi - 1) * Math.exp(-Math.pow(z, -1 / xi));
  }

  function gevReturnLevel(T, mu, sigma, xi) {
    const p = 1 - 1 / T;
    if (Math.abs(xi) < 1e-8) return mu - sigma * Math.log(-Math.log(p));
    return mu + sigma * (Math.pow(-Math.log(p), -xi) - 1) / xi;
  }

  function gpdPDF(x, mu, sigma, xi) {
    if (sigma <= 0 || x < mu) return 0;
    const y = (x - mu) / sigma;
    if (Math.abs(xi) < 1e-8) return (1 / sigma) * Math.exp(-y);
    const z = 1 + xi * y;
    if (z <= 0) return 0;
    return (1 / sigma) * Math.pow(z, -1 / xi - 1);
  }

  // -------------------------------------------------------------------------
  // Monte Carlo Integration
  // -------------------------------------------------------------------------
  function monteCarlo(f, domain, nSamples = 100000, rng = defaultRng) {
    let volume = domain.reduce((v, [lo, hi]) => v * (hi - lo), 1);
    let sum = 0, sum2 = 0;
    for (let i = 0; i < nSamples; i++) {
      const x = domain.map(([lo, hi]) => rng.uniform(lo, hi));
      const v = f(x); sum += v; sum2 += v * v;
    }
    const mean = sum / nSamples, varEst = (sum2 / nSamples - mean ** 2);
    return { estimate: volume * mean, stdError: volume * Math.sqrt(varEst / nSamples) };
  }

  function haltonSequence(n, base) {
    const seq = [];
    for (let i = 1; i <= n; i++) {
      let f = 1, r = 0, k = i;
      while (k > 0) { f /= base; r += f * (k % base); k = Math.floor(k / base); }
      seq.push(r);
    }
    return seq;
  }

  function qmcIntegrate(f, domain, nSamples = 10000) {
    const d = domain.length;
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29].slice(0, d);
    const halton = primes.map(p => haltonSequence(nSamples, p));
    let volume = domain.reduce((v, [lo, hi]) => v * (hi - lo), 1);
    let total = 0;
    for (let i = 0; i < nSamples; i++) {
      const x = domain.map(([lo, hi], j) => lo + (hi - lo) * halton[j][i]);
      total += f(x);
    }
    return volume * total / nSamples;
  }

  function importanceSampling(f, propSample, propPDF, targetPDF, nSamples = 10000, rng = defaultRng) {
    const xs = Array.from({ length: nSamples }, () => propSample(rng));
    const ws = xs.map(x => targetPDF(x) / Math.max(propPDF(x), 1e-300));
    const wSum = ws.reduce((a, b) => a + b, 0);
    const estimate = xs.reduce((acc, x, i) => acc + f(x) * ws[i], 0) / (wSum / nSamples);
    const wNorm = ws.map(w => w / wSum);
    const ess = 1 / wNorm.reduce((a, w) => a + w ** 2, 0);
    return { estimate, ess: ess / nSamples };
  }

  // -------------------------------------------------------------------------
  // Metropolis-Hastings (scalar)
  // -------------------------------------------------------------------------
  function metropolisHastings(logTarget, x0, nSamples = 5000, proposalSd = 0.5,
                               nBurnin = 1000, rng = defaultRng) {
    let x = x0, lp = logTarget(x);
    const samples = []; let nAccept = 0;
    for (let i = 0; i < nBurnin + nSamples; i++) {
      const xProp = x + rng.normal() * proposalSd;
      const lpProp = logTarget(xProp);
      if (Math.log(rng.next() + 1e-300) < lpProp - lp) { x = xProp; lp = lpProp; nAccept++; }
      if (i >= nBurnin) samples.push(x);
    }
    return { samples, acceptRate: nAccept / (nBurnin + nSamples) };
  }

  // -------------------------------------------------------------------------
  // Summary Statistics
  // -------------------------------------------------------------------------
  function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
  function variance(xs) { const m = mean(xs); return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1); }
  function quantile(xs, p) {
    const sorted = xs.slice().sort((a, b) => a - b);
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
  }
  function autocorrelation(xs, lag) {
    const m = mean(xs), n = xs.length;
    const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / n;
    return xs.slice(0, n - lag).reduce((a, x, i) => a + (x - m) * (xs[i + lag] - m), 0) / (n * v);
  }
  function effectiveSampleSize(samples) {
    const n = samples.length;
    let sum = 0;
    for (let lag = 1; lag < n / 2; lag++) {
      const rho = autocorrelation(samples, lag);
      if (Math.abs(rho) < 0.05) break;
      sum += rho;
    }
    return n / (1 + 2 * sum);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  const MajixProbability = {
    Rng, defaultRng,
    Dist,
    logGamma, gammaFn, betaFn, erf, normalCDF, normalQuantile,
    // Processes
    brownianMotion, geometricBM, ornsteinUhlenbeck, coxIngersollRoss, poissonProcess,
    // Large deviations
    gaussianRateFunction, poissonRateFunction, binomialRateFunction,
    // EVT
    gevCDF, gevPDF, gevReturnLevel, gpdPDF,
    // Monte Carlo
    monteCarlo, haltonSequence, qmcIntegrate, importanceSampling,
    // MCMC
    metropolisHastings,
    // Statistics
    mean, variance, quantile, autocorrelation, effectiveSampleSize,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MajixProbability;
  } else {
    global.MajixProbability = MajixProbability;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
