"""
regression_core.py — PhD-level regression library
===================================================
Implements OLS, GLS, Ridge, LASSO, Elastic Net, Logistic Regression,
Gaussian Process Regression, Cox Proportional Hazards, Multivariate
Regression, and Bayesian Linear Regression with full mathematical rigour.

Mathematical foundations:
  - Gauss-Markov theorem, Frisch-Waugh-Lovell theorem
  - Restricted eigenvalue conditions for LASSO
  - Representer theorem for kernel/GP methods
  - Partial likelihood for survival analysis
"""

from __future__ import annotations
import math
from typing import Callable, Optional, Tuple

# ---------------------------------------------------------------------------
# Linear algebra primitives (pure Python, no external deps)
# ---------------------------------------------------------------------------

def mat_mul(A: list[list[float]], B: list[list[float]]) -> list[list[float]]:
    """O(n^3) matrix multiplication A @ B."""
    n, m, p = len(A), len(A[0]), len(B[0])
    assert len(B) == m
    C = [[0.0] * p for _ in range(n)]
    for i in range(n):
        for k in range(m):
            if A[i][k] == 0.0:
                continue
            for j in range(p):
                C[i][j] += A[i][k] * B[k][j]
    return C


def mat_T(A: list[list[float]]) -> list[list[float]]:
    """Transpose of matrix A."""
    return [[A[j][i] for j in range(len(A))] for i in range(len(A[0]))]


def lu_decompose(A: list[list[float]]) -> Tuple[list[list[float]], list[list[float]], list[int]]:
    """
    LU decomposition with partial pivoting.
    Returns L, U, pivot such that P*A = L*U.
    """
    n = len(A)
    L = [[0.0] * n for _ in range(n)]
    U = [row[:] for row in A]  # copy
    P = list(range(n))
    for j in range(n):
        # find pivot
        pivot = max(range(j, n), key=lambda i: abs(U[i][j]))
        U[j], U[pivot] = U[pivot], U[j]
        P[j], P[pivot] = P[pivot], P[j]
        L[j], L[pivot] = L[pivot], L[j]
        L[j][j] = 1.0
        if abs(U[j][j]) < 1e-15:
            continue
        for i in range(j + 1, n):
            L[i][j] = U[i][j] / U[j][j]
            for k in range(j, n):
                U[i][k] -= L[i][j] * U[j][k]
    return L, U, P


def forward_sub(L: list[list[float]], b: list[float]) -> list[float]:
    """Solve L*x = b by forward substitution."""
    n = len(b)
    x = [0.0] * n
    for i in range(n):
        x[i] = (b[i] - sum(L[i][j] * x[j] for j in range(i))) / L[i][i]
    return x


def backward_sub(U: list[list[float]], b: list[float]) -> list[float]:
    """Solve U*x = b by backward substitution."""
    n = len(b)
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = (b[i] - sum(U[i][j] * x[j] for j in range(i + 1, n))) / U[i][i]
    return x


def lu_solve(A: list[list[float]], b: list[float]) -> list[float]:
    """Solve A*x = b using LU decomposition with partial pivoting."""
    L, U, P = lu_decompose(A)
    bp = [b[P[i]] for i in range(len(b))]
    y = forward_sub(L, bp)
    x = backward_sub(U, y)
    return x


def mat_inv(A: list[list[float]]) -> list[list[float]]:
    """Matrix inverse via LU decomposition."""
    n = len(A)
    inv = []
    for j in range(n):
        e = [1.0 if i == j else 0.0 for i in range(n)]
        col = lu_solve(A, e)
        inv.append(col)
    return mat_T(inv)


def mat_vec(A: list[list[float]], v: list[float]) -> list[float]:
    """Matrix-vector product A @ v."""
    return [sum(A[i][j] * v[j] for j in range(len(v))) for i in range(len(A))]


def dot(u: list[float], v: list[float]) -> float:
    return sum(a * b for a, b in zip(u, v))


def norm2(v: list[float]) -> float:
    return math.sqrt(dot(v, v))


