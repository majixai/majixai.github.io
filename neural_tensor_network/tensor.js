/**
 * tensor.js — Lightweight Tensor class with Adam optimizer
 * Used by the neural network to process market signal data.
 */

export class Tensor {
  constructor(data, shape) {
    this.data = Float32Array.from(data);
    this.shape = shape;
    this.grad = new Float32Array(data.length);
  }

  static zeros(shape) {
    const size = shape.reduce((a, b) => a * b, 1);
    return new Tensor(new Float32Array(size), shape);
  }

  static randn(shape, scale = 0.1) {
    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      // Box-Muller transform
      const u1 = Math.random() + 1e-10;
      const u2 = Math.random();
      data[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * scale;
    }
    return new Tensor(data, shape);
  }

  clone() {
    return new Tensor(this.data.slice(), [...this.shape]);
  }

  // Element-wise add
  add(other) {
    const out = new Float32Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = this.data[i] + other.data[i];
    return new Tensor(out, [...this.shape]);
  }

  // Element-wise multiply
  mul(other) {
    const out = new Float32Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = this.data[i] * other.data[i];
    return new Tensor(out, [...this.shape]);
  }

  // Scalar multiply
  scale(s) {
    const out = new Float32Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = this.data[i] * s;
    return new Tensor(out, [...this.shape]);
  }

  // ReLU activation
  relu() {
    const out = new Float32Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = Math.max(0, this.data[i]);
    return new Tensor(out, [...this.shape]);
  }

  // Sigmoid activation
  sigmoid() {
    const out = new Float32Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = 1 / (1 + Math.exp(-this.data[i]));
    return new Tensor(out, [...this.shape]);
  }

  // Tanh activation
  tanh() {
    const out = new Float32Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = Math.tanh(this.data[i]);
    return new Tensor(out, [...this.shape]);
  }

  // Softmax (for 1D tensor)
  softmax() {
    const max = Math.max(...this.data);
    const exps = new Float32Array(this.data.length);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      exps[i] = Math.exp(this.data[i] - max);
      sum += exps[i];
    }
    for (let i = 0; i < exps.length; i++) exps[i] /= sum;
    return new Tensor(exps, [...this.shape]);
  }

  // Matrix multiply: [m,k] x [k,n] => [m,n]
  matmul(other) {
    const [m, k] = this.shape;
    const [k2, n] = other.shape;
    if (k !== k2) throw new Error(`matmul shape mismatch: ${this.shape} x ${other.shape}`);
    const out = new Float32Array(m * n);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let p = 0; p < k; p++) sum += this.data[i * k + p] * other.data[p * n + j];
        out[i * n + j] = sum;
      }
    }
    return new Tensor(out, [m, n]);
  }

  // L2 norm
  norm() {
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) sum += this.data[i] * this.data[i];
    return Math.sqrt(sum);
  }

  // Mean squared error loss vs target vector
  mseLoss(target) {
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const diff = this.data[i] - target.data[i];
      sum += diff * diff;
    }
    return sum / this.data.length;
  }

  toArray() {
    return Array.from(this.data);
  }

  toString() {
    return `Tensor[${this.shape.join('x')}](${Array.from(this.data).map(v => v.toFixed(4)).join(', ')})`;
  }
}

/**
 * Adam optimizer — adaptive moment estimation.
 * Tracks first (m) and second (v) moment vectors per parameter tensor.
 */
export class AdamOptimizer {
  constructor({ lr = 0.001, beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8 } = {}) {
    this.lr = lr;
    this.beta1 = beta1;
    this.beta2 = beta2;
    this.epsilon = epsilon;
    this.t = 0; // timestep
    this._m = new Map(); // first moments
    this._v = new Map(); // second moments
  }

  /**
   * Apply gradient descent step to a parameter Tensor.
   * @param {Tensor} param - parameter tensor (modified in-place)
   * @param {Float32Array|Array} grad - gradient array same length as param.data
   * @param {string} key - unique key for this parameter
   */
  step(param, grad, key) {
    this.t++;
    const n = param.data.length;

    if (!this._m.has(key)) {
      this._m.set(key, new Float32Array(n));
      this._v.set(key, new Float32Array(n));
    }

    const m = this._m.get(key);
    const v = this._v.get(key);

    const bc1 = 1 - Math.pow(this.beta1, this.t);
    const bc2 = 1 - Math.pow(this.beta2, this.t);

    for (let i = 0; i < n; i++) {
      const g = typeof grad[i] !== 'undefined' ? grad[i] : 0;
      m[i] = this.beta1 * m[i] + (1 - this.beta1) * g;
      v[i] = this.beta2 * v[i] + (1 - this.beta2) * g * g;
      const mHat = m[i] / bc1;
      const vHat = v[i] / bc2;
      param.data[i] -= this.lr * mHat / (Math.sqrt(vHat) + this.epsilon);
    }
  }

  getState() {
    return { t: this.t, lr: this.lr, beta1: this.beta1, beta2: this.beta2 };
  }
}
