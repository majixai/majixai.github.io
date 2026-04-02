/*
 * predictive_ledger/kinematics.c
 *
 * Emscripten-ready C engine for the Predictive Ledger Engine.
 *
 * Compile to WebAssembly:
 *   emcc kinematics.c -O3 -s WASM=1 \
 *        -s EXPORTED_FUNCTIONS='["_calculate_projection","_calculate_velocity",
 *            "_calculate_acceleration","_calculate_jerk","_compute_sma",
 *            "_compute_ema","_compute_rsi","_compute_macd_line",
 *            "_kalman_init","_kalman_predict","_kalman_update",
 *            "_sha256_ledger","_verify_ledger_hash","_compute_statistics",
 *            "_compute_bollinger_upper","_compute_bollinger_lower",
 *            "_compute_atr","_compute_vwap","_compute_correlation"]' \
 *        -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString"]' \
 *        -s ALLOW_MEMORY_GROWTH=1 \
 *        -o static/wasm_module.js
 *
 * Without Emscripten (native test build):
 *   gcc -O2 -Wall -Wextra -lm kinematics.c -o kinematics_test
 *
 * All exported functions are marked EMSCRIPTEN_KEEPALIVE so the linker does
 * not strip them during dead-code elimination.  When compiled natively the
 * macro expands to nothing (see the compat define below).
 */

#ifdef __EMSCRIPTEN__
#  include <emscripten.h>
#else
   /* Allow native compilation without Emscripten headers */
#  define EMSCRIPTEN_KEEPALIVE
#endif

#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ═══════════════════════════════════════════════════════════════════════════
 * SECTION 1 — KINEMATIC PROJECTION
 *
 * Models price movement as a physical system:
 *   position  = price
 *   velocity  = first-order finite difference  (Δp)
 *   acceleration = second-order finite difference (Δv)
 *   jerk         = third-order finite difference  (Δa)
 *
 * Constant-acceleration extrapolation (used in the JS PredictiveLedger):
 *   C_{t+1} = C_t + v_t + 0.5 · a_t
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * calculate_velocity — first-order finite difference of price.
 *
 *   v_t = p_t − p_{t−1}
 *
 * A positive value indicates upward momentum; negative indicates downward.
 */
EMSCRIPTEN_KEEPALIVE
double calculate_velocity(double p_t, double p_prev)
{
    return p_t - p_prev;
}

/**
 * calculate_acceleration — second-order finite difference.
 *
 *   a_t = v_t − v_{t−1}  =  (p_t − p_{t−1}) − (p_{t−1} − p_{t−2})
 *
 * Acceleration captures whether the momentum is speeding up or slowing down.
 * Used to weight the kinematic projection more conservatively near reversals.
 */
EMSCRIPTEN_KEEPALIVE
double calculate_acceleration(double v_t, double v_prev)
{
    return v_t - v_prev;
}

/**
 * calculate_jerk — third-order finite difference.
 *
 *   j_t = a_t − a_{t−1}
 *
 * Jerk measures the rate of change of acceleration.  A large positive jerk
 * can signal an impending trend change (the acceleration itself is turning).
 * Used as an auxiliary feature for the ensemble model.
 */
EMSCRIPTEN_KEEPALIVE
double calculate_jerk(double a_t, double a_prev)
{
    return a_t - a_prev;
}

/**
 * calculate_projection — constant-acceleration kinematic price extrapolation.
 *
 *   C_{t+1} = C_t + v_t + 0.5 · a_t
 *
 * Derived from the classical kinematics equation:
 *   x(t) = x_0 + v_0 t + ½ a t²
 * evaluated at t = 1 period into the future.
 *
 * Parameters
 * ----------
 * latest : most recent close price C_t
 * v_t    : velocity at time t  (calculate_velocity)
 * a_t    : acceleration at time t  (calculate_acceleration)
 *
 * Returns
 * -------
 * Projected next-period close price.
 */
EMSCRIPTEN_KEEPALIVE
double calculate_projection(double latest, double v_t, double a_t)
{
    return latest + v_t + (0.5 * a_t);
}

