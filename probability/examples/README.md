# Probability Examples

Short examples for the probability toolkit.

## 1. Simulate Brownian Motion

```python
from probability.probability_core import brownian_motion

times, values = brownian_motion(T=1.0, n=100, seed=42)
print(times[-1], values[-1])
```

## 2. Geometric Brownian Motion

```python
from probability.probability_core import geometric_brownian_motion

times, prices = geometric_brownian_motion(100.0, mu=0.05, sigma=0.2, T=1.0, n=252, seed=42)
print(prices[-1])
```

## 3. Quasi-Monte Carlo Integration

```python
from probability.probability_core import qmc_integrate

estimate = qmc_integrate(lambda x: x[0] * x[1], [(0.0, 1.0), (0.0, 1.0)], n_samples=1024)
print(estimate)
```
