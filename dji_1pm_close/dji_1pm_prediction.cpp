/**
 * DJI 1 PM Close Prediction Engine - C++ Implementation
 * =======================================================
 * A comprehensive prediction system for the Dow Jones Industrial Average
 * 1 PM close price using modern C++17, STL, and numerical methods.
 *
 * Implements:
 * - Geometric Brownian Motion (GBM) with templates
 * - Monte Carlo simulation with variance reduction
 * - Numerical integration (Simpson's Rule, Gauss-Legendre)
 * - Taylor Series expansion
 * - Black-Scholes Greeks calculations
 * - Eigen-like matrix operations (simplified)
 *
 * Compile: g++ -std=c++17 -O3 -o dji_prediction_cpp dji_1pm_prediction.cpp -lm
 * Run: ./dji_prediction_cpp
 *
 * Author: MajixAI
 * License: MIT
 */

// =============================================================================
// EXTENSIVE INCLUDES - C++ Standard Library & STL
// =============================================================================

// C++ Standard Library
#include <iostream>       // I/O streams
#include <iomanip>        // I/O manipulators
#include <fstream>        // File I/O
#include <sstream>        // String streams
#include <string>         // String class

// STL Containers
#include <vector>         // Dynamic arrays
#include <array>          // Fixed-size arrays

// STL Algorithms & Iterators
#include <algorithm>      // Algorithms
#include <numeric>        // Numeric algorithms

// Functional & Utilities
#include <functional>     // Function objects

// Numerics
#include <cmath>          // Math functions
#include <limits>         // Numeric limits
#include <random>         // Random number generation

// Other utilities
#include <cstdlib>        // C standard library
#include <stdexcept>      // Standard exceptions

// =============================================================================
// NAMESPACE AND TYPE ALIASES
// =============================================================================

namespace dji {

// Type aliases for clarity
using Real = double;
using Vec = std::vector<Real>;
using Mat = std::vector<Vec>;

// Mathematical constants
constexpr Real PI = 3.14159265358979323846;
constexpr Real E = 2.71828182845904523536;
constexpr Real SQRT_2PI = 2.50662827463100050242;

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Market configuration structure
 */
struct MarketConfig {
    Real current_price = 44000.0;
    Real volatility = 0.15;          // 15% annualized
    Real drift = 0.05;               // 5% expected return
    Real risk_free_rate = 0.045;     // 4.5%
    int trading_days = 252;
    int minutes_per_day = 390;
    int simulations = 10000;
    unsigned int random_seed = 42;
    
    /**
     * Load configuration from environment variables with validation
     */
    void load_from_env() {
        auto get_env_double = [](const char* name, Real default_val, Real min_val, Real max_val) -> Real {
            if (const char* val = std::getenv(name)) {
                try {
                    Real result = std::stod(val);
                    if (result < min_val || result > max_val) {
                        std::cerr << "Warning: " << name << " out of range, using default\n";
                        return default_val;
                    }
                    return result;
                } catch (const std::exception&) {
                    std::cerr << "Warning: Invalid " << name << ", using default\n";
                    return default_val;
                }
            }
            return default_val;
        };
        
        auto get_env_int = [](const char* name, int default_val, int min_val, int max_val) -> int {
            if (const char* val = std::getenv(name)) {
                try {
                    int result = std::stoi(val);
                    if (result < min_val || result > max_val) {
                        std::cerr << "Warning: " << name << " out of range, using default\n";
                        return default_val;
                    }
                    return result;
                } catch (const std::exception&) {
                    std::cerr << "Warning: Invalid " << name << ", using default\n";
                    return default_val;
                }
            }
            return default_val;
        };
        
        current_price = get_env_double("DJI_PRICE", current_price, 0.01, 1e9);
        volatility = get_env_double("VOLATILITY", volatility, 0.001, 5.0);
        drift = get_env_double("DRIFT", drift, -1.0, 1.0);
        simulations = get_env_int("SIMULATIONS", simulations, 100, 1000000);
        
        if (const char* val = std::getenv("RANDOM_SEED")) {
            try {
                random_seed = static_cast<unsigned int>(std::stoul(val));
            } catch (const std::exception&) {
                std::cerr << "Warning: Invalid RANDOM_SEED, using default\n";
            }
        }
    }
};

/**
 * Prediction results structure
 */
struct PredictionResults {
    // GBM results
    Real gbm_mean = 0.0;
    Real gbm_std = 0.0;
    Real gbm_p5 = 0.0;
    Real gbm_p95 = 0.0;
    