/**
 * calculate_projection_with_jerk — fourth-order kinematic extrapolation.
 *
 *   C_{t+1} = C_t + v_t + 0.5 · a_t + (1/6) · j_t
 *
 * Incorporates the third derivative for slightly longer look-ahead windows.
 * Use with caution: higher-order terms amplify noise.
 */
EMSCRIPTEN_KEEPALIVE
double calculate_projection_with_jerk(double latest,
                                       double v_t,
                                       double a_t,
                                       double j_t)
{
    return latest + v_t + (0.5 * a_t) + ((1.0 / 6.0) * j_t);
}

/**
 * compute_kinematic_suite — compute all kinematic quantities from a price
 * window of at least 3 values.
 *
 * Writes results to the provided output array:
 *   out[0] = velocity        (p[n-1] - p[n-2])
 *   out[1] = acceleration    (v_t - v_{t-1})
 *   out[2] = jerk            (a_t - a_{t-1}) — requires n >= 4
 *   out[3] = projection      (C_t + v_t + 0.5 * a_t)
 *   out[4] = proj_with_jerk  (requires n >= 4; same as projection if n == 3)
 *
 * Returns 0 on success, -1 if n < 3.
 */
EMSCRIPTEN_KEEPALIVE
int compute_kinematic_suite(const double *prices, int n, double *out)
{
    if (n < 3 || !prices || !out) return -1;

    double v_t    = calculate_velocity(prices[n-1], prices[n-2]);
    double v_prev = calculate_velocity(prices[n-2], prices[n-3]);
    double a_t    = calculate_acceleration(v_t, v_prev);
    double j_t    = 0.0;

    if (n >= 4) {
        double v_pp   = calculate_velocity(prices[n-3], prices[n-4]);
        double a_prev = calculate_acceleration(v_prev, v_pp);
        j_t = calculate_jerk(a_t, a_prev);
    }

    out[0] = v_t;
    out[1] = a_t;
    out[2] = j_t;
    out[3] = calculate_projection(prices[n-1], v_t, a_t);
    out[4] = (n >= 4)
             ? calculate_projection_with_jerk(prices[n-1], v_t, a_t, j_t)
             : out[3];
    return 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SECTION 2 — TECHNICAL INDICATORS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * compute_mean — arithmetic mean of n values.
 */
EMSCRIPTEN_KEEPALIVE
double compute_mean(const double *arr, int n)
{
    if (n <= 0 || !arr) return 0.0;
    double sum = 0.0;
    for (int i = 0; i < n; i++) sum += arr[i];
    return sum / (double)n;
}

/**
 * compute_variance — population variance (divide by n).
 */
EMSCRIPTEN_KEEPALIVE
double compute_variance(const double *arr, int n)
{
    if (n <= 1 || !arr) return 0.0;
    double mean = compute_mean(arr, n);
    double sq_sum = 0.0;
    for (int i = 0; i < n; i++) {
        double d = arr[i] - mean;
        sq_sum += d * d;
    }
    return sq_sum / (double)n;
}

/**
 * compute_std — population standard deviation.
 */
EMSCRIPTEN_KEEPALIVE
double compute_std(const double *arr, int n)
{
    return sqrt(compute_variance(arr, n));
}

/**
 * compute_correlation — Pearson correlation coefficient between x and y.
 */
EMSCRIPTEN_KEEPALIVE
double compute_correlation(const double *x, const double *y, int n)
{
    if (n <= 1 || !x || !y) return 0.0;
    double mx = compute_mean(x, n);
    double my = compute_mean(y, n);
    double num = 0.0, dx2 = 0.0, dy2 = 0.0;
    for (int i = 0; i < n; i++) {
        double dx = x[i] - mx;
        double dy = y[i] - my;
        num  += dx * dy;
        dx2  += dx * dx;
        dy2  += dy * dy;
    }
    double denom = sqrt(dx2 * dy2);
    return (denom < 1e-12) ? 0.0 : (num / denom);
}

/**
 * compute_statistics — compute mean, std, min, max, and range in one pass.
 * out[0]=mean, out[1]=std, out[2]=min, out[3]=max, out[4]=range
 */
EMSCRIPTEN_KEEPALIVE
int compute_statistics(const double *arr, int n, double *out)
{
    if (n <= 0 || !arr || !out) return -1;
    double mn = arr[0], mx = arr[0], sum = 0.0, sq = 0.0;
    for (int i = 0; i < n; i++) {
        sum += arr[i];
        sq  += arr[i] * arr[i];
        if (arr[i] < mn) mn = arr[i];
        if (arr[i] > mx) mx = arr[i];
    }
    double mean = sum / n;
    double var  = (sq / n) - (mean * mean);
    out[0] = mean;
    out[1] = sqrt(var > 0.0 ? var : 0.0);
    out[2] = mn;
    out[3] = mx;
    out[4] = mx - mn;
    return 0;
}

/**
 * compute_sma — Simple Moving Average.
 *
 * Writes (n - window + 1) values into out[].
 * Returns number of output values, or -1 on error.
 *
 *   SMA_t = (1/window) Σ_{i=0}^{window−1} prices[t−i]
 */
EMSCRIPTEN_KEEPALIVE
int compute_sma(const double *prices, int n, int window, double *out)
{
    if (!prices || !out || window <= 0 || n < window) return -1;
    int count = n - window + 1;
    for (int i = 0; i < count; i++) {
        double sum = 0.0;
        for (int j = 0; j < window; j++) sum += prices[i + j];
        out[i] = sum / (double)window;
    }
    return count;
}

/**
 * compute_ema — Exponential Moving Average.
 *
 * Smoothing factor: α = 2 / (period + 1)
 * Seeded with the SMA of the first `period` values.
 * Writes exactly n values into out[] (NaN for warm-up indices).
 */
EMSCRIPTEN_KEEPALIVE
int compute_ema(const double *prices, int n, int period, double *out)
{
    if (!prices || !out || period <= 0 || n < period) return -1;
    double alpha = 2.0 / (double)(period + 1);

    /* Fill warm-up values with NaN */
    for (int i = 0; i < period - 1; i++) out[i] = NAN;

    /* Seed with SMA */
    double seed = 0.0;
    for (int i = 0; i < period; i++) seed += prices[i];
    out[period - 1] = seed / (double)period;

    /* EMA recurrence */
    for (int i = period; i < n; i++)
        out[i] = alpha * prices[i] + (1.0 - alpha) * out[i - 1];

    return n;
}

/**
 * compute_rsi — Relative Strength Index (Wilder smoothing, period default 14).
 *
 *   RS  = avg_gain / avg_loss   (Wilder exponential average)
 *   RSI = 100 − 100 / (1 + RS)
 *
 * Writes n values into out[]; indices < period+1 are NaN.
 * Returns n on success, -1 on error.
 */
EMSCRIPTEN_KEEPALIVE
int compute_rsi(const double *prices, int n, int period, double *out)
{
    if (!prices || !out || period <= 0 || n <= period) return -1;

    for (int i = 0; i <= period; i++) out[i] = NAN;

    double avg_gain = 0.0, avg_loss = 0.0;

    /* Seed averages from first `period` deltas */
    for (int i = 1; i <= period; i++) {
        double delta = prices[i] - prices[i - 1];
        if (delta > 0.0) avg_gain += delta;
        else             avg_loss += (-delta);
    }
    avg_gain /= (double)period;
    avg_loss /= (double)period;

    /* Wilder smoothing */
    for (int i = period + 1; i < n; i++) {
        double delta = prices[i] - prices[i - 1];
        double gain  = (delta > 0.0) ? delta : 0.0;
        double loss  = (delta < 0.0) ? (-delta) : 0.0;
        avg_gain = (avg_gain * (double)(period - 1) + gain) / (double)period;
        avg_loss = (avg_loss * (double)(period - 1) + loss) / (double)period;
        double rs = (avg_loss < 1e-12) ? 1e12 : (avg_gain / avg_loss);
        out[i] = 100.0 - 100.0 / (1.0 + rs);
    }
    return n;
}

/**
 * compute_macd_line — MACD line only (EMA_fast − EMA_slow).
 *
 * Writes n values into out[]; warm-up indices are NaN.
 * Returns n on success, -1 on error.
 */
EMSCRIPTEN_KEEPALIVE
int compute_macd_line(const double *prices, int n,
                       int fast, int slow, double *out)
{
    if (!prices || !out || n < slow) return -1;

    double *ema_fast = (double *)malloc((size_t)n * sizeof(double));
    double *ema_slow = (double *)malloc((size_t)n * sizeof(double));
    if (!ema_fast || !ema_slow) { free(ema_fast); free(ema_slow); return -1; }

    compute_ema(prices, n, fast, ema_fast);
    compute_ema(prices, n, slow, ema_slow);

    for (int i = 0; i < n; i++) {
        if (isnan(ema_fast[i]) || isnan(ema_slow[i])) out[i] = NAN;
        else                                            out[i] = ema_fast[i] - ema_slow[i];
    }
    free(ema_fast);
    free(ema_slow);
    return n;
}

/**
 * compute_bollinger_upper / compute_bollinger_lower
 *
 * Bollinger band = SMA ± (num_std × rolling_stddev)
 *
 * Both functions write (n − period + 1) values into out[].
 * Returns number of values written, or -1 on error.
 */
EMSCRIPTEN_KEEPALIVE
int compute_bollinger_upper(const double *prices, int n,
                             int period, double num_std, double *out)
{
    if (!prices || !out || period <= 0 || n < period) return -1;
    int count = n - period + 1;
    for (int i = 0; i < count; i++) {
        const double *w = prices + i;
        double mean = compute_mean(w, period);
        double std  = compute_std(w, period);
        out[i] = mean + num_std * std;
    }
    return count;
}

EMSCRIPTEN_KEEPALIVE
int compute_bollinger_lower(const double *prices, int n,
                             int period, double num_std, double *out)
{
    if (!prices || !out || period <= 0 || n < period) return -1;
    int count = n - period + 1;
    for (int i = 0; i < count; i++) {
        const double *w = prices + i;
        double mean = compute_mean(w, period);
        double std  = compute_std(w, period);
        out[i] = mean - num_std * std;
    }
    return count;
}

/**
 * compute_atr — Average True Range (Wilder smoothing).
 *
 *   TR_t = max(H_t − L_t, |H_t − C_{t−1}|, |L_t − C_{t−1}|)
 *   ATR  = Wilder EMA of TR over `period` bars
 *
 * Writes n values into out[]; indices < period are NaN.
 */
EMSCRIPTEN_KEEPALIVE
int compute_atr(const double *high, const double *low,
                const double *close, int n, int period, double *out)
{
    if (!high || !low || !close || !out || n <= period) return -1;

    double *tr = (double *)malloc((size_t)n * sizeof(double));
    if (!tr) return -1;

    tr[0] = NAN;
    for (int i = 1; i < n; i++) {
        double hl  = high[i] - low[i];
        double hpc = fabs(high[i]  - close[i - 1]);
        double lpc = fabs(low[i]   - close[i - 1]);
        tr[i] = (hl > hpc) ? ((hl > lpc) ? hl : lpc)
                            : ((hpc > lpc) ? hpc : lpc);
    }

    /* Seed ATR with simple mean of first `period` TRs */
    double seed = 0.0;
    for (int i = 1; i <= period; i++) seed += tr[i];

    for (int i = 0; i < period; i++) out[i] = NAN;
    out[period] = seed / (double)period;
    for (int i = period + 1; i < n; i++)
        out[i] = (out[i-1] * (double)(period - 1) + tr[i]) / (double)period;

    free(tr);
    return n;
}

/**
 * compute_vwap — Volume-Weighted Average Price.
 *
 *   VWAP_t = Σ_{i=0}^{t} (price_i × vol_i) / Σ_{i=0}^{t} vol_i
 *
 * Writes n values into out[].
 */
EMSCRIPTEN_KEEPALIVE
int compute_vwap(const double *prices, const double *volumes,
                 int n, double *out)
{
    if (!prices || !volumes || !out || n <= 0) return -1;
    double cum_pv = 0.0, cum_v = 0.0;
    for (int i = 0; i < n; i++) {
        cum_pv += prices[i] * volumes[i];
        cum_v  += volumes[i];
        out[i]  = (cum_v < 1e-12) ? prices[i] : (cum_pv / cum_v);
    }
    return n;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SECTION 3 — KALMAN FILTER (C implementation)
 *
 * State vector: x = [position, velocity]ᵀ (2×1)
 * Stored in a flat array: x[0]=position, x[1]=velocity
 * P is a 2×2 matrix stored row-major: P[0..3]
 * ═══════════════════════════════════════════════════════════════════════════ */

/* Kalman state structure — stored in a double[8] buffer:
 *   [0]   x[0]  position
 *   [1]   x[1]  velocity
 *   [2]   P[0]  P(0,0)
 *   [3]   P[1]  P(0,1)
 *   [4]   P[2]  P(1,0)
 *   [5]   P[3]  P(1,1)
 *   [6]   process_var
 *   [7]   obs_var
 */
#define KF_SIZE 8

/**
 * kalman_init — initialise a Kalman filter state buffer.
 *
 * state  : double[8] buffer (caller-allocated)
 * z0     : first observation (seeds position; velocity starts at 0)
 * pv     : process noise variance
 * ov     : observation noise variance
 */
EMSCRIPTEN_KEEPALIVE
void kalman_init(double *state, double z0, double pv, double ov)
{
    if (!state) return;
    state[0] = z0;    /* position */
    state[1] = 0.0;   /* velocity */
    state[2] = 1000.0; state[3] = 0.0;   /* P row 0 */
    state[4] = 0.0;    state[5] = 1000.0; /* P row 1 */
    state[6] = pv;
    state[7] = ov;
}

/**
 * kalman_predict — time-update step (constant-velocity model, dt=1).
 *
 * F = [[1,1],[0,1]],   Q ≈ pv * [[1,1],[1,1]] (simplified)
 *
 * Returns predicted position.
 */
EMSCRIPTEN_KEEPALIVE
double kalman_predict(double *state)
{
    if (!state) return 0.0;
    double pv = state[6];

    /* x = F x */
    double x0 = state[0] + state[1];   /* position + velocity */
    double x1 = state[1];              /* velocity unchanged   */

    /* P = F P Fᵀ + Q  (simplified Q = pv * I) */
    double p00 = state[2] + state[3] + state[4] + state[5] + pv;
    double p01 = state[3] + state[5];
    double p10 = state[4] + state[5];
    double p11 = state[5] + pv;

    state[0] = x0; state[1] = x1;
    state[2] = p00; state[3] = p01;
    state[4] = p10; state[5] = p11;

    return x0;
}

/**
 * kalman_update — measurement-update step.
 *
 * H = [1, 0],   R = ov (scalar)
 *
 * Returns filtered position.
 */
EMSCRIPTEN_KEEPALIVE
double kalman_update(double *state, double z)
{
    if (!state) return z;
    double ov = state[7];

    /* Innovation: y = z - H x */
    double y = z - state[0];

    /* Innovation covariance: S = H P Hᵀ + R = P[0,0] + R */
    double S = state[2] + ov;
    if (S < 1e-12) S = 1e-12;

    /* Kalman gain: K = P Hᵀ / S  (H picks column 0 of P) */
    double K0 = state[2] / S;
    double K1 = state[4] / S;

    /* State update: x = x + K y */
    state[0] += K0 * y;
    state[1] += K1 * y;

    /* Covariance update: P = (I - K H) P */
    double p00 = (1.0 - K0) * state[2];
    double p01 = (1.0 - K0) * state[3];
    double p10 = state[4] - K1 * state[2];
    double p11 = state[5] - K1 * state[3];

    state[2] = p00; state[3] = p01;
    state[4] = p10; state[5] = p11;

    return state[0];
}

/**
 * kalman_filter_sequence — run predict→update over an array of observations.
 *
 * filtered_out : caller-allocated array of length n (filtered positions)
 * velocity_out : caller-allocated array of length n (velocity estimates)
 * forecast_out : caller-allocated array of length n (one-step-ahead forecasts)
 *
 * Returns 0 on success.
 */
EMSCRIPTEN_KEEPALIVE
int kalman_filter_sequence(const double *obs, int n,
                            double pv, double ov,
                            double *filtered_out,
                            double *velocity_out,
                            double *forecast_out)
{
    if (!obs || !filtered_out || !velocity_out || !forecast_out || n <= 0)
        return -1;

    double state[KF_SIZE];
    kalman_init(state, obs[0], pv, ov);

    for (int i = 0; i < n; i++) {
        forecast_out[i]  = kalman_predict(state);
        filtered_out[i]  = kalman_update(state, obs[i]);
        velocity_out[i]  = state[1];
    }
    return 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SECTION 4 — SHA-256 FOR LEDGER INTEGRITY VERIFICATION
 *
 * Full FIPS 180-4 compliant SHA-256 implementation in C.
 * Used to hash serialised ledger entries and verify their integrity,
 * ensuring the "Copy Of Ledger" has not been tampered with.
 * ═══════════════════════════════════════════════════════════════════════════ */

static const uint32_t SHA256_K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};

static const uint32_t SHA256_H0[8] = {
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
};

/* Bitwise primitives */
#define ROTR32(x,n)   (((x)>>(n))|((x)<<(32u-(n))))
#define CH(x,y,z)     (((x)&(y))^(~(x)&(z)))
#define MAJ(x,y,z)    (((x)&(y))^((x)&(z))^((y)&(z)))
#define BSIG0(x)      (ROTR32(x, 2)^ROTR32(x,13)^ROTR32(x,22))
#define BSIG1(x)      (ROTR32(x, 6)^ROTR32(x,11)^ROTR32(x,25))
#define SSIG0(x)      (ROTR32(x, 7)^ROTR32(x,18)^((x)>> 3))
#define SSIG1(x)      (ROTR32(x,17)^ROTR32(x,19)^((x)>>10))
#define BE32_LOAD(p)  (((uint32_t)(p)[0]<<24)|((uint32_t)(p)[1]<<16)|  \
                       ((uint32_t)(p)[2]<< 8)| (uint32_t)(p)[3])
#define BE32_STORE(p,v) do{                               \
    (p)[0]=((v)>>24)&0xFF; (p)[1]=((v)>>16)&0xFF;        \
    (p)[2]=((v)>> 8)&0xFF; (p)[3]= (v)     &0xFF; }while(0)

