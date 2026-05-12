/*
 * conics/c/conics.c
 * =================
 * Conic section analysis in C99.
 *
 * Implements the general second-degree curve:
 *   A·x² + B·x·y + C·y² + D·x + E·y + F = 0
 *
 * Functions:
 *   conic_classify   — discriminant-based type detection
 *   conic_center     — centre of ellipse / hyperbola
 *   conic_axes       — semi-axis lengths via eigenvalue decomposition
 *   conic_angle      — principal-axis rotation angle (radians)
 *   conic_eval       — evaluate the quadratic form at (x, y)
 *   conic_fit_ols    — ordinary-least-squares fit to n data points
 *   conic_print      — pretty-print a ConicResult
 *
 * Build:
 *   cc -std=c99 -O2 -lm -o conics conics.c
 *
 * Usage:
 *   ./conics          — runs built-in self-test
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#ifndef M_PI
#  define M_PI 3.14159265358979323846
#endif

/* ------------------------------------------------------------------ Types */

typedef enum {
    CONIC_ELLIPSE   = 0,   /* B²-4AC < 0 */
    CONIC_PARABOLA  = 1,   /* B²-4AC ≈ 0 */
    CONIC_HYPERBOLA = 2,   /* B²-4AC > 0 */
    CONIC_UNKNOWN   = 3
} ConicKind;

/* General conic coefficients */
typedef struct {
    double A, B, C, D, E, F;
} ConicCoeffs;

/* Decomposed conic properties */
typedef struct {
    ConicKind kind;        /* classification */
    double    disc;        /* B² - 4AC       */
    double    cx, cy;      /* centre          */
    double    semiA;       /* larger semi-axis  (or focal param for parabola) */
    double    semiB;       /* smaller semi-axis */
    double    theta;       /* principal-axis rotation (radians)               */
    double    rss;         /* residual sum of squares  (fit quality)          */
    double    r2;          /* R-squared                                        */
    int       ok;          /* 1 when decomposition succeeded                  */
} ConicResult;

static const char *KIND_NAMES[] = { "ELLIPSE", "PARABOLA", "HYPERBOLA", "UNKNOWN" };

/* --------------------------------------------------------------- Helpers */

/* Solve 2×2 linear system [[a,b],[c,d]] · [x,y]^T = [e,f]^T */
static int solve2(double a, double b, double c, double d,
                  double e, double f, double *x, double *y)
{
    double det = a * d - b * c;
    if (fabs(det) < 1e-12) return 0;
    *x = (e * d - b * f) / det;
    *y = (a * f - e * c) / det;
    return 1;
}

/* ----------------------------------------------------------- Core solver */

/*
 * conic_classify
 * Classify a conic given its 6 coefficients.
 * Populates cr->kind, cr->disc, and cr->ok.
 */
ConicResult conic_classify(ConicCoeffs cc)
{
    ConicResult cr;
    memset(&cr, 0, sizeof(cr));
    cr.disc = cc.B * cc.B - 4.0 * cc.A * cc.C;

    if      (cr.disc < -1e-9)  cr.kind = CONIC_ELLIPSE;
    else if (cr.disc >  1e-9)  cr.kind = CONIC_HYPERBOLA;
    else                       cr.kind = CONIC_PARABOLA;

    cr.ok = 1;
    return cr;
}

/*
 * conic_center
 * Solve the gradient-zero system to find (cx, cy).
 * Valid for ellipses and hyperbolas (det ≠ 0).
 */
int conic_center(ConicCoeffs cc, double *cx, double *cy)
{
    /* Gradient of A x² + B xy + C y² + D x + E y + F = 0:
     *   ∂/∂x = 2A x + B y + D = 0
     *   ∂/∂y = B x + 2C y + E = 0               */
    return solve2(2.0*cc.A, cc.B,
                  cc.B,     2.0*cc.C,
                  -cc.D,    -cc.E,
                  cx, cy);
}

/*
 * conic_angle
 * Principal-axis rotation: θ = ½ · atan2(B, A−C)
 */
double conic_angle(ConicCoeffs cc)
{
    if (fabs(cc.A - cc.C) < 1e-12 && fabs(cc.B) < 1e-12)
        return 0.0;
    return 0.5 * atan2(cc.B, cc.A - cc.C);
}

