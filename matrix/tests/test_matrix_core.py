"""Tests for matrix/matrix_core.py."""

from __future__ import annotations

import math
import random
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from matrix.matrix_core import (  # noqa: E402
    cholesky,
    dot,
    empirical_spectral_distribution,
    eye,
    frobenius_norm,
    inverse_iteration,
    kronecker,
    lanczos,
    lu_decomp,
    lu_solve,
    marchenko_pastur_density,
    mat_add,
    mat_expm,
    mat_inv,
    mat_mul,
    mat_scale,
    mat_sub,
    mat_T,
    mat_vec,
    norm2,
    outer,
    power_iteration,
    qr_householder,
    rayleigh_quotient_iteration,
    semicircle_density,
    trace,
    tridiag_eig,
    unvec,
    vec,
    zeros,
    bidiagonalise,
)


def _assert_matrix_close(testcase: unittest.TestCase, actual, expected, places: int = 7) -> None:
    testcase.assertEqual(len(actual), len(expected))
    for row_a, row_e in zip(actual, expected):
        testcase.assertEqual(len(row_a), len(row_e))
        for a, e in zip(row_a, row_e):
            testcase.assertAlmostEqual(a, e, places=places)


class TestMatrixBasics(unittest.TestCase):
    def test_zeros_eye_and_copy_helpers(self):
        z = zeros(2, 3)
        self.assertEqual(z, [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]])
        i = eye(3)
        self.assertEqual(i, [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]])

    def test_basic_arithmetic_helpers(self):
        a = [[1.0, 2.0], [3.0, 4.0]]
        b = [[5.0, 6.0], [7.0, 8.0]]
        self.assertEqual(mat_add(a, b), [[6.0, 8.0], [10.0, 12.0]])
        self.assertEqual(mat_sub(b, a), [[4.0, 4.0], [4.0, 4.0]])
        self.assertEqual(mat_scale(a, 2.0), [[2.0, 4.0], [6.0, 8.0]])
        self.assertEqual(mat_T(a), [[1.0, 3.0], [2.0, 4.0]])
        self.assertEqual(mat_vec(a, [1.0, 1.0]), [3.0, 7.0])
        self.assertEqual(vec(a), [1.0, 3.0, 2.0, 4.0])
        self.assertEqual(unvec([1.0, 3.0, 2.0, 4.0], 2, 2), a)

    def test_mul_norm_trace_outer(self):
        a = [[1.0, 2.0], [3.0, 4.0]]
        b = [[2.0, 0.0], [1.0, 2.0]]
        self.assertEqual(mat_mul(a, b), [[4.0, 4.0], [10.0, 8.0]])
        self.assertEqual(dot([1.0, 2.0, 3.0], [4.0, 5.0, 6.0]), 32.0)
        self.assertAlmostEqual(norm2([3.0, 4.0]), 5.0)
        self.assertAlmostEqual(frobenius_norm(a), math.sqrt(30.0))
        self.assertAlmostEqual(trace(a), 5.0)
        self.assertEqual(outer([1.0, 2.0], [3.0, 4.0]), [[3.0, 4.0], [6.0, 8.0]])


class TestMatrixDecompositions(unittest.TestCase):
    def test_lu_decomp_and_solve(self):
        a = [[0.0, 2.0], [1.0, 3.0]]
        l, u, p = lu_decomp(a)
        self.assertEqual(len(p), 2)
        self.assertTrue(all(abs(l[i][i] - 1.0) < 1e-12 for i in range(2)))
        x = lu_solve(a, [2.0, 5.0])
        self.assertAlmostEqual(x[0], 2.0)
        self.assertAlmostEqual(x[1], 1.0)

    def test_mat_inv(self):
        a = [[4.0, 7.0], [2.0, 6.0]]
        inv_a = mat_inv(a)
        _assert_matrix_close(self, mat_mul(a, inv_a), eye(2), places=6)

    def test_qr_householder(self):
        a = [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]]
        q, r = qr_householder(a)
        _assert_matrix_close(self, mat_mul(mat_T(q), q), eye(3), places=6)
        _assert_matrix_close(self, mat_mul(q, r), a, places=6)

    def test_bidiagonalise(self):
        a = [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]]
        u, b, v = bidiagonalise(a)
        reconstructed = mat_mul(mat_T(u), mat_mul(a, v))
        _assert_matrix_close(self, reconstructed, b, places=6)
        for i, row in enumerate(b):
            for j, value in enumerate(row):
                if j > i + 1:
                    self.assertAlmostEqual(value, 0.0, places=6)

    def test_cholesky(self):
        a = [[4.0, 2.0], [2.0, 3.0]]
        l = cholesky(a)
        lt = mat_T(l)
        _assert_matrix_close(self, mat_mul(l, lt), a, places=6)
        with self.assertRaises(ValueError):
            cholesky([[1.0, 2.0], [2.0, 1.0]])


class TestEigenAndExponential(unittest.TestCase):
    def test_power_iteration(self):
        with patch.object(random, "gauss", side_effect=[1.0, 1.0]):
            eigenvalue, vector = power_iteration([[5.0, 0.0], [0.0, 2.0]], max_iter=50)
        self.assertAlmostEqual(eigenvalue, 5.0, places=6)
        self.assertGreater(abs(vector[0]), abs(vector[1]))

    def test_inverse_iteration(self):
        with patch.object(random, "gauss", side_effect=[1.0, 1.0]):
            eigenvalue, vector = inverse_iteration([[2.0, 0.0], [0.0, 5.0]], mu=4.9, max_iter=50)
        self.assertAlmostEqual(eigenvalue, 5.0, places=6)
        self.assertGreater(abs(vector[1]), abs(vector[0]))

    def test_rayleigh_quotient_iteration(self):
        eigenvalue, vector = rayleigh_quotient_iteration([[2.0, 0.0], [0.0, 1.0]], v0=[1.0, 0.0])
        self.assertAlmostEqual(eigenvalue, 2.0, places=6)
        self.assertAlmostEqual(vector[0], 1.0, places=6)

    def test_mat_expm(self):
        self.assertEqual(mat_expm([[0.0, 0.0], [0.0, 0.0]]), eye(2))
        exp_diag = mat_expm([[1.0, 0.0], [0.0, 2.0]])
        self.assertAlmostEqual(exp_diag[0][0], math.e, places=3)
        self.assertAlmostEqual(exp_diag[1][1], math.exp(2.0), places=3)


class TestSpectralHelpers(unittest.TestCase):
    def test_histogram_and_density_helpers(self):
        centres, density = empirical_spectral_distribution([1.0, 2.0, 3.0, 4.0], bins=2)
        self.assertEqual(len(centres), 2)
        self.assertEqual(len(density), 2)
        self.assertAlmostEqual(semicircle_density(0.0), 1.0 / math.pi, places=6)
        self.assertEqual(semicircle_density(3.0), 0.0)
        self.assertGreater(marchenko_pastur_density(1.0, gamma=0.5), 0.0)
        self.assertEqual(marchenko_pastur_density(0.01, gamma=0.5), 0.0)

    def test_tridiag_eig_on_diagonal_case(self):
        eigenvalues = tridiag_eig([1.0, 2.0, 3.0], [0.0, 0.0])
        self.assertCountEqual([round(v, 6) for v in eigenvalues], [1.0, 2.0, 3.0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