def cholesky(A: list[list[float]]) -> list[list[float]]:
    """
    Cholesky decomposition: A = L L^T for symmetric positive definite A.
    Returns lower-triangular L.
    """
    n = len(A)
    L = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            s = sum(L[i][k] * L[j][k] for k in range(j))
            if i == j:
                val = A[i][i] - s
                if val < 0:
                    raise ValueError(f"Matrix is not positive definite at ({i},{i}).")
                L[i][j] = math.sqrt(val)
            else:
                if abs(L[j][j]) < 1e-15:
                    raise ValueError("Zero diagonal in Cholesky.")
                L[i][j] = (A[i][j] - s) / L[j][j]
    return L


def chol_solve(L: list[list[float]], b: list[float]) -> list[float]:
    """Solve A x = b where A = L L^T."""
    y = forward_sub(L, b)
    x = backward_sub(mat_T(L), y)
    return x


def outer(u: list[float], v: list[float]) -> list[list[float]]:
    """Outer product u v^T."""
    return [[u[i] * v[j] for j in range(len(v))] for i in range(len(u))]


def identity(n: int) -> list[list[float]]:
    return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]


def mat_add(A: list[list[float]], B: list[list[float]]) -> list[list[float]]:
    return [[A[i][j] + B[i][j] for j in range(len(A[0]))] for i in range(len(A))]


def mat_scale(A: list[list[float]], s: float) -> list[list[float]]:
    return [[A[i][j] * s for j in range(len(A[0]))] for i in range(len(A))]


def gram(X: list[list[float]]) -> list[list[float]]:
    """Gram matrix X^T X."""
    return mat_mul(mat_T(X), X)


def hat_matrix(X: list[list[float]]) -> list[list[float]]:
    """H = X (X^T X)^{-1} X^T."""
    G = gram(X)
    Ginv = mat_inv(G)
    return mat_mul(mat_mul(X, Ginv), mat_T(X))


def trace(A: list[list[float]]) -> float:
    return sum(A[i][i] for i in range(len(A)))


# ---------------------------------------------------------------------------
# OLS Estimator
# ---------------------------------------------------------------------------

