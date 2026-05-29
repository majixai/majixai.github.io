# conics/ — Multi-Language Conic Section Analysis

**Path:** `conics/`  
**Languages:** C · C++ · R · Python · Cython · Bash · Zsh  
**Purpose:** Unified library for conic-section classification, principal-axis decomposition, and OLS surface fitting, with integration bridges to every major numerical module in the repository.

---

## Mathematical Background

### General Second-Degree Curve

Every conic section is a level curve of the quadratic surface:

```
z = A·x² + B·x·y + C·y² + D·x + E·y + F
```

When set equal to zero (z = 0) this defines the **general conic**:

```
A x² + B xy + C y² + D x + E y + F = 0
```

### Classification (Discriminant)

| Discriminant Δ = B² − 4AC | Conic Type  |
|---------------------------|-------------|
| Δ < 0                     | Ellipse     |
| Δ = 0                     | Parabola    |
| Δ > 0                     | Hyperbola   |

### Principal-Axis Rotation

The rotation angle that diagonalises the pure-quadratic part:

```
θ = ½ · atan2(B, A − C)
```

### Centre (Ellipse / Hyperbola)

Solved from the gradient-zero system:

```
2A·cx + B·cy + D = 0
 B·cx + 2C·cy + E = 0
```

Solution (when det = 4AC − B² ≠ 0):

```
cx = (B·E − 2·C·D) / det
cy = (B·D − 2·A·E) / det
```

### Semi-Axes (Eigenvalue Decomposition)

The 2×2 quadratic-form matrix is:

```
M = [[A,   B/2],
     [B/2, C  ]]
```

Eigenvalues:

```
λ₁,₂ = (A+C)/2  ±  ½√((A−C)² + B²)
```

Surface value at the centre:

```
k₃₃ = F − cx·D/2 − cy·E/2
```

Semi-axis lengths:

```
aᵢ = √|−k₃₃ / λᵢ|
```

### OLS Surface Fit

Given *n* data points (x_i, y_i, z_i), minimise

```
‖z − Φ·θ‖²,    Φᵢ = [xᵢ², xᵢyᵢ, yᵢ², xᵢ, yᵢ, 1],    θ = [A B C D E F]ᵀ
```

via the 6×6 normal equations  `(Φᵀ·Φ)·θ = Φᵀ·z`.

---

## Directory Structure

```
conics/
├── README.md                          # This file
├── __init__.py                        # Python package entry point
│
├── c/
│   └── conics.c                       # C99: struct-based solver, self-contained
│
├── cpp/
│   └── conics.cpp                     # C++17: template<T> solver (float/double/long double)
│
├── r/
│   └── conics.R                       # R: sources rlang/lib/; lm()-backed fit
│
├── python/
│   └── conics.py                      # Pure Python: ConicCoeffs, decompose, fit_ols
│
├── cython/
│   ├── conics.pyx                     # Cython typed extension (O3 inner loops)
│   └── setup.py                       # Build with: python setup.py build_ext --inplace
│
├── bash/
│   └── conics.sh                      # Bash + bc + awk; sourceable or standalone
│
├── zsh/
│   └── conics.zsh                     # Zsh + zsh/mathfunc; sourceable or standalone
│
└── integrations/
    ├── __init__.py
    ├── matrix_bridge.py               # → matrix/matrix_core.py
    ├── numerical_bridge.py            # → numerical_methods/numerical_core.py
    ├── regression_bridge.py           # → regression/regression_core.py
    ├── tensor_bridge.py               # → tensor/financial/
    ├── yfinance_bridge.py             # → yfinance/ops.py
    └── rlang_bridge.py                # → rlang/ (Rscript subprocess)
```

---

## Quick Start

### Python

```python
import sys
sys.path.insert(0, ".")           # repo root

from conics import ConicCoeffs, decompose, fit_ols

# Classify known conic
cc = ConicCoeffs(A=1, B=0, C=1, D=0, E=0, F=-1)  # unit circle
d  = decompose(cc)
print(d.kind)   # ELLIPSE

# Fit to data
import math
t  = [2*math.pi*i/40 for i in range(40)]
xs = [math.cos(ti) for ti in t]
ys = [0.5*math.sin(ti) for ti in t]
zs = [1.0]*40
result = fit_ols(xs, ys, zs)
print(result.decomp.kind, result.r2)   # ELLIPSE  ~1.0
```

