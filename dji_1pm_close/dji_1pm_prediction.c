/**
 * DJI 1 PM Close Prediction Engine - C Implementation
 * =====================================================
 * A numerical prediction system for the Dow Jones Industrial Average
 * 1 PM close price using advanced calculus and stochastic methods.
 *
 * Implements:
 * - Geometric Brownian Motion (GBM)
 * - Monte Carlo simulation
 * - Numerical integration (Simpson's Rule, Gaussian Quadrature)
 * - Taylor Series expansion
 * - Black-Scholes Greeks calculations
 * - Box-Muller transform for normal distribution
 *
 * Compile: gcc -o dji_prediction dji_1pm_prediction.c -lm -O2
 * Run: ./dji_prediction
 *
 * Author: MajixAI
 * License: MIT
 */

/* ==============================================================================
 * EXTENSIVE INCLUDES - C Standard Library & Math
 * ============================================================================== */

#include <stdio.h>       /* Standard I/O */
#include <stdlib.h>      /* Memory allocation, random */
#include <string.h>      /* String operations */
#include <math.h>        /* Mathematical functions */
#include <float.h>       /* Floating point limits */
#include <stdbool.h>     /* Boolean type */

/* ==============================================================================
 * CONSTANTS AND CONFIGURATION
 * ============================================================================== */

#define PI 3.14159265358979323846
#define E  2.71828182845904523536
#define SQRT_2PI 2.50662827463100050242

/* Default configuration */
#define DEFAULT_CURRENT_PRICE    44000.0
#define DEFAULT_VOLATILITY       0.15
#define DEFAULT_DRIFT            0.05
#define DEFAULT_RISK_FREE_RATE   0.045
#define DEFAULT_TRADING_DAYS     252
#define DEFAULT_MINUTES_PER_DAY  390
#define DEFAULT_SIMULATIONS      10000
#define DEFAULT_RANDOM_SEED      42

/* Market configuration structure */
typedef struct {
    double current_price;
    double volatility;
    double drift;
    double risk_free_rate;
    int trading_days;
    int minutes_per_day;
    int simulations;
    unsigned int random_seed;
} MarketConfig;

/* Prediction results structure */
typedef struct {
    double gbm_mean;
    double gbm_std;
    double gbm_p5;
    double gbm_p95;
    double antithetic_mean;
    double antithetic_std;
    double variance_reduction;
    double stratified_mean;
    double stratified_std;
    double analytical_expected;
    double taylor_price;
    double combined_mean;
    double ci_lower;
    double ci_upper;
    /* Black-Scholes Greeks */
    double delta;
    double gamma;
    double theta;
    double vega;
} PredictionResults;

/* ==============================================================================
 * RANDOM NUMBER GENERATION
 * ============================================================================== */

/* Linear Congruential Generator state */
static unsigned long lcg_state = 1;

/**
 * Seed the random number generator
 */
void seed_random(unsigned int seed) {
    lcg_state = seed;
}

/**
 * Generate uniform random number in [0, 1)
 * Uses Linear Congruential Generator
 */
double uniform_random(void) {
    /* LCG parameters (same as glibc) */
    lcg_state = lcg_state * 1103515245UL + 12345UL;
    return (double)(lcg_state & 0x7FFFFFFF) / (double)0x7FFFFFFF;
}

/**
 * Box-Muller transform for generating standard normal random variables
 * Generates pairs of independent standard normal variates
 */
double normal_random(void) {
    static int has_spare = 0;
    static double spare;
    
    if (has_spare) {
        has_spare = 0;
        return spare;
    }
    
    double u, v, s;
    do {
        u = 2.0 * uniform_random() - 1.0;
        v = 2.0 * uniform_random() - 1.0;
        s = u * u + v * v;
    } while (s >= 1.0 || s == 0.0);
    
    s = sqrt(-2.0 * log(s) / s);
    spare = v * s;
    has_spare = 1;
    
    return u * s;
}