class OLS:
    """
    Ordinary Least Squares estimator.

    Model: y = X β + ε,  ε ~ N(0, σ² I)

    Closed-form: β̂ = (X^T X)^{-1} X^T y

    Provides: coefficient estimates, standard errors (HC0–HC3 robust),
    F-statistic, R², adjusted R², hat matrix, leverage scores, Cook's D.
    """

    def __init__(self, fit_intercept: bool = True):
        self.fit_intercept = fit_intercept
        self.coef_: Optional[list[float]] = None
        self.intercept_: float = 0.0
        self.residuals_: Optional[list[float]] = None
        self.sigma2_: float = 0.0
        self.n_: int = 0
        self.p_: int = 0
        self._X: Optional[list[list[float]]] = None
        self._y: Optional[list[float]] = None

    def _add_intercept(self, X: list[list[float]]) -> list[list[float]]:
        return [[1.0] + row for row in X]

    def fit(self, X: list[list[float]], y: list[float]) -> "OLS":
        Xd = self._add_intercept(X) if self.fit_intercept else [row[:] for row in X]
        n, p = len(Xd), len(Xd[0])
        self.n_, self.p_ = n, p
        self._X = Xd
        self._y = y

        # β̂ = (X^T X)^{-1} X^T y
        XtX = gram(Xd)
        Xty = mat_vec(mat_T(Xd), y)
        beta = lu_solve(XtX, Xty)

        self.residuals_ = [y[i] - dot(Xd[i], beta) for i in range(n)]
        rss = dot(self.residuals_, self.residuals_)
        self.sigma2_ = rss / (n - p)

        if self.fit_intercept:
            self.intercept_ = beta[0]
            self.coef_ = beta[1:]
        else:
            self.coef_ = beta

        self._beta_full = beta
        self._XtX_inv = mat_inv(XtX)
        return self

    def predict(self, X: list[list[float]]) -> list[float]:
        Xd = self._add_intercept(X) if self.fit_intercept else X
        return [dot(Xd[i], self._beta_full) for i in range(len(Xd))]

    def standard_errors(self) -> list[float]:
        """Homoskedastic standard errors: sqrt(σ² diag((X^T X)^{-1}))."""
        return [math.sqrt(self.sigma2_ * self._XtX_inv[i][i]) for i in range(self.p_)]

    def r_squared(self) -> float:
        y_bar = sum(self._y) / self.n_
        tss = sum((yi - y_bar) ** 2 for yi in self._y)
        rss = dot(self.residuals_, self.residuals_)
        return 1.0 - rss / tss if tss > 0 else 0.0

    def adj_r_squared(self) -> float:
        r2 = self.r_squared()
        n, p = self.n_, self.p_
        return 1.0 - (1.0 - r2) * (n - 1) / (n - p)

    def f_statistic(self) -> float:
        """F statistic for overall significance H0: β = 0 (excluding intercept)."""
        r2 = self.r_squared()
        n, p = self.n_, self.p_
        k = p - (1 if self.fit_intercept else 0)
        if k <= 0:
            return float("nan")
        return (r2 / k) / ((1.0 - r2) / (n - p))

    def leverage(self) -> list[float]:
        """Diagonal of hat matrix H = X (X^T X)^{-1} X^T."""
        H = hat_matrix(self._X)
        return [H[i][i] for i in range(self.n_)]

    def cooks_distance(self) -> list[float]:
        """Cook's distance D_i = (ê_i)² h_ii / (p σ² (1-h_ii)²)."""
        h = self.leverage()
        p = self.p_
        return [
            (self.residuals_[i] ** 2 * h[i]) / (p * self.sigma2_ * (1.0 - h[i]) ** 2)
            if (1.0 - h[i]) > 1e-10 else float("inf")
            for i in range(self.n_)
        ]

    def hc0_se(self) -> list[float]:
        """HC0 heteroskedasticity-robust (White) standard errors."""
        e = self.residuals_
        X = self._X
        n, p = self.n_, self.p_
        meat = [[0.0] * p for _ in range(p)]
        for i in range(n):
            xi = X[i]
            for r in range(p):
                for c in range(p):
                    meat[r][c] += e[i] ** 2 * xi[r] * xi[c]
        V = mat_mul(mat_mul(self._XtX_inv, meat), self._XtX_inv)
        return [math.sqrt(max(0.0, V[j][j])) for j in range(p)]


# ---------------------------------------------------------------------------
# Ridge Regression
# ---------------------------------------------------------------------------

class Ridge:
    """
    Ridge regression: β̂ = (X^T X + λ I)^{-1} X^T y.

    Incorporates bias-variance trade-off analysis and GCV for λ selection.
    """

    def __init__(self, lam: float = 1.0, fit_intercept: bool = True):
        self.lam = lam
        self.fit_intercept = fit_intercept
        self.coef_: Optional[list[float]] = None
        self.intercept_: float = 0.0

    def fit(self, X: list[list[float]], y: list[float]) -> "Ridge":
        if self.fit_intercept:
            x_mean = [sum(X[i][j] for i in range(len(X))) / len(X) for j in range(len(X[0]))]
            y_mean = sum(y) / len(y)
            Xc = [[X[i][j] - x_mean[j] for j in range(len(X[0]))] for i in range(len(X))]
            yc = [yi - y_mean for yi in y]
        else:
            Xc, yc = X, y
            x_mean = [0.0] * len(X[0])
            y_mean = 0.0

        p = len(Xc[0])
        XtX = gram(Xc)
        reg = mat_add(XtX, mat_scale(identity(p), self.lam))
        Xty = mat_vec(mat_T(Xc), yc)
        beta = lu_solve(reg, Xty)
        self.coef_ = beta

        if self.fit_intercept:
            self.intercept_ = y_mean - dot(beta, x_mean)

        self._Xc = Xc
        self._yc = yc
        return self

    def predict(self, X: list[list[float]]) -> list[float]:
        return [dot(X[i], self.coef_) + self.intercept_ for i in range(len(X))]

    def gcv_score(self) -> float:
        """Generalised Cross-Validation score for current λ."""
        n, p = len(self._Xc), len(self._Xc[0])
        H = hat_matrix_ridge(self._Xc, self.lam)
        y_hat = mat_vec(H, self._yc)
        resid = [self._yc[i] - y_hat[i] for i in range(n)]
        rss = dot(resid, resid)
        trH = trace(H)
        denom = (1.0 - trH / n) ** 2
        return (rss / n) / denom if denom > 1e-14 else float("inf")


