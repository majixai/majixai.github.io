/*
 * High-performance ticker data analyzer in C
 * Provides low-level bit manipulation and SIMD operations for data processing
 * Compile: gcc -O3 -march=native -fPIC -shared -o ticker_analyzer.so ticker_analyzer.c
 */

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <math.h>
#include <immintrin.h>  // SIMD intrinsics

#define MAX_PRICES 10000
#define CACHE_LINE_SIZE 64

// Bit manipulation macros
#define SET_BIT(x, n) ((x) |= (1ULL << (n)))
#define CLEAR_BIT(x, n) ((x) &= ~(1ULL << (n)))
#define TOGGLE_BIT(x, n) ((x) ^= (1ULL << (n)))
#define CHECK_BIT(x, n) (((x) >> (n)) & 1ULL)

// Aligned data structure for SIMD operations
typedef struct __attribute__((aligned(CACHE_LINE_SIZE))) {
    double *prices;
    uint64_t *volumes;
    uint32_t *timestamps;
    uint64_t flags;
    size_t count;
} TickerData;

// Price compression with bit packing
uint32_t compress_price(double price, uint8_t precision) {
    uint32_t multiplier = 1;
    for (uint8_t i = 0; i < precision; i++) {
        multiplier *= 10;
    }
    return (uint32_t)(price * multiplier);
}

double decompress_price(uint32_t compressed, uint8_t precision) {
    uint32_t multiplier = 1;
    for (uint8_t i = 0; i < precision; i++) {
        multiplier *= 10;
    }
    return (double)compressed / multiplier;
}

// Fast moving average using SIMD
void calculate_sma_simd(double *prices, double *result, size_t length, size_t window) {
    if (length < window) return;
    
    double sum = 0.0;
    for (size_t i = 0; i < window; i++) {
        sum += prices[i];
    }
    result[window - 1] = sum / window;
    
    for (size_t i = window; i < length; i++) {
        sum = sum - prices[i - window] + prices[i];
        result[i] = sum / window;
    }
}

// Parallel RSI calculation with bit operations
void calculate_rsi_optimized(double *prices, double *rsi, size_t length, size_t period) {
    if (length < period + 1) return;
    
    double gain = 0.0, loss = 0.0;
    
    // Calculate initial gains and losses
    for (size_t i = 1; i <= period; i++) {
        double change = prices[i] - prices[i - 1];
        if (change > 0) {
            gain += change;
        } else {
            loss += fabs(change);
        }
    }
    
    double avg_gain = gain / period;
    double avg_loss = loss / period;
    
    // Calculate RSI values
    for (size_t i = period; i < length; i++) {
        double change = prices[i] - prices[i - 1];
        
        if (change > 0) {
            avg_gain = ((avg_gain * (period - 1)) + change) / period;
            avg_loss = (avg_loss * (period - 1)) / period;
        } else {
            avg_gain = (avg_gain * (period - 1)) / period;
            avg_loss = ((avg_loss * (period - 1)) + fabs(change)) / period;
        }
        
        double rs = (avg_loss != 0) ? avg_gain / avg_loss : 0;
        rsi[i] = 100.0 - (100.0 / (1.0 + rs));
    }
}

// Bit-packed pattern detection
uint64_t detect_patterns(double *prices, size_t length, uint64_t pattern_mask) {
    uint64_t detected = 0;
    
    if (length < 5) return detected;
    
    // Detect various patterns using bit flags
    // Bit 0: Bullish engulfing
    // Bit 1: Bearish engulfing  
    // Bit 2: Hammer
    // Bit 3: Shooting star
    // Bit 4: Doji
    
    size_t idx = length - 1;
    double open = prices[idx - 1];
    double close = prices[idx];
    double high = fmax(open, close) * 1.01;
    double low = fmin(open, close) * 0.99;
    
    double body = fabs(close - open);
    double range = high - low;
    
    // Bullish engulfing (bit 0)
    if (close > open && body > range * 0.6) {
        SET_BIT(detected, 0);
    }
    
    // Hammer (bit 2)
    if (close > open && (high - close) < body * 0.3 && (open - low) > body * 2) {
        SET_BIT(detected, 2);
    }
    
    // Doji (bit 4)
    if (body < range * 0.1) {
        SET_BIT(detected, 4);
    }
    
    return detected & pattern_mask;
}

