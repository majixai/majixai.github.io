# distutils: extra_compile_args=-fopenmp
# distutils: extra_link_args=-fopenmp
# cython: boundscheck=False, wraparound=False, cdivision=True, nonecheck=False

import numpy as np
cimport numpy as cnp
from cython.parallel import prange
from libc.math cimport exp, sinh

cpdef cnp.ndarray[cnp.float64_t, ndim=2] calculate_cosh_matrix(
    double[:] t, 
    double[:] a, 
    double[:] b, 
    double[:] c, 
    double[:] d):
    """
    Computes the Damped Cosh Oscillator position matrix in parallel.
    Formula: P(t) = a * cosh(b(t-c)) + d
    
    Utilizes exponential breakdown (e^x + e^-x)/2 for maximum C-level hardware optimization
    instead of relying on slower Python-level math libraries.
    """
    cdef int i, j
    cdef int n = t.shape[0]
    cdef int m = a.shape[0]
    
    # Pre-allocate contiguous memory view for maximum L1/L2 cache locality
    cdef cnp.ndarray[cnp.float64_t, ndim=2] res = np.zeros((n, m), dtype=np.float64)
    
    # OpenMP Parallel loop bypassing the GIL completely
    for i in prange(n, nogil=True, schedule='static'):
        for j in range(m):
            # Parametric reconstruction of hyperbolic cosine
            res[i, j] = a[j] * (exp(b[j] * (t[i] - c[j])) + exp(-b[j] * (t[i] - c[j]))) / 2.0 + d[j]
            
    return res

cpdef cnp.ndarray[cnp.float64_t, ndim=2] calculate_velocity_matrix(
    double[:] t, 
    double[:] a, 
    double[:] b, 
    double[:] c):
    """
    Computes the First Derivative (Velocity/Momentum) of the Cosh curve.
    Formula: P'(t) = a * b * sinh(b(t-c))
    
    Used strictly by the ParametricBacktester to evaluate hyperbolic momentum 
    and mathematically confirm breakouts bypassing arbitrary threshold indicators.
    """
    cdef int i, j
    cdef int n = t.shape[0]
    cdef int m = a.shape[0]
    
    # Memory allocation for the momentum gradient
    cdef cnp.ndarray[cnp.float64_t, ndim=2] vel = np.zeros((n, m), dtype=np.float64)
    
    for i in prange(n, nogil=True, schedule='static'):
        for j in range(m):
            # Using C-level sinh for maximum throughput on the derivative calculation
            vel[i, j] = a[j] * b[j] * sinh(b[j] * (t[i] - c[j]))
            
    return vel
