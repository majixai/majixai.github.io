import { OptionType } from '../types.js'; // Assuming types.js is in the same directory and has .js extension

// Standard Normal Cumulative Distribution Function (CNDF) - Abramowitz and Stegun approximation
/**
 * @param {number} x
 * @returns {number}
 */
function cnd(x) {
  const a1 = 0.319381530;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const p = 0.2316419;
  const L = Math.abs(x);
  const k = 1.0 / (1.0 + p * L);
  const y = 1.0 - (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-L * L / 2.0) *
            (a1 * k + a2 * k * k + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5));
  return x < 0 ? 1.0 - y : y;
}

// Probability Density Function (PDF) of standard normal
/**
 * @param {number} x
 * @returns {number}
 */
function pdf(x) {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

/**
 * @param {import('../types.js').BlackScholesInputs} inputs
 * @returns {import('../types.js').BlackScholesResults | { error: string }}
 */
export function calculateBlackScholes(inputs) {
  const S = parseFloat(inputs.stockPrice);
  const K = parseFloat(inputs.strikePrice);
  const T = parseFloat(inputs.timeToExpiration); // In years
  const r = parseFloat(inputs.riskFreeRate);   // Annualized decimal, e.g., 0.05 for 5%
  const sigma = parseFloat(inputs.volatility); // Annualized decimal, e.g., 0.2 for 20%

  if (isNaN(S) || S <= 0) return { error: "Stock Price must be positive." };
  if (isNaN(K) || K <= 0) return { error: "Strike Price must be positive." };
  if (isNaN(T) || T <= 0) return { error: "Time to Expiration must be positive." };
  if (isNaN(r) || r < 0) return { error: "Risk-Free Rate must be non-negative." }; // Can be 0 or negative in some scenarios
  if (isNaN(sigma) || sigma <= 0) return { error: "Volatility must be positive." };

  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  let callPrice;
  let putPrice;
  let callDelta;
  let putDelta;
  let gamma;
  let vega;
  let callTheta;
  let putTheta;
  let callRho;
  let putRho;

  if (inputs.optionType === OptionType.Call || !inputs.optionType) { // Calculate call if type is call or not specified (for full results)
    callPrice = S * cnd(d1) - K * Math.exp(-r * T) * cnd(d2);
    callDelta = cnd(d1);
    callTheta = -(S * pdf(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cnd(d2);
    callRho = K * T * Math.exp(-r * T) * cnd(d2);
  }

  if (inputs.optionType === OptionType.Put || !inputs.optionType) { // Calculate put if type is put or not specified
    putPrice = K * Math.exp(-r * T) * cnd(-d2) - S * cnd(-d1);
    putDelta = cnd(d1) - 1; // or -cnd(-d1)
    putTheta = -(S * pdf(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cnd(-d2);
    putRho = -K * T * Math.exp(-r * T) * cnd(-d2);
  }

  // Greeks common to both or calculated once
  gamma = pdf(d1) / (S * sigma * Math.sqrt(T));
  vega = S * pdf(d1) * Math.sqrt(T);

  /** @type {import('../types.js').BlackScholesResults} */
  const results = {};
  if (callPrice !== undefined) results.callPrice = callPrice;
  if (putPrice !== undefined) results.putPrice = putPrice;
  if (callDelta !== undefined) results.callDelta = callDelta;
  if (putDelta !== undefined) results.putDelta = putDelta;
  if (gamma !== undefined) results.gamma = gamma;
  if (vega !== undefined) results.vega = vega;
  if (callTheta !== undefined) results.callTheta = callTheta / 365; // Convert to daily theta
  if (putTheta !== undefined) results.putTheta = putTheta / 365; // Convert to daily theta
  if (callRho !== undefined) results.callRho = callRho / 100; // Rho per 1% change in r
  if (putRho !== undefined) results.putRho = putRho / 100; // Rho per 1% change in r

  return results;
}
