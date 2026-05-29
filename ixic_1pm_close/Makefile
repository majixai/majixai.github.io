# =============================================================================
# IXIC 1 PM Close Prediction Engine - Makefile
# =============================================================================
# Build system for C and C++ implementations (reserved for future native impls)
#
# Usage:
#   make all       - Build all targets
#   make clean     - Remove compiled binaries
#   make run       - Build and run all implementations
#   make test      - Run tests (all implementations)
#   make python    - Run the Python implementation
#
# Author: MajixAI
# License: MIT
# =============================================================================

# Compilers
CC  = gcc
CXX = g++

# Compiler flags
CFLAGS   = -Wall -Wextra -Wpedantic -std=c11   -O2
CXXFLAGS = -Wall -Wextra -Wpedantic -std=c++17 -O3

# Linker flags
LDFLAGS = -lm

# Debug flags (use: make DEBUG=1)
ifdef DEBUG
    CFLAGS   += -g -DDEBUG
    CXXFLAGS += -g -DDEBUG
else
    CFLAGS   += -DNDEBUG
    CXXFLAGS += -DNDEBUG
endif

# Source files
C_SRC   = ixic_1pm_prediction.c
CPP_SRC = ixic_1pm_prediction.cpp

# Output binaries
C_BIN   = ixic_prediction_c
CPP_BIN = ixic_prediction_cpp

# Python script
PY_SCRIPT = ixic_1pm_prediction.py

# Environment variables for testing / overrides
export IXIC_PRICE     ?= 19000.00
export VOLATILITY     ?= 0.18
export DRIFT          ?= 0.06
export SIMULATIONS    ?= 10000
export RANDOM_SEED    ?= 42
export HISTORY_PERIOD ?= 60d

# =============================================================================
# TARGETS
# =============================================================================

.PHONY: all clean run python test help

# Default: run the Python implementation (C/C++ sources are not yet present)
all: python

# Python implementation
python:
	@echo "Running Python IXIC 1 PM prediction engine..."
	cd .. && python $(PY_SCRIPT:%=ixic_1pm_close/%)

# Build C implementation (when source is provided)
$(C_BIN): $(C_SRC)
	@echo "Building C implementation..."
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)
	@echo "Built: $@"

# Build C++ implementation (when source is provided)
$(CPP_BIN): $(CPP_SRC)
	@echo "Building C++ implementation..."
	$(CXX) $(CXXFLAGS) -o $@ $< $(LDFLAGS)
	@echo "Built: $@"

# Run all available implementations
run: python

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -f $(C_BIN) $(CPP_BIN)
	rm -f *.o *.obj
	@echo "Clean complete."

# Test all available implementations
test:
	@echo "Testing Python implementation..."
	@cd .. && python ixic_1pm_close/$(PY_SCRIPT) > /dev/null \
		&& echo "✓ Python implementation: PASSED" \
		|| echo "✗ Python implementation: FAILED"

# Help target
help:
	@echo "IXIC 1 PM Close Prediction – Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  all       - Run Python implementation (default)"
	@echo "  python    - Run Python prediction engine"
	@echo "  clean     - Remove compiled binaries"
	@echo "  run       - Run all implementations"
	@echo "  test      - Run basic tests"
	@echo "  help      - Show this help message"
	@echo ""
	@echo "Environment variables:"
	@echo "  IXIC_PRICE      - Starting price if live data unavailable (default: 19000.00)"
	@echo "  VOLATILITY      - Annualised volatility (default: 0.18)"
	@echo "  DRIFT           - Annualised drift (default: 0.06)"
	@echo "  SIMULATIONS     - Number of Monte Carlo simulations (default: 10000)"
	@echo "  RANDOM_SEED     - Random seed for reproducibility (default: 42)"
	@echo "  HISTORY_PERIOD  - yfinance history window (default: 60d)"
	@echo ""
	@echo "Debug build (when C/C++ sources are present):"
	@echo "  make DEBUG=1 all"
