/**
 * network.js — Feed-forward Neural Network using Tensor + Adam optimizer.
 * Processes market signal vectors and predicts bullish probability scores.
 */

import { Tensor, AdamOptimizer } from '/tensor/neural/tensor.js';

export class DenseLayer {
  constructor(inputSize, outputSize, activation = 'relu') {
    // He initialization for ReLU layers
    const scale = activation === 'relu' ? Math.sqrt(2 / inputSize) : Math.sqrt(1 / inputSize);
    this.W = Tensor.randn([inputSize, outputSize], scale);
    this.b = Tensor.zeros([1, outputSize]);
    this.activation = activation;
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    // Cache for backward pass
    this._lastInput = null;
    this._lastPreActivation = null;
  }

  forward(x) {
    // x: [1, inputSize]
    this._lastInput = x;
    // [1, inputSize] x [inputSize, outputSize] = [1, outputSize]
    const z = x.matmul(this.W);
    // Add bias (broadcast)
    const zb = new Tensor(
      z.data.map((v, i) => v + this.b.data[i % this.outputSize]),
      z.shape
    );
    this._lastPreActivation = zb;
    switch (this.activation) {
      case 'relu':    return zb.relu();
      case 'sigmoid': return zb.sigmoid();
      case 'tanh':    return zb.tanh();
      case 'softmax': return zb.softmax();
      default:        return zb;
    }
  }

  /**
   * Simplified backward pass — compute gradients numerically for Adam step.
   * We use a signal-based pseudo-gradient proportional to output error.
   */
  backward(outputError, optimizer, layerId) {
    const n = this.W.data.length;
    // Gradient approximation: outer product of input and error signal
    const gradW = new Float32Array(n);
    const inputArr = this._lastInput ? Array.from(this._lastInput.data) : new Array(this.inputSize).fill(0);
    // Pad or truncate error array to exactly outputSize to guarantee correct gradient dimensions
    const rawErr = Array.from(outputError.data);
    const errArr = Array.from({ length: this.outputSize }, (_, j) => rawErr[j] ?? 0);

    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.outputSize; j++) {
        gradW[i * this.outputSize + j] = inputArr[i] * errArr[j];
      }
    }

    optimizer.step(this.W, gradW, `${layerId}_W`);
    optimizer.step(this.b, errArr, `${layerId}_b`);

    // Propagate error back: W^T * error
    const backError = new Float32Array(this.inputSize);
    for (let i = 0; i < this.inputSize; i++) {
      let s = 0;
      for (let j = 0; j < this.outputSize; j++) {
        s += this.W.data[i * this.outputSize + j] * errArr[j];
      }
      backError[i] = s;
    }
    return new Tensor(backError, [1, this.inputSize]);
  }
}

/**
 * MarketSignalNetwork — 3-layer feedforward net.
 * Input: market feature vector (price, volume, RSI, MACD, momentum, etc.)
 * Output: bullish probability [0,1] per asset class
 */
export class MarketSignalNetwork {
  constructor(inputSize = 12, hiddenSize = 32, outputSize = 6) {
    this.layers = [
      new DenseLayer(inputSize, hiddenSize, 'relu'),
      new DenseLayer(hiddenSize, hiddenSize, 'tanh'),
      new DenseLayer(hiddenSize, outputSize, 'sigmoid'),
    ];
    this.optimizer = new AdamOptimizer({ lr: 0.003, beta1: 0.9, beta2: 0.999 });
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    this.trainingStep = 0;
    this.lossHistory = [];
  }

  forward(inputVec) {
    // inputVec: plain Array of length inputSize
    const padded = inputVec.slice(0, this.inputSize);
    while (padded.length < this.inputSize) padded.push(0);
    let x = new Tensor(padded, [1, this.inputSize]);
    for (const layer of this.layers) {
      x = layer.forward(x);
    }
    return x; // [1, outputSize] sigmoid output
  }

  /**
   * One training step given input features and target signal vector.
   * Returns { loss, output, weights_norm }
   */
  train(inputVec, targetVec) {
    // Forward
    const output = this.forward(inputVec);
    // MSE loss vs target
    const target = new Tensor(targetVec, [1, this.outputSize]);
    const loss = output.mseLoss(target);
    // Error signal
    const errData = output.data.map((v, i) => v - (targetVec[i] || 0));
    let errTensor = new Tensor(errData, [1, this.outputSize]);
    // Backward through layers (reversed)
    for (let i = this.layers.length - 1; i >= 0; i--) {
      errTensor = this.layers[i].backward(errTensor, this.optimizer, `l${i}`);
    }
    this.trainingStep++;
    this.lossHistory.push(loss);
    if (this.lossHistory.length > 200) this.lossHistory.shift();

    const weightsNorm = this.layers.reduce((acc, l) => acc + l.W.norm(), 0);

    return { loss, output: output.toArray(), weightsNorm };
  }

  /** Get human-readable summary of current network state */
  summary() {
    const avgLoss = this.lossHistory.length
      ? (this.lossHistory.reduce((a, b) => a + b, 0) / this.lossHistory.length).toFixed(6)
      : 'N/A';
    const adamState = this.optimizer.getState();
    return {
      steps: this.trainingStep,
      avgLoss,
      adamStep: adamState.t,
      adamLr: adamState.lr,
      layerShapes: this.layers.map(l => `${l.inputSize}→${l.outputSize}[${l.activation}]`),
    };
  }

  /** Produce a bullish signal string for a set of output probabilities */
  static interpretOutput(outputArr, assetNames) {
    return outputArr.map((prob, i) => ({
      asset: assetNames[i] || `Asset${i}`,
      bullishProb: prob,
      signal: prob > 0.65 ? '🟢 STRONG BUY' : prob > 0.5 ? '📈 BUY' : prob > 0.4 ? '⚪ NEUTRAL' : '🔴 AVOID',
    }));
  }
}
