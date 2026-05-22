"""
conics/integrations/__init__.py
=================================
Integration bridges between the conics/ module and other root directories
in this repository.

Available bridges:
    matrix_bridge      — matrix/matrix_core.py  (mat_mul, lu_solve, qr, svd)
    numerical_bridge   — numerical_methods/numerical_core.py  (CG, brent, spline)
    regression_bridge  — regression/regression_core.py (OLS, ridge, GP)
    tensor_bridge      — tensor/financial/  (feature_matrix, kalman_filter)
    yfinance_bridge    — yfinance/ops.py  (download, ticker_history)
    rlang_bridge       — rlang/  (R subprocess, finance.R helpers)
"""