/*
 * conic_axes
 * Eigenvalue decomposition of the 2×2 quadratic-form matrix
 *   M = [[A, B/2], [B/2, C]]
 * Eigenvalues:  λ = (A+C)/2  ±  ½√((A−C)² + B²)
 * Semi-axis a = √|−k33/λ1|,  b = √|−k33/λ2|
 * where k33 = F − cx·D/2 − cy·E/2  (surface value at centre).
 */
void conic_axes(ConicCoeffs cc, double cx, double cy,
                double *semiA, double *semiB)
{
    double k33  = cc.F - cx * (cc.D / 2.0) - cy * (cc.E / 2.0);
    double tr   = cc.A + cc.C;
    double diff = cc.A - cc.C;
    double ediff = 0.5 * sqrt(fmax(0.0, diff*diff + cc.B*cc.B));
    double lam1 = tr / 2.0 + ediff;
    double lam2 = tr / 2.0 - ediff;
    *semiA = (fabs(lam1) > 1e-12) ? sqrt(fabs(-k33 / lam1)) : 0.0;
    *semiB = (fabs(lam2) > 1e-12) ? sqrt(fabs(-k33 / lam2)) : 0.0;
}

/*
 * conic_eval
 * Evaluate the quadratic form at (x, y).
 */
double conic_eval(ConicCoeffs cc, double x, double y)
{
    return cc.A*x*x + cc.B*x*y + cc.C*y*y + cc.D*x + cc.E*y + cc.F;
}

/*
 * conic_decompose
 * Full decomposition: classify + centre + axes + angle.
 */
ConicResult conic_decompose(ConicCoeffs cc)
{
    ConicResult cr = conic_classify(cc);
    cr.theta = conic_angle(cc);

    if (conic_center(cc, &cr.cx, &cr.cy))
        conic_axes(cc, cr.cx, cr.cy, &cr.semiA, &cr.semiB);

    cr.ok = 1;
    return cr;
}

/* -------------------------------------------------------- OLS surface fit */

/*
 * conic_fit_ols
 * Fit the explicit quadratic surface z = A·x² + B·x·y + C·y² + D·x + E·y + F
 * to n data points via the 6×6 normal-equations system M^T·M · θ = M^T·z.
 * Solved with Gaussian elimination with partial pivoting.
 *
 * n    — number of points
 * xs   — x coordinates
 * ys   — y coordinates (second axis, e.g. log-volume or RSI)
 * zs   — z values (price surface)
 * out  — output ConicCoeffs populated on success
 * Returns 1 on success, 0 if the normal matrix is singular.
 */
int conic_fit_ols(int n, const double *xs, const double *ys, const double *zs,
                  ConicCoeffs *out, double *rss, double *r2)
{
    /* 6-element basis: [x², xy, y², x, y, 1] */
    double M[6][7];
    memset(M, 0, sizeof(M));

    for (int i = 0; i < n; i++) {
        double x  = xs[i], y  = ys[i], z = zs[i];
        double x2 = x*x,   y2 = y*y,  xy = x*y;
        double phi[6] = { x2, xy, y2, x, y, 1.0 };
        for (int r = 0; r < 6; r++) {
            for (int c = 0; c < 6; c++)
                M[r][c] += phi[r] * phi[c];
            M[r][6] += phi[r] * z;  /* right-hand side */
        }
    }

    /* Gaussian elimination with partial pivoting */
    for (int j = 0; j < 6; j++) {
        int pivot = j;
        for (int i = j+1; i < 6; i++)
            if (fabs(M[i][j]) > fabs(M[pivot][j])) pivot = i;
        if (fabs(M[pivot][j]) < 1e-14) return 0; /* singular */
        double tmp[7];
        memcpy(tmp, M[j], sizeof(tmp));
        memcpy(M[j], M[pivot], sizeof(tmp));
        memcpy(M[pivot], tmp, sizeof(tmp));
        double inv = 1.0 / M[j][j];
        for (int i = j+1; i < 6; i++) {
            double f = M[i][j] * inv;
            for (int k = j; k <= 6; k++) M[i][k] -= f * M[j][k];
        }
    }

    double theta[6];
    for (int i = 5; i >= 0; i--) {
        theta[i] = M[i][6];
        for (int k = i+1; k < 6; k++) theta[i] -= M[i][k] * theta[k];
        theta[i] /= M[i][i];
    }

    out->A = theta[0]; out->B = theta[1]; out->C = theta[2];
    out->D = theta[3]; out->E = theta[4]; out->F = theta[5];

    /* compute RSS and R² */
    double ss_res = 0.0, ss_tot = 0.0, z_mean = 0.0;
    for (int i = 0; i < n; i++) z_mean += zs[i];
    z_mean /= n;
    for (int i = 0; i < n; i++) {
        double pred = conic_eval(*out, xs[i], ys[i]);
        double res  = zs[i] - pred;
        ss_res += res * res;
        double dev  = zs[i] - z_mean;
        ss_tot += dev * dev;
    }
    if (rss) *rss = ss_res;
    if (r2)  *r2  = (ss_tot > 0.0) ? 1.0 - ss_res / ss_tot : 0.0;

    return 1;
}

