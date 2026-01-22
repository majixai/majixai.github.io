#!/usr/bin/env python3
"""
Setup script for Cython compilation.
Run: python setup_cython.py build_ext --inplace
"""

from setuptools import setup, Extension
from Cython.Build import cythonize
import numpy as np

extensions = [
    Extension(
        "data_processor",
        ["data_processor.pyx"],
        include_dirs=[np.get_include()],
        extra_compile_args=['-O3', '-march=native', '-fopenmp'],
        extra_link_args=['-fopenmp'],
    )
]

setup(
    name='TickerDataProcessor',
    version='1.0',
    ext_modules=cythonize(
        extensions,
        compiler_directives={
            'language_level': "3",
            'boundscheck': False,
            'wraparound': False,
            'cdivision': True,
            'embedsignature': True
        }
    ),
    zip_safe=False,
)
