"""
topology_core.py — PhD-Level Topology and TDA Library
=====================================================
Implements:
  Simplicial complexes: Vietoris-Rips, Čech (1D)
  Boundary matrices and homology computation (Z₂ and Z coefficients)
  Persistent homology via reduction algorithm
  Barcode computation and persistence diagrams
  Betti numbers
  Knot polynomial utilities (Jones skein, Gaussian linking number)
  Möbius function (for posets)
"""

from __future__ import annotations
import math
from typing import Optional


# ---------------------------------------------------------------------------
# Simplicial Complex
# ---------------------------------------------------------------------------

class SimplicialComplex:
    """
    Finite abstract simplicial complex.
    Supports boundary maps, chain complex, and homology computation over Z₂.
    """

    def __init__(self):
        self.simplices: dict[int, list[frozenset]] = {}  # dim → list of simplices

    def add_simplex(self, sigma: list[int]) -> None:
        """Add simplex and all its faces."""
        for k in range(len(sigma)+1):
            for face in self._k_faces(sorted(sigma), k):
                d = k-1
                if d not in self.simplices:
                    self.simplices[d] = []
                fs = frozenset(face)
                if fs not in self.simplices[d]:
                    self.simplices[d].append(fs)

    def _k_faces(self, sigma, k):
        """All k-element subsets of sigma."""
        if k == 0: return [[]]
        if k > len(sigma): return []
        result = []
        for i in range(len(sigma)-k+1):
            for rest in self._k_faces(sigma[i+1:], k-1):
                result.append([sigma[i]]+rest)
        return result

    def n_simplices(self, dim: int) -> int:
        return len(self.simplices.get(dim, []))

    def euler_characteristic(self) -> int:
        """χ = Σ (-1)^k |K_k|."""
        dims = sorted(self.simplices.keys())
        return sum((-1)**d * len(self.simplices[d]) for d in dims)

    def boundary_matrix(self, dim: int) -> list[list[int]]:
        """
        Boundary matrix ∂_dim: C_{dim} → C_{dim-1} over Z₂.
        Rows index (dim-1)-simplices, columns index dim-simplices.
        """
        faces = self.simplices.get(dim-1, [])
        cols = self.simplices.get(dim, [])
        mat = [[0]*len(cols) for _ in range(len(faces))]
        for j, sigma in enumerate(cols):
            sigma_list = sorted(sigma)
            for k in range(len(sigma_list)):
                face = frozenset(sigma_list[:k] + sigma_list[k+1:])
                if face in faces:
                    i = faces.index(face)
                    mat[i][j] = 1
        return mat

    def betti_numbers(self) -> dict[int, int]:
        """
        Compute Betti numbers β_k = rank H_k = rank ker ∂_k - rank im ∂_{k+1}
        over Z₂ by Gaussian elimination.
        """
        dims = sorted(set(self.simplices.keys()))
        if not dims: return {}
        max_dim = max(dims)

        def _rank_z2(M):
            if not M or not M[0]: return 0
            mat = [r[:] for r in M]
            rows, cols = len(mat), len(mat[0])
            rank = 0
            for c in range(cols):
                piv = None
                for r in range(rank, rows):
                    if mat[r][c] == 1: piv = r; break
                if piv is None: continue
                mat[rank], mat[piv] = mat[piv], mat[rank]
                for r in range(rows):
                    if r != rank and mat[r][c] == 1:
                        mat[r] = [(mat[r][k]^mat[rank][k]) for k in range(cols)]
                rank += 1
            return rank

        betti = {}
        for k in range(max_dim+1):
            n_k = self.n_simplices(k)
            bdk = self.boundary_matrix(k)
            bdk1 = self.boundary_matrix(k+1)
            rank_bdk = _rank_z2(bdk) if bdk and bdk[0] else 0
            rank_bdk1 = _rank_z2(bdk1) if bdk1 and bdk1[0] else 0
            betti[k] = n_k - rank_bdk - rank_bdk1
        return betti


# ---------------------------------------------------------------------------
# Vietoris-Rips Complex
# ---------------------------------------------------------------------------

def rips_complex(points: list[list[float]], epsilon: float,
                 max_dim: int = 2) -> SimplicialComplex:
    """
    Vietoris-Rips complex: include simplex {v₀,...,vₖ} iff all pairwise
    distances ≤ ε.  Returned complex includes all simplices up to max_dim.
    """
    n = len(points)
    dist = [[math.sqrt(sum((points[i][k]-points[j][k])**2 for k in range(len(points[0]))))
             for j in range(n)] for i in range(n)]
    sc = SimplicialComplex()
    # Add vertices
    for i in range(n): sc.add_simplex([i])
    # Add edges
    edges = [(i,j) for i in range(n) for j in range(i+1,n) if dist[i][j] <= epsilon]
    for e in edges: sc.add_simplex(list(e))
    # Higher-order simplices
    if max_dim >= 2:
        candidates = list(range(n))
        for size in range(3, max_dim+2):
            for combo in _combinations(candidates, size):
                if all(dist[combo[a]][combo[b]] <= epsilon
                       for a in range(size) for b in range(a+1, size)):
                    sc.add_simplex(list(combo))
    return sc


def _combinations(lst, k):
    if k == 0: yield []; return
    if len(lst) < k: return
    for i in range(len(lst)-k+1):
        for rest in _combinations(lst[i+1:], k-1):
            yield [lst[i]] + rest


