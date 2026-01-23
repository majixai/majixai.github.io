/**
 * Advanced Mathematical Models for Financial Prediction
 * Implements cutting-edge mathematical techniques:
 * - Stochastic Calculus (Ito's Lemma, Brownian Motion)
 * - Fourier Analysis for Cycle Detection
 * - Wavelet Transforms for Multi-scale Analysis
 * - GARCH Models for Volatility Forecasting
 * - Heston Stochastic Volatility Model
 * - Neural Network Approximations
 * - Kalman Filtering for State Estimation
 * - Levy Processes for Jump Detection
 */

const AdvancedMath = {
    
    // ============================================
    // STOCHASTIC CALCULUS
    // ============================================
    
    /**
     * Geometric Brownian Motion simulation with drift and volatility
     * dS = μS dt + σS dW
     */
    geometricBrownianMotion(S0, mu, sigma, T, steps) {
        const dt = T / steps;
        const prices = [S0];
        let S = S0;
        
        for (let i = 0; i < steps; i++) {
            const dW = this.normalRandom() * Math.sqrt(dt);
            S = S * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * dW);
            prices.push(S);
        }
        
        return prices;
    },
    
    /**
     * Ornstein-Uhlenbeck process for mean reversion
     * dX = θ(μ - X)dt + σdW
     */
    ornsteinUhlenbeck(X0, theta, mu, sigma, T, steps) {
        const dt = T / steps;
        const values = [X0];
        let X = X0;
        
        for (let i = 0; i < steps; i++) {
            const dW = this.normalRandom() * Math.sqrt(dt);
            X = X + theta * (mu - X) * dt + sigma * dW;
            values.push(X);
        }
        
        return values;
    },
    
    /**
     * Heston Stochastic Volatility Model
     * dS = μS dt + √v S dW1
     * dv = κ(θ - v)dt + ξ√v dW2
     */
    hestonModel(S0, v0, mu, kappa, theta, xi, rho, T, steps) {
        const dt = T / steps;
        const prices = [S0];
        const volatilities = [v0];
        
        let S = S0;
        let v = v0;
        
        for (let i = 0; i < steps; i++) {
            const dW1 = this.normalRandom();
            const dW2 = rho * dW1 + Math.sqrt(1 - rho * rho) * this.normalRandom();
            
            // Ensure volatility stays positive (full truncation scheme)
            v = Math.max(0, v + kappa * (theta - v) * dt + xi * Math.sqrt(Math.max(0, v)) * dW2 * Math.sqrt(dt));
            
            // Price evolution
            S = S * Math.exp((mu - 0.5 * v) * dt + Math.sqrt(Math.max(0, v)) * dW1 * Math.sqrt(dt));
            
            prices.push(S);
            volatilities.push(v);
        }
        
        return { prices, volatilities };
    },
    
    /**
     * Jump Diffusion Model (Merton Model)
     * dS = μS dt + σS dW + S dJ
     */
    jumpDiffusion(S0, mu, sigma, lambda, jumpMean, jumpStd, T, steps) {
        const dt = T / steps;
        const prices = [S0];
        let S = S0;
        
        for (let i = 0; i < steps; i++) {
            const dW = this.normalRandom() * Math.sqrt(dt);
            
            // Jump component
            const jumpOccurs = Math.random() < lambda * dt;
            const jumpSize = jumpOccurs ? Math.exp(jumpMean + jumpStd * this.normalRandom()) - 1 : 0;
            
            S = S * (1 + jumpSize) * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * dW);
            prices.push(S);
        }
        
        return prices;
    },
    
    // ============================================
    // FOURIER ANALYSIS
    // ============================================
    
    /**
     * Fast Fourier Transform for cycle detection
     */
    fft(signal) {
        const N = signal.length;
        if (N <= 1) return signal;
        if (N % 2 !== 0) {
            // Pad to nearest power of 2
            const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
            signal = [...signal, ...Array(nextPow2 - N).fill(0)];
            return this.fft(signal);
        }
        
        // Cooley-Tukey FFT algorithm
        const even = this.fft(signal.filter((_, i) => i % 2 === 0));
        const odd = this.fft(signal.filter((_, i) => i % 2 === 1));
        
        const result = Array(N);
        for (let k = 0; k < N / 2; k++) {
            const t = this.complexExp(-2 * Math.PI * k / N);
            const oddMultiplied = this.complexMultiply(t, odd[k]);
            
            result[k] = this.complexAdd(even[k], oddMultiplied);
            result[k + N / 2] = this.complexSubtract(even[k], oddMultiplied);
        }
        
        return result;
    },
    
    /**
     * Inverse FFT
     */
    ifft(spectrum) {
        const N = spectrum.length;
        // Conjugate input
        const conjugated = spectrum.map(c => ({ re: c.re, im: -c.im }));
        // Apply FFT
        const result = this.fft(conjugated);
        // Conjugate and normalize
        return result.map(c => ({ re: c.re / N, im: -c.im / N }));
    },
    
    /**
     * Detect dominant cycles using FFT
     */
    detectCycles(prices) {
        const N = prices.length;
        const detrended = this.detrend(prices);
        
        // Convert to complex numbers
        const signal = detrended.map(x => ({ re: x, im: 0 }));
        
        // Apply FFT
        const spectrum = this.fft(signal);
        
        // Calculate power spectrum
        const power = spectrum.slice(0, N / 2).map((c, i) => ({
            frequency: i / N,
            period: i === 0 ? Infinity : N / i,
            power: Math.sqrt(c.re * c.re + c.im * c.im)
        }));
        
        // Find dominant frequencies
        const sorted = power.sort((a, b) => b.power - a.power);
        
        return sorted.slice(1, 6).map(p => ({
            period: Math.round(p.period),
            strength: p.power,
            frequency: p.frequency
        }));
    },
    
    // ============================================
    // WAVELET ANALYSIS
    // ============================================
    
    /**
     * Discrete Wavelet Transform (Haar wavelet)
     */
    waveletTransform(signal, level = 3) {
        let approximation = [...signal];
        const details = [];
        
        for (let l = 0; l < level; l++) {
            const N = approximation.length;
            const newApprox = [];
            const detail = [];
            
            for (let i = 0; i < Math.floor(N / 2); i++) {
                const a = approximation[2 * i];
                const b = approximation[2 * i + 1] || approximation[2 * i];
                newApprox.push((a + b) / Math.sqrt(2));
                detail.push((a - b) / Math.sqrt(2));
            }
            
            approximation = newApprox;
            details.push(detail);
        }
        
        return { approximation, details };
    },
    
    /**
     * Multi-resolution analysis for trend detection
     */
    multiResolutionAnalysis(prices) {
        const { approximation, details } = this.waveletTransform(prices, 4);
        
        return {
            longTermTrend: approximation,
            mediumTermFluctuations: details[3],
            shortTermNoise: details[0],
            trendStrength: this.calculateTrendStrength(approximation),
            noiseLevel: this.calculateNoiseLevel(details[0])
        };
    },
    
    // ============================================
    // GARCH MODELS
    // ============================================
    
    /**
     * GARCH(1,1) volatility model
     * σ²(t) = ω + α·ε²(t-1) + β·σ²(t-1)
     */
    garchModel(returns, omega = 0.00001, alpha = 0.1, beta = 0.85) {
        const n = returns.length;
        const variance = Array(n);
        
        // Initial variance
        variance[0] = this.variance(returns);
        
        for (let t = 1; t < n; t++) {
            const epsilon = returns[t - 1];
            variance[t] = omega + alpha * epsilon * epsilon + beta * variance[t - 1];
        }
        
        return variance.map(v => Math.sqrt(v)); // Return volatility (std dev)
    },
    
    /**
     * EGARCH model for asymmetric volatility
     */
    egarchModel(returns, omega = -0.1, alpha = 0.1, beta = 0.95, gamma = -0.05) {
        const n = returns.length;
        const logVariance = Array(n);
        
        logVariance[0] = Math.log(this.variance(returns));
        
        for (let t = 1; t < n; t++) {
            const z = returns[t - 1] / Math.sqrt(Math.exp(logVariance[t - 1]));
            logVariance[t] = omega + 
                           beta * logVariance[t - 1] + 
                           alpha * (Math.abs(z) - Math.sqrt(2 / Math.PI)) + 
                           gamma * z;
        }
        
        return logVariance.map(lv => Math.sqrt(Math.exp(lv)));
    },
    
    // ============================================
    // KALMAN FILTER
    // ============================================
    
    /**
     * Kalman Filter for state estimation
     */
    kalmanFilter(observations, processNoise = 0.001, measurementNoise = 0.01) {
        const n = observations.length;
        const estimates = Array(n);
        const errorEstimates = Array(n);
        
        // Initialize
        estimates[0] = observations[0];
        errorEstimates[0] = 1;
        
        for (let t = 1; t < n; t++) {
            // Prediction
            const predictedEstimate = estimates[t - 1];
            const predictedError = errorEstimates[t - 1] + processNoise;
            
            // Update
            const kalmanGain = predictedError / (predictedError + measurementNoise);
            estimates[t] = predictedEstimate + kalmanGain * (observations[t] - predictedEstimate);
            errorEstimates[t] = (1 - kalmanGain) * predictedError;
        }
        
        return { estimates, errorEstimates };
    },
    
    // ============================================
    // NEURAL NETWORK PREDICTION
    // ============================================
    
    /**
     * Simple feedforward neural network for price prediction
     */
    neuralNetworkPredict(prices, lookback = 10, horizon = 5) {
        const network = this.createNetwork([lookback, 20, 10, horizon]);
        const trainingData = this.prepareTrainingData(prices, lookback, horizon);
        
        // Train network
        this.trainNetwork(network, trainingData, 100);
        
        // Make prediction
        const lastData = prices.slice(-lookback);
        const normalized = this.normalize(lastData);
        const prediction = this.forwardPass(network, normalized);
        
        return this.denormalize(prediction, prices);
    },
    
    createNetwork(layers) {
        const network = [];
        for (let i = 1; i < layers.length; i++) {
            const layer = {
                weights: Array(layers[i]).fill(0).map(() => 
                    Array(layers[i - 1]).fill(0).map(() => (Math.random() - 0.5) * 2)
                ),
                biases: Array(layers[i]).fill(0).map(() => (Math.random() - 0.5) * 2),
                activation: i === layers.length - 1 ? 'linear' : 'relu'
            };
            network.push(layer);
        }
        return network;
    },
    
    forwardPass(network, input) {
        let activation = input;
        
        for (const layer of network) {
            const output = [];
            for (let i = 0; i < layer.weights.length; i++) {
                let sum = layer.biases[i];
                for (let j = 0; j < activation.length; j++) {
                    sum += activation[j] * layer.weights[i][j];
                }
                output.push(layer.activation === 'relu' ? Math.max(0, sum) : sum);
            }
            activation = output;
        }
        
        return activation;
    },
    
    trainNetwork(network, trainingData, epochs) {
        const learningRate = 0.001;
        
        for (let epoch = 0; epoch < epochs; epoch++) {
            for (const { input, target } of trainingData) {
                // Forward pass
                const activations = [input];
                let current = input;
                
                for (const layer of network) {
                    const output = this.forwardPass([layer], current);
                    activations.push(output);
                    current = output;
                }
                
                // Backward pass (simplified gradient descent)
                let error = activations[activations.length - 1].map((a, i) => a - target[i]);
                
                for (let l = network.length - 1; l >= 0; l--) {
                    const layer = network[l];
                    const prevActivation = activations[l];
                    
                    for (let i = 0; i < layer.weights.length; i++) {
                        layer.biases[i] -= learningRate * error[i];
                        for (let j = 0; j < layer.weights[i].length; j++) {
                            layer.weights[i][j] -= learningRate * error[i] * prevActivation[j];
                        }
                    }
                    
                    // Propagate error (simplified)
                    if (l > 0) {
                        const newError = Array(prevActivation.length).fill(0);
                        for (let i = 0; i < error.length; i++) {
                            for (let j = 0; j < layer.weights[i].length; j++) {
                                newError[j] += error[i] * layer.weights[i][j];
                            }
                        }
                        error = newError;
                    }
                }
            }
        }
    },
    
    prepareTrainingData(prices, lookback, horizon) {
        const data = [];
        for (let i = 0; i < prices.length - lookback - horizon; i++) {
            const input = this.normalize(prices.slice(i, i + lookback));
            const target = this.normalize(prices.slice(i + lookback, i + lookback + horizon));
            data.push({ input, target });
        }
        return data;
    },
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    normalRandom() {
        // Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    },
    
    complexExp(theta) {
        return { re: Math.cos(theta), im: Math.sin(theta) };
    },
    
    complexMultiply(a, b) {
        return {
            re: a.re * b.re - a.im * b.im,
            im: a.re * b.im + a.im * b.re
        };
    },
    
    complexAdd(a, b) {
        return { re: a.re + b.re, im: a.im + b.im };
    },
    
    complexSubtract(a, b) {
        return { re: a.re - b.re, im: a.im - b.im };
    },
    
    detrend(series) {
        const n = series.length;
        const mean = series.reduce((a, b) => a + b, 0) / n;
        
        // Linear detrending
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += series[i];
            sumXY += i * series[i];
            sumX2 += i * i;
        }
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        return series.map((y, i) => y - (slope * i + intercept));
    },
    
    variance(data) {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        return data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length;
    },
    
    calculateTrendStrength(approximation) {
        if (approximation.length < 2) return 0;
        const changes = [];
        for (let i = 1; i < approximation.length; i++) {
            changes.push(approximation[i] - approximation[i - 1]);
        }
        const positiveChanges = changes.filter(c => c > 0).length;
        return positiveChanges / changes.length;
    },
    
    calculateNoiseLevel(details) {
        return Math.sqrt(this.variance(details));
    },
    
    normalize(data) {
        const min = Math.min(...data);
        const max = Math.max(...data);
        return data.map(x => (x - min) / (max - min || 1));
    },
    
    denormalize(normalized, originalData) {
        const min = Math.min(...originalData);
        const max = Math.max(...originalData);
        return normalized.map(x => x * (max - min) + min);
    },
    
    // ============================================
    // ADVANCED MATHEMATICAL CONCEPTS
    // ============================================
    
    /**
     * Stokes' Theorem Application - Circulation and Flux
     * ∮_C F·dr = ∬_S (∇×F)·dS
     * Used for analyzing price momentum circulation
     */
    stokesCirculation(prices, volumes) {
        const n = prices.length;
        const circulation = [];
        
        for (let i = 2; i < n; i++) {
            // Vector field: F = (price_change, volume_change)
            const dx = prices[i] - prices[i-1];
            const dy = volumes ? volumes[i] - volumes[i-1] : 0;
            
            // Curl calculation (∇×F)
            const curl = dy - dx;
            
            // Line integral approximation
            circulation.push(curl);
        }
        
        return {
            circulation: circulation,
            totalCirculation: circulation.reduce((a, b) => a + b, 0),
            avgCirculation: circulation.reduce((a, b) => a + b, 0) / circulation.length
        };
    },
    
    /**
     * Green's Theorem for Area-based Analysis
     * ∮_C (P dx + Q dy) = ∬_D (∂Q/∂x - ∂P/∂y) dA
     * Used for pattern area calculations and closed curve analysis
     */
    greensTheoremArea(xCoords, yCoords) {
        if (xCoords.length !== yCoords.length || xCoords.length < 3) {
            return 0;
        }
        
        let area = 0;
        const n = xCoords.length;
        
        // Shoelace formula (Green's theorem application)
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += xCoords[i] * yCoords[j];
            area -= xCoords[j] * yCoords[i];
        }
        
        return Math.abs(area / 2);
    },
    
    /**
     * Injection/Bijection Analysis for Price Mapping
     * Tests if price movements are injective (one-to-one)
     * Useful for detecting reversals and unique price levels
     */
    injectionAnalysis(prices) {
        const uniqueLevels = new Set();
        const duplicateLevels = [];
        const supportResistance = [];
        
        // Round to 2 decimals for level detection
        prices.forEach((p, i) => {
            const level = Math.round(p * 100) / 100;
            if (uniqueLevels.has(level)) {
                duplicateLevels.push({ price: level, index: i });
            } else {
                uniqueLevels.add(level);
            }
        });
        
        // Find significant support/resistance (prices hit 3+ times)
        const levelCounts = {};
        duplicateLevels.forEach(({ price }) => {
            levelCounts[price] = (levelCounts[price] || 0) + 1;
        });
        
        Object.entries(levelCounts).forEach(([price, count]) => {
            if (count >= 2) {
                supportResistance.push({
                    price: parseFloat(price),
                    touches: count + 1,
                    strength: count / prices.length
                });
            }
        });
        
        return {
            uniqueRatio: uniqueLevels.size / prices.length,
            supportResistanceLevels: supportResistance.sort((a, b) => b.strength - a.strength),
            duplicateCount: duplicateLevels.length
        };
    },
    
    /**
     * Damped Harmonic Oscillator Model
     * m(d²x/dt²) + γ(dx/dt) + kx = 0
     * Models price oscillations with friction/resistance
     */
    dampedOscillator(prices, dampingRatio = 0.1) {
        const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
        const n = returns.length;
        
        // Estimate natural frequency from autocorrelation
        const omega0 = this.estimateNaturalFrequency(returns);
        const gamma = 2 * dampingRatio * omega0;
        
        // Damping regimes
        const dampingType = dampingRatio < 1 ? 'underdamped' : 
                           dampingRatio === 1 ? 'critically damped' : 'overdamped';
        
        // Calculate oscillation envelope
        const envelope = [];
        const phase = [];
        
        for (let t = 0; t < n; t++) {
            const decayFactor = Math.exp(-gamma * t);
            envelope.push(decayFactor);
            
            if (dampingRatio < 1) {
                const omegaD = omega0 * Math.sqrt(1 - dampingRatio * dampingRatio);
                phase.push(Math.cos(omegaD * t) * decayFactor);
            }
        }
        
        return {
            dampingType: dampingType,
            dampingRatio: dampingRatio,
            naturalFrequency: omega0,
            envelope: envelope,
            oscillationPhase: phase,
            halfLife: Math.log(2) / gamma
        };
    },
    
    estimateNaturalFrequency(returns) {
        // Estimate dominant frequency using autocorrelation
        const maxLag = Math.min(50, Math.floor(returns.length / 4));
        let maxCorr = 0;
        let bestLag = 1;
        
        for (let lag = 1; lag < maxLag; lag++) {
            const corr = this.autocorrelation(returns, lag);
            if (Math.abs(corr) > Math.abs(maxCorr) && lag > 5) {
                maxCorr = corr;
                bestLag = lag;
            }
        }
        
        return 2 * Math.PI / bestLag;
    },
    
    autocorrelation(series, lag) {
        const n = series.length - lag;
        const mean = series.reduce((a, b) => a + b, 0) / series.length;
        
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < n; i++) {
            numerator += (series[i] - mean) * (series[i + lag] - mean);
        }
        
        for (let i = 0; i < series.length; i++) {
            denominator += Math.pow(series[i] - mean, 2);
        }
        
        return numerator / denominator;
    },
    
    /**
     * Navier-Stokes Inspired Momentum Flow
     * ∂u/∂t + (u·∇)u = -∇p + ν∇²u + f
     * Models price momentum as fluid flow with viscosity
     */
    momentumFlow(prices, viscosity = 0.01) {
        const n = prices.length;
        const velocity = [];
        const acceleration = [];
        const pressure = [];
        
        // Calculate velocity (first derivative)
        for (let i = 1; i < n; i++) {
            velocity.push(prices[i] - prices[i-1]);
        }
        
        // Calculate acceleration (second derivative)
        for (let i = 1; i < velocity.length; i++) {
            acceleration.push(velocity[i] - velocity[i-1]);
        }
        
        // Calculate pressure gradient (third derivative approximation)
        for (let i = 1; i < acceleration.length; i++) {
            const pressureGrad = acceleration[i] - acceleration[i-1];
            pressure.push(pressureGrad);
        }
        
        // Apply viscous diffusion
        const diffusedVelocity = this.applyViscousDiffusion(velocity, viscosity);
        
        return {
            velocity: velocity,
            acceleration: acceleration,
            pressure: pressure,
            diffusedVelocity: diffusedVelocity,
            turbulence: this.calculateTurbulence(velocity),
            flowRegime: this.classifyFlowRegime(velocity, viscosity)
        };
    },
    
    applyViscousDiffusion(velocity, viscosity) {
        const diffused = [...velocity];
        const n = velocity.length;
        
        // Simple diffusion: v_new = v + ν(v_{i+1} - 2v_i + v_{i-1})
        for (let iter = 0; iter < 5; iter++) {
            const temp = [...diffused];
            for (let i = 1; i < n - 1; i++) {
                diffused[i] = temp[i] + viscosity * (temp[i+1] - 2*temp[i] + temp[i-1]);
            }
        }
        
        return diffused;
    },
    
    calculateTurbulence(velocity) {
        // Measure of velocity fluctuations
        const mean = velocity.reduce((a, b) => a + b, 0) / velocity.length;
        const fluctuations = velocity.map(v => Math.pow(v - mean, 2));
        return Math.sqrt(fluctuations.reduce((a, b) => a + b, 0) / velocity.length);
    },
    
    classifyFlowRegime(velocity, viscosity) {
        const avgVelocity = Math.abs(velocity.reduce((a, b) => a + b, 0) / velocity.length);
        const reynolds = avgVelocity / viscosity;
        
        if (reynolds < 100) return 'laminar';
        if (reynolds < 500) return 'transitional';
        return 'turbulent';
    },
    
    /**
     * Complex Analysis - Residue Theorem for Singularity Detection
     * Detects price singularities and critical points
     */
    findSingularities(prices) {
        const singularities = [];
        const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
        
        // Find discontinuities and sharp changes
        for (let i = 1; i < returns.length - 1; i++) {
            const change = Math.abs(returns[i]);
            const avgChange = (Math.abs(returns[i-1]) + Math.abs(returns[i+1])) / 2;
            
            // Detect jumps (singularities)
            if (change > avgChange * 3 && Math.abs(returns[i]) > 0.03) {
                singularities.push({
                    index: i + 1,
                    price: prices[i + 1],
                    magnitude: change,
                    type: returns[i] > 0 ? 'gap_up' : 'gap_down'
                });
            }
        }
        
        return singularities;
    },
    
    /**
     * Laplace Transform for System Response
     * L{f(t)} = ∫₀^∞ e^(-st)f(t)dt
     * Analyzes price response to impulses
     */
    laplaceTransform(prices, s = 1) {
        const n = prices.length;
        let real = 0;
        let imag = 0;
        
        for (let t = 0; t < n; t++) {
            const factor = Math.exp(-s * t);
            real += prices[t] * factor * Math.cos(s * t);
            imag += prices[t] * factor * Math.sin(s * t);
        }
        
        return {
            real: real / n,
            imag: imag / n,
            magnitude: Math.sqrt(real*real + imag*imag) / n,
            phase: Math.atan2(imag, real)
        };
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.AdvancedMath = AdvancedMath;
}
