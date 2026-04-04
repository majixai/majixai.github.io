/**
 * yfinance_chart/worker.js — Web Worker for off-main-thread neural signal computation.
 *
 * The main thread posts a message with OHLCV + indicator data; this worker
 * performs all heavy computation (EKF approximation, feature extraction,
 * rolling indicators, neural-style probability calculation) and posts back a
 * structured signal result — without ever blocking the UI thread.
 *
 * Message protocol
 * ----------------
 * Incoming (main → worker):
 *   { type: 'COMPUTE_SIGNALS', ticker, data, forecast }
 *     data    : array of OHLCV+indicator records from the .dat file
 *     forecast: Bayesian forecast object (may be null)
 *
 * Outgoing (worker → main):
 *   { type: 'SIGNALS_READY', ticker, result }
 *     result.signal        : 'BUY' | 'HOLD' | 'SELL'
 *     result.buyProb       : number [0,1]
 *     result.holdProb      : number [0,1]
 *     result.sellProb      : number [0,1]
 *     result.confidence    : number [0,1]
 *     result.ekfState      : { logPrice, volatility, momentumAngle }
 *     result.neuralFeatures: { logReturn, rsiNorm, macdNorm, bbPos, volRatio, momentum, annVol }
 *     result.method        : string description
 *
 *   { type: 'WORKER_ERROR', ticker, message }
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SEQ_LEN     = 30;
const CLASSES     = ['BUY', 'HOLD', 'SELL'];
const EKF_MU      = 1e-4;
const EKF_KAPPA   = 2.0;
const EKF_THETA_V = 4e-4;
const EKF_DT      = 1.0;

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = function (evt) {
    const { type, ticker, data, forecast } = evt.data;

    if (type !== 'COMPUTE_SIGNALS') return;

    try {
        if (!Array.isArray(data) || data.length < 10) {
            throw new Error('Insufficient data for signal computation');
        }

        const closes  = data.map(d => d.Close  || d.close  || 0).filter(v => v > 0);
        const volumes = data.map(d => d.Volume  || d.volume || 0);
        const highs   = data.map(d => d.High    || d.high   || 0);
        const lows    = data.map(d => d.Low     || d.low    || 0);

        if (closes.length < 10) {
            throw new Error('Not enough valid close prices');
        }

        // Step 1: EKF state estimation
        const ekfState = runEKF(closes);

        // Step 2: Feature extraction
        const features = extractFeatures(closes, volumes, highs, lows);

        // Step 3: Neural-style probability from features + EKF
        const probs = computeProbabilities(features, ekfState, forecast);

        // Step 4: Format result
        const signalIdx = probs.indexOf(Math.max(...probs));
        const result = {
            signal:         CLASSES[signalIdx],
            buyProb:        +probs[0].toFixed(4),
            holdProb:       +probs[1].toFixed(4),
            sellProb:       +probs[2].toFixed(4),
            confidence:     +Math.max(...probs).toFixed(4),
            ekfState:       {
                logPrice:       +ekfState.logPrice.toFixed(6),
                volatility:     +ekfState.volatility.toFixed(8),
                momentumAngle:  +ekfState.momentumAngle.toFixed(6),
            },
            neuralFeatures: features.last,
            method:         'Worker: EKF + heuristic LSTM approximation',
        };

        self.postMessage({ type: 'SIGNALS_READY', ticker, result });

    } catch (err) {
        self.postMessage({ type: 'WORKER_ERROR', ticker, message: err.message });
    }
};

// ---------------------------------------------------------------------------
// EKF approximation (lightweight JS implementation)
// ---------------------------------------------------------------------------

/**
 * Run a simplified EKF over the log-price series.
 * Returns the final posterior state.
 */
function runEKF(closes) {
    const logPrices = closes.map(c => Math.log(Math.max(c, 1e-10)));
    const pRef = logPrices.reduce((s, v) => s + v, 0) / logPrices.length;

    let x = [pRef, EKF_THETA_V, 0.0];                    // [log_price, vol, theta]
    let P = [EKF_THETA_V, 0, 0, 0, EKF_THETA_V * EKF_THETA_V, 0, 0, 0, 0.1]; // 3×3 flat

    const q = buildQ();
    const R = 1e-4;

    for (const z of logPrices) {
        [x, P] = ekfStep(x, P, z, q, R, pRef);
    }

    return {
        logPrice:      x[0],
        volatility:    x[1],
        momentumAngle: x[2],
        pTrace:        P[0] + P[4] + P[8],
    };
}