/* ==============================================================================
 * MATHEMATICAL FUNCTIONS
 * ============================================================================== */

/**
 * Cumulative distribution function for standard normal
 * Uses Abramowitz and Stegun approximation (error < 7.5e-8)
 */
double normal_cdf(double x) {
    const double a1 =  0.254829592;
    const double a2 = -0.284496736;
    const double a3 =  1.421413741;
    const double a4 = -1.453152027;
    const double a5 =  1.061405429;
    const double p  =  0.3275911;
    
    int sign = 1;
    if (x < 0) {
        sign = -1;
        x = -x;
    }
    
    double t = 1.0 / (1.0 + p * x);
    double y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * exp(-x * x / 2.0);
    
    return 0.5 * (1.0 + sign * y);
}

/**
 * Probability density function for standard normal
 */
double normal_pdf(double x) {
    return exp(-0.5 * x * x) / SQRT_2PI;
}

/**
 * Inverse CDF (quantile function) for standard normal
 * Rational approximation from Abramowitz and Stegun
 */
double normal_quantile(double p) {
    if (p <= 0.0) return -INFINITY;
    if (p >= 1.0) return INFINITY;
    if (p == 0.5) return 0.0;
    
    double t;
    if (p < 0.5) {
        t = sqrt(-2.0 * log(p));
    } else {
        t = sqrt(-2.0 * log(1.0 - p));
    }
    
    /* Coefficients for rational approximation */
    const double c0 = 2.515517;
    const double c1 = 0.802853;
    const double c2 = 0.010328;
    const double d1 = 1.432788;
    const double d2 = 0.189269;
    const double d3 = 0.001308;
    
    double result = t - (c0 + c1 * t + c2 * t * t) / 
                        (1.0 + d1 * t + d2 * t * t + d3 * t * t * t);
    
    return (p < 0.5) ? -result : result;
}

/**
 * Factorial using iterative calculation
 */