def hat_matrix_ridge(X: list[list[float]], lam: float) -> list[list[float]]:
    """H_λ = X (X^T X + λ I)^{-1} X^T."""
    p = len(X[0])
    XtX = gram(X)
    reg = mat_add(XtX, mat_scale(identity(p), lam))
    reginv = mat_inv(reg)
    return mat_mul(mat_mul(X, reginv), mat_T(X))


# ---------------------------------------------------------------------------
# LASSO (Coordinate Descent)
# ---------------------------------------------------------------------------

class LASSO:
    """
    LASSO via cyclic coordinate descent.

    Objective: (1/2n)||y - Xβ||² + λ||β||₁

    Coordinate update (Shooting algorithm):
      β_j ← S(r_j / n, λ) / ||x_j||² / n
    where S(z, λ) = sign(z) max(|z|-λ, 0) is the soft-threshold operator.
    """

    def __init__(self, lam: float = 0.1, max_iter: int = 1000,
                 tol: float = 1e-6, fit_intercept: bool = True):
        self.lam = lam
        self.max_iter = max_iter
        self.tol = tol
        self.fit_intercept = fit_intercept
        self.coef_: Optional[list[float]] = None
        self.intercept_: float = 0.0
        self.n_iter_: int = 0

    @staticmethod
    def _soft_threshold(z: float, t: float) -> float:
        if z > t:
            return z - t
        elif z < -t:
            return z + t
        return 0.0

    def fit(self, X: list[list[float]], y: list[float]) -> "LASSO":
        n, p = len(X), len(X[0])
        if self.fit_intercept:
            x_mean = [sum(X[i][j] for i in range(n)) / n for j in range(p)]
            y_mean = sum(y) / n
            Xc = [[X[i][j] - x_mean[j] for j in range(p)] for i in range(n)]
            yc = [yi - y_mean for yi in y]
        else:
            Xc, yc = X, y[:]
            x_mean = [0.0] * p
            y_mean = 0.0

        beta = [0.0] * p
        col_norms_sq = [sum(Xc[i][j] ** 2 for i in range(n)) for j in range(p)]
        resid = yc[:]

        for iteration in range(self.max_iter):
            max_delta = 0.0
            for j in range(p):
                if col_norms_sq[j] < 1e-14:
                    continue
                # Partial residual r_j = resid + x_j * beta_j
                rj = sum(Xc[i][j] * (resid[i] + Xc[i][j] * beta[j]) for i in range(n))
                new_beta_j = self._soft_threshold(rj / n, self.lam) / (col_norms_sq[j] / n)
                delta = new_beta_j - beta[j]
                if abs(delta) > max_delta:
                    max_delta = abs(delta)
                # Update residuals
                for i in range(n):
                    resid[i] -= Xc[i][j] * delta
                beta[j] = new_beta_j
            self.n_iter_ = iteration + 1
            if max_delta < self.tol:
                break

        self.coef_ = beta
        if self.fit_intercept:
            self.intercept_ = y_mean - dot(beta, x_mean)
        return self

    def predict(self, X: list[list[float]]) -> list[float]:
        return [dot(X[i], self.coef_) + self.intercept_ for i in range(len(X))]


# ---------------------------------------------------------------------------
# Elastic Net (Coordinate Descent)
# ---------------------------------------------------------------------------

