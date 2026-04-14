/**
 * tensor.js — Re-export shim
 *
 * The canonical Tensor and AdamOptimizer implementations live in the central
 * tensor library at /tensor/neural/tensor.js.  This file re-exports them so
 * that existing relative imports within neural_tensor_network/ continue to work
 * without any changes to the callers.
 */
export { Tensor, AdamOptimizer } from '/tensor/neural/tensor.js';
