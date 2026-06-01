# Differential Equations Examples

Worked snippets for the differential equations toolkit.

## 1. Classical RK4

```python
from differential_equations.de_core import rk4

def f(t, y):
    return [-2.0 * y[0]]

times, states = rk4(f, 0.0, [1.0], 1.0, 0.1)
print(times[-1], states[-1][0])
```

## 2. Euler–Maruyama

```python
from differential_equations.de_core import euler_maruyama

def drift(t, y):
    return [0.1 * y[0]]

def diffusion(t, y):
    return [0.2 * y[0]]

times, states = euler_maruyama(drift, diffusion, 0.0, [1.0], 1.0, 0.01, seed=42)
print(states[-1][0])
```

## 3. 1D Heat Equation

```python
from differential_equations.de_core import heat_eq_1d_cn

u0 = [0.0, 1.0, 0.0]
u = heat_eq_1d_cn(u0, dx=0.5, dt=0.01, alpha=1.0, n_steps=10)
print(u)
```
