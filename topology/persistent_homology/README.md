# Persistent Homology — PhD Reference

## Overview

Persistent homology studies how the topology of a filtered space changes as a
parameter grows.  It is the core tool of Topological Data Analysis (TDA).

---

## 1. Filtration and Persistent Modules

A **filtration** is a nested sequence of topological spaces:
$$\emptyset = K_0 \subseteq K_1 \subseteq \cdots \subseteq K_n = K$$

For each $i \leq j$, inclusion $K_i \hookrightarrow K_j$ induces:
$$\phi^{i,j}: H_p(K_i) \to H_p(K_j) \quad \text{(persistence map)}$$

**Persistent homology group:** $H_p^{i,j} = \text{im}\,\phi^{i,j} \subset H_p(K_j)$

---

## 2. Persistence Diagrams and Barcodes

**Barcode:** A multiset of intervals $[b_k, d_k)$ representing "birth" and "death" of
each topological feature (connected component, loop, void, ...).

**Persistence diagram:** $\text{Dgm}_p(K_\bullet) = \{(b_k, d_k)\} \cup \Delta$ (diagonal $\Delta = \{(x,x)\}$).

**Bottleneck distance:**
$$d_B(\text{Dgm}_1, \text{Dgm}_2) = \inf_\gamma \sup_{x\in\text{Dgm}_1} \|x - \gamma(x)\|_\infty$$
where the infimum is over all bijections $\gamma: \text{Dgm}_1 \to \text{Dgm}_2$.

**Wasserstein distance:**
$$W_q(\text{Dgm}_1, \text{Dgm}_2) = \inf_\gamma \left(\sum_x \|x-\gamma(x)\|_\infty^q\right)^{1/q}$$

---

## 3. Stability Theorem

**Cohen-Steiner stability:** For two tame functions $f, g: X \to \mathbb{R}$:
$$d_B(\text{Dgm}(f), \text{Dgm}(g)) \leq \|f - g\|_\infty$$

This guarantees that small perturbations in the data lead to small changes in the persistence diagram.

---

## 4. Computation

**Boundary matrix reduction:** Represent $\partial: C_\bullet \to C_\bullet$ as a matrix $M$;
reduce to *reduced form* $R$ by column operations over $\mathbb{Z}_2$:
$$R = M \cdot V \quad (V \text{ invertible})$$

**Running time:** $O(n^3)$ in general; $O(n^\omega)$ for matrix multiplication exponent $\omega$.

**Twist algorithm:** Exploits the persistence pairing structure for practical speedup.

---

## 5. Rips and Čech Complexes

**Vietoris-Rips:** $\sigma \in \mathcal{R}(\varepsilon)$ iff $\text{diam}(\sigma) \leq 2\varepsilon$ (all pairwise distances).

**Čech complex:** $\sigma \in \mathcal{C}(\varepsilon)$ iff $\bigcap_i B(x_i,\varepsilon) \neq \emptyset$ (requires $\varepsilon$-ball intersection).

**Nerve lemma:** $\mathcal{C}(\varepsilon)$ is homotopy equivalent to $\bigcup_i B(x_i,\varepsilon)$ when the balls form a good cover.

**Approximation:** $\mathcal{C}(\varepsilon) \subseteq \mathcal{R}(\varepsilon) \subseteq \mathcal{C}(2\varepsilon)$ (interleaving).

---

## 6. Persistent Homology in Machine Learning

**Topological features as ML inputs:** Persistence entropy, Betti numbers, landscape functions.

**Persistent homology gradient:** Can backpropagate through persistence to learn filtrations (PLLAY, TopoAE).

**Applications:** Protein folding, materials science, neuroscience (brain connectivity), image analysis, time series.
