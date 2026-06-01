# Numerical Methods Examples

Small examples for the numerical methods core.

## 1. Conjugate Gradient

```python
from numerical_methods.numerical_core import conjugate_gradient, matvec

A = [[4.0, 1.0], [1.0, 3.0]]
b = [1.0, 2.0]
x, iterations, residuals = conjugate_gradient(lambda v: matvec(A, v), b)
print(x, iterations, residuals[-1])
```

## 2. Root Finding

```python
from numerical_methods.numerical_core import newton_raphson

root = newton_raphson(lambda x: x * x - 2.0, lambda x: 2.0 * x, 1.0)
print(root)
```

## 3. Quadrature

```python
from numerical_methods.numerical_core import gauss_legendre

area = gauss_legendre(lambda x: x * x, 0.0, 1.0, n=4)
print(area)
```
