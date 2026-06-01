# Matrix Examples

Short, runnable examples for the core matrix toolkit.

## 1. Solve a Linear System

```python
from matrix.matrix_core import lu_solve

A = [[4.0, 7.0], [2.0, 6.0]]
b = [1.0, 0.0]
x = lu_solve(A, b)
print(x)
```

## 2. Estimate the Dominant Eigenpair

```python
from matrix.matrix_core import power_iteration

A = [[5.0, 0.0], [0.0, 2.0]]
eigenvalue, vector = power_iteration(A)
print(eigenvalue, vector)
```

## 3. Matrix Exponential

```python
from matrix.matrix_core import mat_expm

print(mat_expm([[0.0, 1.0], [-1.0, 0.0]]))
```