### C

```sh
cc -std=c99 -O2 -lm -o conics conics/c/conics.c
./conics        # runs self-test
```

### C++

```sh
g++ -std=c++17 -O2 -lm -o conics conics/cpp/conics.cpp
./conics        # runs self-test
```

### R

```r
source("conics/r/conics.R")
r <- conic_decompose(c(A=2, B=1, C=3, D=0, E=0, F=-4))
conic_print(r)
```

### Cython (build first)

```sh
cd conics/cython
python setup.py build_ext --inplace
cd ../..
python -c "from conics.cython.conics import cy_decompose; print(cy_decompose(1,0,1,0,0,-1))"
```

### Bash

```sh
source conics/bash/conics.sh
conic_classify 1 0 -1      # HYPERBOLA
conic_decompose 1 0 1 0 0 -1
```

### Zsh

```zsh
source conics/zsh/conics.zsh
conic_classify 2 1 3       # ELLIPSE
conic_decompose 1 0 -1 0 0 -1
```

---

## Integration Bridges

Each bridge can be imported independently.  All bridges gracefully degrade when
their upstream dependency is absent.

| Bridge | Upstream module | Key function |
|--------|----------------|--------------|
| `matrix_bridge`     | `matrix/matrix_core.py`           | `normal_matrix_solve(xs, ys, zs)` |
| `numerical_bridge`  | `numerical_methods/numerical_core.py` | `fit_via_conjugate_gradient(xs, ys, zs)` |
| `regression_bridge` | `regression/regression_core.py`   | `fit_via_ridge(xs, ys, zs, lam)` |
| `tensor_bridge`     | `tensor/financial/`               | `fit_from_feature_matrix(symbol)` |
| `yfinance_bridge`   | `yfinance/ops.py`                 | `fit_ohlcv(symbol, lookback)` |
| `rlang_bridge`      | `rlang/`                          | `fit_via_r(xs, ys, zs)` |

### Example: market conic scan

```python
from conics.integrations.yfinance_bridge import scan_conic_type
print(scan_conic_type(["AAPL", "MSFT", "TSLA", "SPY"], lookback=60))
# {'AAPL': 'ELLIPSE', 'MSFT': 'HYPERBOLA', ...}
```

### Example: ridge-regularised fit

```python
from conics.integrations.regression_bridge import fit_via_ridge
result = fit_via_ridge(xs, ys, zs, lam=1e-3)
```

### Example: Kalman-smoothed surface predictions

```python
from conics.integrations.tensor_bridge import conic_kalman_smooth
smoothed = conic_kalman_smooth(result, ys)
```

### Example: R-language fit

```python
from conics.integrations.rlang_bridge import fit_via_r
result = fit_via_r(xs, ys, zs)   # delegates to conics/r/conics.R via Rscript
```

---

## Related Files

| File | Role |
|------|------|
| `scripts/test16.pine` | Pine Script v5 indicator that uses the same quadratic-surface / conic-branch algorithm on TradingView charts |
| `matrix/matrix_core.py` | Pure-Python matrix operations (mat_mul, LU, SVD) used by `matrix_bridge` |
| `numerical_methods/numerical_core.py` | Conjugate gradient, Brent root-finder used by `numerical_bridge` |
| `regression/regression_core.py` | OLS, ridge, GP used by `regression_bridge` |
| `tensor/financial/` | Feature matrices, Kalman filter used by `tensor_bridge` |
| `yfinance/ops.py` | Market data download used by `yfinance_bridge` |
| `rlang/lib/finance.R` | R financial helpers (GBM, OU) sourced by `conics/r/conics.R` |

---

## Testing

```sh
# Python self-test (no external dependencies needed)
python conics/python/conics.py

# Python integration bridges
python conics/integrations/matrix_bridge.py
python conics/integrations/numerical_bridge.py
python conics/integrations/regression_bridge.py

# C
cc -std=c99 -O2 -lm -o /tmp/conics_c conics/c/conics.c && /tmp/conics_c

# C++
g++ -std=c++17 -O2 -lm -o /tmp/conics_cpp conics/cpp/conics.cpp && /tmp/conics_cpp

# R
Rscript conics/r/conics.R

# Bash
bash conics/bash/conics.sh

# Zsh
zsh conics/zsh/conics.zsh
```
