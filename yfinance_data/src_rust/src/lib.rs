//! ekf_core_rust — Rust EKF numerical core with PyO3 Python bindings.
//!
//! Provides high-performance implementations of:
//!   - Extended Kalman Filter predict/update steps
//!   - Batch EKF filtering over a price series
//!   - Rolling technical indicators (RSI, EMA, SMA, Bollinger Bands, MACD)
//!   - Feature extraction for the NeuralForecaster
//!
//! Build (requires maturin):
//!   cd yfinance_data/src_rust
//!   pip install maturin
//!   maturin develop          # installs as editable for the current Python env
//!   maturin build --release  # produces a .whl for distribution
//!
//! Python usage:
//!   import ekf_core_rust as rust
//!   filtered = rust.batch_filter(log_prices, mu=1e-4, kappa=2.0,
//!                                theta_v=4e-4, sigma_v=0.3, dt=1.0,
//!                                p_ref=0.0, r_noise=1e-4)
//!   features = rust.extract_features(close_arr, volume_arr)

use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;

// ---------------------------------------------------------------------------
// EKF state / covariance helpers
// ---------------------------------------------------------------------------

/// Symmetrise a 3×3 matrix stored as [row-major; 9 elements]: M = (M + Mᵀ) / 2
#[inline]
fn symmetrise(m: &mut [f64; 9]) {
    for i in 0..3 {
        for j in (i + 1)..3 {
            let avg = (m[i * 3 + j] + m[j * 3 + i]) * 0.5;
            m[i * 3 + j] = avg;
            m[j * 3 + i] = avg;
        }
    }
}