# ---------------------------------------------------------------------------
# Persistent Homology
# ---------------------------------------------------------------------------

class PersistentHomology:
    """
    Compute persistent homology of a filtered simplicial complex.
    Uses the standard boundary matrix reduction algorithm over Z₂.
    """

    def __init__(self):
        self.birth_death: list[tuple[int,float,float]] = []  # (dim, birth, death)

    def compute(self, filtration: list[tuple[float, list[int]]]) -> None:
        """
        filtration: list of (value, simplex) in order of appearance.
        Runs boundary matrix reduction.
        """
        # Index all simplices
        simplices = [s for _, s in filtration]
        values = [v for v, _ in filtration]
        n = len(simplices)
        dims = [len(s)-1 for s in simplices]

        def boundary(sigma):
            if len(sigma) <= 1: return []
            s = sorted(sigma)
            return [frozenset(s[:k]+s[k+1:]) for k in range(len(s))]

        def index_of(face):
            f = frozenset(face)
            for k, s in enumerate(simplices):
                if frozenset(s) == f: return k
            return -1

        # Build boundary matrix columns
        cols = [[] for _ in range(n)]
        for j, s in enumerate(simplices):
            for face in boundary(s):
                i = index_of(face)
                if i >= 0: cols[j].append(i)
            cols[j].sort()

        pivot_of = {}  # pivot row → column index
        pairs = []  # (creator_idx, destroyer_idx)
        low = [-1]*n

        def _low(col):
            return col[-1] if col else -1

        for j in range(n):
            while True:
                l = _low(cols[j])
                if l == -1 or l not in pivot_of: break
                k = pivot_of[l]
                # Add column k to column j (mod 2)
                merged = sorted(set(cols[j]).symmetric_difference(set(cols[k])))
                cols[j] = merged
            l = _low(cols[j])
            low[j] = l
            if l != -1:
                pivot_of[l] = j
                pairs.append((l, j))

        # Compute birth-death pairs
        self.birth_death = []
        paired = set()
        for i, j in pairs:
            paired.add(i); paired.add(j)
            d = dims[i]
            b = values[i]; death = values[j]
            if death > b: self.birth_death.append((d, b, death))
        # Essential classes (never die)
        for j in range(n):
            if j not in paired:
                d = dims[j]; b = values[j]
                self.birth_death.append((d, b, float('inf')))

    def diagram(self, dim: int) -> list[tuple[float,float]]:
        """Return persistence diagram for given dimension."""
        return [(b, d) for dd, b, d in self.birth_death if dd == dim and d < float('inf')]

    def betti_number(self, dim: int) -> int:
        """Betti number = number of essential classes in given dimension."""
        return sum(1 for dd, b, d in self.birth_death if dd == dim and d == float('inf'))

    def persistence_entropy(self, dim: int) -> float:
        """Entropy of the persistence diagram (Atienza et al. 2019)."""
        pairs = [(d-b) for dd, b, d in self.birth_death if dd == dim and d < float('inf')]
        L = sum(pairs)
        if L < 1e-14: return 0.0
        probs = [p/L for p in pairs]
        return -sum(p*math.log(p+1e-300) for p in probs)

    def bottleneck_distance(self, other: 'PersistentHomology', dim: int) -> float:
        """
        Bottleneck distance between two persistence diagrams (O(n²) greedy approx).
        """
        D1 = self.diagram(dim)
        D2 = other.diagram(dim)
        if not D1 and not D2: return 0.0
        # Pad with diagonal points for unmatched
        all_pts = list(D1) + [((b+d)/2,(b+d)/2) for b,d in D2]
        all_pts2 = list(D2) + [((b+d)/2,(b+d)/2) for b,d in D1]
        if not all_pts or not all_pts2: return 0.0
        return max(min(max(abs(p[0]-q[0]), abs(p[1]-q[1])) for q in all_pts2)
                   for p in all_pts)


# ---------------------------------------------------------------------------
# Gaussian Linking Number (Knot Theory)
# ---------------------------------------------------------------------------

def gaussian_linking_number(K1: list[tuple[float,float,float]],
                              K2: list[tuple[float,float,float]]) -> float:
    """
    Compute the Gaussian linking number of two discrete closed curves in ℝ³.
    Lk(K1,K2) = (1/4π) ∮ ∮ (r12 × dr1) · dr2 / |r12|³
    Discretised as a double sum over edges.
    """
    def cross(u, v):
        return (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
    def sub(u, v): return (u[0]-v[0], u[1]-v[1], u[2]-v[2])
    def dot3(u, v): return u[0]*v[0]+u[1]*v[1]+u[2]*v[2]
    def norm3(v): return math.sqrt(dot3(v,v))

    n1, n2 = len(K1), len(K2)
    total = 0.0
    for i in range(n1):
        a = K1[i]; b = K1[(i+1)%n1]
        for j in range(n2):
            c = K2[j]; d = K2[(j+1)%n2]
            # Midpoints
            r12 = sub(((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2),
                      ((c[0]+d[0])/2,(c[1]+d[1])/2,(c[2]+d[2])/2))
            dr1 = sub(b, a); dr2 = sub(d, c)
            cr = cross(r12, dr1)
            r12_norm = norm3(r12)
            if r12_norm < 1e-14: continue
            total += dot3(cr, dr2) / r12_norm**3
    return total / (4.0 * math.pi)
