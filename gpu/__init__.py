"""
gpu — Central GPU Processing Package
======================================
Single import point for GPU management across the entire repository.

Quick start
-----------
    from gpu import GPUManager, GPUDispatcher
    import gpu.kernels as K

    mgr        = GPUManager()               # auto-selects best backend
    dispatcher = GPUDispatcher(manager=mgr)

    future = dispatcher.submit("tensor_ops.hosvd",
                               feature_matrix=F, rank=3)
    core, sv = future.result()

    future = dispatcher.submit("matrix_ops.pca",
                               data=X, n_components=5)
    pcs, explained = future.result()

    dispatcher.shutdown()

Backends (auto-selected in priority order)
------------------------------------------
  cuda        NVIDIA GPU via CuPy
  mps         Apple Silicon via PyTorch MPS
  tensorflow  GPU via TensorFlow
  cpu         NumPy (always available — automatic fallback)

Any script in any sub-directory can reach the package by adding the
repository root to sys.path before importing:

    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from gpu import GPUManager
"""

from gpu.manager import GPUManager
from gpu.dispatcher import GPUDispatcher, Task
from gpu import kernels

__all__ = [
    "GPUManager",
    "GPUDispatcher",
    "Task",
    "kernels",
]
