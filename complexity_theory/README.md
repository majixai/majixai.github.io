# Complexity Theory — PhD-Level Reference

## Overview

Computational complexity theory classifies problems by the resources (time, space,
communication, randomness) required to solve them. This module covers circuit
complexity, communication complexity, interactive proofs, parameterised complexity,
and approximation.

---

## 1. Classical Complexity Classes

**P:** Problems solvable in deterministic polynomial time.

**NP:** Problems verifiable in polynomial time.  $L \in \text{NP}$ iff $\exists$
polynomial $p$ and verifier $V$ s.t. $x \in L \Leftrightarrow \exists w, |w|\leq p(|x|): V(x,w) = 1$.

**NP-completeness:** $L$ is NP-complete if $L \in \text{NP}$ and $\forall L'\in\text{NP}: L' \leq_p L$.

**Cook-Levin theorem:** SAT is NP-complete.

**The P vs NP problem:** The central open problem. If P = NP, one-way functions
(and thus public-key cryptography) cannot exist.

### 1.1 The Polynomial Hierarchy

$$\Sigma_0^P = \Pi_0^P = \Delta_0^P = \text{P}$$
$$\Sigma_{k+1}^P = \text{NP}^{\Sigma_k^P}, \quad \Pi_{k+1}^P = \text{co-NP}^{\Sigma_k^P}$$

**PH** = $\bigcup_k \Sigma_k^P$.  A collapse of PH to any finite level would be remarkable.

---

## 2. Space Complexity

**PSPACE:** Polynomial space. Savitch's theorem: NSPACE$(s) \subseteq$ DSPACE$(s^2)$.

**PSPACE-completeness:** TQBF (true quantified Boolean formula) is PSPACE-complete.

**L and NL:** Logarithmic space classes. **Immerman-Szelepcsényi:** NL = co-NL.

**L ⊆ NL ⊆ P ⊆ NP ⊆ PH ⊆ PSPACE ⊆ EXP**

---

## 3. Randomised Complexity

**BPP:** Bounded-error probabilistic polynomial time.
$L \in \text{BPP}$ if $\Pr[M(x) \text{ correct}] \geq 2/3$ for a polynomial-time PTM $M$.

**RP and co-RP:** One-sided error.

**ZPP = RP ∩ co-RP:** Zero-error probabilistic polynomial time.

**Adleman's theorem:** BPP ⊆ P/poly (probabilistic polynomial-time algorithms can be
derandomised with polynomial-length advice).

**Nisan-Wigderson PRG:** If DTIME$(2^n)$ is hard on average, then P = BPP.

---

## 4. Circuit Complexity

**Boolean circuits:** DAGs with AND, OR, NOT gates; size = number of gates.

**$\text{AC}^0$:** Constant-depth polynomial-size circuits with unbounded fan-in.
**Håstad's switching lemma:** After random restriction, depth-$d$ circuits simplify.
**$\text{AC}^0$ lower bounds:** PARITY $\notin \text{AC}^0$ (Furst-Saxe-Sipser, Håstad).

**$\text{TC}^0$:** $\text{AC}^0$ augmented with majority gates.
**$\text{NC}^1$:** Log-depth polynomial-size circuits.
$$\text{AC}^0 \subsetneq \text{TC}^0 \subseteq \text{NC}^1 \subseteq \text{L} \subseteq \text{P}$$

**Monotone circuit complexity:** Ben-Mor and Razborov proved exponential lower bounds
for monotone circuits solving MATCHING.

---

## 5. Communication Complexity

Alice holds $x \in \{0,1\}^n$, Bob holds $y \in \{0,1\}^n$; both want to compute $f(x,y)$.

**Deterministic CC:** $D(f) = $ min bits exchanged in worst case.

**Rank lower bound:** $D(f) \geq \log_2\text{rank}(M_f)$ where $M_f$ is the communication matrix.

**Randomised CC:** $R(f) \leq D(f)$; separation by constant-vs-log factor possible.

**Information Complexity:** $IC_\mu(f,\varepsilon) = \min_\pi I(\pi; X|Y) + I(\pi; Y|X)$
amortises to compression of protocols.

**Discrepancy method:** $D(f) \geq \log(1/\text{disc}(f))$; used to prove $D(\text{IP}) = \Omega(n)$.

---

## 6. Interactive Proofs

**IP:** Problems with interactive proof systems (polynomial rounds, poly-time verifier,
probabilistic verifier).  **Shamir's theorem:** IP = PSPACE.

**MIP:** Multi-prover interactive proofs.  **MIP = NEXP** (Babai-Moran-Ben-Or-Goldwasser-Lund).

**MIP*:** Multi-prover IPs with shared entanglement.  **MIP* = RE** (Ji-Natarajan-Vidick-Wright-Yuen 2020) — undecidable!

**PCP theorem:** Every NP language has a probabilistically checkable proof with $O(\log n)$
random bits and $O(1)$ query bits:
$$\text{NP} = \text{PCP}[\log n, 1]$$

**Inapproximability:** The PCP theorem implies MAX-3SAT, CLIQUE, SET COVER are hard to
approximate within constant factors (assuming P ≠ NP).

---

## 7. Parameterised Complexity

**Fixed-parameter tractability:** An instance $(I, k)$ is FPT if solvable in $f(k)\cdot|I|^c$.

**W[1]-hardness:** K-CLIQUE is W[1]-complete; likely not FPT.

**Kernelisation:** Preprocessing to reduce instance size to $g(k)$; equivalent to FPT.

**Treewidth:** Many NP-hard problems are FPT parameterised by treewidth $w$,
solvable in $f(w)\cdot n$ time via dynamic programming on tree decompositions.

---

## 8. Approximation Algorithms

**Approximation ratio:** $\rho = \text{ALG}/\text{OPT}$ (minimisation) or $\text{OPT}/\text{ALG}$ (max).

**PTAS:** Polynomial-time approximation scheme: $(1+\varepsilon)$-approx for any $\varepsilon>0$.

**FPTAS:** Fully PTAS: poly in $n$ and $1/\varepsilon$.  Exists for Knapsack.

**APX-hardness:** MAX-3SAT, Vertex Cover (unless P=NP), CLIQUE (unless P=NP)
are in APX but not PTAS (PCP theorem).

**Semidefinite programming bounds:** Goemans-Williamson MAX-CUT achieves a $0.878$-approximation
via SDP relaxation.  UGC implies this is optimal.

---

## Subdirectories

| Directory | Content |
|---|---|
| `circuit/` | Boolean circuits, AC0/TC0/NC hierarchies, lower bounds |
| `communication/` | Deterministic/randomised CC, information complexity, applications |
| `interactive_proofs/` | IP, MIP, MIP*, PCP theorem, zero-knowledge proofs |
| `parameterized/` | FPT, W-hierarchy, kernelisation, treewidth |
| `approximation/` | Greedy, LP/SDP relaxations, inapproximability, UGC |