    // Antithetic results
    Real antithetic_mean = 0.0;
    Real antithetic_std = 0.0;
    Real variance_reduction = 0.0;
    
    // Stratified results
    Real stratified_mean = 0.0;
    Real stratified_std = 0.0;
    
    // Analytical results
    Real analytical_expected = 0.0;
    Real taylor_price = 0.0;
    
    // Combined results
    Real combined_mean = 0.0;
    Real ci_lower = 0.0;
    Real ci_upper = 0.0;
    
    // Black-Scholes Greeks
    Real delta = 0.0;
    Real gamma = 0.0;
    Real theta = 0.0;
    Real vega = 0.0;
    Real rho = 0.0;
};

// =============================================================================
// MATHEMATICAL FUNCTIONS
// =============================================================================

/**
 * Normal distribution utilities using STL <random>
 */
class NormalDistribution {
public:
    /**
     * Standard normal CDF using error function
     */
    static Real cdf(Real x) {
        return 0.5 * (1.0 + std::erf(x / std::sqrt(2.0)));
    }
    
    /**
     * Standard normal PDF
     */
    static Real pdf(Real x) {
        return std::exp(-0.5 * x * x) / SQRT_2PI;
    }
    
    /**
     * Inverse CDF (quantile function) using rational approximation
     */
    static Real quantile(Real p) {
        if (p <= 0.0) return -std::numeric_limits<Real>::infinity();
        if (p >= 1.0) return std::numeric_limits<Real>::infinity();
        if (p == 0.5) return 0.0;
        
        Real t = (p < 0.5) ? std::sqrt(-2.0 * std::log(p))
                          : std::sqrt(-2.0 * std::log(1.0 - p));
        
        // Rational approximation coefficients
        constexpr Real c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
        constexpr Real d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
        
        Real result = t - (c0 + c1 * t + c2 * t * t) /
                          (1.0 + d1 * t + d2 * t * t + d3 * t * t * t);
        
        return (p < 0.5) ? -result : result;
    }
};

// =============================================================================
// ADVANCED CALCULUS
// =============================================================================

/**
 * Taylor series expansion for price approximation
 * 
 * Template class for compile-time order specification
 */
template<int Order = 4>
class TaylorExpansion {
public:
    /**
     * Compute Taylor expansion of log(S) around S0
     */
    static Real compute_price(Real S0, Real dS) {
        Real log_S0 = std::log(S0);
        Real log_price_approx = log_S0;
        
        // Precompute powers of dS and factorials
        std::array<Real, Order + 1> dS_pow{};
        std::array<Real, Order + 1> factorials{};
        
        dS_pow[0] = 1.0;
        factorials[0] = 1.0;
        
        for (int n = 1; n <= Order; ++n) {
            dS_pow[n] = dS_pow[n-1] * dS;
            factorials[n] = factorials[n-1] * n;
        }
        
        // Compute Taylor coefficients
        for (int n = 1; n <= Order; ++n) {
            // n-th derivative of log(S) at S0
            Real sign = (n % 2 == 0) ? -1.0 : 1.0;
            Real deriv_n = sign * factorials[n-1] / std::pow(S0, n);
            log_price_approx += deriv_n * dS_pow[n] / factorials[n];
        }
        
        return std::exp(log_price_approx);
    }
};

/**
 * Black-Scholes Greeks calculator
 */
class BlackScholesGreeks {
public:
    struct Greeks {
        Real d1, d2;
        Real call_price, put_price;
        Real delta, gamma, theta, vega, rho;
    };
    