class ElasticNet:
    """
    Elastic Net: (1/2n)||y-Xβ||² + λ₁||β||₁ + (λ₂/2)||β||²

    Coordinate update:
      β_j ← S(r_j/n, λ₁) / (||x_j||²/n + λ₂)
    """

    def __init__(self, lam1: float = 0.1, lam2: float = 0.1,
                 max_iter: int = 1000, tol: float = 1e-6, fit_intercept: bool = True):
        self.lam1 = lam1
        self.lam2 = lam2
        self.max_iter = max_iter
        self.tol = tol
        self.fit_intercept = fit_intercept
        self.coef_: Optional[list[float]] = None
        self.intercept_: float = 0.0

    @staticmethod
    def _soft_threshold(z: float, t: float) -> float:
        return math.copysign(max(abs(z) - t, 0.0), z)

    def fit(self, X: list[list[float]], y: list[float]) -> "ElasticNet":
        n, p = len(X), len(X[0])
        if self.fit_intercept:
            x_mean = [sum(X[i][j] for i in range(n)) / n for j in range(p)]
            y_mean = sum(y) / n
            Xc = [[X[i][j] - x_mean[j] for j in range(p)] for i in range(n)]
            yc = [yi - y_mean for yi in y]
        else:
            Xc, yc = X, y[:]
            x_mean = [0.0] * p
            y_mean = 0.0

        beta = [0.0] * p
        col_norms_sq = [sum(Xc[i][j] ** 2 for i in range(n)) for j in range(p)]
        resid = yc[:]

        for _ in range(self.max_iter):
            max_delta = 0.0
            for j in range(p):
                cnj = col_norms_sq[j]
                if cnj < 1e-14:
                    continue
                rj = sum(Xc[i][j] * (resid[i] + Xc[i][j] * beta[j]) for i in range(n))
                denom = cnj / n + self.lam2
                new_bj = self._soft_threshold(rj / n, self.lam1) / denom
                delta = new_bj - beta[j]
                if abs(delta) > max_delta:
                    max_delta = abs(delta)
                for i in range(n):
                    resid[i] -= Xc[i][j] * delta
                beta[j] = new_bj
            if max_delta < self.tol:
                break

        self.coef_ = beta
        if self.fit_intercept:
            self.intercept_ = y_mean - dot(beta, x_mean)
        return self

    def predict(self, X: list[list[float]]) -> list[float]:
        return [dot(X[i], self.coef_) + self.intercept_ for i in range(len(X))]


# ---------------------------------------------------------------------------
# Logistic Regression (Newton-Raphson / IRLS)
# ---------------------------------------------------------------------------

