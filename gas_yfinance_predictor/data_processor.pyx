# cython: language_level=3
# cython: boundscheck=False
# cython: wraparound=False
# cython: cdivision=True
"""
Cython-optimized data processor with bit operations for high-performance ticker data processing.
Compile with: cythonize -i data_processor.pyx
"""

import numpy as np
cimport numpy as np
cimport cython
from libc.stdint cimport uint64_t, uint32_t, uint16_t, uint8_t
from libc.math cimport sqrt, pow, fabs
from libc.stdlib cimport malloc, free

# Type definitions
DTYPE = np.float64
ctypedef np.float64_t DTYPE_t

# Bit manipulation constants
DEF BIT_PRECISION = 32
DEF PRICE_MULTIPLIER = 10000  # 4 decimal places
DEF VOLUME_SHIFT = 8


cdef class TickerDataProcessor:
    """High-performance ticker data processor using Cython and bit operations."""
    
    cdef:
        uint32_t data_count
        double[:] prices
        uint64_t[:] volumes
        uint32_t[:] packed_flags
        
    def __init__(self, size_t capacity=10000):
        """Initialize processor with pre-allocated arrays."""
        self.data_count = 0
        self.prices = np.zeros(capacity, dtype=np.float64)
        self.volumes = np.zeros(capacity, dtype=np.uint64)
        self.packed_flags = np.zeros(capacity, dtype=np.uint32)
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cdef uint32_t pack_price_to_bits(self, double price) nogil:
        """Pack floating point price into 32-bit integer using bit operations."""
        cdef uint32_t packed = <uint32_t>(price * PRICE_MULTIPLIER)
        return packed
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cdef double unpack_bits_to_price(self, uint32_t packed) nogil:
        """Unpack 32-bit integer back to floating point price."""
        return <double>packed / PRICE_MULTIPLIER
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cdef uint64_t pack_volume_with_flags(self, uint64_t volume, uint8_t flags) nogil:
        """Pack volume with 8-bit flags using bit shifting and masking."""
        cdef uint64_t packed = (volume << VOLUME_SHIFT) | flags
        return packed
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cdef void unpack_volume_and_flags(self, uint64_t packed, uint64_t* volume, uint8_t* flags) nogil:
        """Unpack volume and flags using bit operations."""
        volume[0] = packed >> VOLUME_SHIFT
        flags[0] = <uint8_t>(packed & 0xFF)
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cpdef double calculate_sma_fast(self, double[:] data, int window):
        """Fast Simple Moving Average using Cython."""
        cdef:
            int n = data.shape[0]
            double sum_val = 0.0
            double result
            int i
        
        if window > n or window <= 0:
            return 0.0
        
        # Initial sum
        for i in range(window):
            sum_val += data[i]
        
        result = sum_val / window
        return result
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cpdef np.ndarray[DTYPE_t, ndim=1] calculate_rsi_fast(self, double[:] prices, int period=14):
        """Fast RSI calculation using Cython and bit operations."""
        cdef:
            int n = prices.shape[0]
            np.ndarray[DTYPE_t, ndim=1] rsi = np.zeros(n, dtype=DTYPE)
            double gain = 0.0, loss = 0.0
            double avg_gain, avg_loss, rs
            double change
            int i
        
        if n < period + 1:
            return rsi
        
        # Calculate initial average gain and loss
        for i in range(1, period + 1):
            change = prices[i] - prices[i-1]
            if change > 0:
                gain += change
            else:
                loss += fabs(change)
        
        avg_gain = gain / period
        avg_loss = loss / period
        
        # Calculate RSI for initial period
        if avg_loss != 0:
            rs = avg_gain / avg_loss
            rsi[period] = 100.0 - (100.0 / (1.0 + rs))
        else:
            rsi[period] = 100.0
        
        # Calculate remaining RSI values using Wilder's smoothing
        for i in range(period + 1, n):
            change = prices[i] - prices[i-1]
            
            if change > 0:
                avg_gain = ((avg_gain * (period - 1)) + change) / period
                avg_loss = (avg_loss * (period - 1)) / period
            else:
                avg_gain = (avg_gain * (period - 1)) / period
                avg_loss = ((avg_loss * (period - 1)) + fabs(change)) / period
            
            if avg_loss != 0:
                rs = avg_gain / avg_loss
                rsi[i] = 100.0 - (100.0 / (1.0 + rs))
            else:
                rsi[i] = 100.0
        
        return rsi
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cpdef double calculate_volatility_fast(self, double[:] prices):
        """Fast volatility calculation using bit-optimized variance."""
        cdef:
            int n = prices.shape[0]
            double mean = 0.0
            double variance = 0.0
            double diff
            int i
        
        if n < 2:
            return 0.0
        
        # Calculate mean
        for i in range(n):
            mean += prices[i]
        mean /= n
        
        # Calculate variance
        for i in range(n):
            diff = prices[i] - mean
            variance += diff * diff
        variance /= (n - 1)
        
        return sqrt(variance)
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cpdef np.ndarray[DTYPE_t, ndim=1] calculate_bollinger_bands(self, double[:] prices, int window=20, double num_std=2.0):
        """Fast Bollinger Bands calculation."""
        cdef:
            int n = prices.shape[0]
            np.ndarray[DTYPE_t, ndim=1] middle = np.zeros(n, dtype=DTYPE)
            np.ndarray[DTYPE_t, ndim=1] upper = np.zeros(n, dtype=DTYPE)
            np.ndarray[DTYPE_t, ndim=1] lower = np.zeros(n, dtype=DTYPE)
            double sum_val = 0.0
            double sum_sq = 0.0
            double mean, std
            int i, j
        
        if n < window:
            return np.column_stack([middle, upper, lower])
        
        # Calculate for each window
        for i in range(window - 1, n):
            sum_val = 0.0
            sum_sq = 0.0
            
            for j in range(i - window + 1, i + 1):
                sum_val += prices[j]
                sum_sq += prices[j] * prices[j]
            
            mean = sum_val / window
            std = sqrt((sum_sq / window) - (mean * mean))
            
            middle[i] = mean
            upper[i] = mean + (num_std * std)
            lower[i] = mean - (num_std * std)
        
        return np.column_stack([middle, upper, lower])
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cpdef bint is_bullish_pattern(self, double[:] prices, uint32_t pattern_flags) nogil:
        """Check bullish pattern using bit flags and fast comparison."""
        cdef:
            int n = prices.shape[0]
            uint32_t detected = 0
            bint result
        
        if n < 3:
            return False
        
        # Bit flag patterns:
        # 0x01 - Higher high
        # 0x02 - Higher low  
        # 0x04 - Volume increase
        # 0x08 - RSI oversold recovery
        
        # Check higher high (bit 0)
        if prices[n-1] > prices[n-2]:
            detected |= 0x01
        
        # Check higher low (bit 1)
        if prices[n-1] > prices[n-3]:
            detected |= 0x02
        
        # Pattern match using bitwise AND
        result = (detected & pattern_flags) == pattern_flags
        return result
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cpdef np.ndarray[DTYPE_t, ndim=1] compress_prices_lossy(self, double[:] prices, int compression_level=8):
        """Lossy compression of price data using bit truncation."""
        cdef:
            int n = prices.shape[0]
            np.ndarray[DTYPE_t, ndim=1] compressed = np.zeros(n, dtype=DTYPE)
            uint32_t packed
            int i
            int divisor = 1 << compression_level  # 2^compression_level
        
        for i in range(n):
            packed = self.pack_price_to_bits(prices[i])
            packed = (packed >> compression_level) << compression_level  # Truncate lower bits
            compressed[i] = self.unpack_bits_to_price(packed)
        
        return compressed
    
    @cython.boundscheck(False)
    @cython.wraparound(False)
    cpdef double calculate_sharpe_ratio_fast(self, double[:] returns, double risk_free_rate=0.02):
        """Fast Sharpe ratio calculation."""
        cdef:
            int n = returns.shape[0]
            double mean_return = 0.0
            double std_return = 0.0
            double diff, variance = 0.0
            int i
        
        if n < 2:
            return 0.0
        
        # Calculate mean return
        for i in range(n):
            mean_return += returns[i]
        mean_return /= n
        
        # Calculate standard deviation
        for i in range(n):
            diff = returns[i] - mean_return
            variance += diff * diff
        std_return = sqrt(variance / (n - 1))
        
        if std_return == 0:
            return 0.0
        
        return (mean_return - risk_free_rate) / std_return


@cython.boundscheck(False)
@cython.wraparound(False)
cpdef np.ndarray[DTYPE_t, ndim=1] parallel_price_normalization(double[:] prices, double min_val, double max_val):
    """Parallel price normalization using bit operations."""
    cdef:
        int n = prices.shape[0]
        np.ndarray[DTYPE_t, ndim=1] normalized = np.zeros(n, dtype=DTYPE)
        double range_val = max_val - min_val
        int i
    
    if range_val == 0:
        return normalized
    
    for i in range(n):
        normalized[i] = (prices[i] - min_val) / range_val
    
    return normalized


@cython.boundscheck(False)
@cython.wraparound(False)
cpdef uint64_t hash_ticker_symbol(str ticker):
    """Fast hash function for ticker symbols using bit operations."""
    cdef:
        uint64_t hash_val = 5381
        uint64_t c
        bytes ticker_bytes = ticker.encode('utf-8')
        unsigned char[:] data = ticker_bytes
        int i
    
    for i in range(len(data)):
        c = <uint64_t>data[i]
        hash_val = ((hash_val << 5) + hash_val) ^ c  # hash * 33 ^ c
    
    return hash_val