/// 3×3 matrix multiply: C = A × B  (row-major)
#[inline]
fn mat3x3_mul(a: &[f64; 9], b: &[f64; 9]) -> [f64; 9] {
    let mut c = [0f64; 9];
    for i in 0..3 {
        for j in 0..3 {
            for k in 0..3 {
                c[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
            }
        }
    }
    c
}

/// 3×3 transpose
#[inline]
fn mat3x3_t(a: &[f64; 9]) -> [f64; 9] {
    [a[0], a[3], a[6],
     a[1], a[4], a[7],
     a[2], a[5], a[8]]
}

/// EKF process model: advance state x = [log_price, volatility, momentum_angle] by dt
#[inline]
fn process_model(x: [f64; 3], mu: f64, kappa: f64, theta_v: f64, dt: f64, p_ref: f64) -> [f64; 3] {
    let (p, v, theta) = (x[0], x[1].max(1e-10), x[2]);
    [
        p + mu * dt,
        (v + kappa * (theta_v - v) * dt).max(1e-10),
        theta + (p - p_ref).atan() * dt,
    ]
}

/// Jacobian F = ∂f/∂x at state x
#[inline]
fn jacobian_f(x: [f64; 3], kappa: f64, dt: f64, p_ref: f64) -> [f64; 9] {
    let deviation = x[0] - p_ref;
    let d_theta_d_p = dt / (1.0 + deviation * deviation);
    [
        1.0, 0.0, 0.0,
        0.0, 1.0 - kappa * dt, 0.0,
        d_theta_d_p, 0.0, 1.0,
    ]
}

/// Build default process-noise covariance Q
#[inline]
fn build_q(mu: f64, kappa: f64, theta_v: f64, sigma_v: f64, dt: f64) -> [f64; 9] {
    let q_p = (theta_v * dt + (mu * dt).powi(2)).max(1e-10);
    let q_v = (sigma_v.powi(2) * theta_v * dt).max(1e-12);
    let q_t = 1e-6_f64;
    [
        q_p, 0.0, 0.0,
        0.0, q_v, 0.0,
        0.0, 0.0, q_t,
    ]
}

// ---------------------------------------------------------------------------
// Single EKF step (predict + update)
// ---------------------------------------------------------------------------

/// Run one EKF predict + update cycle.
///
/// Returns (x_posterior[3], P_posterior[9], innovation)
fn ekf_step_inner(
    x: [f64; 3],
    p_cov: [f64; 9],
    z: f64,
    q: &[f64; 9],
    r_noise: f64,
    mu: f64,
    kappa: f64,
    theta_v: f64,
    dt: f64,
    p_ref: f64,
) -> ([f64; 3], [f64; 9], f64) {
    // --- Predict step ---
    let f = jacobian_f(x, kappa, dt, p_ref);
    let x_prior = process_model(x, mu, kappa, theta_v, dt, p_ref);
    // P_prior = F P F' + Q
    let fp = mat3x3_mul(&f, &p_cov);
    let ft = mat3x3_t(&f);
    let mut p_prior = mat3x3_mul(&fp, &ft);
    for i in 0..9 {
        p_prior[i] += q[i];
    }
    symmetrise(&mut p_prior);

    // --- Update step ---
    // H = [1, 0, 0]  (observe log_price only)
    // S = H P H' + R  (scalar = p_prior[0,0] + R)
    let s = p_prior[0] + r_noise;
    let s_inv = if s.abs() > 1e-14 { 1.0 / s } else { 1.0 / 1e-14 };

    // K = P H' / S  →  K = col-0 of P_prior / S  (shape 3×1)
    let k = [p_prior[0] * s_inv, p_prior[3] * s_inv, p_prior[6] * s_inv];

    let z_hat = x_prior[0];
    let innovation = z - z_hat;
    let mut x_post = [
        x_prior[0] + k[0] * innovation,
        (x_prior[1] + k[1] * innovation).max(1e-10),
        x_prior[2] + k[2] * innovation,
    ];

    // Joseph-form covariance: (I - KH) P (I - KH)' + K R K'
    // I - KH: only column 0 is affected
    let i_kh: [f64; 9] = [
        1.0 - k[0], 0.0, 0.0,
        -k[1],      1.0, 0.0,
        -k[2],      0.0, 1.0,
    ];
    let ikp = mat3x3_mul(&i_kh, &p_prior);
    let ikh_t = mat3x3_t(&i_kh);
    let mut p_post = mat3x3_mul(&ikp, &ikh_t);
    // + K R K'
    for i in 0..3 {
        for j in 0..3 {
            p_post[i * 3 + j] += r_noise * k[i] * k[j];
        }
    }
    symmetrise(&mut p_post);

    // Keep volatility positive
    x_post[1] = x_post[1].max(1e-10);

    (x_post, p_post, innovation)
}

// ---------------------------------------------------------------------------
// Python-exported functions
// ---------------------------------------------------------------------------

/// Run EKF batch filter over a series of log-prices.
///
/// Parameters
/// ----------
/// log_prices : list[float]   log-price observations
/// mu         : float         log-price drift per step
/// kappa      : float         volatility mean-reversion speed
/// theta_v    : float         long-run variance
/// sigma_v    : float         volatility-of-volatility
/// dt         : float         time step (1.0 = one day)
/// p_ref      : float         reference log-price for momentum angle
/// r_noise    : float         measurement noise variance
///
/// Returns
/// -------
/// list of dicts: [{log_price, volatility, momentum_angle, innovation, p_trace}, ...]
#[pyfunction]
#[pyo3(signature = (
    log_prices,
    mu = 1e-4,
    kappa = 2.0,
    theta_v = 4e-4,
    sigma_v = 0.3,
    dt = 1.0,
    p_ref = 0.0,
    r_noise = 1e-4
))]
fn batch_filter(
    py: Python<'_>,
    log_prices: Vec<f64>,
    mu: f64,
    kappa: f64,
    theta_v: f64,
    sigma_v: f64,
    dt: f64,
    p_ref: f64,
    r_noise: f64,
) -> PyResult<Vec<PyObject>> {
    if log_prices.is_empty() {
        return Ok(vec![]);
    }

    let q = build_q(mu, kappa, theta_v, sigma_v, dt);

    // Initial state and covariance
    let mut x = [p_ref, theta_v, 0.0f64];
    let mut p_cov: [f64; 9] = [
        theta_v.max(1e-6), 0.0, 0.0,
        0.0, theta_v * theta_v, 0.0,
        0.0, 0.0, 0.1,
    ];

    let mut results = Vec::with_capacity(log_prices.len());

    for &z in &log_prices {
        let (x_post, p_post, innovation) =
            ekf_step_inner(x, p_cov, z, &q, r_noise, mu, kappa, theta_v, dt, p_ref);
        x = x_post;
        p_cov = p_post;

        let p_trace = p_cov[0] + p_cov[4] + p_cov[8];
        let d = pyo3::types::PyDict::new_bound(py);
        d.set_item("log_price", x[0])?;
        d.set_item("volatility", x[1])?;
        d.set_item("momentum_angle", x[2])?;
        d.set_item("innovation", innovation)?;
        d.set_item("p_trace", p_trace)?;
        results.push(d.into());
    }

    Ok(results)
}