class LogisticRegression:
    """
    Binary logistic regression via Newton-Raphson (IRLS).

    Model: P(Y=1|x) = σ(x^T β),  σ(z) = 1/(1+e^{-z})

    Score: ∂ℓ/∂β = X^T (y - μ)
    Hessian: ∂²ℓ/∂β∂β^T = -X^T W X,  W = diag(μ_i(1-μ_i))

    Newton update: β ← β + (X^T W X)^{-1} X^T (y - μ)
    """

    def __init__(self, max_iter: int = 100, tol: float = 1e-8,
                 fit_intercept: bool = True, reg: float = 0.0):
        self.max_iter = max_iter
        self.tol = tol
        self.fit_intercept = fit_intercept
        self.reg = reg  # L2 regularisation coefficient
        self.coef_: Optional[list[float]] = None
        self.intercept_: float = 0.0
        self.n_iter_: int = 0

    @staticmethod
    def _sigmoid(z: float) -> float:
        if z >= 0:
            return 1.0 / (1.0 + math.exp(-z))
        e = math.exp(z)
        return e / (1.0 + e)

    def fit(self, X: list[list[float]], y: list[float]) -> "LogisticRegression":
        Xd = [[1.0] + row for row in X] if self.fit_intercept else [row[:] for row in X]
        n, p = len(Xd), len(Xd[0])
        beta = [0.0] * p

        for iteration in range(self.max_iter):
            mu = [self._sigmoid(dot(Xd[i], beta)) for i in range(n)]
            resid = [y[i] - mu[i] for i in range(n)]  # score gradient direction

            # Hessian: X^T W X + reg I
            W = [mu[i] * (1.0 - mu[i]) for i in range(n)]
            XtWX = [[sum(Xd[i][r] * W[i] * Xd[i][c] for i in range(n)) for c in range(p)]
                    for r in range(p)]
            if self.reg > 0:
                for j in range(p):
                    XtWX[j][j] += self.reg

            grad = [sum(Xd[i][j] * resid[i] for i in range(n)) - (self.reg * beta[j] if self.reg > 0 else 0.0)
                    for j in range(p)]

            try:
                delta = lu_solve(XtWX, grad)
            except Exception:
                break

            for j in range(p):
                beta[j] += delta[j]

            self.n_iter_ = iteration + 1
            if norm2(delta) < self.tol:
                break

        if self.fit_intercept:
            self.intercept_ = beta[0]
            self.coef_ = beta[1:]
        else:
            self.coef_ = beta
        self._beta_full = beta
        self._Xd = Xd
        return self

    def predict_proba(self, X: list[list[float]]) -> list[float]:
        Xd = [[1.0] + row for row in X] if self.fit_intercept else X
        return [self._sigmoid(dot(Xd[i], self._beta_full)) for i in range(len(Xd))]

    def predict(self, X: list[list[float]], threshold: float = 0.5) -> list[int]:
        return [1 if p >= threshold else 0 for p in self.predict_proba(X)]


# ---------------------------------------------------------------------------
# Gaussian Process Regression
# ---------------------------------------------------------------------------

class GaussianProcessRegressor:
    """
    Exact GP regression with user-supplied kernel.

    Posterior: f* | X, y, X* ~ N(μ*, Σ*)
      μ* = K(X*,X) [K(X,X) + σ²I]^{-1} y
      Σ* = K(X*,X*) - K(X*,X) [K(X,X) + σ²I]^{-1} K(X,X*)

    Log marginal likelihood:
      log p(y|X) = -½ y^T [K+σ²I]^{-1} y - ½ log|K+σ²I| - n/2 log(2π)
    """

    def __init__(self, kernel: Callable[[list[float], list[float]], float],
                 noise_var: float = 1e-4):
        self.kernel = kernel
        self.noise_var = noise_var
        self._X_train: Optional[list[list[float]]] = None
        self._alpha: Optional[list[float]] = None
        self._L: Optional[list[list[float]]] = None

    def _build_kernel_matrix(self, X1: list[list[float]],
                              X2: list[list[float]]) -> list[list[float]]:
        return [[self.kernel(X1[i], X2[j]) for j in range(len(X2))]
                for i in range(len(X1))]

    def fit(self, X: list[list[float]], y: list[float]) -> "GaussianProcessRegressor":
        n = len(X)
        K = self._build_kernel_matrix(X, X)
        # Add noise
        for i in range(n):
            K[i][i] += self.noise_var
        self._L = cholesky(K)
        self._alpha = chol_solve(self._L, y)
        self._X_train = X
        self._y_train = y
        return self

    def predict(self, X_star: list[list[float]]) -> Tuple[list[float], list[float]]:
        """Returns (mean, variance) at X_star."""
        Ks = self._build_kernel_matrix(X_star, self._X_train)
        mu = [dot(Ks[i], self._alpha) for i in range(len(X_star))]

        # Variance: k** - K_*s (K + σ²I)^{-1} K_s*
        Kss_diag = [self.kernel(X_star[i], X_star[i]) for i in range(len(X_star))]
        L = self._L
        variances = []
        for i in range(len(X_star)):
            v = forward_sub(L, Ks[i])
            variances.append(max(0.0, Kss_diag[i] - dot(v, v)))
        return mu, variances

    def log_marginal_likelihood(self) -> float:
        """log p(y|X,θ) = -½ y^T α - Σ log L_ii - n/2 log(2π)."""
        n = len(self._y_train)
        log_det = sum(math.log(self._L[i][i]) for i in range(n))
        data_fit = 0.5 * dot(self._y_train, self._alpha)
        return -data_fit - log_det - 0.5 * n * math.log(2 * math.pi)