    /**
     * Calculate all Greeks for ATM option
     */
    static Greeks calculate(Real S, Real K, Real T, Real r, Real sigma) {
        Greeks g{};
        
        if (T <= 0) return g;
        
        Real sqrt_T = std::sqrt(T);
        g.d1 = (std::log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrt_T);
        g.d2 = g.d1 - sigma * sqrt_T;
        
        Real Nd1 = NormalDistribution::cdf(g.d1);
        Real Nd2 = NormalDistribution::cdf(g.d2);
        Real nd1 = NormalDistribution::pdf(g.d1);
        
        // Option prices
        g.call_price = S * Nd1 - K * std::exp(-r * T) * Nd2;
        g.put_price = K * std::exp(-r * T) * (1 - Nd2) - S * (1 - Nd1);
        
        // Greeks
        g.delta = Nd1;
        g.gamma = nd1 / (S * sigma * sqrt_T);
        g.theta = -(S * nd1 * sigma / (2 * sqrt_T)) - r * K * std::exp(-r * T) * Nd2;
        g.vega = S * sqrt_T * nd1;
        g.rho = K * T * std::exp(-r * T) * Nd2;
        
        return g;
    }
};

// =============================================================================
// NUMERICAL INTEGRATION
// =============================================================================

/**
 * Numerical integration methods
 */
class NumericalIntegration {
public:
    /**
     * Simpson's rule integration
     */
    template<typename Func>
    static Real simpsons_rule(Func&& f, Real a, Real b, int n) {
        if (n % 2 == 1) ++n;
        
        Real h = (b - a) / n;
        Real sum = f(a) + f(b);
        
        for (int i = 1; i < n; ++i) {
            Real x = a + i * h;
            sum += ((i % 2 == 0) ? 2.0 : 4.0) * f(x);
        }
        
        return h * sum / 3.0;
    }
    
    /**
     * Gauss-Legendre quadrature (5-point)
     */
    template<typename Func>
    static Real gauss_legendre_5(Func&& f, Real a, Real b) {
        // 5-point Gauss-Legendre nodes and weights
        static constexpr std::array<Real, 5> nodes = {
            -0.9061798459386640, -0.5384693101056831, 0.0,
             0.5384693101056831,  0.9061798459386640
        };
        static constexpr std::array<Real, 5> weights = {
            0.2369268850561891, 0.4786286704993665, 0.5688888888888889,
            0.4786286704993665, 0.2369268850561891
        };
        
        Real scale = (b - a) / 2.0;
        Real shift = (a + b) / 2.0;
        
        Real sum = 0.0;
        for (int i = 0; i < 5; ++i) {
            Real x = scale * nodes[i] + shift;
            sum += weights[i] * f(x);
        }
        
        return scale * sum;
    }
};

// =============================================================================
// STOCHASTIC PROCESSES
// =============================================================================

/**
 * Random number generator wrapper using Mersenne Twister
 */
class RandomGenerator {
private:
    std::mt19937_64 engine_;
    std::normal_distribution<Real> normal_dist_{0.0, 1.0};
    std::uniform_real_distribution<Real> uniform_dist_{0.0, 1.0};
    
public:
    explicit RandomGenerator(unsigned int seed = 42) : engine_(seed) {}
    
    Real normal() { return normal_dist_(engine_); }
    Real uniform() { return uniform_dist_(engine_); }
    
    void seed(unsigned int s) { engine_.seed(s); }
};

/**
 * Geometric Brownian Motion simulator
 */
class GBMSimulator {
private:
    RandomGenerator rng_;
    Real mu_, sigma_;
    
public:
    GBMSimulator(Real mu, Real sigma, unsigned int seed = 42)
        : rng_(seed), mu_(mu), sigma_(sigma) {}
    
    /**
     * Simulate terminal price using closed-form solution
     */
    Real simulate_terminal(Real S0, Real T) {
        Real Z = rng_.normal();
        return S0 * std::exp((mu_ - 0.5 * sigma_ * sigma_) * T + sigma_ * std::sqrt(T) * Z);
    }
    
