# =============================================================================
# DJI 1 PM Close Prediction Engine - Makefile
# =============================================================================
# Build system for C and C++ implementations
#
# Usage:
#   make all       - Build all targets
#   make c         - Build C implementation only
#   make cpp       - Build C++ implementation only
#   make clean     - Remove compiled binaries
#   make run       - Build and run all implementations
#   make run-c     - Build and run C implementation
#   make run-cpp   - Build and run C++ implementation
#   make test      - Run tests (all implementations)
#
# Author: MajixAI
# License: MIT
# =============================================================================

# Compilers
CC = gcc
CXX = g++

# Compiler flags
CFLAGS = -Wall -Wextra -Wpedantic -std=c11 -O2
CXXFLAGS = -Wall -Wextra -Wpedantic -std=c++17 -O3

# Linker flags
LDFLAGS = -lm

# Debug flags (use: make DEBUG=1)
ifdef DEBUG
    CFLAGS += -g -DDEBUG
    CXXFLAGS += -g -DDEBUG
else
    CFLAGS += -DNDEBUG
    CXXFLAGS += -DNDEBUG
endif

# Source files
C_SRC = dji_1pm_prediction.c
CPP_SRC = dji_1pm_prediction.cpp

# Output binaries
C_BIN = dji_prediction_c
CPP_BIN = dji_prediction_cpp

# Environment variables for testing
export DJI_PRICE ?= 44000.00
export VOLATILITY ?= 0.15
export DRIFT ?= 0.05
export SIMULATIONS ?= 10000
export RANDOM_SEED ?= 42

# =============================================================================
# TARGETS
# =============================================================================

.PHONY: all clean run run-c run-cpp test help

# Default target
all: $(C_BIN) $(CPP_BIN)

# Build C implementation
c: $(C_BIN)

$(C_BIN): $(C_SRC)
	@echo "Building C implementation..."
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)
	@echo "Built: $@"

# Build C++ implementation
cpp: $(CPP_BIN)

$(CPP_BIN): $(CPP_SRC)
	@echo "Building C++ implementation..."
	$(CXX) $(CXXFLAGS) -o $@ $< $(LDFLAGS)
	@echo "Built: $@"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -f $(C_BIN) $(CPP_BIN)
	rm -f *.o *.obj
	@echo "Clean complete."

# Run all implementations
run: all
	@echo "\n============================================"
	@echo "Running C Implementation"
	@echo "============================================"
	./$(C_BIN)
	@echo "\n============================================"
	@echo "Running C++ Implementation"
	@echo "============================================"
	./$(CPP_BIN)

# Run C implementation only
run-c: c
	./$(C_BIN)

# Run C++ implementation only
run-cpp: cpp
	./$(CPP_BIN)

# Test all implementations
test: all
	@echo "Testing C implementation..."
	@./$(C_BIN) > /dev/null && echo "✓ C implementation: PASSED" || echo "✗ C implementation: FAILED"
	@echo "Testing C++ implementation..."
	@./$(CPP_BIN) > /dev/null && echo "✓ C++ implementation: PASSED" || echo "✗ C++ implementation: FAILED"

# Help target
help:
	@echo "DJI 1 PM Close Prediction - Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  all       - Build all implementations (default)"
	@echo "  c         - Build C implementation only"
	@echo "  cpp       - Build C++ implementation only"
	@echo "  clean     - Remove compiled binaries"
	@echo "  run       - Build and run all implementations"
	@echo "  run-c     - Build and run C implementation"
	@echo "  run-cpp   - Build and run C++ implementation"
	@echo "  test      - Run basic tests"
	@echo "  help      - Show this help message"
	@echo ""
	@echo "Environment variables:"
	@echo "  DJI_PRICE    - Current DJI price (default: 44000.00)"
	@echo "  VOLATILITY   - Annualized volatility (default: 0.15)"
	@echo "  DRIFT        - Drift rate (default: 0.05)"
	@echo "  SIMULATIONS  - Number of Monte Carlo simulations (default: 10000)"
	@echo "  RANDOM_SEED  - Random seed for reproducibility (default: 42)"
	@echo ""
	@echo "Debug build:"
	@echo "  make DEBUG=1 all"