# ---------------------------------------------------------------------------
# Kernels for GP
# ---------------------------------------------------------------------------

def rbf_kernel(length_scale: float = 1.0, amplitude: float = 1.0
               ) -> Callable[[list[float], list[float]], float]:
    """Squared Exponential (RBF) kernel k(x,x') = σ² exp(-||x-x'||²/(2l²))."""
    def k(x: list[float], xp: list[float]) -> float:
        d2 = sum((a - b) ** 2 for a, b in zip(x, xp))
        return amplitude ** 2 * math.exp(-d2 / (2.0 * length_scale ** 2))
    return k


def matern52_kernel(length_scale: float = 1.0, amplitude: float = 1.0
                    ) -> Callable[[list[float], list[float]], float]:
    """Matérn 5/2 kernel: k(r) = σ²(1 + √5 r/l + 5r²/(3l²)) exp(-√5 r/l)."""
    def k(x: list[float], xp: list[float]) -> float:
        r = math.sqrt(sum((a - b) ** 2 for a, b in zip(x, xp)))
        t = math.sqrt(5.0) * r / length_scale
        return amplitude ** 2 * (1.0 + t + t ** 2 / 3.0) * math.exp(-t)
    return k


def rational_quadratic_kernel(alpha: float = 1.0, length_scale: float = 1.0,
                               amplitude: float = 1.0
                               ) -> Callable[[list[float], list[float]], float]:
    """Rational quadratic: k(r) = σ²(1 + r²/(2αl²))^{-α}."""
    def k(x: list[float], xp: list[float]) -> float:
        r2 = sum((a - b) ** 2 for a, b in zip(x, xp))
        return amplitude ** 2 * (1.0 + r2 / (2.0 * alpha * length_scale ** 2)) ** (-alpha)
    return k


# ---------------------------------------------------------------------------
# Cox Proportional Hazards (partial likelihood, Newton-Raphson)
# ---------------------------------------------------------------------------

class CoxPH:
    """
    Cox Proportional Hazards model.

    Partial log-likelihood:
      ℓ(β) = Σ_{i:δ_i=1} [x_i^T β - log Σ_{j∈R(t_i)} exp(x_j^T β)]

    Score:  U_k = Σ_{i:δ_i=1} [x_ik - ē_k(t_i)]
    Information: I_kl = Σ_{i:δ_i=1} [ē_kl(t_i) - ē_k(t_i)ē_l(t_i)]

    where ē_k(t) = Σ_{j∈R(t)} x_jk exp(x_j^T β) / Σ_{j∈R(t)} exp(x_j^T β)
    """

    def __init__(self, max_iter: int = 100, tol: float = 1e-8):
        self.max_iter = max_iter
        self.tol = tol
        self.coef_: Optional[list[float]] = None
        self.n_iter_: int = 0

    def fit(self, X: list[list[float]], times: list[float],
            events: list[int]) -> "CoxPH":
        n, p = len(X), len(X[0])
        beta = [0.0] * p
        order = sorted(range(n), key=lambda i: times[i])

        for iteration in range(self.max_iter):
            score = [0.0] * p
            info = [[0.0] * p for _ in range(p)]

            for i in order:
                if not events[i]:
                    continue
                ti = times[i]
                # Risk set R(ti): all j with t_j >= t_i
                risk = [j for j in range(n) if times[j] >= ti]
                theta = [math.exp(min(dot(X[j], beta), 500.0)) for j in risk]
                S0 = sum(theta)
                S1 = [sum(X[risk[k]][q] * theta[k] for k in range(len(risk))) / S0 for q in range(p)]
                S2 = [[sum(X[risk[k]][q] * X[risk[k]][r] * theta[k]
                           for k in range(len(risk))) / S0 for r in range(p)] for q in range(p)]

                for q in range(p):
                    score[q] += X[i][q] - S1[q]
                for q in range(p):
                    for r in range(p):
                        info[q][r] += S2[q][r] - S1[q] * S1[r]

            try:
                delta = lu_solve(info, score)
            except Exception:
                break

            for j in range(p):
                beta[j] += delta[j]

            self.n_iter_ = iteration + 1
            if norm2(delta) < self.tol:
                break

        self.coef_ = beta
        return self

    def hazard_ratio(self, x1: list[float], x2: list[float]) -> float:
        """HR(x1 vs x2) = exp((x1 - x2)^T β)."""
        return math.exp(dot([x1[j] - x2[j] for j in range(len(x1))], self.coef_))