/// Forecast future states from a given EKF posterior (no observations).
///
/// Parameters
/// ----------
/// x_post  : list[float, 3]   current posterior state [log_price, vol, theta]
/// p_post  : list[float, 9]   current posterior covariance (row-major)
/// n_steps : int              steps to forecast ahead
/// (remaining params same as batch_filter)
///
/// Returns
/// -------
/// list of dicts: [{log_price, volatility, momentum_angle, p_trace}, ...]
#[pyfunction]
#[pyo3(signature = (
    x_post,
    p_post,
    n_steps = 5,
    mu = 1e-4,
    kappa = 2.0,
    theta_v = 4e-4,
    sigma_v = 0.3,
    dt = 1.0,
    p_ref = 0.0
))]
fn predict_next(
    py: Python<'_>,
    x_post: Vec<f64>,
    p_post: Vec<f64>,
    n_steps: usize,
    mu: f64,
    kappa: f64,
    theta_v: f64,
    sigma_v: f64,
    dt: f64,
    p_ref: f64,
) -> PyResult<Vec<PyObject>> {
    if x_post.len() < 3 || p_post.len() < 9 {
        return Err(PyValueError::new_err("x_post must have 3 elements, p_post must have 9"));
    }
    let q = build_q(mu, kappa, theta_v, sigma_v, dt);
    let mut x: [f64; 3] = [x_post[0], x_post[1], x_post[2]];
    let mut p_cov: [f64; 9] = p_post[..9].try_into().expect("slice length mismatch");

    let mut forecasts = Vec::with_capacity(n_steps);
    for _ in 0..n_steps {
        // Predict step only (no observation)
        let f = jacobian_f(x, kappa, dt, p_ref);
        x = process_model(x, mu, kappa, theta_v, dt, p_ref);
        let fp = mat3x3_mul(&f, &p_cov);
        let ft = mat3x3_t(&f);
        p_cov = mat3x3_mul(&fp, &ft);
        for i in 0..9 {
            p_cov[i] += q[i];
        }
        symmetrise(&mut p_cov);
        let p_trace = p_cov[0] + p_cov[4] + p_cov[8];

        let d = pyo3::types::PyDict::new_bound(py);
        d.set_item("log_price", x[0])?;
        d.set_item("volatility", x[1])?;
        d.set_item("momentum_angle", x[2])?;
        d.set_item("p_trace", p_trace)?;
        forecasts.push(d.into());
    }
    Ok(forecasts)
}

/// Extract the 7-dimensional feature matrix from OHLCV arrays (fast Rust path).
///
/// Features: [log_ret, rsi_norm, macd_norm, bb_pos, vol_ratio, momentum, ann_vol]
///
/// Returns
/// -------
/// list[list[float]]  — shape (N, 7)
#[pyfunction]
fn extract_features(
    py: Python<'_>,
    close: Vec<f64>,
    volume: Vec<f64>,
) -> PyResult<Vec<PyObject>> {
    let n = close.len().min(volume.len());
    if n < 2 {
        return Ok(vec![]);
    }

    // Log returns
    let mut log_ret = vec![0f64; n];
    for i in 1..n {
        if close[i - 1] > 0.0 {
            log_ret[i] = (close[i] / close[i - 1]).ln().clamp(-0.5, 0.5);
        }
    }

    // RSI-14
    let rsi = rsi_wilder(&close, 14);

    // MACD
    let ema12 = ema_rust(&close, 12);
    let ema26 = ema_rust(&close, 26);
    let macd_line: Vec<f64> = ema12.iter().zip(&ema26).map(|(a, b)| a - b).collect();

    // Rolling std for normalisation
    let roll_std = rolling_std_rust(&close, 20);

    // Bollinger Bands
    let bb_mid = sma_rust(&close, 20);
    let bb_std = rolling_std_rust(&close, 20);

    // Volume MA20
    let vol_ma = sma_rust(&volume, 20);

    let mut feats: Vec<PyObject> = Vec::with_capacity(n);
    for i in 0..n {
        let bb_width = (2.0 * bb_std[i] * 2.0).max(1e-10);
        let bb_pos = ((close[i] - bb_mid[i]) / bb_width).clamp(-2.0, 2.0);

        let vol_ratio = (volume[i] / (vol_ma[i] + 1e-10) - 1.0).clamp(-2.0, 2.0);

        let prior5 = if i >= 5 { close[i - 5] } else { close[0] };
        let momentum = ((close[i] - prior5) / (prior5 + 1e-10)).clamp(-0.5, 0.5);

        let macd_norm = (macd_line[i] / (roll_std[i] + 1e-10)).clamp(-3.0, 3.0);
        let rsi_norm = (rsi[i] - 50.0) / 50.0;
        let ann_vol = (rolling_std_scalar(&log_ret, i, 20) * (252f64).sqrt()).clamp(0.0, 2.0);

        let row = pyo3::types::PyList::new_bound(
            py,
            &[log_ret[i], rsi_norm, macd_norm, bb_pos, vol_ratio, momentum, ann_vol],
        );
        feats.push(row.into());
    }
    Ok(feats)
}