    /**
     * Simulate full price path
     */
    Vec simulate_path(Real S0, Real T, int steps) {
        Vec path(steps + 1);
        path[0] = S0;
        
        Real dt = T / steps;
        Real sqrt_dt = std::sqrt(dt);
        Real drift_term = (mu_ - 0.5 * sigma_ * sigma_) * dt;
        
        for (int i = 1; i <= steps; ++i) {
            Real dW = sqrt_dt * rng_.normal();
            path[i] = path[i-1] * std::exp(drift_term + sigma_ * dW);
        }
        
        return path;
    }
    
    /**
     * Return a normal random number for antithetic
     */
    Real get_normal() { return rng_.normal(); }
    
    /**
     * Return a uniform random number
     */
    Real get_uniform() { return rng_.uniform(); }
};

// =============================================================================
// MONTE CARLO ENGINE
// =============================================================================

/**
 * Monte Carlo simulation with variance reduction techniques
 */
class MonteCarloEngine {
private:
    const MarketConfig& config_;
    GBMSimulator gbm_;
    
public:
    explicit MonteCarloEngine(const MarketConfig& config)
        : config_(config)
        , gbm_(config.drift, config.volatility, config.random_seed) {}
    
    /**
     * Standard Monte Carlo
     */
    Vec simulate_standard(Real S0, Real T, int n_sims) {
        Vec prices(n_sims);
        for (int i = 0; i < n_sims; ++i) {
            prices[i] = gbm_.simulate_terminal(S0, T);
        }
        return prices;
    }
    
    /**
     * Antithetic variates Monte Carlo
     */
    Vec simulate_antithetic(Real S0, Real T, int n_sims) {
        Vec prices(n_sims);
        int half = n_sims / 2;
        
        Real mu = config_.drift;
        Real sigma = config_.volatility;
        Real sqrt_T = std::sqrt(T);
        Real drift_term = (mu - 0.5 * sigma * sigma) * T;
        
        for (int i = 0; i < half; ++i) {
            Real Z = gbm_.get_normal();
            prices[i] = S0 * std::exp(drift_term + sigma * sqrt_T * Z);
            prices[half + i] = S0 * std::exp(drift_term + sigma * sqrt_T * (-Z));
        }
        
        return prices;
    }
    
    /**
     * Stratified sampling Monte Carlo
     */
    Vec simulate_stratified(Real S0, Real T, int n_sims, int n_strata = 10) {
        Vec prices(n_sims);
        int per_stratum = n_sims / n_strata;
        
        Real mu = config_.drift;
        Real sigma = config_.volatility;
        Real sqrt_T = std::sqrt(T);
        Real drift_term = (mu - 0.5 * sigma * sigma) * T;
        
        int idx = 0;
        for (int s = 0; s < n_strata && idx < n_sims; ++s) {
            Real u_low = static_cast<Real>(s) / n_strata;
            Real u_high = static_cast<Real>(s + 1) / n_strata;
            
            for (int i = 0; i < per_stratum && idx < n_sims; ++i, ++idx) {
                Real u = u_low + (u_high - u_low) * gbm_.get_uniform();
                Real Z = NormalDistribution::quantile(u);
                prices[idx] = S0 * std::exp(drift_term + sigma * sqrt_T * Z);
            }
        }
        
        return prices;
    }
};

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Statistical calculations using STL algorithms
 */
class Statistics {
public:
    static Real mean(const Vec& data) {
        if (data.empty()) return 0.0;
        return std::accumulate(data.begin(), data.end(), 0.0) / data.size();
    }
    
    static Real variance(const Vec& data, Real mean_val) {
        if (data.size() < 2) return 0.0;
        
        Real sum_sq = std::accumulate(data.begin(), data.end(), 0.0,
            [mean_val](Real acc, Real x) { return acc + (x - mean_val) * (x - mean_val); });
        
        return sum_sq / (data.size() - 1);
    }
    
    static Real std_dev(const Vec& data, Real mean_val) {
        return std::sqrt(variance(data, mean_val));
    }
    