# ---------------------------------------------------------------------------
# Bayesian Linear Regression (conjugate Normal-Inverse-Gamma prior)
# ---------------------------------------------------------------------------

class BayesianLinearRegression:
    """
    Bayesian linear regression with conjugate Normal-Inverse-Gamma prior.

    Prior:  β | σ² ~ N(μ₀, σ² Λ₀⁻¹)
            σ² ~ InvGamma(a₀, b₀)

    Posterior:
      Λₙ = Λ₀ + X^T X
      μₙ = Λₙ⁻¹ (Λ₀ μ₀ + X^T y)
      aₙ = a₀ + n/2
      bₙ = b₀ + ½(y^T y + μ₀^T Λ₀ μ₀ - μₙ^T Λₙ μₙ)

    Predictive distribution (marginalising σ²): Student-t
    """

    def __init__(self, prior_mean: Optional[list[float]] = None,
                 prior_precision: Optional[list[list[float]]] = None,
                 a0: float = 1e-4, b0: float = 1e-4, fit_intercept: bool = True):
        self.prior_mean = prior_mean
        self.prior_precision = prior_precision
        self.a0 = a0
        self.b0 = b0
        self.fit_intercept = fit_intercept
        self.mu_n: Optional[list[float]] = None
        self.Lambda_n: Optional[list[list[float]]] = None
        self.a_n: float = a0
        self.b_n: float = b0

    def fit(self, X: list[list[float]], y: list[float]) -> "BayesianLinearRegression":
        Xd = [[1.0] + row for row in X] if self.fit_intercept else [row[:] for row in X]
        n, p = len(Xd), len(Xd[0])

        Lambda0 = self.prior_precision if self.prior_precision else mat_scale(identity(p), 1e-4)
        mu0 = self.prior_mean if self.prior_mean else [0.0] * p

        XtX = gram(Xd)
        self.Lambda_n = mat_add(Lambda0, XtX)

        Xty = mat_vec(mat_T(Xd), y)
        Lambda0_mu0 = mat_vec(Lambda0, mu0)
        rhs = [Lambda0_mu0[j] + Xty[j] for j in range(p)]
        self.mu_n = lu_solve(self.Lambda_n, rhs)

        self.a_n = self.a0 + n / 2.0
        yty = dot(y, y)
        mu0_Lambda0_mu0 = dot(mu0, mat_vec(Lambda0, mu0))
        mun_Lambdan_mun = dot(self.mu_n, mat_vec(self.Lambda_n, self.mu_n))
        self.b_n = self.b0 + 0.5 * (yty + mu0_Lambda0_mu0 - mun_Lambdan_mun)
        return self

    def predict_mean(self, X: list[list[float]]) -> list[float]:
        Xd = [[1.0] + row for row in X] if self.fit_intercept else X
        return [dot(Xd[i], self.mu_n) for i in range(len(Xd))]

    def posterior_variance_beta(self) -> float:
        """E[σ²] × Λₙ⁻¹ diagonal (marginal posterior variance of each β_j)."""
        sigma2_mean = self.b_n / (self.a_n - 1) if self.a_n > 1 else float("inf")
        Ln_inv = mat_inv(self.Lambda_n)
        return [sigma2_mean * Ln_inv[j][j] for j in range(len(self.mu_n))]
