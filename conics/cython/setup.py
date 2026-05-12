"""
conics/cython/setup.py
======================
Build the Cython extension for conics/cython/conics.pyx.

Usage:
    cd conics/cython
    python setup.py build_ext --inplace

Produces:
    conics/cython/conics.cpython-<version>-<platform>.so  (or .pyd on Windows)

Then import with:
    import sys, os
    sys.path.insert(0, os.path.join("<repo_root>", "conics", "cython"))
    from conics import cy_decompose, cy_fit_ols
"""

from setuptools import Extension, setup

try:
    from Cython.Build import cythonize
    ext = cythonize(
        Extension(
            name="conics",
            sources=["conics.pyx"],
            extra_compile_args=["-O3"],
        ),
        compiler_directives={
            "language_level": "3",
            "boundscheck": False,
            "wraparound": False,
            "cdivision": True,
        },
    )
except ImportError:
    # If Cython is not installed, expose a pure-Python fallback
    import warnings
    warnings.warn(
        "Cython not found — skipping native extension.  "
        "Use conics/python/conics.py for pure-Python functionality.",
        RuntimeWarning,
        stacklevel=2,
    )
    ext = []

setup(
    name="conics-cython",
    version="1.0.0",
    ext_modules=ext,
    zip_safe=False,
)