function buildQ() {
    const qP = Math.max(EKF_THETA_V * EKF_DT + (EKF_MU * EKF_DT) ** 2, 1e-10);
    const qV = Math.max(0.3 ** 2 * EKF_THETA_V * EKF_DT, 1e-12);
    const qT = 1e-6;
    return [qP, 0, 0, 0, qV, 0, 0, 0, qT];
}

function ekfStep(x, P, z, Q, R, pRef) {
    // Process model
    const [p, v, theta] = x;
    const vClamped = Math.max(v, 1e-10);
    const xPrior = [
        p + EKF_MU * EKF_DT,
        Math.max(vClamped + EKF_KAPPA * (EKF_THETA_V - vClamped) * EKF_DT, 1e-10),
        theta + Math.atan(p - pRef) * EKF_DT,
    ];

    // Jacobian F
    const dev = p - pRef;
    const dThetadP = EKF_DT / (1.0 + dev * dev);
    const F = [1, 0, 0, 0, 1 - EKF_KAPPA * EKF_DT, 0, dThetadP, 0, 1];

    // P_prior = F P F' + Q
    const FP = mat3x3mul(F, P);
    const Ft = mat3x3t(F);
    let PPrior = mat3x3mul(FP, Ft);
    for (let i = 0; i < 9; i++) PPrior[i] += Q[i];
    PPrior = symmetrise(PPrior);

    // Update: S = P[0] + R, K = col0 / S
    const S = Math.max(PPrior[0] + R, 1e-14);
    const K = [PPrior[0] / S, PPrior[3] / S, PPrior[6] / S];

    const inn = z - xPrior[0];
    const xPost = [
        xPrior[0] + K[0] * inn,
        Math.max(xPrior[1] + K[1] * inn, 1e-10),
        xPrior[2] + K[2] * inn,
    ];

    // Joseph form covariance
    const IKH = [1 - K[0], 0, 0, -K[1], 1, 0, -K[2], 0, 1];
    const IKHP = mat3x3mul(IKH, PPrior);
    const IKHt = mat3x3t(IKH);
    let PPost = mat3x3mul(IKHP, IKHt);
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            PPost[i * 3 + j] += R * K[i] * K[j];
    PPost = symmetrise(PPost);
    PPost[1] = Math.max(PPost[1], 1e-10);

    return [xPost, PPost];
}

// ---------------------------------------------------------------------------
// Feature extraction
// ---------------------------------------------------------------------------

function extractFeatures(closes, volumes, highs, lows) {
    const n = closes.length;

    const logRets = closes.map((c, i) =>
        i === 0 ? 0 : clamp(Math.log(c / Math.max(closes[i - 1], 1e-10)), -0.5, 0.5)
    );

    const rsi = computeRSI(closes, 14);
    const ema12 = computeEMA(closes, 12);
    const ema26 = computeEMA(closes, 26);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const rollStd = rollingStd(closes, 20);
    const bbMid = rollingSMA(closes, 20);
    const bbStd = rollingStd(closes, 20);
    const volMA = rollingSMA(volumes, 20);

    const rows = [];
    for (let i = 0; i < n; i++) {
        const bbWidth = Math.max(2 * bbStd[i] * 2, 1e-10);
        rows.push({
            logReturn: logRets[i],
            rsiNorm:   (rsi[i] - 50) / 50,
            macdNorm:  clamp(macdLine[i] / (rollStd[i] + 1e-10), -3, 3),
            bbPos:     clamp((closes[i] - bbMid[i]) / bbWidth, -2, 2),
            volRatio:  clamp(volumes[i] / (volMA[i] + 1e-10) - 1, -2, 2),
            momentum:  clamp((closes[i] - (i >= 5 ? closes[i - 5] : closes[0])) /
                             (Math.max(i >= 5 ? closes[i - 5] : closes[0], 1e-10)), -0.5, 0.5),
            annVol:    clamp(rollingStdScalar(logRets, i, 20) * Math.sqrt(252), 0, 2),
        });
    }

    // Window mean of last SEQ_LEN rows
    const window = rows.slice(-SEQ_LEN);
    const mean = key => window.reduce((s, r) => s + r[key], 0) / window.length;

    return {
        all:  rows,
        last: rows[rows.length - 1] || {},
        windowMean: {
            logReturn: mean('logReturn'),
            rsiNorm:   mean('rsiNorm'),
            macdNorm:  mean('macdNorm'),
            bbPos:     mean('bbPos'),
            volRatio:  mean('volRatio'),
            momentum:  mean('momentum'),
            annVol:    mean('annVol'),
        },
    };
}