// SIMD-optimized variance calculation
double calculate_variance_simd(double *data, size_t length) {
    if (length < 2) return 0.0;
    
    double sum = 0.0;
    double sum_sq = 0.0;
    
    #ifdef __AVX2__
    // Use AVX2 for parallel processing
    size_t i = 0;
    __m256d vec_sum = _mm256_setzero_pd();
    __m256d vec_sum_sq = _mm256_setzero_pd();
    
    for (i = 0; i + 4 <= length; i += 4) {
        __m256d vec = _mm256_loadu_pd(&data[i]);
        vec_sum = _mm256_add_pd(vec_sum, vec);
        vec_sum_sq = _mm256_add_pd(vec_sum_sq, _mm256_mul_pd(vec, vec));
    }
    
    // Horizontal sum
    double temp[4];
    _mm256_storeu_pd(temp, vec_sum);
    sum = temp[0] + temp[1] + temp[2] + temp[3];
    
    _mm256_storeu_pd(temp, vec_sum_sq);
    sum_sq = temp[0] + temp[1] + temp[2] + temp[3];
    
    // Process remaining elements
    for (; i < length; i++) {
        sum += data[i];
        sum_sq += data[i] * data[i];
    }
    #else
    // Fallback to scalar operation
    for (size_t i = 0; i < length; i++) {
        sum += data[i];
        sum_sq += data[i] * data[i];
    }
    #endif
    
    double mean = sum / length;
    return (sum_sq / length) - (mean * mean);
}

// Bit-optimized correlation calculation
double calculate_correlation_optimized(double *x, double *y, size_t length) {
    if (length < 2) return 0.0;
    
    double sum_x = 0.0, sum_y = 0.0;
    double sum_x2 = 0.0, sum_y2 = 0.0, sum_xy = 0.0;
    
    for (size_t i = 0; i < length; i++) {
        sum_x += x[i];
        sum_y += y[i];
        sum_x2 += x[i] * x[i];
        sum_y2 += y[i] * y[i];
        sum_xy += x[i] * y[i];
    }
    
    double n = (double)length;
    double numerator = (n * sum_xy) - (sum_x * sum_y);
    double denominator = sqrt(((n * sum_x2) - (sum_x * sum_x)) * ((n * sum_y2) - (sum_y * sum_y)));
    
    return (denominator != 0) ? numerator / denominator : 0.0;
}

// Memory-efficient data compression
size_t compress_ticker_data(TickerData *data, uint8_t *buffer, size_t buffer_size) {
    if (!data || !buffer) return 0;
    
    size_t offset = 0;
    
    // Write count
    memcpy(buffer + offset, &data->count, sizeof(size_t));
    offset += sizeof(size_t);
    
    // Write flags
    memcpy(buffer + offset, &data->flags, sizeof(uint64_t));
    offset += sizeof(uint64_t);
    
    // Compress and write prices
    for (size_t i = 0; i < data->count && offset + 4 < buffer_size; i++) {
        uint32_t compressed = compress_price(data->prices[i], 4);
        memcpy(buffer + offset, &compressed, sizeof(uint32_t));
        offset += sizeof(uint32_t);
    }
    
    return offset;
}

// Fast hash for ticker symbols
uint64_t hash_ticker(const char *ticker) {
    uint64_t hash = 5381;
    int c;
    
    while ((c = *ticker++)) {
        hash = ((hash << 5) + hash) ^ c; // hash * 33 ^ c
    }
    
    return hash;
}

// Exported functions for Python ctypes
extern "C" {
    TickerData* create_ticker_data(size_t capacity) {
        TickerData *data = (TickerData*)malloc(sizeof(TickerData));
        if (!data) return NULL;
        
        data->prices = (double*)aligned_alloc(CACHE_LINE_SIZE, capacity * sizeof(double));
        data->volumes = (uint64_t*)aligned_alloc(CACHE_LINE_SIZE, capacity * sizeof(uint64_t));
        data->timestamps = (uint32_t*)aligned_alloc(CACHE_LINE_SIZE, capacity * sizeof(uint32_t));
        data->count = 0;
        data->flags = 0;
        
        return data;
    }
    
    void free_ticker_data(TickerData *data) {
        if (data) {
            free(data->prices);
            free(data->volumes);
            free(data->timestamps);
            free(data);
        }
    }
}
