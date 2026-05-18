# gc.R — Garbage Collection algorithms in R
# ==========================================
# Implements two classic GC strategies on a simulated heap:
#
#   1. Mark-and-Sweep  — DFS mark pass + sweep pass
#   2. Reference Counting — immediate reclamation (no cycle detection)
#
# Dependencies: base R only (no external packages required).
#
# Usage:
#   Rscript gc.R

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

.next_id <- local({ id <- 0L; function() { id <<- id + 1L; id } })

new_gc_object <- function(name) {
  list(
    id     = .next_id(),
    name   = name,
    refs   = integer(0),
    alive  = TRUE,
    marked = FALSE
  )
}

# ---------------------------------------------------------------------------
# Mark-and-Sweep Heap (closure-based)
# ---------------------------------------------------------------------------

mark_sweep_heap <- function(max_size = 64L) {
  objects <- list()   # named by string id
  roots   <- integer(0)

  alloc <- function(name) {
    if (length(objects) >= max_size) collect()
    if (length(objects) >= max_size) stop("Heap exhausted")
    obj <- new_gc_object(name)
    objects[[as.character(obj$id)]] <<- obj
    obj
  }

  add_root    <- function(obj) roots <<- unique(c(roots, obj$id))
  remove_root <- function(obj) roots <<- roots[roots != obj$id]

  add_ref <- function(src, dst) {
    k <- as.character(src$id)
    if (!dst$id %in% objects[[k]]$refs)
      objects[[k]]$refs <<- c(objects[[k]]$refs, dst$id)
  }

  remove_ref <- function(src, dst) {
    k <- as.character(src$id)
    objects[[k]]$refs <<- objects[[k]]$refs[objects[[k]]$refs != dst$id]
  }

  .mark <- function() {
    for (k in names(objects)) objects[[k]]$marked <<- FALSE
    stack <- roots
    while (length(stack) > 0) {
      id    <- stack[length(stack)]
      stack <- stack[-length(stack)]
      k     <- as.character(id)
      if (is.null(objects[[k]]) || objects[[k]]$marked) next
      objects[[k]]$marked <<- TRUE
      stack <- c(stack, objects[[k]]$refs)
    }
  }

  .sweep <- function() {
    dead <- character(0)
    for (k in names(objects)) {
      if (!objects[[k]]$marked) dead <- c(dead, k)
    }
    for (k in dead) {
      objects[[k]]$alive <<- FALSE
      objects[[k]] <<- NULL
    }
    length(dead)
  }

  collect <- function() {
    .mark()
    .sweep()
  }

  live_count <- function() length(objects)

  show <- function() {
    nms <- sort(sapply(objects, `[[`, "name"))
    cat(sprintf("MarkSweepHeap(live=%d, roots=%d, objects=[%s])\n",
                live_count(), length(roots), paste(nms, collapse = ", ")))
  }

  list(
    alloc       = alloc,
    add_root    = add_root,
    remove_root = remove_root,
    add_ref     = add_ref,
    remove_ref  = remove_ref,
    collect     = collect,
    live_count  = live_count,
    show        = show
  )
}

# ---------------------------------------------------------------------------
# Reference-Counting Heap (closure-based)
# ---------------------------------------------------------------------------

ref_count_heap <- function() {
  objects   <- list()    # named by string id
  ref_count <- integer(0)

  alloc <- function(name) {
    obj <- new_gc_object(name)
    k   <- as.character(obj$id)
    objects[[k]]   <<- obj
    ref_count[[k]] <<- 0L
    obj
  }

  inc_ref <- function(obj) {
    k <- as.character(obj$id)
    if (!is.null(ref_count[[k]]))
      ref_count[[k]] <<- ref_count[[k]] + 1L
  }

  dec_ref <- function(obj) {
    k <- as.character(obj$id)
    if (is.null(ref_count[[k]])) return(invisible(NULL))
    ref_count[[k]] <<- ref_count[[k]] - 1L
    if (ref_count[[k]] <= 0L) .free(obj$id)
  }

  add_ref <- function(src, dst) {
    sk <- as.character(src$id)
    if (!dst$id %in% objects[[sk]]$refs) {
      objects[[sk]]$refs <<- c(objects[[sk]]$refs, dst$id)
      inc_ref(dst)
    }
  }

  remove_ref <- function(src, dst) {
    sk <- as.character(src$id)
    objects[[sk]]$refs <<- objects[[sk]]$refs[objects[[sk]]$refs != dst$id]
    dec_ref(dst)
  }

  .free <- function(id) {
    k   <- as.character(id)
    obj <- objects[[k]]
    if (is.null(obj)) return(invisible(NULL))
    child_refs     <- obj$refs
    objects[[k]]$alive <<- FALSE
    objects[[k]]   <<- NULL
    ref_count[[k]] <<- NULL
    for (cid in child_refs) {
      ck <- as.character(cid)
      if (!is.null(objects[[ck]])) dec_ref(objects[[ck]])
    }
  }

  live_count <- function() length(objects)

  show <- function() {
    nms <- sort(sapply(objects, `[[`, "name"))
    cat(sprintf("RefCountHeap(live=%d, objects=[%s])\n",
                live_count(), paste(nms, collapse = ", ")))
  }

  list(
    alloc      = alloc,
    inc_ref    = inc_ref,
    dec_ref    = dec_ref,
    add_ref    = add_ref,
    remove_ref = remove_ref,
    live_count = live_count,
    show       = show
  )
}

# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

demo_mark_and_sweep <- function() {
  cat("=== Mark-and-Sweep Demo ===\n")
  heap  <- mark_sweep_heap(max_size = 16L)
  root  <- heap$alloc("root")
  child <- heap$alloc("child")
  heap$alloc("orphan")   # unreachable — should be collected

  heap$add_root(root)
  heap$add_ref(root, child)

  cat("Before GC: "); heap$show()
  freed <- heap$collect()
  cat(sprintf("Freed %d object(s) (orphan collected)\n", freed))
  cat("After GC:  "); heap$show()
  cat("\n")
}

demo_ref_counting <- function() {
  cat("=== Reference-Counting Demo ===\n")
  heap <- ref_count_heap()
  a    <- heap$alloc("A")
  b    <- heap$alloc("B")
  heap$alloc("C")   # never referenced externally

  heap$inc_ref(a)    # external root-level reference to A
  heap$inc_ref(b)    # external root-level reference to B
  heap$add_ref(a, b) # A → B

  cat("After alloc & refs: "); heap$show()

  heap$dec_ref(b)
  cat("After dec_ref(b):   "); heap$show()

  heap$remove_ref(a, b)
  heap$dec_ref(a)
  cat("After dec_ref(a) (A & B freed): "); heap$show()
  cat("\n")
}

if (!interactive()) {
  demo_mark_and_sweep()
  demo_ref_counting()
}
