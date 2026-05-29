/*
 * conics/cpp/conics.cpp
 * ======================
 * Conic section analysis — C++17 template-parameterised implementation.
 *
 * General second-degree curve:
 *   A·x² + B·x·y + C·y² + D·x + E·y + F = 0
 *
 * Arithmetic type is a template parameter (float, double, long double).
 *
 * Build:
 *   g++ -std=c++17 -O2 -lm -o conics conics.cpp
 *
 * Usage:
 *   ./conics    — runs built-in self-test
 */

#include <array>
#include <cmath>
#include <cstring>
#include <iostream>
#include <iomanip>
#include <optional>
#include <string>
#include <tuple>
#include <vector>

// =========================================================================
// §1  Scalar constants
// =========================================================================

static constexpr double DISC_TOL = 1e-9;  /* parabola threshold          */
static constexpr double DET2_TOL = 1e-12; /* centre-detection threshold  */

// =========================================================================
// §2  Enumerations and structures
// =========================================================================

enum class ConicKind { Ellipse, Parabola, Hyperbola, Unknown };

inline std::string kind_name(ConicKind k)
{
    switch (k) {
        case ConicKind::Ellipse:   return "ELLIPSE";
        case ConicKind::Parabola:  return "PARABOLA";
        case ConicKind::Hyperbola: return "HYPERBOLA";
        default:                   return "UNKNOWN";
    }
}

/*
 * ConicCoeffs<T>
 * Six coefficients of A x² + B xy + C y² + D x + E y + F = 0.
 */
template <typename T>
struct ConicCoeffs {
    T A{}, B{}, C{}, D{}, E{}, F{};

    /* Evaluate the quadratic form at (x, y) */
    T eval(T x, T y) const
    {
        return A*x*x + B*x*y + C*y*y + D*x + E*y + F;
    }

    T discriminant() const { return B*B - T(4)*A*C; }
};

/*
 * ConicDecomposition<T>
 * Full principal-axis decomposition result.
 */
template <typename T>
struct ConicDecomposition {
    ConicKind kind   { ConicKind::Unknown };
    T         disc   {};
    T         cx     {};    /* centre x                                */
    T         cy     {};    /* centre y                                */
    T         semiA  {};    /* larger  semi-axis / focal parameter     */
    T         semiB  {};    /* smaller semi-axis                       */
    T         theta  {};    /* rotation angle (radians)                */
    bool      ok     { false };
};

// =========================================================================
// §3  2×2 linear system solver
// =========================================================================

/*
 * solve2x2 — solve [[a, b], [c, d]] · [x, y]^T = [e, f]^T.
 * Returns std::nullopt when the system is singular.
 */
template <typename T>
std::optional<std::pair<T, T>>
solve2x2(T a, T b, T c, T d, T e, T f)
{
    T det = a*d - b*c;
    if (std::abs(det) < T(DET2_TOL)) return std::nullopt;
    return std::make_pair((e*d - b*f) / det,
                          (a*f - e*c) / det);
}

// =========================================================================
// §4  Core conic operations
// =========================================================================

template <typename T>
ConicKind classify_discriminant(T disc)
{
    if (disc < -T(DISC_TOL))  return ConicKind::Ellipse;
    if (disc >  T(DISC_TOL))  return ConicKind::Hyperbola;
    return ConicKind::Parabola;
}

/*
 * principal_angle
 * θ = ½ · atan2(B, A−C) rotates the conic to its principal axes.
 */
template <typename T>
T principal_angle(const ConicCoeffs<T>& cc)
{
    if (std::abs(cc.A - cc.C) < T(1e-12) && std::abs(cc.B) < T(1e-12))
        return T(0);
    return T(0.5) * std::atan2(cc.B, cc.A - cc.C);
}

/*
 * principal_axes
 * Eigenvalue decomposition of [[A, B/2], [B/2, C]].
 * λ₁,₂ = (A+C)/2 ± ½√((A−C)² + B²)
 * Semi-axes: aᵢ = √|−k₃₃ / λᵢ|  where  k₃₃ = F − cx·D/2 − cy·E/2.
 */