static void sha256_compress(uint32_t state[8], const uint8_t block[64])
{
    uint32_t W[64], a,b,c,d,e,f,g,h, T1,T2;
    int i;
    for (i = 0;  i < 16; i++) W[i] = BE32_LOAD(block + i*4);
    for (i = 16; i < 64; i++)
        W[i] = SSIG1(W[i-2]) + W[i-7] + SSIG0(W[i-15]) + W[i-16];
    a=state[0]; b=state[1]; c=state[2]; d=state[3];
    e=state[4]; f=state[5]; g=state[6]; h=state[7];
    for (i = 0; i < 64; i++) {
        T1 = h + BSIG1(e) + CH(e,f,g) + SHA256_K[i] + W[i];
        T2 = BSIG0(a) + MAJ(a,b,c);
        h=g; g=f; f=e; e=d+T1;
        d=c; c=b; b=a; a=T1+T2;
    }
    state[0]+=a; state[1]+=b; state[2]+=c; state[3]+=d;
    state[4]+=e; state[5]+=f; state[6]+=g; state[7]+=h;
}

static void sha256_raw(const uint8_t *msg, size_t len, uint8_t out[32])
{
    uint32_t state[8];
    uint8_t  block[64];
    size_t   i;

    memcpy(state, SHA256_H0, 32);
    for (i = 0; i + 64 <= len; i += 64) sha256_compress(state, msg + i);

    size_t rem = len - i;
    memcpy(block, msg + i, rem);
    block[rem++] = 0x80;

    if (rem > 56) {
        memset(block + rem, 0, 64 - rem);
        sha256_compress(state, block);
        rem = 0;
    }
    memset(block + rem, 0, 56 - rem);

    uint64_t bit_len = (uint64_t)len * 8;
    block[56] = (uint8_t)((bit_len >> 56) & 0xFF);
    block[57] = (uint8_t)((bit_len >> 48) & 0xFF);
    block[58] = (uint8_t)((bit_len >> 40) & 0xFF);
    block[59] = (uint8_t)((bit_len >> 32) & 0xFF);
    block[60] = (uint8_t)((bit_len >> 24) & 0xFF);
    block[61] = (uint8_t)((bit_len >> 16) & 0xFF);
    block[62] = (uint8_t)((bit_len >>  8) & 0xFF);
    block[63] = (uint8_t)( bit_len        & 0xFF);
    sha256_compress(state, block);

    for (int k = 0; k < 8; k++) BE32_STORE(out + k*4, state[k]);
}