// ---------------------------------------------------------------------------
// Probability computation
// ---------------------------------------------------------------------------

/**
 * Heuristic neural-style probability using EKF posterior + feature window mean.
 * Mirrors the numpy fallback in neural_forecaster.py so results are comparable.
 */
function computeProbabilities(features, ekfState, forecast) {
    const wm = features.windowMean;

    // Bull score: weighted combination of momentum indicators
    let bullScore = (
        0.35 * wm.logReturn
        + 0.25 * wm.rsiNorm
        + 0.20 * wm.macdNorm
        + 0.20 * wm.momentum
    );

    // EKF adjustment
    const direction = clamp(ekfState.momentumAngle / (Math.PI / 2), -1, 1);
    const volDamp   = Math.exp(-ekfState.volatility * 1000);
    bullScore += direction * volDamp * 0.15;

    // Bayesian forecast adjustment
    if (forecast && typeof forecast.momentum_factor === 'number') {
        bullScore += forecast.momentum_factor * 0.10;
    }

    const bearScore = -bullScore + 0.05 * wm.annVol;
    const holdScore  = 0.30 - 0.50 * Math.abs(bullScore);

    return softmax([bullScore, holdScore, bearScore]);
}

function softmax(arr) {
    const max = Math.max(...arr);
    const exp = arr.map(v => Math.exp(v - max));
    const sum = exp.reduce((s, v) => s + v, 0);
    return exp.map(v => v / sum);
}

// ---------------------------------------------------------------------------
// Rolling indicator helpers
// ---------------------------------------------------------------------------

function computeEMA(arr, span) {
    const alpha = 2 / (span + 1);
    const out = new Array(arr.length);
    out[0] = arr[0];
    for (let i = 1; i < arr.length; i++)
        out[i] = alpha * arr[i] + (1 - alpha) * out[i - 1];
    return out;
}

function computeRSI(arr, period) {
    const n = arr.length;
    const alpha = 1 / period;
    let avgGain = 0, avgLoss = 0;
    const out = new Array(n).fill(50);
    for (let i = 1; i < n; i++) {
        const diff = arr[i] - arr[i - 1];
        avgGain = alpha * (diff > 0 ? diff : 0) + (1 - alpha) * avgGain;
        avgLoss = alpha * (diff < 0 ? -diff : 0) + (1 - alpha) * avgLoss;
        out[i] = avgLoss < 1e-10 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
}

function rollingSMA(arr, w) {
    const out = new Array(arr.length);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
        if (i >= w) sum -= arr[i - w];
        out[i] = sum / Math.min(i + 1, w);
    }
    return out;
}

function rollingStd(arr, w) {
    const out = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
        const start = Math.max(0, i - w + 1);
        const seg = arr.slice(start, i + 1);
        const mean = seg.reduce((s, v) => s + v, 0) / seg.length;
        const variance = seg.reduce((s, v) => s + (v - mean) ** 2, 0) / seg.length;
        out[i] = Math.sqrt(variance);
    }
    return out;
}

function rollingStdScalar(arr, i, w) {
    const start = Math.max(0, i - w + 1);
    const seg = arr.slice(start, i + 1);
    if (seg.length < 2) return 0;
    const mean = seg.reduce((s, v) => s + v, 0) / seg.length;
    const variance = seg.reduce((s, v) => s + (v - mean) ** 2, 0) / seg.length;
    return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// 3×3 matrix helpers (flat row-major arrays, length 9)
// ---------------------------------------------------------------------------

function mat3x3mul(A, B) {
    const C = new Array(9).fill(0);
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            for (let k = 0; k < 3; k++)
                C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
    return C;
}

function mat3x3t(A) {
    return [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
}

function symmetrise(M) {
    const S = [...M];
    for (let i = 0; i < 3; i++)
        for (let j = i + 1; j < 3; j++) {
            const avg = (S[i * 3 + j] + S[j * 3 + i]) * 0.5;
            S[i * 3 + j] = avg;
            S[j * 3 + i] = avg;
        }
    return S;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
