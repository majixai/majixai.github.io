#!/usr/bin/env zsh
# =============================================================================
# conics/zsh/conics.zsh
# =============================================================================
# Conic section analysis in Zsh.
#
# Uses zsh/mathfunc module for floating-point math (atan, sqrt, fabs, etc.)
# Falls back to awk for atan2 where zsh/mathfunc does not provide it.
#
# General second-degree curve:  A x² + B xy + C y² + D x + E y + F = 0
#
# Functions:
#   conic_discriminant A B C
#   conic_classify     A B C
#   conic_center       A B C D E
#   conic_angle        A B C
#   conic_axes         A B C D E F cx cy
#   conic_decompose    A B C D E F
#   conic_eval         A B C D E F x y
#
# Usage:
#   chmod +x conics.zsh
#   ./conics.zsh               — runs self-test
#   source conics.zsh          — import functions into current shell
#
# Dependencies: zsh ≥ 5.0, awk
# =============================================================================

# Load zsh math function module (provides sin, cos, sqrt, log, atan, fabs …)
zmodload zsh/mathfunc 2>/dev/null || true

# ---------------------------------------------------------------------------
# Constants (zsh arithmetic)
# ---------------------------------------------------------------------------

typeset -gF _DISC_TOL=1e-9
typeset -gF _DET2_TOL=1e-12
typeset -gF _EIGEN_TOL=1e-12

# PI via awk (portable)
_PI=$(awk 'BEGIN { printf "%.15f\n", 4*atan2(1,1) }')

# ---------------------------------------------------------------------------
# §1  Helper: zsh -l float expression evaluator
# ---------------------------------------------------------------------------

# zf_eval EXPR — evaluate a floating-point expression using zsh arithmetic
# Prints the result with 10 decimal places.
zf_eval() {
    local result
    (( result = $1 ))
    printf "%.10f\n" $result
}

# ---------------------------------------------------------------------------
# §2  Discriminant
# ---------------------------------------------------------------------------

# conic_discriminant A B C — print B² − 4AC
conic_discriminant() {
    local -F A=$1 B=$2 C=$3
    zf_eval "$B * $B - 4.0 * $A * $C"
}

# ---------------------------------------------------------------------------
# §3  Classification
# ---------------------------------------------------------------------------

# conic_classify A B C — print ELLIPSE | PARABOLA | HYPERBOLA
conic_classify() {
    local -F A=$1 B=$2 C=$3
    local -F disc
    (( disc = B * B - 4.0 * A * C ))
    if   (( disc < -_DISC_TOL )); then echo "ELLIPSE"
    elif (( disc >  _DISC_TOL )); then echo "HYPERBOLA"
    else                               echo "PARABOLA"
    fi
}

# ---------------------------------------------------------------------------
# §4  Centre
# ---------------------------------------------------------------------------

# conic_center A B C D E — print "cx cy" or "SINGULAR"
conic_center() {
    local -F A=$1 B=$2 C=$3 D=$4 E=$5
    local -F det2 abs_det2
    (( det2     = 4.0 * A * C - B * B ))
    (( abs_det2 = det2 < 0.0 ? -det2 : det2 ))
    if (( abs_det2 < _DET2_TOL )); then
        echo "SINGULAR"
        return
    fi
    local -F cx cy
    (( cx = (B * E - 2.0 * C * D) / det2 ))
    (( cy = (B * D - 2.0 * A * E) / det2 ))
    printf "%.10f %.10f\n" $cx $cy
}

# ---------------------------------------------------------------------------
# §5  Principal-axis angle
# ---------------------------------------------------------------------------

# conic_angle A B C — print rotation angle in radians
conic_angle() {
    local -F A=$1 B=$2 C=$3
    local -F diff abs_diff abs_B
    (( diff     = A - C ))
    (( abs_diff = diff < 0.0 ? -diff : diff ))
    (( abs_B    = B    < 0.0 ? -B    : B    ))
    if (( abs_diff < _EIGEN_TOL && abs_B < _EIGEN_TOL )); then
        echo "0.0000000000"
        return
    fi
    # atan2 via awk for portability
    awk -v B="$B" -v diff="$diff" 'BEGIN {
        printf "%.10f\n", 0.5 * atan2(B + 0, diff + 0)
    }'
}

# ---------------------------------------------------------------------------
# §6  Semi-axes
# ---------------------------------------------------------------------------