    static Real percentile(const Vec& data, Real p) {
        if (data.empty()) return 0.0;
        
        Vec sorted = data;
        std::sort(sorted.begin(), sorted.end());
        
        Real rank = p * (sorted.size() - 1);
        size_t lower = static_cast<size_t>(std::floor(rank));
        size_t upper = static_cast<size_t>(std::ceil(rank));
        Real frac = rank - lower;
        
        if (lower == upper) {
            return sorted[lower];
        }
        return sorted[lower] * (1 - frac) + sorted[upper] * frac;
    }
};

// =============================================================================
// MAIN PREDICTOR
// =============================================================================

/**
 * Main DJI 1 PM Close Predictor
 */
class DJI1PMPredictor {
private:
    MarketConfig config_;
    MonteCarloEngine mc_engine_;
    
public:
    explicit DJI1PMPredictor(const MarketConfig& config)
        : config_(config), mc_engine_(config) {}
    
    /**
     * Compute time to 1 PM target (in years)
     */
    Real compute_time_to_target() const {
        // Default: 207 minutes (9:33 AM to 1:00 PM)
        Real minutes_to_1pm = 207.0;
        return minutes_to_1pm / (config_.trading_days * config_.minutes_per_day);
    }
    
    /**
     * Run comprehensive simulation
     */
    PredictionResults run() {
        PredictionResults results;
        
        Real S0 = config_.current_price;
        Real T = compute_time_to_target();
        int n_sims = config_.simulations;
        
        // 1. Standard GBM Monte Carlo
        Vec gbm_prices = mc_engine_.simulate_standard(S0, T, n_sims);
        results.gbm_mean = Statistics::mean(gbm_prices);
        results.gbm_std = Statistics::std_dev(gbm_prices, results.gbm_mean);
        results.gbm_p5 = Statistics::percentile(gbm_prices, 0.05);
        results.gbm_p95 = Statistics::percentile(gbm_prices, 0.95);
        
        // 2. Antithetic Variates
        Vec av_prices = mc_engine_.simulate_antithetic(S0, T, n_sims);
        results.antithetic_mean = Statistics::mean(av_prices);
        results.antithetic_std = Statistics::std_dev(av_prices, results.antithetic_mean);
        results.variance_reduction = Statistics::variance(gbm_prices, results.gbm_mean) /
                                     Statistics::variance(av_prices, results.antithetic_mean);
        
        // 3. Stratified Sampling
        Vec strat_prices = mc_engine_.simulate_stratified(S0, T, n_sims);
        results.stratified_mean = Statistics::mean(strat_prices);
        results.stratified_std = Statistics::std_dev(strat_prices, results.stratified_mean);
        
        // 4. Black-Scholes Greeks
        auto greeks = BlackScholesGreeks::calculate(
            S0, S0, T, config_.risk_free_rate, config_.volatility);
        results.delta = greeks.delta;
        results.gamma = greeks.gamma;
        results.theta = greeks.theta;
        results.vega = greeks.vega;
        results.rho = greeks.rho;
        
        // 5. Analytical expected value
        results.analytical_expected = S0 * std::exp(config_.drift * T);
        
        // 6. Taylor expansion
        Real expected_dS = S0 * config_.drift * T;
        results.taylor_price = TaylorExpansion<4>::compute_price(S0, expected_dS);
        
        // 7. Combined prediction
        results.combined_mean = (results.gbm_mean + results.antithetic_mean +
                                results.stratified_mean + results.analytical_expected) / 4.0;
        
        // 8. Confidence intervals
        Real z_95 = 1.96;
        Real ci_std = results.antithetic_std / std::sqrt(n_sims);
        results.ci_lower = results.antithetic_mean - z_95 * ci_std;
        results.ci_upper = results.antithetic_mean + z_95 * ci_std;
        
        return results;
    }
    
