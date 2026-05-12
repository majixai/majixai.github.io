"""
gc.py — Garbage Collection algorithms in Python 3
==================================================
Implements two classic GC strategies on a simulated heap:

  1. Mark-and-Sweep  — DFS mark pass + sweep pass
  2. Reference Counting — ref-counts; immediate reclamation (no cycles)

Run:
    python gc.py
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

# ---------------------------------------------------------------------------
# Shared object model
# ---------------------------------------------------------------------------

_next_id: int = 0


def _alloc_id() -> int:
    global _next_id
    _next_id += 1
    return _next_id


@dataclass
class GCObject:
    """A managed heap object."""
    id:     int
    name:   str
    refs:   List[int] = field(default_factory=list)  # ids of referenced objects
    alive:  bool = True
    marked: bool = False


# ---------------------------------------------------------------------------
# Mark-and-Sweep Heap
# ---------------------------------------------------------------------------

class MarkSweepHeap:
    """
    A simple mark-and-sweep managed heap.

    Allocation: O(1) amortised.
    Collection: O(live objects) mark + O(heap size) sweep.
    """

    def __init__(self, max_size: int = 64):
        self.max_size = max_size
        self._objects: Dict[int, GCObject] = {}
        self._roots:   Set[int]            = set()

    # -- Allocation -----------------------------------------------------------

    def alloc(self, name: str) -> GCObject:
        if len(self._objects) >= self.max_size:
            self.collect()
        if len(self._objects) >= self.max_size:
            raise MemoryError("Heap exhausted")
        obj = GCObject(id=_alloc_id(), name=name)
        self._objects[obj.id] = obj
        return obj

    # -- Root management ------------------------------------------------------

    def add_root(self, obj: GCObject) -> None:
        self._roots.add(obj.id)

    def remove_root(self, obj: GCObject) -> None:
        self._roots.discard(obj.id)

    # -- Reference management -------------------------------------------------

    def add_ref(self, src: GCObject, dst: GCObject) -> None:
        if dst.id not in src.refs:
            src.refs.append(dst.id)

    def remove_ref(self, src: GCObject, dst: GCObject) -> None:
        src.refs = [r for r in src.refs if r != dst.id]

    # -- Collection -----------------------------------------------------------

    def collect(self) -> int:
        """Run mark-and-sweep. Returns number of objects freed."""
        self._mark()
        return self._sweep()

    def _mark(self) -> None:
        for obj in self._objects.values():
            obj.marked = False
        stack = list(self._roots)
        while stack:
            oid = stack.pop()
            obj = self._objects.get(oid)
            if obj is None or obj.marked:
                continue
            obj.marked = True
            stack.extend(obj.refs)

    def _sweep(self) -> int:
        dead = [oid for oid, obj in self._objects.items() if not obj.marked]
        for oid in dead:
            self._objects[oid].alive = False
            del self._objects[oid]
        return len(dead)

    # -- Stats ----------------------------------------------------------------

    def live_count(self) -> int:
        return len(self._objects)

    def __repr__(self) -> str:
        live = sorted(obj.name for obj in self._objects.values())
        return (
            f"MarkSweepHeap(live={self.live_count()}, "
            f"roots={len(self._roots)}, objects={live})"
        )


# ---------------------------------------------------------------------------
# Reference-Counting Heap
# ---------------------------------------------------------------------------

class RefCountHeap:
    """
    Reference-counted heap.  Objects are freed immediately when their
    ref-count drops to zero.  NOTE: cycles are NOT collected.
    """

    def __init__(self) -> None:
        self._objects:  Dict[int, GCObject] = {}
        self._refcount: Dict[int, int]      = {}

    def alloc(self, name: str) -> GCObject:
        obj = GCObject(id=_alloc_id(), name=name)
        self._objects[obj.id] = obj
        self._refcount[obj.id] = 0   # new objects start with zero external refs
        return obj

    def inc_ref(self, obj: GCObject) -> None:
        if obj.id in self._refcount:
            self._refcount[obj.id] += 1

    def dec_ref(self, obj: GCObject) -> None:
        if obj.id not in self._refcount:
            return
        self._refcount[obj.id] -= 1
        if self._refcount[obj.id] <= 0:
            self._free(obj.id)

    def add_ref(self, src: GCObject, dst: GCObject) -> None:
        """Record that src holds a reference to dst."""
        if dst.id not in src.refs:
            src.refs.append(dst.id)
            self.inc_ref(dst)

    def remove_ref(self, src: GCObject, dst: GCObject) -> None:
        """Remove src's reference to dst."""
        src.refs = [r for r in src.refs if r != dst.id]
        self.dec_ref(dst)

    def _free(self, oid: int) -> None:
        obj = self._objects.pop(oid, None)
        if obj is None:
            return
        obj.alive = False
        del self._refcount[oid]
        for child_id in obj.refs:
            child = self._objects.get(child_id)
            if child:
                self.dec_ref(child)

    def live_count(self) -> int:
        return len(self._objects)

    def __repr__(self) -> str:
        live = sorted(obj.name for obj in self._objects.values())
        return f"RefCountHeap(live={self.live_count()}, objects={live})"


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

def demo_mark_and_sweep() -> None:
    print("=== Mark-and-Sweep Demo ===")
    heap   = MarkSweepHeap(max_size=16)
    root   = heap.alloc("root")
    child  = heap.alloc("child")
    heap.alloc("orphan")   # unreachable — should be collected

    heap.add_root(root)
    heap.add_ref(root, child)

    print(f"Before GC: {heap}")
    freed = heap.collect()
    print(f"Freed {freed} object(s) (orphan collected)")
    print(f"After GC:  {heap}\n")


def demo_ref_counting() -> None:
    print("=== Reference-Counting Demo ===")
    heap = RefCountHeap()

    a = heap.alloc("A")
    b = heap.alloc("B")
    heap.alloc("C")   # never referenced externally

    heap.inc_ref(a)    # external root-level reference to A
    heap.inc_ref(b)    # external root-level reference to B
    heap.add_ref(a, b) # A → B

    print(f"After alloc & refs: {heap}")

    # Drop external ref to B; still alive via A→B
    heap.dec_ref(b)
    print(f"After dec_ref(b):   {heap}")

    # Remove A→B then drop A; both A and B should be freed
    heap.remove_ref(a, b)
    heap.dec_ref(a)
    print(f"After dec_ref(a) (A & B freed): {heap}\n")


if __name__ == "__main__":
    demo_mark_and_sweep()
    demo_ref_counting()