template <typename T>
std::pair<T, T> principal_axes(const ConicCoeffs<T>& cc, T cx, T cy)
{
    T k33  = cc.F - cx*(cc.D/T(2)) - cy*(cc.E/T(2));
    T diff = cc.A - cc.C;
    T ediff = T(0.5) * std::sqrt(std::max(T(0), diff*diff + cc.B*cc.B));
    T lam1 = (cc.A + cc.C) / T(2) + ediff;
    T lam2 = (cc.A + cc.C) / T(2) - ediff;
    T sA   = (std::abs(lam1) > T(1e-12)) ? std::sqrt(std::abs(-k33/lam1)) : T(0);
    T sB   = (std::abs(lam2) > T(1e-12)) ? std::sqrt(std::abs(-k33/lam2)) : T(0);
    return {sA, sB};
}

/*
 * decompose — full principal-axis decomposition of a conic.
 */
template <typename T>
ConicDecomposition<T> decompose(const ConicCoeffs<T>& cc)
{
    ConicDecomposition<T> r;
    r.disc  = cc.discriminant();
    r.kind  = classify_discriminant(r.disc);
    r.theta = principal_angle(cc);

    auto ctr = solve2x2(T(2)*cc.A, cc.B,
                         cc.B,     T(2)*cc.C,
                        -cc.D,    -cc.E);
    if (ctr) {
        auto [cx, cy] = *ctr;
        r.cx = cx;  r.cy = cy;
        auto [sA, sB] = principal_axes(cc, cx, cy);
        r.semiA = sA;  r.semiB = sB;
    }
    r.ok = true;
    return r;
}

// =========================================================================
// §5  OLS surface fit
// =========================================================================

/*
 * fit_ols — ordinary-least-squares fit of
 *   z = A x² + B xy + C y² + D x + E y + F
 * to n data points (xs, ys, zs).
 *
 * Returns std::nullopt when the 6×6 normal matrix is singular.
 */
template <typename T>
struct FitResult {
    ConicCoeffs<T> cc;
    T rss{};
    T r2{};
};

template <typename T>
std::optional<FitResult<T>>
fit_ols(const std::vector<T>& xs, const std::vector<T>& ys, const std::vector<T>& zs)
{
    int n = static_cast<int>(xs.size());
    if (n < 6) return std::nullopt;

    /* Augmented 6×7 matrix [M^T·M | M^T·z] */
    std::array<std::array<T, 7>, 6> M{};
    for (auto& row : M) row.fill(T(0));

    for (int i = 0; i < n; i++) {
        T x = xs[i], y = ys[i], z = zs[i];
        T phi[6] = { x*x, x*y, y*y, x, y, T(1) };
        for (int r = 0; r < 6; r++) {
            for (int c = 0; c < 6; c++) M[r][c] += phi[r]*phi[c];
            M[r][6] += phi[r]*z;
        }
    }

    /* Gaussian elimination with partial pivoting */
    for (int j = 0; j < 6; j++) {
        int piv = j;
        for (int i = j+1; i < 6; i++)
            if (std::abs(M[i][j]) > std::abs(M[piv][j])) piv = i;
        if (std::abs(M[piv][j]) < T(1e-14)) return std::nullopt;
        std::swap(M[j], M[piv]);
        T inv = T(1) / M[j][j];
        for (int i = j+1; i < 6; i++) {
            T f = M[i][j] * inv;
            for (int k = j; k <= 6; k++) M[i][k] -= f * M[j][k];
        }
    }

    std::array<T, 6> th{};
    for (int i = 5; i >= 0; i--) {
        th[i] = M[i][6];
        for (int k = i+1; k < 6; k++) th[i] -= M[i][k]*th[k];
        th[i] /= M[i][i];
    }

    ConicCoeffs<T> cc{ th[0], th[1], th[2], th[3], th[4], th[5] };

    /* RSS / R² */
    T zmean = T(0);
    for (int i = 0; i < n; i++) zmean += zs[i];
    zmean /= n;
    T ss_res = T(0), ss_tot = T(0);
    for (int i = 0; i < n; i++) {
        T pred = cc.eval(xs[i], ys[i]);
        T res  = zs[i] - pred;
        ss_res += res*res;
        T dev  = zs[i] - zmean;
        ss_tot += dev*dev;
    }
    T r2 = (ss_tot > T(0)) ? T(1) - ss_res/ss_tot : T(0);
    return FitResult<T>{ cc, ss_res, r2 };
}

