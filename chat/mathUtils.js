// chat/mathUtils.js

/**
 * Calculates hyperbolic cosine, optionally scaled.
 * @param {number} x - The input value.
 * @param {object} [params] - Optional parameters.
 * @param {number} [params.scale=1] - Scaling factor for the amplitude.
 * @param {number} [params.xShift=0] - Horizontal shift for x.
 * @returns {number}
 */
function calculateCosh(x, params = {}) {
    const scale = params.scale === undefined ? 1 : params.scale;
    const xShift = params.xShift === undefined ? 0 : params.xShift;
    const val = x - xShift;
    return scale * (Math.exp(val) + Math.exp(-val)) / 2;
}

/**
 * Calculates a damped sine wave.
 * @param {number} t - The time variable.
 * @param {object} [params] - Parameters for the damping function.
 * @param {number} [params.amplitude=1] - Initial amplitude.
 * @param {number} [params.dampingFactor=0.1] - Damping factor (zeta).
 * @param {number} [params.frequency=1] - Angular frequency (omega_n).
 * @param {number} [params.phase=0] - Phase shift.
 * @returns {number}
 */
function calculateDampedOscillation(t, params = {}) {
    const amplitude = params.amplitude === undefined ? 1 : params.amplitude;
    const dampingFactor = params.dampingFactor === undefined ? 0.1 : params.dampingFactor;
    const frequency = params.frequency === undefined ? 1 : params.frequency;
    const phase = params.phase === undefined ? 0 : params.phase;

    // Using a common form: A * exp(-zeta*omega_n*t) * cos(omega_d*t - phi)
    // Here, let's simplify and assume params.frequency is omega_n and params.dampingFactor is zeta.
    // The damped frequency (omega_d) is omega_n * sqrt(1 - zeta^2).
    // For simplicity in parameterization, we'll use the provided frequency directly in cos,
    // which is common in some representations, or can be considered omega_d if zeta is small.
    // A more physically accurate model might require distinct natural and damped frequencies.
    return amplitude * Math.exp(-dampingFactor * t) * Math.cos(frequency * t - phase);
}
