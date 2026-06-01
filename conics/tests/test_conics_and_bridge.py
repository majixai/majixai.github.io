"""Tests for conics/python/conics.py and the matrix bridge."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from conics import ConicCoeffs, classify, decompose, fit_ols  # noqa: E402
from conics.integrations import matrix_bridge  # noqa: E402
from conics.integrations.matrix_bridge import normal_matrix_solve  # noqa: E402


def _sample_surface():
    xs = [-1.0, 0.0, 1.0, -1.0, 0.0, 1.0, -1.0, 0.0, 1.0]
    ys = [-1.0, -1.0, -1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0]
    zs = []
    for x, y in zip(xs, ys):
        zs.append(2.0 * x * x + 3.0 * x * y + 4.0 * y * y + 5.0 * x + 6.0 * y + 7.0)
    return xs, ys, zs


class TestConicGeometry(unittest.TestCase):
    def test_classify_and_decompose_circle(self):
        cc = ConicCoeffs(A=1.0, B=0.0, C=1.0, D=0.0, E=0.0, F=-1.0)
        self.assertEqual(classify(cc.A, cc.B, cc.C), "ELLIPSE")
        self.assertEqual(cc.eval(1.0, 0.0), 0.0)
        decomp = decompose(cc)
        self.assertEqual(decomp.kind, "ELLIPSE")
        self.assertAlmostEqual(decomp.disc, -4.0)
        self.assertAlmostEqual(decomp.cx, 0.0)
        self.assertAlmostEqual(decomp.cy, 0.0)
        self.assertAlmostEqual(decomp.semiA, 1.0)
        self.assertAlmostEqual(decomp.semiB, 1.0)

    def test_rotated_ellipse(self):
        cc = ConicCoeffs(A=2.0, B=1.0, C=3.0, D=0.0, E=0.0, F=-4.0)
        decomp = decompose(cc)
        self.assertEqual(decomp.kind, "ELLIPSE")
        self.assertAlmostEqual(decomp.theta, 0.5 * 2.356194490192345, places=6)
        self.assertGreater(decomp.semiA, 0.0)
        self.assertGreater(decomp.semiB, 0.0)

    def test_parabola_and_hyperbola(self):
        self.assertEqual(classify(1.0, 0.0, 0.0), "PARABOLA")
        self.assertEqual(classify(1.0, 0.0, -1.0), "HYPERBOLA")

    def test_fit_ols_recovers_coefficients(self):
        xs, ys, zs = _sample_surface()
        result = fit_ols(xs, ys, zs)
        self.assertIsNotNone(result)
        assert result is not None
        coeffs = result.coeffs
        self.assertAlmostEqual(coeffs.A, 2.0, places=6)
        self.assertAlmostEqual(coeffs.B, 3.0, places=6)
        self.assertAlmostEqual(coeffs.C, 4.0, places=6)
        self.assertAlmostEqual(coeffs.D, 5.0, places=6)
        self.assertAlmostEqual(coeffs.E, 6.0, places=6)
        self.assertAlmostEqual(coeffs.F, 7.0, places=6)
        self.assertAlmostEqual(result.rss, 0.0, places=6)
        self.assertAlmostEqual(result.r2, 1.0, places=6)

    def test_fit_ols_requires_enough_points(self):
        self.assertIsNone(fit_ols([0.0] * 5, [0.0] * 5, [0.0] * 5))


class TestMatrixBridge(unittest.TestCase):
    def test_normal_matrix_solve_matches_fit_ols(self):
        xs, ys, zs = _sample_surface()
        bridge_result = normal_matrix_solve(xs, ys, zs)
        self.assertIsNotNone(bridge_result)
        assert bridge_result is not None
        self.assertAlmostEqual(bridge_result.coeffs.A, 2.0, places=6)
        self.assertAlmostEqual(bridge_result.coeffs.B, 3.0, places=6)
        self.assertAlmostEqual(bridge_result.coeffs.C, 4.0, places=6)
        self.assertAlmostEqual(bridge_result.coeffs.D, 5.0, places=6)
        self.assertAlmostEqual(bridge_result.coeffs.E, 6.0, places=6)
        self.assertAlmostEqual(bridge_result.coeffs.F, 7.0, places=6)
        self.assertAlmostEqual(bridge_result.rss, 0.0, places=6)
        self.assertAlmostEqual(bridge_result.r2, 1.0, places=6)

    def test_normal_matrix_solve_fallback_path(self):
        xs, ys, zs = _sample_surface()
        with patch.object(matrix_bridge, "_MATRIX_CORE_AVAILABLE", False):
            fallback_result = matrix_bridge.normal_matrix_solve(xs, ys, zs)
        self.assertIsNotNone(fallback_result)
        assert fallback_result is not None
        self.assertAlmostEqual(fallback_result.coeffs.A, 2.0, places=6)
        self.assertAlmostEqual(fallback_result.coeffs.B, 3.0, places=6)
        self.assertAlmostEqual(fallback_result.coeffs.C, 4.0, places=6)


if __name__ == "__main__":
    unittest.main(verbosity=2)
