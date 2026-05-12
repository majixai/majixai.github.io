#!/usr/bin/env bash
# =============================================================================
# conics/bash/conics.sh
# =============================================================================
# Conic section analysis in Bash, using `bc -l` for floating-point arithmetic.
#
# General second-degree curve:  A x² + B xy + C y² + D x + E y + F = 0
#
# Functions:
#   conic_discriminant A B C       — prints B²−4AC
#   conic_classify     A B C       — prints ELLIPSE | PARABOLA | HYPERBOLA
#   conic_center       A B C D E   — prints "cx cy" (or "SINGULAR")
#   conic_angle        A B C       — prints rotation angle in radians
#   conic_axes         A B C D E F cx cy — prints "semiA semiB"
#   conic_decompose    A B C D E F — prints full decomposition
#   conic_eval         A B C D E F x y  — prints quadratic form value
#
# Usage:
#   chmod +x conics.sh
#   ./conics.sh               — runs self-test
#   source conics.sh          — import functions into current shell
#
# Dependencies: bash ≥ 4, bc, awk
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# §1  Floating-point constants (via bc -l)
# ---------------------------------------------------------------------------

readonly _DISC_TOL="0.000000001"   # 1e-9
readonly _DET2_TOL="0.000000000001" # 1e-12
readonly _EIGEN_TOL="0.000000000001"
readonly _PI=$(echo "scale=15; 4*a(1)" | bc -l)

# ---------------------------------------------------------------------------
# §2  bc helper
# ---------------------------------------------------------------------------

# bc_eval EXPR — evaluate a bc -l expression and print the result
bc_eval() {
    echo "scale=10; $1" | bc -l 2>/dev/null
}

# bc_cmp A OP B — compare two bc expressions; returns 0 (true) or 1 (false)
# OP: lt | le | gt | ge | eq | ne
bc_cmp() {
    local a="$1" op="$2" b="$3"
    local expr
    case "$op" in
        lt) expr="if ($a < $b) 1 else 0" ;;
        le) expr="if ($a <= $b) 1 else 0" ;;
        gt) expr="if ($a > $b) 1 else 0" ;;
        ge) expr="if ($a >= $b) 1 else 0" ;;
        eq) expr="if ($a == $b) 1 else 0" ;;
        ne) expr="if ($a != $b) 1 else 0" ;;
    esac
    local res
    res=$(echo "scale=15; $expr" | bc -l 2>/dev/null)
    [[ "$res" == "1" ]]
}

# ---------------------------------------------------------------------------
# §3  Discriminant
# ---------------------------------------------------------------------------

# conic_discriminant A B C — print B² − 4AC
conic_discriminant() {
    local A="$1" B="$2" C="$3"
    bc_eval "$B * $B - 4 * $A * $C"
}

# ---------------------------------------------------------------------------
# §4  Classification
# ---------------------------------------------------------------------------

# conic_classify A B C — print ELLIPSE | PARABOLA | HYPERBOLA
conic_classify() {
    local A="$1" B="$2" C="$3"
    local disc
    disc=$(conic_discriminant "$A" "$B" "$C")
    # Use awk for the comparison to avoid bc branching issues
    awk -v d="$disc" -v tol="$_DISC_TOL" 'BEGIN {
        if (d + 0 < -tol + 0)   print "ELLIPSE"
        else if (d + 0 > tol + 0) print "HYPERBOLA"
        else                      print "PARABOLA"
    }'
}

# ---------------------------------------------------------------------------
# §5  Centre
# ---------------------------------------------------------------------------

# conic_center A B C D E — print "cx cy" or "SINGULAR"
conic_center() {
    local A="$1" B="$2" C="$3" D="$4" E="$5"
    local det2
    det2=$(bc_eval "4 * $A * $C - $B * $B")
    local abs_det2
    abs_det2=$(bc_eval "if ($det2 < 0) -($det2) else $det2")
    if awk -v d="$abs_det2" -v tol="$_DET2_TOL" 'BEGIN{exit (d+0 < tol+0) ? 0 : 1}'; then
        echo "SINGULAR"
        return
    fi
    local cx cy
    cx=$(bc_eval "($B * $E - 2 * $C * $D) / ($det2)")
    cy=$(bc_eval "($B * $D - 2 * $A * $E) / ($det2)")
    echo "$cx $cy"
}

# ---------------------------------------------------------------------------
# §6  Principal-axis angle
# ---------------------------------------------------------------------------

# conic_angle A B C — print rotation angle in radians
conic_angle() {
    local A="$1" B="$2" C="$3"
    # atan2 via bc: use the identity atan(y/x) with quadrant correction
    local diff
    diff=$(bc_eval "$A - $C")
    local abs_diff abs_B
    abs_diff=$(bc_eval "if ($diff < 0) -($diff) else $diff")
    abs_B=$(bc_eval "if ($B < 0) -($B) else $B")
    # If both near zero, angle = 0
    if awk -v d="$abs_diff" -v b="$abs_B" -v tol="$_EIGEN_TOL" \
           'BEGIN{exit (d+0 < tol+0 && b+0 < tol+0) ? 0 : 1}'; then
        echo "0"
        return
    fi
    # atan2(B, A-C) via awk (has atan2 built-in)
    awk -v B="$B" -v diff="$diff" 'BEGIN {
        printf "%.10f\n", 0.5 * atan2(B + 0, diff + 0)
    }'
}

