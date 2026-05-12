// gc.go — Garbage Collection algorithms in Go
// ============================================
// Implements two classic GC strategies on a simulated heap:
//
//   1. Mark-and-Sweep  — DFS mark pass + sweep pass
//   2. Reference Counting — immediate reclamation (no cycle detection)
//
// Build &amp; run:
//   go run gc.go

package main

import (
	"fmt"
	"sort"
	"strings"
	"sync/atomic"
)

// ---------------------------------------------------------------------------
// Shared object model
// ---------------------------------------------------------------------------

var _nextID int64

func allocID() int {
	return int(atomic.AddInt64(&_nextID, 1))
}

// GCObject represents a managed heap object.
type GCObject struct {
	ID     int
	Name   string
	Refs   []int // IDs of referenced objects
	Alive  bool
	Marked bool
}

func newGCObject(name string) *GCObject {
	return &GCObject{ID: allocID(), Name: name, Alive: true}
}

// ---------------------------------------------------------------------------
// Mark-and-Sweep Heap
// ---------------------------------------------------------------------------

// MarkSweepHeap manages a set of GCObjects using mark-and-sweep collection.
type MarkSweepHeap struct {
	maxSize int
	objects map[int]*GCObject
	roots   map[int]bool
}

// NewMarkSweepHeap creates a new mark-and-sweep managed heap.
func NewMarkSweepHeap(maxSize int) *MarkSweepHeap {
	return &MarkSweepHeap{
		maxSize: maxSize,
		objects: make(map[int]*GCObject),
		roots:   make(map[int]bool),
	}
}

// Alloc allocates a new GCObject, triggering a collection if the heap is full.
func (h *MarkSweepHeap) Alloc(name string) *GCObject {
	if len(h.objects) >= h.maxSize {
		h.Collect()
	}
	if len(h.objects) >= h.maxSize {
		panic("heap exhausted")
	}
	obj := newGCObject(name)
	h.objects[obj.ID] = obj
	return obj
}

// AddRoot designates obj as a GC root.
func (h *MarkSweepHeap) AddRoot(obj *GCObject) { h.roots[obj.ID] = true }

// RemoveRoot removes obj from the root set.
func (h *MarkSweepHeap) RemoveRoot(obj *GCObject) { delete(h.roots, obj.ID) }

// AddRef records that src holds a reference to dst.
func (h *MarkSweepHeap) AddRef(src, dst *GCObject) {
	for _, id := range src.Refs {
		if id == dst.ID {
			return
		}
	}
	src.Refs = append(src.Refs, dst.ID)
}

// RemoveRef removes src's reference to dst.
func (h *MarkSweepHeap) RemoveRef(src, dst *GCObject) {
	out := src.Refs[:0]
	for _, id := range src.Refs {
		if id != dst.ID {
			out = append(out, id)
		}
	}
	src.Refs = out
}

// Collect runs a mark-and-sweep collection; returns the number of freed objects.
func (h *MarkSweepHeap) Collect() int {
	h.mark()
	return h.sweep()
}

func (h *MarkSweepHeap) mark() {
	for _, obj := range h.objects {
		obj.Marked = false
	}
	stack := make([]int, 0, len(h.roots))
	for id := range h.roots {
		stack = append(stack, id)
	}
	for len(stack) > 0 {
		id := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		obj, ok := h.objects[id]
		if !ok || obj.Marked {
			continue
		}
		obj.Marked = true
		stack = append(stack, obj.Refs...)
	}
}

func (h *MarkSweepHeap) sweep() int {
	var dead []int
	for id, obj := range h.objects {
		if !obj.Marked {
			dead = append(dead, id)
		}
	}
	for _, id := range dead {
		h.objects[id].Alive = false
		delete(h.objects, id)
	}
	return len(dead)
}

// LiveCount returns the number of live objects.
func (h *MarkSweepHeap) LiveCount() int { return len(h.objects) }

// String summarises the heap state.
func (h *MarkSweepHeap) String() string {
	names := make([]string, 0, len(h.objects))
	for _, obj := range h.objects {
		names = append(names, obj.Name)
	}
	sort.Strings(names)
	return fmt.Sprintf("MarkSweepHeap(live=%d, roots=%d, objects=[%s])",
		h.LiveCount(), len(h.roots), strings.Join(names, ", "))
}

