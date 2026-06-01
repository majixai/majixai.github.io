# Optimization Examples

Small examples for the optimization core.

## 1. Gradient Descent on a Quadratic

```python
from optimization.optimization_core import gradient_descent

def f(x):
    return (x[0] - 1.0) ** 2 + 2.0 * (x[1] + 2.0) ** 2

def grad_f(x):
    return [2.0 * (x[0] - 1.0), 4.0 * (x[1] + 2.0)]

solution, history = gradient_descent(f, grad_f, [0.0, 0.0], lr=0.1)
print(solution, history[-1])
```

## 2. Nonlinear Least Squares Step

```python
from optimization.optimization_core import newton_method

def f(x):
    return (x[0] - 3.0) ** 2

def grad_f(x):
    return [2.0 * (x[0] - 3.0)]

solution, _ = newton_method(f, grad_f, [0.0])
print(solution)
```

## 3. LASSO via ADMM

```python
from optimization.optimization_core import admm_lasso

X = [[1.0, 0.0], [0.0, 1.0]]
y = [1.0, 2.0]
beta = admm_lasso(X, y, lam=0.1)
print(beta)
```
