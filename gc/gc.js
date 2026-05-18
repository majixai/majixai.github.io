/**
 * gc.js — Garbage Collection algorithms in JavaScript (ES2020)
 * =============================================================
 * Implements two classic GC strategies on a simulated heap:
 *
 *   1. Mark-and-Sweep  — DFS mark pass + sweep pass
 *   2. Reference Counting — ref-counts; immediate reclamation (no cycles)
 *
 * Works in Node.js 14+ or any modern browser (no external dependencies).
 *
 * Usage (Node.js):
 *   node gc.js
 */

'use strict';

// ---------------------------------------------------------------------------
// Shared object model
// ---------------------------------------------------------------------------

let _nextId = 0;
function allocId() { return ++_nextId; }

class GCObject {
  constructor(name) {
    this.id     = allocId();
    this.name   = name;
    this.refs   = [];   // Array of GCObject ids
    this.alive  = true;
    this.marked = false;
  }
}

// ---------------------------------------------------------------------------
// Mark-and-Sweep Heap
// ---------------------------------------------------------------------------

class MarkSweepHeap {
  /**
   * @param {number} [maxSize=64]
   */
  constructor(maxSize = 64) {
    this.maxSize  = maxSize;
    this._objects = new Map();  // id → GCObject
    this._roots   = new Set();  // root ids
  }

  alloc(name) {
    if (this._objects.size >= this.maxSize) this.collect();
    if (this._objects.size >= this.maxSize) throw new Error('Heap exhausted');
    const obj = new GCObject(name);
    this._objects.set(obj.id, obj);
    return obj;
  }

  addRoot(obj)    { this._roots.add(obj.id); }
  removeRoot(obj) { this._roots.delete(obj.id); }

  addRef(src, dst) {
    if (!src.refs.includes(dst.id)) src.refs.push(dst.id);
  }

  removeRef(src, dst) {
    src.refs = src.refs.filter(id => id !== dst.id);
  }

  collect() {
    this._mark();
    return this._sweep();
  }

  _mark() {
    for (const obj of this._objects.values()) obj.marked = false;
    const stack = [...this._roots];
    while (stack.length) {
      const id  = stack.pop();
      const obj = this._objects.get(id);
      if (!obj || obj.marked) continue;
      obj.marked = true;
      stack.push(...obj.refs);
    }
  }

  _sweep() {
    const dead = [];
    for (const [id, obj] of this._objects) {
      if (!obj.marked) dead.push(id);
    }
    for (const id of dead) {
      this._objects.get(id).alive = false;
      this._objects.delete(id);
    }
    return dead.length;
  }

  liveCount() { return this._objects.size; }

  toString() {
    const names = [...this._objects.values()].map(o => o.name).sort().join(', ');
    return `MarkSweepHeap(live=${this.liveCount()}, roots=${this._roots.size}, objects=[${names}])`;
  }
}

// ---------------------------------------------------------------------------
// Reference-Counting Heap
// ---------------------------------------------------------------------------

class RefCountHeap {
  constructor() {
    this._objects  = new Map();  // id → GCObject
    this._refCount = new Map();  // id → count
  }

  alloc(name) {
    const obj = new GCObject(name);
    this._objects.set(obj.id, obj);
    this._refCount.set(obj.id, 0);
    return obj;
  }

  incRef(obj) {
    if (this._refCount.has(obj.id))
      this._refCount.set(obj.id, this._refCount.get(obj.id) + 1);
  }

  decRef(obj) {
    if (!this._refCount.has(obj.id)) return;
    const cnt = this._refCount.get(obj.id) - 1;
    this._refCount.set(obj.id, cnt);
    if (cnt <= 0) this._free(obj.id);
  }

  addRef(src, dst) {
    if (!src.refs.includes(dst.id)) {
      src.refs.push(dst.id);
      this.incRef(dst);
    }
  }

  removeRef(src, dst) {
    src.refs = src.refs.filter(id => id !== dst.id);
    this.decRef(dst);
  }

  _free(id) {
    const obj = this._objects.get(id);
    if (!obj) return;
    obj.alive = false;
    this._objects.delete(id);
    this._refCount.delete(id);
    for (const childId of obj.refs) {
      const child = this._objects.get(childId);
      if (child) this.decRef(child);
    }
  }

  liveCount() { return this._objects.size; }

  toString() {
    const names = [...this._objects.values()].map(o => o.name).sort().join(', ');
    return `RefCountHeap(live=${this.liveCount()}, objects=[${names}])`;
  }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

function demoMarkAndSweep() {
  console.log('=== Mark-and-Sweep Demo ===');
  const heap  = new MarkSweepHeap(16);
  const root  = heap.alloc('root');
  const child = heap.alloc('child');
  heap.alloc('orphan');  // unreachable — should be collected

  heap.addRoot(root);
  heap.addRef(root, child);

  console.log('Before GC:', heap.toString());
  const freed = heap.collect();
  console.log(`Freed ${freed} object(s) (orphan collected)`);
  console.log('After GC: ', heap.toString(), '\n');
}

function demoRefCounting() {
  console.log('=== Reference-Counting Demo ===');
  const heap = new RefCountHeap();
  const a    = heap.alloc('A');
  const b    = heap.alloc('B');
  heap.alloc('C');  // never referenced externally

  heap.incRef(a);    // external root-level reference to A
  heap.incRef(b);    // external root-level reference to B
  heap.addRef(a, b); // A → B

  console.log('After alloc & refs:', heap.toString());

  heap.decRef(b);
  console.log('After decRef(b):   ', heap.toString());

  heap.removeRef(a, b);
  heap.decRef(a);
  console.log('After decRef(a) (A & B freed):', heap.toString(), '\n');
}

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GCObject, MarkSweepHeap, RefCountHeap };
}

if (typeof require !== 'undefined' && require.main === module) {
  demoMarkAndSweep();
  demoRefCounting();
}