/* Convert 32-byte digest to lowercase hex string (65-byte buffer needed). */
static void sha256_to_hex(const uint8_t digest[32], char *hex_out)
{
    static const char hx[] = "0123456789abcdef";
    for (int i = 0; i < 32; i++) {
        hex_out[2*i]   = hx[(digest[i] >> 4) & 0xF];
        hex_out[2*i+1] = hx[ digest[i]       & 0xF];
    }
    hex_out[64] = '\0';
}

/**
 * sha256_ledger — compute SHA-256 of a UTF-8 ledger entry string.
 *
 * hex_out : caller-allocated buffer of at least 65 bytes.
 *           Receives lowercase hex digest (64 chars + NUL).
 */
EMSCRIPTEN_KEEPALIVE
void sha256_ledger(const char *data, char *hex_out)
{
    if (!data || !hex_out) return;
    uint8_t digest[32];
    sha256_raw((const uint8_t *)data, strlen(data), digest);
    sha256_to_hex(digest, hex_out);
}

/**
 * verify_ledger_hash — compare SHA-256(data) with expected_hash.
 *
 * Returns 1 if the hash matches (entry is intact), 0 if tampered,
 * -1 on invalid arguments.
 */
EMSCRIPTEN_KEEPALIVE
int verify_ledger_hash(const char *data, const char *expected_hash)
{
    if (!data || !expected_hash) return -1;
    if (strlen(expected_hash) != 64) return -1;
    char computed[65];
    sha256_ledger(data, computed);
    return (memcmp(computed, expected_hash, 64) == 0) ? 1 : 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SECTION 5 — BAYESIAN UTILITY FUNCTIONS
 *
 * Lightweight scalar Bayesian update for the kinematic prediction weight.
 * Used to adjust how much the kinematic projection is trusted relative to the
 * SMA-based Bayesian prior, without requiring full matrix inversion.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * bayesian_update_scalar — update a scalar Gaussian prior with one observation.
 *
 * Prior:       w ~ N(mu_prior, var_prior)
 * Likelihood:  y | w ~ N(x * w, noise_var)
 *
 * Posterior mean:     mu_post  = (mu_prior / var_prior + x * y / noise_var)
 *                                / (1/var_prior + x² / noise_var)
 * Posterior variance: var_post = 1 / (1/var_prior + x² / noise_var)
 *
 * Returns posterior mean; writes posterior variance to *var_post_out.
 */
EMSCRIPTEN_KEEPALIVE
double bayesian_update_scalar(double mu_prior, double var_prior,
                               double x, double y, double noise_var,
                               double *var_post_out)
{
    double prec_prior = 1.0 / var_prior;
    double prec_like  = (x * x) / noise_var;
    double prec_post  = prec_prior + prec_like;
    double var_post   = 1.0 / prec_post;
    double mu_post    = var_post * (prec_prior * mu_prior + (x * y) / noise_var);
    if (var_post_out) *var_post_out = var_post;
    return mu_post;
}

/**
 * arctan_jacobian_scalar — scalar arctangent Jacobian.
 *
 *   d/dx arctan(u(x))  =  (1 / (1 + u²)) · du/dx
 */
EMSCRIPTEN_KEEPALIVE
double arctan_jacobian_scalar(double u, double du)
{
    return (1.0 / (1.0 + u * u)) * du;
}

/**
 * arctan_jacobian_vec — element-wise arctangent Jacobian on arrays.
 *
 * Writes n values into out[].  Returns n on success, -1 on error.
 */
EMSCRIPTEN_KEEPALIVE
int arctan_jacobian_vec(const double *u, const double *du, int n, double *out)
{
    if (!u || !du || !out || n <= 0) return -1;
    for (int i = 0; i < n; i++)
        out[i] = arctan_jacobian_scalar(u[i], du[i]);
    return n;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SECTION 6 — NATIVE TEST ENTRY POINT (stripped by Emscripten)
 * ═══════════════════════════════════════════════════════════════════════════ */

#ifndef __EMSCRIPTEN__
int main(void)
{
    printf("=== kinematics.c native self-test ===\n");

    /* --- Kinematic suite --- */
    double prices[] = {100.0, 102.5, 105.3, 103.8, 106.2, 108.0};
    int n = (int)(sizeof prices / sizeof prices[0]);
    double kin[5];
    int rc = compute_kinematic_suite(prices, n, kin);
    printf("Kinematic suite (rc=%d):\n", rc);
    printf("  velocity=%.4f  accel=%.4f  jerk=%.4f\n", kin[0], kin[1], kin[2]);
    printf("  projection=%.4f  proj_jerk=%.4f\n", kin[3], kin[4]);

    /* --- SMA --- */
    double sma_out[4];
    int cnt = compute_sma(prices, n, 3, sma_out);
    printf("SMA(3) -> %d values: ", cnt);
    for (int i = 0; i < cnt; i++) printf("%.3f ", sma_out[i]);
    printf("\n");

    /* --- RSI --- */
    double rsi_prices[] = {
        44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.15,
        43.61,44.33,44.83,45.10,45.15,46.0,45.5
    };
    int rn = 15;
    double rsi_out[15];
    compute_rsi(rsi_prices, rn, 14, rsi_out);
    printf("RSI(14) last value: %.2f\n", rsi_out[14]);

    /* --- Kalman --- */
    double kf_obs[] = {100.0, 101.2, 99.8, 102.3, 103.5};
    double kfilt[5], kvel[5], kfcast[5];
    kalman_filter_sequence(kf_obs, 5, 0.01, 1.0, kfilt, kvel, kfcast);
    printf("Kalman filtered: ");
    for (int i = 0; i < 5; i++) printf("%.3f ", kfilt[i]);
    printf("\n");

    /* --- SHA-256 self-test against NIST vector "abc" --- */
    char hex[65];
    sha256_ledger("abc", hex);
    const char *expected = "ba7816bf8f01cfea414140de5dae2ec7"
                            "3b338c432d5d4ccd6cf6af13b28e8b57";
    printf("SHA-256(\"abc\") = %s\n", hex);
    printf("Expected       = %s\n", expected);
    printf("Match: %s\n", strcmp(hex, expected) == 0 ? "YES" : "NO");

    /* --- Verify ledger hash --- */
    char entry[] = "symbol=BTC;close=45000.00;volume=1200;ts=1711900000";
    char entry_hash[65];
    sha256_ledger(entry, entry_hash);
    int valid = verify_ledger_hash(entry, entry_hash);
    printf("Ledger hash valid: %d\n", valid);

    /* --- Arctan Jacobian --- */
    printf("arctan_jacobian(u=1.0, du=1.0) = %.6f (expected 0.5)\n",
           arctan_jacobian_scalar(1.0, 1.0));

    printf("All self-tests complete.\n");
    return 0;
}
#endif /* !__EMSCRIPTEN__ */