/* ----------------------------------------------------------------- Print */

void conic_print(ConicCoeffs cc, ConicResult cr, double rss, double r2)
{
    printf("Conic type  : %s\n", KIND_NAMES[cr.kind]);
    printf("Disc (B²-4AC): %.6f\n", cr.disc);
    printf("Coefficients: A=%.4f  B=%.4f  C=%.4f\n", cc.A, cc.B, cc.C);
    printf("              D=%.4f  E=%.4f  F=%.4f\n", cc.D, cc.E, cc.F);
    printf("Centre      : (%.4f, %.4f)\n", cr.cx, cr.cy);
    printf("Semi-axes   : a=%.4f  b=%.4f\n", cr.semiA, cr.semiB);
    printf("Rotation θ  : %.4f rad  (%.2f°)\n", cr.theta, cr.theta * 180.0 / M_PI);
    if (rss >= 0.0)
        printf("RSS / R²    : %.6f / %.6f\n", rss, r2);
}

/* ------------------------------------------------------------------ Main */

int main(void)
{
    printf("=== conics/c/conics.c  self-test ===\n\n");

    /* ── Test 1: unit circle  x² + y² - 1 = 0  (A=1,B=0,C=1,D=0,E=0,F=-1) */
    {
        ConicCoeffs cc = {1.0, 0.0, 1.0, 0.0, 0.0, -1.0};
        ConicResult cr = conic_decompose(cc);
        printf("Test 1 — Unit circle:\n");
        conic_print(cc, cr, -1.0, 0.0);
        printf("Expected: ELLIPSE, disc<0, centre=(0,0), semiA=semiB≈1\n\n");
    }

    /* ── Test 2: rectangular hyperbola  x² - y² - 1 = 0 */
    {
        ConicCoeffs cc = {1.0, 0.0, -1.0, 0.0, 0.0, -1.0};
        ConicResult cr = conic_decompose(cc);
        printf("Test 2 — Rectangular hyperbola:\n");
        conic_print(cc, cr, -1.0, 0.0);
        printf("Expected: HYPERBOLA, disc>0\n\n");
    }

    /* ── Test 3: upward parabola  y - x² = 0  → x² + 0·y - y = 0 */
    {
        ConicCoeffs cc = {1.0, 0.0, 0.0, 0.0, -1.0, 0.0};
        ConicResult cr = conic_decompose(cc);
        printf("Test 3 — Upward parabola:\n");
        conic_print(cc, cr, -1.0, 0.0);
        printf("Expected: PARABOLA, disc≈0\n\n");
    }

    /* ── Test 4: OLS fit to points on a noisy quadratic surface z = x² + 0.5y² */
    {
        int n = 25;
        double xs[25], ys[25], zs[25];
        /* 5×5 grid in [−1, 1] × [−1, 1] */
        int idx = 0;
        for (int r = 0; r < 5; r++) {
            for (int c = 0; c < 5; c++) {
                xs[idx] = -1.0 + 0.5 * c;
                ys[idx] = -1.0 + 0.5 * r;
                /* z = x² + 0.5 y² + small linear term */
                zs[idx] = xs[idx]*xs[idx] + 0.5*ys[idx]*ys[idx] + 0.1*xs[idx];
                idx++;
            }
        }

        ConicCoeffs cc;
        double rss = 0.0, r2 = 0.0;
        int ok = conic_fit_ols(n, xs, ys, zs, &cc, &rss, &r2);
        if (ok) {
            ConicResult cr = conic_decompose(cc);
            printf("Test 4 — OLS fit to quadratic grid (z=x²+0.5y²+0.1x):\n");
            conic_print(cc, cr, rss, r2);
            printf("Expected: ELLIPSE, R²≈1.0\n");
        } else {
            printf("Test 4 — OLS fit failed (singular)\n");
        }
    }

    return 0;
}