# conic_axes A B C D E F cx cy — print "semiA semiB"
conic_axes() {
    local -F A=$1 B=$2 C=$3 D=$4 E=$5 F=$6 cx=$7 cy=$8
    awk -v A="$A" -v B="$B" -v C="$C" \
        -v D="$D" -v E="$E" -v F="$F" \
        -v cx="$cx" -v cy="$cy" \
        -v etol="$_EIGEN_TOL" \
    'BEGIN {
        k33   = F - cx*(D/2) - cy*(E/2)
        diff  = A - C
        under = diff*diff + B*B
        ediff = (under > 0) ? 0.5*sqrt(under) : 0
        lam1  = (A+C)/2 + ediff
        lam2  = (A+C)/2 - ediff
        al1   = (lam1 < 0) ? -lam1 : lam1
        al2   = (lam2 < 0) ? -lam2 : lam2
        v1    = (al1 > 0) ? -k33/lam1 : 0
        v2    = (al2 > 0) ? -k33/lam2 : 0
        if (v1 < 0) v1 = -v1
        if (v2 < 0) v2 = -v2
        sA = (al1 > etol+0) ? sqrt(v1) : 0
        sB = (al2 > etol+0) ? sqrt(v2) : 0
        printf "%.10f %.10f\n", sA, sB
    }'
}

# ---------------------------------------------------------------------------
# §7  Evaluate quadratic form
# ---------------------------------------------------------------------------

# conic_eval A B C D E F x y — print A x² + B xy + C y² + D x + E y + F
conic_eval() {
    local -F A=$1 B=$2 C=$3 D=$4 E=$5 F=$6 x=$7 y=$8
    local -F result
    (( result = A*x*x + B*x*y + C*y*y + D*x + E*y + F ))
    printf "%.10f\n" $result
}

# ---------------------------------------------------------------------------
# §8  Full decomposition
# ---------------------------------------------------------------------------

# conic_decompose A B C D E F — print full decomposition
conic_decompose() {
    local A=$1 B=$2 C=$3 D=$4 E=$5 F=$6
    local disc kind theta center_str cx cy semiA semiB

    disc=$(conic_discriminant "$A" "$B" "$C")
    kind=$(conic_classify     "$A" "$B" "$C")
    theta=$(conic_angle       "$A" "$B" "$C")
    center_str=$(conic_center "$A" "$B" "$C" "$D" "$E")

    print "Conic type   : $kind"
    print "Disc (B²-4AC): $disc"
    print "Coefficients : A=$A  B=$B  C=$C  D=$D  E=$E  F=$F"
    print "Rotation θ   : $theta rad"

    if [[ "$center_str" == "SINGULAR" ]]; then
        print "Centre       : SINGULAR (parabola / degenerate)"
    else
        read -rA center_arr <<< "$center_str"
        cx=${center_arr[1]}
        cy=${center_arr[2]}
        local axes_str
        axes_str=$(conic_axes "$A" "$B" "$C" "$D" "$E" "$F" "$cx" "$cy")
        read -rA axes_arr <<< "$axes_str"
        semiA=${axes_arr[1]}
        semiB=${axes_arr[2]}
        print "Centre       : ($cx, $cy)"
        print "Semi-axes    : a=$semiA  b=$semiB"
    fi
}

# ---------------------------------------------------------------------------
# §9  Self-test
# ---------------------------------------------------------------------------

_run_tests() {
    print "=== conics/zsh/conics.zsh  self-test ==="
    print

    print "Test 1 — Unit circle  (x² + y² − 1 = 0):"
    conic_decompose 1 0 1 0 0 -1
    print "Expected: ELLIPSE"
    print

    print "Test 2 — Rectangular hyperbola  (x² − y² − 1 = 0):"
    conic_decompose 1 0 -1 0 0 -1
    print "Expected: HYPERBOLA"
    print

    print "Test 3 — Upward parabola  (x² − y = 0):"
    conic_decompose 1 0 0 0 -1 0
    print "Expected: PARABOLA"
    print

    print "Test 4 — Rotated ellipse  (2x² + xy + 3y² − 4 = 0):"
    conic_decompose 2 1 3 0 0 -4
    print "Expected: ELLIPSE (disc = 1 − 24 = −23 < 0)"
    print

    print "Test 5 — Evaluate unit circle at (1, 0):"
    conic_eval 1 0 1 0 0 -1 1 0
    print "Expected: 0"
    print
}

# Run tests when script is executed directly (not sourced)
if [[ "${(%):-%N}" == "${0}" ]]; then
    _run_tests
fi