// =========================================================================
// §6  Pretty printer
// =========================================================================

template <typename T>
void print_decomposition(const ConicCoeffs<T>& cc, const ConicDecomposition<T>& cr,
                          T rss = T(-1), T r2 = T(0))
{
    constexpr double PI = 3.14159265358979323846;
    std::cout << std::fixed << std::setprecision(6);
    std::cout << "Conic type   : " << kind_name(cr.kind) << "\n";
    std::cout << "Disc (B²-4AC): " << cr.disc << "\n";
    std::cout << "Coefficients : A=" << cc.A << "  B=" << cc.B << "  C=" << cc.C << "\n";
    std::cout << "               D=" << cc.D << "  E=" << cc.E << "  F=" << cc.F << "\n";
    std::cout << "Centre       : (" << cr.cx << ", " << cr.cy << ")\n";
    std::cout << "Semi-axes    : a=" << cr.semiA << "  b=" << cr.semiB << "\n";
    std::cout << "Rotation θ   : " << cr.theta << " rad"
              << "  (" << cr.theta * T(180.0 / PI) << "°)\n";
    if (rss >= T(0))
        std::cout << "RSS / R²     : " << rss << " / " << r2 << "\n";
}

// =========================================================================
// §7  Self-test
// =========================================================================

int main()
{
    constexpr double PI = 3.14159265358979323846;
    std::cout << "=== conics/cpp/conics.cpp  self-test ===\n\n";

    /* ── Test 1: unit circle (ELLIPSE) */
    {
        ConicCoeffs<double> cc{1.0, 0.0, 1.0, 0.0, 0.0, -1.0};
        auto cr = decompose(cc);
        std::cout << "Test 1 — Unit circle:\n";
        print_decomposition(cc, cr);
        std::cout << "Expected: ELLIPSE, centre=(0,0), semiA=semiB≈1\n\n";
    }

    /* ── Test 2: rectangular hyperbola */
    {
        ConicCoeffs<double> cc{1.0, 0.0, -1.0, 0.0, 0.0, -1.0};
        auto cr = decompose(cc);
        std::cout << "Test 2 — Rectangular hyperbola:\n";
        print_decomposition(cc, cr);
        std::cout << "Expected: HYPERBOLA\n\n";
    }

    /* ── Test 3: upward parabola  x² − y = 0 */
    {
        ConicCoeffs<double> cc{1.0, 0.0, 0.0, 0.0, -1.0, 0.0};
        auto cr = decompose(cc);
        std::cout << "Test 3 — Upward parabola:\n";
        print_decomposition(cc, cr);
        std::cout << "Expected: PARABOLA\n\n";
    }

    /* ── Test 4: OLS fit to points on a noisy quadratic surface */
    {
        int n = 25;
        std::vector<double> xs(n), ys(n), zs(n);
        int idx = 0;
        for (int r = 0; r < 5; r++) {
            for (int c = 0; c < 5; c++) {
                xs[idx] = -1.0 + 0.5 * c;
                ys[idx] = -1.0 + 0.5 * r;
                zs[idx] = xs[idx]*xs[idx] + 0.5*ys[idx]*ys[idx] + 0.1*xs[idx];
                idx++;
            }
        }
        auto res = fit_ols(xs, ys, zs);
        if (res) {
            auto cr = decompose(res->cc);
            std::cout << "Test 4 — OLS fit (float) to quadratic grid:\n";
            print_decomposition(res->cc, cr, res->rss, res->r2);
            std::cout << "Expected: ELLIPSE, R²≈1.0\n\n";
        } else {
            std::cout << "Test 4 — OLS fit failed (singular)\n\n";
        }
    }

    /* ── Test 5: long double precision */
    {
        ConicCoeffs<long double> cc{2.0L, 1.0L, 3.0L, 0.0L, 0.0L, -4.0L};
        auto cr = decompose(cc);
        std::cout << "Test 5 — Rotated ellipse (long double):\n";
        print_decomposition(cc, cr);
        std::cout << "Expected: ELLIPSE (disc = 1 - 24 = -23 < 0)\n\n";
    }

    return 0;
}