# ---------------------------------------------------------------------------
# §7  Semi-axes
# ---------------------------------------------------------------------------

# conic_axes A B C D E F cx cy — print "semiA semiB"
conic_axes() {
    local A="$1" B="$2" C="$3" D="$4" E="$5" F="$6" cx="$7" cy="$8"
    awk -v A="$A" -v B="$B" -v C="$C" \
        -v D="$D" -v E="$E" -v F="$F" \
        -v cx="$cx" -v cy="$cy" \
        -v etol="$_EIGEN_TOL" \
    'BEGIN {
        k33   = F - cx * (D / 2) - cy * (E / 2)
        diff  = A - C
        under = diff*diff + B*B
        ediff = (under > 0) ? 0.5 * sqrt(under) : 0
        lam1  = (A + C) / 2 + ediff
        lam2  = (A + C) / 2 - ediff
        q1    = (lam1 < 0) ? -lam1 : lam1
        q2    = (lam2 < 0) ? -lam2 : lam2
        val1  = (q1 > 0) ? -k33 / lam1 : 0
        val2  = (q2 > 0) ? -k33 / lam2 : 0
        if (val1 < 0) val1 = -val1
        if (val2 < 0) val2 = -val2
        sA = (q1 > etol + 0) ? sqrt(val1) : 0
        sB = (q2 > etol + 0) ? sqrt(val2) : 0
        printf "%.10f %.10f\n", sA, sB
    }'
}

# ---------------------------------------------------------------------------
# §8  Evaluate the quadratic form
# ---------------------------------------------------------------------------

# conic_eval A B C D E F x y — print A x² + B xy + C y² + D x + E y + F
conic_eval() {
    local A="$1" B="$2" C="$3" D="$4" E="$5" F="$6" x="$7" y="$8"
    bc_eval "$A*$x*$x + $B*$x*$y + $C*$y*$y + $D*$x + $E*$y + $F"
}

# ---------------------------------------------------------------------------
# §9  Full decomposition
# ---------------------------------------------------------------------------

# conic_decompose A B C D E F — print full decomposition to stdout
conic_decompose() {
    local A="$1" B="$2" C="$3" D="$4" E="$5" F="$6"
    local disc kind theta center_str cx cy semiA semiB

    disc=$(conic_discriminant "$A" "$B" "$C")
    kind=$(conic_classify     "$A" "$B" "$C")
    theta=$(conic_angle       "$A" "$B" "$C")
    center_str=$(conic_center "$A" "$B" "$C" "$D" "$E")

    echo "Conic type   : $kind"
    echo "Disc (B²-4AC): $disc"
    echo "Coefficients : A=$A  B=$B  C=$C  D=$D  E=$E  F=$F"
    echo "Rotation θ   : $theta rad"

    if [[ "$center_str" == "SINGULAR" ]]; then
        echo "Centre       : SINGULAR (parabola / degenerate)"
    else
        read -r cx cy <<< "$center_str"
        local axes_str
        axes_str=$(conic_axes "$A" "$B" "$C" "$D" "$E" "$F" "$cx" "$cy")
        read -r semiA semiB <<< "$axes_str"
        echo "Centre       : ($cx, $cy)"
        echo "Semi-axes    : a=$semiA  b=$semiB"
    fi
}

# ---------------------------------------------------------------------------
# §10  Self-test (runs when executed directly)
# ---------------------------------------------------------------------------

_run_tests() {
    echo "=== conics/bash/conics.sh  self-test ==="
    echo

    echo "Test 1 — Unit circle  (x² + y² − 1 = 0):"
    conic_decompose 1 0 1 0 0 -1
    echo "Expected: ELLIPSE"
    echo

    echo "Test 2 — Rectangular hyperbola  (x² − y² − 1 = 0):"
    conic_decompose 1 0 -1 0 0 -1
    echo "Expected: HYPERBOLA"
    echo

    echo "Test 3 — Upward parabola  (x² − y = 0):"
    conic_decompose 1 0 0 0 -1 0
    echo "Expected: PARABOLA"
    echo

    echo "Test 4 — Rotated ellipse  (2x² + xy + 3y² − 4 = 0):"
    conic_decompose 2 1 3 0 0 -4
    echo "Expected: ELLIPSE (disc = 1 − 24 = −23 < 0)"
    echo

    echo "Test 5 — Evaluate unit circle at (1, 0):"
    conic_eval 1 0 1 0 0 -1 1 0
    echo "Expected: 0"
    echo
}

# Only run tests when the script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    _run_tests
fi
