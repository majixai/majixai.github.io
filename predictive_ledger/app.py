"""
predictive_ledger/app.py

Flask backend for the Predictive Ledger Engine.

Endpoints
---------
GET  /                      Serve the SPA (index.html)
POST /api/optimize          Bayesian weight update  →  posterior mean + cov
POST /api/jacobian          Arctan Jacobian evaluation
GET  /api/health            Liveness probe

Run
---
    python app.py               (development, port 5050)
    flask --app app run         (Flask CLI)
"""

import json
import logging
import os

import numpy as np
from flask import Flask, jsonify, render_template, request

from optimizer import LedgerOptimizer

# ── logging ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
log = logging.getLogger(__name__)

app = Flask(__name__, template_folder="templates")

# One shared optimizer instance (stateless, so this is safe)
_optimizer = LedgerOptimizer(noise_var=0.01)


# ── helpers ──────────────────────────────────────────────────────

def _json_err(msg: str, status: int = 400):
    return jsonify({"error": msg}), status


def _require_json_fields(data: dict, *fields):
    missing = [f for f in fields if f not in data]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")


# ── routes ───────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/optimize", methods=["POST"])
def optimize():
    """
    Bayesian weight update.

    Request JSON
    ------------
    {
        "X":         [[...], ...],   // (n, d) design matrix
        "y":         [...],          // (n,)   target vector
        "prior_mu":  [...],          // (d,)   prior mean
        "prior_cov": [[...], ...],   // (d, d) prior covariance
        "noise_var": 0.01            // optional — overrides instance default
    }

    Response JSON
    -------------
    {
        "posterior_mean": [...],
        "posterior_std":  [...],
        "posterior_cov":  [[...]],
        "condition_number": 1.23
    }
    """
    data = request.get_json(silent=True)
    if not data:
        return _json_err("Request body must be JSON")

    try:
        _require_json_fields(data, "X", "y", "prior_mu", "prior_cov")
        X = np.array(data["X"], dtype=float)
        y = np.array(data["y"], dtype=float)
        prior_mu = np.array(data["prior_mu"], dtype=float)
        prior_cov = np.array(data["prior_cov"], dtype=float)

        noise_var = float(data.get("noise_var", _optimizer.noise_var))
        if noise_var <= 0:
            return _json_err("noise_var must be positive")

        opt = LedgerOptimizer(noise_var=noise_var)
        post_mu, post_cov = opt.update_weights(X, y, prior_mu, prior_cov)
        result = opt.posterior_summary(post_mu, post_cov)

    except ValueError as exc:
        return _json_err(str(exc))
    except np.linalg.LinAlgError as exc:
        log.warning("LinAlgError in /api/optimize: %s", exc)
        return _json_err(f"Matrix operation failed: {exc}", 422)
    except Exception as exc:
        log.exception("Unexpected error in /api/optimize")
        return _json_err("Internal server error", 500)

    log.info(
        "optimize: X=%s  cond=%.3f",
        X.shape,
        result["condition_number"],
    )
    return jsonify(result)


@app.route("/api/jacobian", methods=["POST"])
def jacobian():
    """
    Arctan Jacobian evaluation.

    Request JSON
    ------------
    { "u": [...], "du": [...] }

    Response JSON
    -------------
    { "jacobian": [...] }
    """
    data = request.get_json(silent=True)
    if not data:
        return _json_err("Request body must be JSON")

    try:
        _require_json_fields(data, "u", "du")
        u = np.array(data["u"], dtype=float)
        du = np.array(data["du"], dtype=float)
        if u.shape != du.shape:
            return _json_err("u and du must have the same shape")

        result = LedgerOptimizer.arctan_jacobian(u, du)

    except ValueError as exc:
        return _json_err(str(exc))
    except Exception:
        log.exception("Unexpected error in /api/jacobian")
        return _json_err("Internal server error", 500)

    return jsonify({"jacobian": result.tolist()})


# ── entry point ──────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    log.info("Starting Predictive Ledger backend on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=debug)
