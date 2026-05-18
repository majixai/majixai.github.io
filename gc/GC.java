/**
 * GC.java — Garbage Collection algorithms in Java 11+
 * ====================================================
 * Implements two classic GC strategies on a simulated heap:
 *
 *   1. Mark-and-Sweep  — DFS mark pass + sweep pass
 *   2. Reference Counting — immediate reclamation (no cycle detection)
 *
 * Compile & run:
 *   javac GC.java && java GC
 */

import java.util.*;

public class GC {

    // -----------------------------------------------------------------------
    // Shared object model
    // -----------------------------------------------------------------------

    static int nextId = 0;

    static class GCObject {
        final int    id;
        final String name;
        final List<Integer> refs = new ArrayList<>();
        boolean alive  = true;
        boolean marked = false;

        GCObject(String name) {
            this.id   = ++nextId;
            this.name = name;
        }

        @Override public String toString() { return name + "#" + id; }
    }

    // -----------------------------------------------------------------------
    // Mark-and-Sweep Heap
    // -----------------------------------------------------------------------

    static class MarkSweepHeap {
        private final int maxSize;
        private final Map<Integer, GCObject> objects = new LinkedHashMap<>();
        private final Set<Integer>           roots   = new HashSet<>();

        MarkSweepHeap(int maxSize) { this.maxSize = maxSize; }

        GCObject alloc(String name) {
            if (objects.size() >= maxSize) collect();
            if (objects.size() >= maxSize) throw new RuntimeException("Heap exhausted");
            GCObject obj = new GCObject(name);
            objects.put(obj.id, obj);
            return obj;
        }

        void addRoot(GCObject obj)    { roots.add(obj.id); }
        void removeRoot(GCObject obj) { roots.remove(obj.id); }

        void addRef(GCObject src, GCObject dst) {
            if (!src.refs.contains(dst.id)) src.refs.add(dst.id);
        }

        void removeRef(GCObject src, GCObject dst) {
            src.refs.remove(Integer.valueOf(dst.id));
        }

        int collect() {
            mark();
            return sweep();
        }

        private void mark() {
            for (GCObject o : objects.values()) o.marked = false;
            Deque<Integer> stack = new ArrayDeque<>(roots);
            while (!stack.isEmpty()) {
                int      id  = stack.pop();
                GCObject obj = objects.get(id);
                if (obj == null || obj.marked) continue;
                obj.marked = true;
                stack.addAll(obj.refs);
            }
        }

        private int sweep() {
            List<Integer> dead = new ArrayList<>();
            for (Map.Entry<Integer, GCObject> e : objects.entrySet()) {
                if (!e.getValue().marked) dead.add(e.getKey());
            }
            for (int id : dead) {
                objects.get(id).alive = false;
                objects.remove(id);
            }
            return dead.size();
        }

        int liveCount() { return objects.size(); }

        @Override public String toString() {
            List<String> names = new ArrayList<>();
            for (GCObject o : objects.values()) names.add(o.name);
            Collections.sort(names);
            return "MarkSweepHeap(live=" + liveCount() + ", roots=" + roots.size()
                    + ", objects=" + names + ")";
        }
    }

    // -----------------------------------------------------------------------
    // Reference-Counting Heap
    // -----------------------------------------------------------------------

    static class RefCountHeap {
        private final Map<Integer, GCObject> objects  = new LinkedHashMap<>();
        private final Map<Integer, Integer>  refCount = new HashMap<>();

        GCObject alloc(String name) {
            GCObject obj = new GCObject(name);
            objects.put(obj.id, obj);
            refCount.put(obj.id, 0);
            return obj;
        }

        void incRef(GCObject obj) {
            if (refCount.containsKey(obj.id))
                refCount.put(obj.id, refCount.get(obj.id) + 1);
        }

        void decRef(GCObject obj) {
            if (!refCount.containsKey(obj.id)) return;
            int cnt = refCount.get(obj.id) - 1;
            refCount.put(obj.id, cnt);
            if (cnt <= 0) free(obj.id);
        }

        void addRef(GCObject src, GCObject dst) {
            if (!src.refs.contains(dst.id)) {
                src.refs.add(dst.id);
                incRef(dst);
            }
        }

        void removeRef(GCObject src, GCObject dst) {
            src.refs.remove(Integer.valueOf(dst.id));
            decRef(dst);
        }

        private void free(int id) {
            GCObject obj = objects.remove(id);
            if (obj == null) return;
            obj.alive = false;
            refCount.remove(id);
            for (int childId : obj.refs) {
                GCObject child = objects.get(childId);
                if (child != null) decRef(child);
            }
        }

        int liveCount() { return objects.size(); }

        @Override public String toString() {
            List<String> names = new ArrayList<>();
            for (GCObject o : objects.values()) names.add(o.name);
            Collections.sort(names);
            return "RefCountHeap(live=" + liveCount() + ", objects=" + names + ")";
        }
    }

    // -----------------------------------------------------------------------
    // main — demos
    // -----------------------------------------------------------------------

    static void demoMarkAndSweep() {
        System.out.println("=== Mark-and-Sweep Demo ===");
        MarkSweepHeap heap  = new MarkSweepHeap(16);
        GCObject      root  = heap.alloc("root");
        GCObject      child = heap.alloc("child");
        heap.alloc("orphan");  // unreachable — should be collected

        heap.addRoot(root);
        heap.addRef(root, child);

        System.out.println("Before GC: " + heap);
        int freed = heap.collect();
        System.out.println("Freed " + freed + " object(s) (orphan collected)");
        System.out.println("After GC:  " + heap + "\n");
    }

    static void demoRefCounting() {
        System.out.println("=== Reference-Counting Demo ===");
        RefCountHeap heap = new RefCountHeap();
        GCObject a = heap.alloc("A");
        GCObject b = heap.alloc("B");
        heap.alloc("C");  // never referenced externally

        heap.incRef(a);     // external root-level reference to A
        heap.incRef(b);     // external root-level reference to B
        heap.addRef(a, b);  // A → B

        System.out.println("After alloc & refs: " + heap);

        heap.decRef(b);
        System.out.println("After decRef(b):    " + heap);

        heap.removeRef(a, b);
        heap.decRef(a);
        System.out.println("After decRef(a) (A & B freed): " + heap + "\n");
    }

    public static void main(String[] args) {
        demoMarkAndSweep();
        demoRefCounting();
    }
}
