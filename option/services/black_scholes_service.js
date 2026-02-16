/**
 * Black-Scholes Service for option pricing.
 * Implements the Black-Scholes-Merton model for European options.
 */
export class BlackScholesService {
    /**
     * Standard normal cumulative distribution function (CDF).
     * Uses Abramowitz and Stegun approximation (Formula 7.1.26).
     * @param {number} x - Input value
     * @returns {number}
     */
    _cdf(x) {
        const p = 0.2316419;
        const b1 = 0.319381530;
        const b2 = -0.356563782;
        const b3 = 1.781477937;
        const b4 = -1.821255978;
        const b5 = 1.330274429;

        const t = 1.0 / (1.0 + p * Math.abs(x));
        const y = 1.0 - (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-x * x / 2.0) *
            (b1 * t + b2 * Math.pow(t, 2) + b3 * Math.pow(t, 3) +
             b4 * Math.pow(t, 4) + b5 * Math.pow(t, 5));

        return x < 0 ? 1.0 - y : y;
    }

    /**
     * Standard normal probability density function (PDF).
     * @param {number} x - Input value
     * @returns {number}
     */
    _pdf(x) {
        return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    }

    /**
     * Calculate d1 and d2 parameters.
     * @param {number} S - Current stock price
     * @param {number} K - Strike price
     * @param {number} T - Time to expiration (in years)
     * @param {number} r - Risk-free interest rate
     * @param {number} sigma - Volatility
     * @returns {Object}
     */
    calculateD1D2(S, K, T, r, sigma) {
        if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
            throw new Error('Invalid input: S, K, T, sigma must be positive');
        }

        const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);

        return { d1, d2 };
    }

    /**
     * Calculate call option price.
     * @param {number} S - Current stock price
     * @param {number} K - Strike price
     * @param {number} T - Time to expiration (in years)
     * @param {number} r - Risk-free interest rate
     * @param {number} sigma - Volatility
     * @returns {number}
     */
    callPrice(S, K, T, r, sigma) {
        const { d1, d2 } = this.calculateD1D2(S, K, T, r, sigma);
        return S * this._cdf(d1) - K * Math.exp(-r * T) * this._cdf(d2);
    }

    /**
     * Calculate put option price.
     * @param {number} S - Current stock price
     * @param {number} K - Strike price
     * @param {number} T - Time to expiration (in years)
     * @param {number} r - Risk-free interest rate
     * @param {number} sigma - Volatility
     * @returns {number}
     */
    putPrice(S, K, T, r, sigma) {
        const { d1, d2 } = this.calculateD1D2(S, K, T, r, sigma);
        return K * Math.exp(-r * T) * this._cdf(-d2) - S * this._cdf(-d1);
    }

    /**
     * Calculate all Greeks for an option.
     * @param {string} type - 'call' or 'put'
     * @param {number} S - Current stock price
     * @param {number} K - Strike price
     * @param {number} T - Time to expiration (in years)
     * @param {number} r - Risk-free interest rate
     * @param {number} sigma - Volatility
     * @returns {Object}
     */
    calculateGreeks(type, S, K, T, r, sigma) {
        const { d1, d2 } = this.calculateD1D2(S, K, T, r, sigma);
        const sqrtT = Math.sqrt(T);

        // Delta
        const delta = type === 'call' ? this._cdf(d1) : this._cdf(d1) - 1;

        // Gamma (same for calls and puts)
        const gamma = this._pdf(d1) / (S * sigma * sqrtT);

        // Theta
        const thetaTerm1 = -(S * this._pdf(d1) * sigma) / (2 * sqrtT);
        const thetaTerm2 = type === 'call'
            ? -r * K * Math.exp(-r * T) * this._cdf(d2)
            : r * K * Math.exp(-r * T) * this._cdf(-d2);
        const theta = (thetaTerm1 + thetaTerm2) / 365; // Daily theta

        // Vega (same for calls and puts)
        const vega = S * sqrtT * this._pdf(d1) / 100; // Per 1% change in volatility

        // Rho
        const rho = type === 'call'
            ? K * T * Math.exp(-r * T) * this._cdf(d2) / 100
            : -K * T * Math.exp(-r * T) * this._cdf(-d2) / 100;

        return {
            delta: delta,
            gamma: gamma,
            theta: theta,
            vega: vega,
            rho: rho
        };
    }

    /**
     * Calculate implied volatility using Newton-Raphson method.
     * @param {number} marketPrice - Market price of the option
     * @param {string} type - 'call' or 'put'
     * @param {number} S - Current stock price
     * @param {number} K - Strike price
     * @param {number} T - Time to expiration (in years)
     * @param {number} r - Risk-free interest rate
     * @param {number} initialGuess - Initial volatility guess
     * @param {number} tolerance - Convergence tolerance
     * @param {number} maxIterations - Maximum iterations
     * @returns {number|null}
     */
    impliedVolatility(marketPrice, type, S, K, T, r, initialGuess = 0.2, tolerance = 1e-6, maxIterations = 100) {
        let sigma = initialGuess;

        for (let i = 0; i < maxIterations; i++) {
            try {
                const price = type === 'call'
                    ? this.callPrice(S, K, T, r, sigma)
                    : this.putPrice(S, K, T, r, sigma);

                const { d1 } = this.calculateD1D2(S, K, T, r, sigma);
                const vega = S * Math.sqrt(T) * this._pdf(d1);

                if (vega < 1e-10) {
                    return null; // Vega too small, can't converge
                }

                const diff = price - marketPrice;
                if (Math.abs(diff) < tolerance) {
                    return sigma;
                }

                sigma = sigma - diff / vega;
                if (sigma <= 0) {
                    sigma = initialGuess / 2;
                }
            } catch (e) {
                return null;
            }
        }

        return null; // Did not converge
    }
}
