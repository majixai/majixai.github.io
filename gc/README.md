# GC — Garbage Collection Algorithms

Multi-language implementations of two fundamental garbage collection strategies
on a simulated heap.

## Algorithms

### 1. Mark-and-Sweep

The classic two-phase algorithm:

1. **Mark** — starting from all GC roots, perform a depth-first traversal and
   mark every reachable object.
2. **Sweep** — iterate over the entire heap and free every **un**marked object.

| Property | Value |
|----------|-------|
| Collection pause | Stop-the-world |
| Time complexity | O(live) mark + O(heap) sweep |
| Space overhead | One mark bit per object |
| Handles cycles? | ✓ Yes |

### 2. Reference Counting

Each object carries a reference count.  When a new reference is created the
count is incremented; when a reference is destroyed the count is decremented.
When the count reaches zero the object is freed immediately and its children
are decremented recursively.

| Property | Value |
|----------|-------|
| Collection pause | Incremental (per-mutation) |
| Time complexity | O(1) amortised per reference change |
| Space overhead | One integer counter per object |
| Handles cycles? | ✗ No (requires a cycle-collector supplement) |

## Mathematical Concepts

| Component | Concept |
|-----------|---------|
| DFS mark traversal | Graph reachability (directed graph) |
| Reverse-cumulative sweep | Linear scan of a map/array |
| Reference counting | Invariant: `rc(x) = |{y : y → x}|` |
| Cycle detection gap | Strongly-connected components problem |

## Files

| File | Language |
|------|----------|
| `gc.py` | Python 3 |
| `gc.js` | JavaScript (ES2020) |
| `GC.java` | Java 11+ |
| `gc.go` | Go 1.18+ |
| `gc.R` | R (base) |

## Quick Start

```bash
# Python
python gc.py

# JavaScript (Node.js)
node gc.js

# Java
javac GC.java && java GC

# Go
go run gc.go

# R
Rscript gc.R
```

## Object Model

All implementations share the same conceptual model:

```
GCObject {
  id:     unique integer
  name:   string label
  refs:   list of referenced object IDs
  alive:  boolean (false once freed)
  marked: boolean (scratch bit for the mark phase)
}
```

The **heap** is a fixed-size pool (configurable `max_size`).  The **root set**
is the entry point for reachability analysis.

## Comparison

| Strategy | Cycle-safe | Pause | Overhead |
|----------|-----------|-------|----------|
| Mark-and-Sweep | ✓ | Stop-the-world | 1 bit / object |
| Reference Counting | ✗ | Incremental | 1 int / object |