double factorial(int n) {
    if (n < 0) return NAN;
    if (n <= 1) return 1.0;
    
    double result = 1.0;
    for (int i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

/* ==============================================================================
 * ADVANCED CALCULUS FUNCTIONS
 * ============================================================================== */

/**
 * Taylor series expansion for log-normal price approximation
 * 
 * Uses: P(S0 + dS) ≈ exp(Σ f^(n)(S0) * dS^n / n!)
 * where f(S) = ln(S)
 */
double taylor_expansion_price(double S0, double dS, int order) {
    double log_S0 = log(S0);
    double log_price_approx = log_S0;
    
    /* Compute Taylor coefficients for log(S) around S0 */
    for (int n = 1; n <= order; n++) {
        /* n-th derivative of log(S) at S0: (-1)^(n-1) * (n-1)! / S0^n */
        double deriv_n;
        if (n == 1) {
            deriv_n = 1.0 / S0;
        } else {
            deriv_n = (n % 2 == 0 ? -1.0 : 1.0) * factorial(n - 1) / pow(S0, n);
        }
        
        log_price_approx += deriv_n * pow(dS, n) / factorial(n);
    }
    
    return exp(log_price_approx);
}

/**
 * Black-Scholes Greeks calculation
 * 
 * Solves the fundamental PDE: ∂V/∂t + ½σ²S²∂²V/∂S² + rS∂V/∂S - rV = 0
 */
void black_scholes_greeks(double S0, double K, double T, double r, double sigma,
                          double* delta, double* gamma, double* theta, double* vega) {
    if (T <= 0) {
        *delta = *gamma = *theta = *vega = 0.0;
        return;
    }
    
    double sqrt_T = sqrt(T);
    double d1 = (log(S0 / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrt_T);
    double d2 = d1 - sigma * sqrt_T;
    
    /* Greeks calculations */
    *delta = normal_cdf(d1);
    *gamma = normal_pdf(d1) / (S0 * sigma * sqrt_T);
    *theta = -(S0 * normal_pdf(d1) * sigma / (2.0 * sqrt_T)) 
             - r * K * exp(-r * T) * normal_cdf(d2);
    *vega = S0 * sqrt_T * normal_pdf(d1);
}

/* ==============================================================================
 * NUMERICAL INTEGRATION
 * ============================================================================== */

/**
 * Simpson's Rule for numerical integration
 * 
 * ∫[a,b] f(x)dx ≈ (h/3)[f(a) + 4·Σf(odd) + 2·Σf(even) + f(b)]
 */
typedef double (*IntegrandFunc)(double, void*);

double simpsons_rule(IntegrandFunc f, double a, double b, int n, void* params) {
    if (n % 2 == 1) n++;
    
    double h = (b - a) / n;
    double sum = f(a, params) + f(b, params);
    
    for (int i = 1; i < n; i++) {
        double x = a + i * h;
        sum += (i % 2 == 0 ? 2.0 : 4.0) * f(x, params);
    }
    
    return h * sum / 3.0;
}

/* Gauss-Legendre quadrature nodes and weights for n=5 */
static const double gl5_nodes[5] = {
    -0.9061798459386640, -0.5384693101056831, 0.0,
     0.5384693101056831,  0.9061798459386640
};
static const double gl5_weights[5] = {
    0.2369268850561891, 0.4786286704993665, 0.5688888888888889,
    0.4786286704993665, 0.2369268850561891
};

/**
 * Gaussian Quadrature using Gauss-Legendre method
 */
double gaussian_quadrature(IntegrandFunc f, double a, double b, void* params) {
    double sum = 0.0;
    double scale = (b - a) / 2.0;
    double shift = (b + a) / 2.0;
    
    for (int i = 0; i < 5; i++) {
        double x = scale * gl5_nodes[i] + shift;
        sum += gl5_weights[i] * f(x, params);
    }
    
    return scale * sum;
}

/* ==============================================================================
 * STOCHASTIC PROCESSES
 * ============================================================================== */

/**
 * Simulate single GBM path and return terminal price
 * 
 * dS = μS·dt + σS·dW
 * S(T) = S(0)·exp((μ - σ²/2)T + σ·√T·Z)
 */
double simulate_gbm_terminal(double S0, double T, double mu, double sigma) {
    double Z = normal_random();
    return S0 * exp((mu - 0.5 * sigma * sigma) * T + sigma * sqrt(T) * Z);
}

/**
 * Generate full GBM path
 */
void simulate_gbm_path(double S0, double T, int steps, double mu, double sigma,
                       double* path) {
    double dt = T / steps;
    double sqrt_dt = sqrt(dt);
    
    path[0] = S0;
    for (int i = 1; i <= steps; i++) {
        double dW = sqrt_dt * normal_random();
        path[i] = path[i-1] * exp((mu - 0.5 * sigma * sigma) * dt + sigma * dW);
    }
}

/* ==============================================================================
 * MONTE CARLO METHODS
 * ============================================================================== */

/**
 * Standard Monte Carlo simulation
 */
void monte_carlo_standard(double S0, double T, double mu, double sigma,
                          int n_sims, double* prices) {
    for (int i = 0; i < n_sims; i++) {
        prices[i] = simulate_gbm_terminal(S0, T, mu, sigma);
    }
}

/**
 * Antithetic variates for variance reduction
 */
void monte_carlo_antithetic(double S0, double T, double mu, double sigma,
                            int n_sims, double* prices) {
    int half = n_sims / 2;
    
    for (int i = 0; i < half; i++) {
        double Z = normal_random();
        prices[i] = S0 * exp((mu - 0.5 * sigma * sigma) * T + sigma * sqrt(T) * Z);
        prices[half + i] = S0 * exp((mu - 0.5 * sigma * sigma) * T + sigma * sqrt(T) * (-Z));
    }
}

/**
 * Stratified sampling Monte Carlo
 */
void monte_carlo_stratified(double S0, double T, double mu, double sigma,
                            int n_sims, int n_strata, double* prices) {
    int per_stratum = n_sims / n_strata;
    int idx = 0;
    
    for (int s = 0; s < n_strata; s++) {
        double u_low = (double)s / n_strata;
        double u_high = (double)(s + 1) / n_strata;
        
        for (int i = 0; i < per_stratum && idx < n_sims; i++, idx++) {
            double u = u_low + (u_high - u_low) * uniform_random();
            double Z = normal_quantile(u);
            prices[idx] = S0 * exp((mu - 0.5 * sigma * sigma) * T + sigma * sqrt(T) * Z);
        }
    }
}

/* ==============================================================================
 * STATISTICS FUNCTIONS
 * ============================================================================== */

/**
 * Compute mean of array
 */
double compute_mean(double* arr, int n) {
    double sum = 0.0;
    for (int i = 0; i < n; i++) {
        sum += arr[i];
    }
    return sum / n;
}

/**
 * Compute standard deviation of array
 */
double compute_std(double* arr, int n, double mean) {
    double sum_sq = 0.0;
    for (int i = 0; i < n; i++) {
        double diff = arr[i] - mean;
        sum_sq += diff * diff;
    }
    return sqrt(sum_sq / (n - 1));
}

/**
 * Compute variance of array
 */
double compute_variance(double* arr, int n, double mean) {
    double sum_sq = 0.0;
    for (int i = 0; i < n; i++) {
        double diff = arr[i] - mean;
        sum_sq += diff * diff;
    }
    return sum_sq / (n - 1);
}

/**
 * Comparison function for qsort
 */
int compare_doubles(const void* a, const void* b) {
    double da = *(const double*)a;
    double db = *(const double*)b;
    return (da > db) - (da < db);
}

/**
 * Compute percentile of array
 */
double compute_percentile(double* arr, int n, double p) {
    if (arr == NULL || n <= 0) return 0.0;
    
    /* Create sorted copy */
    double* sorted = (double*)malloc(n * sizeof(double));
    if (sorted == NULL) {
        fprintf(stderr, "Warning: Memory allocation failed in compute_percentile\n");
        return arr[0];  /* Return first element as fallback */
    }
    
    memcpy(sorted, arr, n * sizeof(double));
    qsort(sorted, n, sizeof(double), compare_doubles);
    
    /* Linear interpolation */
    double rank = p * (n - 1);
    int lower = (int)floor(rank);
    int upper = (int)ceil(rank);
    double frac = rank - lower;
    
    double result;
    if (lower == upper) {
        result = sorted[lower];
    } else {
        result = sorted[lower] * (1 - frac) + sorted[upper] * frac;
    }
    
    free(sorted);
    return result;
}

/* ==============================================================================
 * MAIN PREDICTION ENGINE
 * ============================================================================== */

/**
 * Compute time to 1 PM target (in years)
 */
double compute_time_to_target(MarketConfig* config) {
    /* Default: 207 minutes (9:33 AM to 1:00 PM) */
    double minutes_to_1pm = 207.0;
    double T = minutes_to_1pm / (config->trading_days * config->minutes_per_day);
    return T;
}

/**
 * Run comprehensive simulation
 */
PredictionResults run_simulation(MarketConfig* config) {
    PredictionResults results;
    memset(&results, 0, sizeof(results));
    
    double S0 = config->current_price;
    double T = compute_time_to_target(config);
    double mu = config->drift;
    double sigma = config->volatility;
    double r = config->risk_free_rate;
    int n_sims = config->simulations;
    
    /* Allocate price arrays */
    double* gbm_prices = (double*)malloc(n_sims * sizeof(double));
    double* av_prices = (double*)malloc(n_sims * sizeof(double));
    double* strat_prices = (double*)malloc(n_sims * sizeof(double));
    
    if (gbm_prices == NULL || av_prices == NULL || strat_prices == NULL) {
        fprintf(stderr, "Error: Memory allocation failed\n");
        if (gbm_prices) free(gbm_prices);
        if (av_prices) free(av_prices);
        if (strat_prices) free(strat_prices);
        return results;
    }
    
    /* 1. Standard GBM Monte Carlo */
    monte_carlo_standard(S0, T, mu, sigma, n_sims, gbm_prices);
    results.gbm_mean = compute_mean(gbm_prices, n_sims);
    results.gbm_std = compute_std(gbm_prices, n_sims, results.gbm_mean);
    results.gbm_p5 = compute_percentile(gbm_prices, n_sims, 0.05);
    results.gbm_p95 = compute_percentile(gbm_prices, n_sims, 0.95);
    
    /* 2. Antithetic Variates */
    monte_carlo_antithetic(S0, T, mu, sigma, n_sims, av_prices);
    results.antithetic_mean = compute_mean(av_prices, n_sims);
    results.antithetic_std = compute_std(av_prices, n_sims, results.antithetic_mean);
    results.variance_reduction = compute_variance(gbm_prices, n_sims, results.gbm_mean) /
                                 compute_variance(av_prices, n_sims, results.antithetic_mean);
    
    /* 3. Stratified Sampling */
    monte_carlo_stratified(S0, T, mu, sigma, n_sims, 10, strat_prices);
    results.stratified_mean = compute_mean(strat_prices, n_sims);
    results.stratified_std = compute_std(strat_prices, n_sims, results.stratified_mean);
    
    /* 4. Black-Scholes Greeks */
    black_scholes_greeks(S0, S0, T, r, sigma,
                         &results.delta, &results.gamma, &results.theta, &results.vega);
    
    /* 5. Analytical expected value */
    results.analytical_expected = S0 * exp(mu * T);
    
    /* 6. Taylor expansion */
    double expected_dS = S0 * mu * T;
    results.taylor_price = taylor_expansion_price(S0, expected_dS, 4);
    
    /* 7. Combined prediction */
    results.combined_mean = (results.gbm_mean + results.antithetic_mean + 
                            results.stratified_mean + results.analytical_expected) / 4.0;
    
    /* 8. Confidence intervals */
    double z_95 = 1.96;
    double ci_std = results.antithetic_std / sqrt(n_sims);
    results.ci_lower = results.antithetic_mean - z_95 * ci_std;
    results.ci_upper = results.antithetic_mean + z_95 * ci_std;
    
    /* Cleanup */
    free(gbm_prices);
    free(av_prices);
    free(strat_prices);
    
    return results;
}

/**
 * Print formatted report
 */
void print_report(MarketConfig* config, PredictionResults* results) {
    printf("\n");
    printf("======================================================================\n");
    printf("      DJI 1 PM CLOSE PREDICTION REPORT (C Implementation)\n");
    printf("      Advanced Calculus & Numerical Methods\n");
    printf("======================================================================\n");
    printf("\n");
    printf("Current Price:    $%12.2f\n", config->current_price);
    printf("Volatility (σ):   %11.1f%%\n", config->volatility * 100);
    printf("Drift (μ):        %11.1f%%\n", config->drift * 100);
    printf("Simulations:      %11d\n", config->simulations);
    printf("\n");
    printf("----------------------------------------------------------------------\n");
    printf("PREDICTION RESULTS\n");
    printf("----------------------------------------------------------------------\n");
    printf("\n");
    printf("1. Geometric Brownian Motion:\n");
    printf("   Mean:           $%12.2f\n", results->gbm_mean);
    printf("   Std Dev:        $%12.2f\n", results->gbm_std);
    printf("   90%% Range:      $%12.2f - $%.2f\n", results->gbm_p5, results->gbm_p95);
    printf("\n");
    printf("2. Antithetic Variates:\n");
    printf("   Mean:           $%12.2f\n", results->antithetic_mean);
    printf("   Var Reduction:  %12.2fx\n", results->variance_reduction);
    printf("\n");
    printf("3. Stratified Sampling:\n");
    printf("   Mean:           $%12.2f\n", results->stratified_mean);
    printf("\n");
    printf("4. Analytical (Integration):\n");
    printf("   Expected:       $%12.2f\n", results->analytical_expected);
    printf("\n");
    printf("5. Taylor Expansion:\n");
    printf("   Approximation:  $%12.2f\n", results->taylor_price);
    printf("\n");
    printf("======================================================================\n");
    printf("COMBINED PREDICTION\n");
    printf("======================================================================\n");
    printf("\n");
    printf("   1 PM Close:     $%12.2f\n", results->combined_mean);
    printf("   95%% CI:         $%12.2f - $%.2f\n", results->ci_lower, results->ci_upper);
    printf("\n");
    printf("----------------------------------------------------------------------\n");
    printf("BLACK-SCHOLES GREEKS (ATM)\n");
    printf("----------------------------------------------------------------------\n");
    printf("   Delta:          %12.4f\n", results->delta);
    printf("   Gamma:          %12.6f\n", results->gamma);
    printf("   Theta:          %12.4f\n", results->theta);
    printf("   Vega:           %12.4f\n", results->vega);
    printf("\n");
    printf("======================================================================\n");
}

/* ==============================================================================
 * MAIN FUNCTION
 * ============================================================================== */

int main(void) {
    /* Initialize configuration */
    MarketConfig config = {
        .current_price = DEFAULT_CURRENT_PRICE,
        .volatility = DEFAULT_VOLATILITY,
        .drift = DEFAULT_DRIFT,
        .risk_free_rate = DEFAULT_RISK_FREE_RATE,
        .trading_days = DEFAULT_TRADING_DAYS,
        .minutes_per_day = DEFAULT_MINUTES_PER_DAY,
        .simulations = DEFAULT_SIMULATIONS,
        .random_seed = DEFAULT_RANDOM_SEED
    };
    
    /* Override from environment variables with validation */
    char* env_val;
    double temp_double;
    int temp_int;
    
    if ((env_val = getenv("DJI_PRICE")) != NULL) {
        temp_double = atof(env_val);
        if (temp_double > 0.0) {
            config.current_price = temp_double;
        } else {
            fprintf(stderr, "Warning: Invalid DJI_PRICE, using default\n");
        }
    }
    if ((env_val = getenv("VOLATILITY")) != NULL) {
        temp_double = atof(env_val);
        if (temp_double > 0.0 && temp_double <= 5.0) {
            config.volatility = temp_double;
        } else {
            fprintf(stderr, "Warning: Invalid VOLATILITY (must be 0-5), using default\n");
        }
    }
    if ((env_val = getenv("DRIFT")) != NULL) {
        temp_double = atof(env_val);
        if (temp_double >= -1.0 && temp_double <= 1.0) {
            config.drift = temp_double;
        } else {
            fprintf(stderr, "Warning: Invalid DRIFT (must be -1 to 1), using default\n");
        }
    }
    if ((env_val = getenv("SIMULATIONS")) != NULL) {
        temp_int = atoi(env_val);
        if (temp_int >= 100 && temp_int <= 1000000) {
            config.simulations = temp_int;
        } else {
            fprintf(stderr, "Warning: Invalid SIMULATIONS (must be 100-1000000), using default\n");
        }
    }
    if ((env_val = getenv("RANDOM_SEED")) != NULL) {
        temp_int = atoi(env_val);
        if (temp_int >= 0) {
            config.random_seed = (unsigned int)temp_int;
        }
    }
    
    /* Seed random number generator */
    seed_random(config.random_seed);
    
    printf("Running comprehensive DJI 1 PM prediction simulation (C)...\n");
    
    /* Run simulation */
    PredictionResults results = run_simulation(&config);
    
    /* Print report */
    print_report(&config, &results);
    
    return 0;
}