/// Rolling RSI with Wilder smoothing.
#[pyfunction]
fn rolling_rsi(close: Vec<f64>, period: usize) -> Vec<f64> {
    rsi_wilder(&close, period)
}

/// Exponential moving average.
#[pyfunction]
fn rolling_ema(arr: Vec<f64>, span: usize) -> Vec<f64> {
    ema_rust(&arr, span)
}

/// Rolling standard deviation.
#[pyfunction]
fn rolling_std(arr: Vec<f64>, window: usize) -> Vec<f64> {
    rolling_std_rust(&arr, window)
}

// ---------------------------------------------------------------------------
// Internal Rust indicator helpers
// ---------------------------------------------------------------------------

fn ema_rust(arr: &[f64], span: usize) -> Vec<f64> {
    if arr.is_empty() {
        return vec![];
    }
    let alpha = 2.0 / (span as f64 + 1.0);
    let mut out = vec![0f64; arr.len()];
    out[0] = arr[0];
    for i in 1..arr.len() {
        out[i] = alpha * arr[i] + (1.0 - alpha) * out[i - 1];
    }
    out
}

fn ema_wilder(arr: &[f64], period: usize) -> Vec<f64> {
    if arr.is_empty() {
        return vec![];
    }
    let alpha = 1.0 / period as f64;
    let mut out = vec![0f64; arr.len()];
    out[0] = arr[0];
    for i in 1..arr.len() {
        out[i] = alpha * arr[i] + (1.0 - alpha) * out[i - 1];
    }
    out
}

fn rsi_wilder(close: &[f64], period: usize) -> Vec<f64> {
    let n = close.len();
    let mut gain = vec![0f64; n];
    let mut loss = vec![0f64; n];
    for i in 1..n {
        let diff = close[i] - close[i - 1];
        if diff > 0.0 {
            gain[i] = diff;
        } else {
            loss[i] = -diff;
        }
    }
    let avg_g = ema_wilder(&gain, period);
    let avg_l = ema_wilder(&loss, period);
    avg_g
        .iter()
        .zip(&avg_l)
        .map(|(g, l)| {
            if *l < 1e-10 {
                100.0
            } else {
                100.0 - 100.0 / (1.0 + g / l)
            }
        })
        .collect()
}

fn sma_rust(arr: &[f64], w: usize) -> Vec<f64> {
    let n = arr.len();
    let mut out = vec![0f64; n];
    let mut sum = 0f64;
    for i in 0..n {
        sum += arr[i];
        let start = if i + 1 > w { i + 1 - w } else { 0 };
        if i + 1 > w {
            sum -= arr[start - 1];
        }
        out[i] = sum / (i + 1).min(w) as f64;
    }
    out
}

fn rolling_std_rust(arr: &[f64], w: usize) -> Vec<f64> {
    let n = arr.len();
    let mut out = vec![0f64; n];
    for i in 0..n {
        let start = if i + 1 > w { i + 1 - w } else { 0 };
        let seg = &arr[start..=i];
        let mean = seg.iter().sum::<f64>() / seg.len() as f64;
        let var = seg.iter().map(|&v| (v - mean).powi(2)).sum::<f64>() / seg.len() as f64;
        out[i] = var.sqrt();
    }
    out
}

fn rolling_std_scalar(arr: &[f64], i: usize, w: usize) -> f64 {
    let start = if i + 1 > w { i + 1 - w } else { 0 };
    let seg = &arr[start..=i];
    if seg.len() < 2 {
        return 0.0;
    }
    let mean = seg.iter().sum::<f64>() / seg.len() as f64;
    let var = seg.iter().map(|&v| (v - mean).powi(2)).sum::<f64>() / seg.len() as f64;
    var.sqrt()
}

// ---------------------------------------------------------------------------
// Module registration
// ---------------------------------------------------------------------------

#[pymodule]
fn ekf_core_rust(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(batch_filter, m)?)?;
    m.add_function(wrap_pyfunction!(predict_next, m)?)?;
    m.add_function(wrap_pyfunction!(extract_features, m)?)?;
    m.add_function(wrap_pyfunction!(rolling_rsi, m)?)?;
    m.add_function(wrap_pyfunction!(rolling_ema, m)?)?;
    m.add_function(wrap_pyfunction!(rolling_std, m)?)?;
    Ok(())
}