// ---------------------------------------------------------------------------
// Reference-Counting Heap
// ---------------------------------------------------------------------------

// RefCountHeap manages objects using reference counting.
type RefCountHeap struct {
	objects  map[int]*GCObject
	refCount map[int]int
}

// NewRefCountHeap creates a new reference-counted heap.
func NewRefCountHeap() *RefCountHeap {
	return &RefCountHeap{
		objects:  make(map[int]*GCObject),
		refCount: make(map[int]int),
	}
}

// Alloc allocates a new GCObject with ref-count 0.
func (h *RefCountHeap) Alloc(name string) *GCObject {
	obj := newGCObject(name)
	h.objects[obj.ID] = obj
	h.refCount[obj.ID] = 0
	return obj
}

// IncRef increments the reference count of obj.
func (h *RefCountHeap) IncRef(obj *GCObject) {
	if _, ok := h.refCount[obj.ID]; ok {
		h.refCount[obj.ID]++
	}
}

// DecRef decrements the reference count; frees the object when it reaches 0.
func (h *RefCountHeap) DecRef(obj *GCObject) {
	if _, ok := h.refCount[obj.ID]; !ok {
		return
	}
	h.refCount[obj.ID]--
	if h.refCount[obj.ID] <= 0 {
		h.free(obj.ID)
	}
}

// AddRef records that src holds a reference to dst, incrementing dst's count.
func (h *RefCountHeap) AddRef(src, dst *GCObject) {
	for _, id := range src.Refs {
		if id == dst.ID {
			return
		}
	}
	src.Refs = append(src.Refs, dst.ID)
	h.IncRef(dst)
}

// RemoveRef removes src's reference to dst and decrements dst's count.
func (h *RefCountHeap) RemoveRef(src, dst *GCObject) {
	out := src.Refs[:0]
	for _, id := range src.Refs {
		if id != dst.ID {
			out = append(out, id)
		}
	}
	src.Refs = out
	h.DecRef(dst)
}

func (h *RefCountHeap) free(id int) {
	obj, ok := h.objects[id]
	if !ok {
		return
	}
	obj.Alive = false
	delete(h.objects, id)
	delete(h.refCount, id)
	for _, childID := range obj.Refs {
		child, ok := h.objects[childID]
		if ok {
			h.DecRef(child)
		}
	}
}

// LiveCount returns the number of live objects.
func (h *RefCountHeap) LiveCount() int { return len(h.objects) }

// String summarises the heap state.
func (h *RefCountHeap) String() string {
	names := make([]string, 0, len(h.objects))
	for _, obj := range h.objects {
		names = append(names, obj.Name)
	}
	sort.Strings(names)
	return fmt.Sprintf("RefCountHeap(live=%d, objects=[%s])",
		h.LiveCount(), strings.Join(names, ", "))
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

func demoMarkAndSweep() {
	fmt.Println("=== Mark-and-Sweep Demo ===")
	heap  := NewMarkSweepHeap(16)
	root  := heap.Alloc("root")
	child := heap.Alloc("child")
	heap.Alloc("orphan")  // unreachable — should be collected

	heap.AddRoot(root)
	heap.AddRef(root, child)

	fmt.Println("Before GC:", heap)
	freed := heap.Collect()
	fmt.Printf("Freed %d object(s) (orphan collected)\n", freed)
	fmt.Println("After GC: ", heap)
	fmt.Println()
}

func demoRefCounting() {
	fmt.Println("=== Reference-Counting Demo ===")
	heap := NewRefCountHeap()
	a    := heap.Alloc("A")
	b    := heap.Alloc("B")
	heap.Alloc("C")  // never referenced externally

	heap.IncRef(a)    // external root-level reference to A
	heap.IncRef(b)    // external root-level reference to B
	heap.AddRef(a, b) // A → B

	fmt.Println("After alloc & refs:", heap)

	heap.DecRef(b)
	fmt.Println("After DecRef(b):   ", heap)

	heap.RemoveRef(a, b)
	heap.DecRef(a)
	fmt.Println("After DecRef(a) (A & B freed):", heap)
	fmt.Println()
}

func main() {
	demoMarkAndSweep()
	demoRefCounting()
}
