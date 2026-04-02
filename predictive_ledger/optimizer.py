"""
predictive_ledger/optimizer.py

LedgerOptimizer — Python backend for multivariate Bayesian weight updates
and arctangent Jacobian calculations.

All heavy matrix operations use NumPy so they stay fast even for large
ledger datasets, offloading work that would be slow inside a JS engine.
"""

import numpy as np


class LedgerOptimizer:
    """
    Multivariate Bayesian linear regression weight optimizer.

    The model assumes:
        y  =  X @ w  +  ε,   ε ~ N(0, σ²)

    with a Gaussian prior on the weight vector w:
        w  ~  N(μ_prior, Σ_prior)

    Given observations (X, y) the closed-form posterior is:
        Σ_post = (Λ_prior + (1/σ²) * Xᵀ X)⁻¹
        μ_post = Σ_post @ (Λ_prior @ μ_prior + (1/σ²) * Xᵀ y)

    where Λ_prior = Σ_prior⁻¹ is the prior precision matrix.
    """

    def __init__(self, noise_var: float = 0.01):
        """
        Parameters
        ----------
        noise_var : float
            Observation noise variance σ².  A smaller value means the model
            trusts the data more and updates weights more aggressively.
        """
        if noise_var <= 0:
            raise ValueError("noise_var must be strictly positive")
        self.noise_var = float(noise_var)

    def update_weights(
        self,
        X: np.ndarray,
        y: np.ndarray,
        prior_mu: np.ndarray,
        prior_cov: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Perform a full Bayesian linear regression posterior update.

        Parameters
        ----------
        X         : (n_samples, n_features) design matrix
        y         : (n_samples,) target vector
        prior_mu  : (n_features,) prior mean vector μ_prior
        prior_cov : (n_features, n_features) prior covariance Σ_prior

        Returns
        -------
        post_mu  : (n_features,) posterior mean
        post_cov : (n_features, n_features) posterior covariance
        """
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)
        prior_mu = np.asarray(prior_mu, dtype=float)
        prior_cov = np.asarray(prior_cov, dtype=float)

        # Prior precision matrix  Λ_prior = Σ_prior⁻¹
        precision_prior = np.linalg.inv(prior_cov)

        # Posterior precision  Λ_post = Λ_prior + (1/σ²) Xᵀ X
        precision_post = precision_prior + (1.0 / self.noise_var) * (X.T @ X)

        # Posterior covariance  Σ_post = Λ_post⁻¹
        post_cov = np.linalg.inv(precision_post)

        # Posterior mean  μ_post = Σ_post @ (Λ_prior μ_prior + (1/σ²) Xᵀ y)
        post_mu = post_cov @ (
            precision_prior @ prior_mu + (1.0 / self.noise_var) * (X.T @ y)
        )

        return post_mu, post_cov

    @staticmethod
    def arctan_jacobian(u: np.ndarray, du: np.ndarray) -> np.ndarray:
        """
        Arctrigonometric differential for non-linear phase estimation.

        Computes the chain-rule derivative:
            d/dx arctan(u(x))  =  1 / (1 + u²)  ·  du/dx

        Used to linearise the arctan activation in the prediction model
        around the current operating point when computing the Jacobian
        for gradient-based updates.

        Parameters
        ----------
        u  : array-like — current value of the inner function u(x)
        du : array-like — derivative du/dx (same shape as u)

        Returns
        -------
        Jacobian value(s) of arctan(u) with respect to x
        """
        u = np.asarray(u, dtype=float)
        du = np.asarray(du, dtype=float)
        return (1.0 / (1.0 + np.power(u, 2))) * du

    def posterior_summary(
        self,
        post_mu: np.ndarray,
        post_cov: np.ndarray,
    ) -> dict:
        """
        Return a JSON-serialisable summary of the posterior distribution.

        Includes the posterior mean, standard deviations (square root of the
        diagonal of the covariance matrix), and the condition number of the
        covariance (a measure of numerical stability).
        """
        post_mu = np.asarray(post_mu, dtype=float)
        post_cov = np.asarray(post_cov, dtype=float)
        return {
            "posterior_mean": post_mu.tolist(),
            "posterior_std": np.sqrt(np.diag(post_cov)).tolist(),
            "posterior_cov": post_cov.tolist(),
            "condition_number": float(np.linalg.cond(post_cov)),
        }