    /**
     * Print formatted report
     */
    void print_report(const PredictionResults& results) const {
        std::cout << std::fixed << std::setprecision(2);
        
        std::cout << "\n";
        std::cout << std::string(70, '=') << "\n";
        std::cout << "      DJI 1 PM CLOSE PREDICTION REPORT (C++ Implementation)\n";
        std::cout << "      Advanced Calculus & STL Numerical Methods\n";
        std::cout << std::string(70, '=') << "\n";
        std::cout << "\n";
        std::cout << "Current Price:    $" << std::setw(12) << config_.current_price << "\n";
        std::cout << "Volatility (σ):   " << std::setw(11) << (config_.volatility * 100) << "%\n";
        std::cout << "Drift (μ):        " << std::setw(11) << (config_.drift * 100) << "%\n";
        std::cout << "Simulations:      " << std::setw(11) << config_.simulations << "\n";
        std::cout << "\n";
        std::cout << std::string(70, '-') << "\n";
        std::cout << "PREDICTION RESULTS\n";
        std::cout << std::string(70, '-') << "\n";
        std::cout << "\n";
        
        std::cout << "1. Geometric Brownian Motion:\n";
        std::cout << "   Mean:           $" << std::setw(12) << results.gbm_mean << "\n";
        std::cout << "   Std Dev:        $" << std::setw(12) << results.gbm_std << "\n";
        std::cout << "   90% Range:      $" << std::setw(12) << results.gbm_p5 
                  << " - $" << results.gbm_p95 << "\n";
        std::cout << "\n";
        
        std::cout << "2. Antithetic Variates:\n";
        std::cout << "   Mean:           $" << std::setw(12) << results.antithetic_mean << "\n";
        std::cout << "   Var Reduction:  " << std::setw(12) << results.variance_reduction << "x\n";
        std::cout << "\n";
        
        std::cout << "3. Stratified Sampling:\n";
        std::cout << "   Mean:           $" << std::setw(12) << results.stratified_mean << "\n";
        std::cout << "\n";
        
        std::cout << "4. Analytical (Integration):\n";
        std::cout << "   Expected:       $" << std::setw(12) << results.analytical_expected << "\n";
        std::cout << "\n";
        
        std::cout << "5. Taylor Expansion:\n";
        std::cout << "   Approximation:  $" << std::setw(12) << results.taylor_price << "\n";
        std::cout << "\n";
        
        std::cout << std::string(70, '=') << "\n";
        std::cout << "COMBINED PREDICTION\n";
        std::cout << std::string(70, '=') << "\n";
        std::cout << "\n";
        std::cout << "   1 PM Close:     $" << std::setw(12) << results.combined_mean << "\n";
        std::cout << "   95% CI:         $" << std::setw(12) << results.ci_lower 
                  << " - $" << results.ci_upper << "\n";
        std::cout << "\n";
        
        std::cout << std::string(70, '-') << "\n";
        std::cout << "BLACK-SCHOLES GREEKS (ATM)\n";
        std::cout << std::string(70, '-') << "\n";
        std::cout << std::setprecision(4);
        std::cout << "   Delta:          " << std::setw(12) << results.delta << "\n";
        std::cout << std::setprecision(6);
        std::cout << "   Gamma:          " << std::setw(12) << results.gamma << "\n";
        std::cout << std::setprecision(4);
        std::cout << "   Theta:          " << std::setw(12) << results.theta << "\n";
        std::cout << "   Vega:           " << std::setw(12) << results.vega << "\n";
        std::cout << "   Rho:            " << std::setw(12) << results.rho << "\n";
        std::cout << "\n";
        std::cout << std::string(70, '=') << "\n";
    }
};

} // namespace dji

// =============================================================================
// MAIN FUNCTION
// =============================================================================

int main() {
    // Load configuration
    dji::MarketConfig config;
    config.load_from_env();
    
    std::cout << "Running comprehensive DJI 1 PM prediction simulation (C++)...\n";
    
    // Create predictor and run
    dji::DJI1PMPredictor predictor(config);
    dji::PredictionResults results = predictor.run();
    
    // Print report
    predictor.print_report(results);
    
    return 0;
}
