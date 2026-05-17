# =============================================================================
# DJI 1 PM Close Prediction Engine - Makefile
# =============================================================================
# Build system for C and C++ implementations with optional integrations
# - Integrates with a `yfinance` directory when present
# - Optional integrations (default OFF): ai, neural, ml, gpu, complex_theory, emoji
#
# Usage examples:
#   make all                       - Build all targets
#   make c                         - Build C implementation only
#   make cpp                       - Build C++ implementation only
#   make integrations              - Build detected integrations (yfinance always auto-detected)
#   make all ENABLE_AI=1           - Build all + AI integration
#   make clean                     - Remove compiled binaries
#   make run                       - Build and run all implementations
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

# Base directory for resolving sibling integration directories
BASEDIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Integration directories (relative to this Makefile)
YFINANCE_DIR := $(BASEDIR)/../yfinance
AI_DIR := $(BASEDIR)/../ai
NEURAL_DIR := $(BASEDIR)/../neural
ML_DIR := $(BASEDIR)/../ml
GPU_DIR := $(BASEDIR)/../gpu
COMPLEX_THEORY_DIR := $(BASEDIR)/../complex_theory
EMOJI_DIR := $(BASEDIR)/../😀

# Enable flags (optional integrations). AI defaults to off; others default off as well.
ENABLE_AI ?= 0
ENABLE_NEURAL ?= 0
ENABLE_ML ?= 0
ENABLE_GPU ?= 0
ENABLE_COMPLEX_THEORY ?= 0
ENABLE_EMOJI ?= 0

# Source files (core)
C_SRC = dji_1pm_prediction.c
CPP_SRC = dji_1pm_prediction.cpp

# Output binaries
C_BIN = dji_prediction_c
CPP_BIN = dji_prediction_cpp

# Integration binaries (auto-detected)
INTEGRATION_BINS :=

# Helper: a function to find sources in a directory
# Usage: $(call find_srcs,<dir>) -> returns space-separated list of .c and .cpp files
find_srcs = $(wildcard $1/*.c) $(wildcard $1/*.cpp)

# If yfinance has sources, compile it as an integration binary. This integration is attempted automatically
YFINANCE_SRCS := $(call find_srcs,$(YFINANCE_DIR))
ifneq ($(YFINANCE_SRCS),)
YFINANCE_BIN = dji_integration_yfinance
INTEGRATION_BINS += $(YFINANCE_BIN)
endif

# Conditional integrations (built only when enabled and directory has sources)
AI_SRCS := $(call find_srcs,$(AI_DIR))
ifneq ($(AI_SRCS),)
ifneq ($(ENABLE_AI),0)
AI_BIN = dji_integration_ai
INTEGRATION_BINS += $(AI_BIN)
endif
endif

NEURAL_SRCS := $(call find_srcs,$(NEURAL_DIR))
ifneq ($(NEURAL_SRCS),)
ifneq ($(ENABLE_NEURAL),0)
NEURAL_BIN = dji_integration_neural
INTEGRATION_BINS += $(NEURAL_BIN)
endif
endif

ML_SRCS := $(call find_srcs,$(ML_DIR))
ifneq ($(ML_SRCS),)
ifneq ($(ENABLE_ML),0)
ML_BIN = dji_integration_ml
INTEGRATION_BINS += $(ML_BIN)
endif
endif

GPU_SRCS := $(call find_srcs,$(GPU_DIR))
ifneq ($(GPU_SRCS),)
ifneq ($(ENABLE_GPU),0)
GPU_BIN = dji_integration_gpu
INTEGRATION_BINS += $(GPU_BIN)
endif
endif

COMPLEX_SRCS := $(call find_srcs,$(COMPLEX_THEORY_DIR))
ifneq ($(COMPLEX_SRCS),)
ifneq ($(ENABLE_COMPLEX_THEORY),0)
COMPLEX_BIN = dji_integration_complex
INTEGRATION_BINS += $(COMPLEX_BIN)
endif
endif

EMOJI_SRCS := $(call find_srcs,$(EMOJI_DIR))
ifneq ($(EMOJI_SRCS),)
ifneq ($(ENABLE_EMOJI),0)
EMOJI_BIN = dji_integration_emoji
INTEGRATION_BINS += $(EMOJI_BIN)
endif
endif

# Environment variables for testing
export DJI_PRICE ?= 44000.00
export VOLATILITY ?= 0.15
export DRIFT ?= 0.05
export SIMULATIONS ?= 10000
export RANDOM_SEED ?= 42

# =============================================================================
# TARGETS
# =============================================================================

.PHONY: all clean run run-c run-cpp test help integrations yfinance ai neural ml gpu complex emoji

# Default target
all: $(C_BIN) $(CPP_BIN) integrations

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

# Integrations meta-target: builds all detected & enabled integrations
integrations: $(INTEGRATION_BINS)
	@echo "Integrations build complete (built: $(INTEGRATION_BINS))"

# -----------------------------------------------------------------------------
# yfinance integration
# -----------------------------------------------------------------------------
ifeq ($(strip $(YFINANCE_SRCS)),)
# yfinance not found
yfinance:
	@echo "No yfinance integration found at $(YFINANCE_DIR). Skipping."
else
$(YFINANCE_BIN):
	@echo "Building yfinance integration from: $(YFINANCE_SRCS)"
	@mkdir -p build || true
	@# Compile C sources
	@if [ -n "$(YFINANCE_SRCS)" ]; then \
		CC_SRCS="$(filter %.c,$(YFINANCE_SRCS))"; \
		CXX_SRCS="$(filter %.cpp,$(YFINANCE_SRCS))"; \
		OBJS=""; \
		for f in $$CC_SRCS; do \
			o=build/$(notdir $${f%.c}).o; \
			$(CC) $(CFLAGS) -c $$f -o $$o || exit 1; \
			OBJS="$$OBJS $$o"; \
		done; \
		for f in $$CXX_SRCS; do \
			o=build/$(notdir $${f%.cpp}).o; \
			$(CXX) $(CXXFLAGS) -c $$f -o $$o || exit 1; \
			OBJS="$$OBJS $$o"; \
		done; \
		$(CXX) $(CXXFLAGS) -o $@ $$OBJS $(LDFLAGS) || exit 1; \
	fi
	@echo "Built: $@"
endif

# -----------------------------------------------------------------------------
# Optional integrations (only built when corresponding ENABLE_* != 0)
# Each block follows the same pattern as yfinance above: detect sources, compile to build/*.o, link
# -----------------------------------------------------------------------------

# AI
ifneq ($(strip $(AI_SRCS)),)
ifneq ($(ENABLE_AI),0)
$(AI_BIN):
	@echo "Building AI integration from: $(AI_SRCS)"
	@mkdir -p build || true
	@CC_SRCS="$(filter %.c,$(AI_SRCS))"; \
	CXX_SRCS="$(filter %.cpp,$(AI_SRCS))"; \
	OBJS=""; \
	for f in $$CC_SRCS; do \
		o=build/$(notdir $${f%.c}).o; \
		$(CC) $(CFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	for f in $$CXX_SRCS; do \
		o=build/$(notdir $${f%.cpp}).o; \
		$(CXX) $(CXXFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	$(CXX) $(CXXFLAGS) -o $@ $$OBJS $(LDFLAGS) || exit 1;
	@echo "Built: $@"
endif
endif

# Neural
ifneq ($(strip $(NEURAL_SRCS)),)
ifneq ($(ENABLE_NEURAL),0)
$(NEURAL_BIN):
	@echo "Building Neural integration from: $(NEURAL_SRCS)"
	@mkdir -p build || true
	@CC_SRCS="$(filter %.c,$(NEURAL_SRCS))"; \
	CXX_SRCS="$(filter %.cpp,$(NEURAL_SRCS))"; \
	OBJS=""; \
	for f in $$CC_SRCS; do \
		o=build/$(notdir $${f%.c}).o; \
		$(CC) $(CFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	for f in $$CXX_SRCS; do \
		o=build/$(notdir $${f%.cpp}).o; \
		$(CXX) $(CXXFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	$(CXX) $(CXXFLAGS) -o $@ $$OBJS $(LDFLAGS) || exit 1;
	@echo "Built: $@"
endif
endif

# ML
ifneq ($(strip $(ML_SRCS)),)
ifneq ($(ENABLE_ML),0)
$(ML_BIN):
	@echo "Building ML integration from: $(ML_SRCS)"
	@mkdir -p build || true
	@CC_SRCS="$(filter %.c,$(ML_SRCS))"; \
	CXX_SRCS="$(filter %.cpp,$(ML_SRCS))"; \
	OBJS=""; \
	for f in $$CC_SRCS; do \
		o=build/$(notdir $${f%.c}).o; \
		$(CC) $(CFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	for f in $$CXX_SRCS; do \
		o=build/$(notdir $${f%.cpp}).o; \
		$(CXX) $(CXXFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	$(CXX) $(CXXFLAGS) -o $@ $$OBJS $(LDFLAGS) || exit 1;
	@echo "Built: $@"
endif
endif

# GPU
ifneq ($(strip $(GPU_SRCS)),)
ifneq ($(ENABLE_GPU),0)
$(GPU_BIN):
	@echo "Building GPU integration from: $(GPU_SRCS)"
	@mkdir -p build || true
	@CC_SRCS="$(filter %.c,$(GPU_SRCS))"; \
	CXX_SRCS="$(filter %.cpp,$(GPU_SRCS))"; \
	OBJS=""; \
	for f in $$CC_SRCS; do \
		o=build/$(notdir $${f%.c}).o; \
		$(CC) $(CFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	for f in $$CXX_SRCS; do \
		o=build/$(notdir $${f%.cpp}).o; \
		$(CXX) $(CXXFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	$(CXX) $(CXXFLAGS) -o $@ $$OBJS $(LDFLAGS) || exit 1;
	@echo "Built: $@"
endif
endif

# Complex theory
ifneq ($(strip $(COMPLEX_SRCS)),)
ifneq ($(ENABLE_COMPLEX_THEORY),0)
$(COMPLEX_BIN):
	@echo "Building Complex Theory integration from: $(COMPLEX_SRCS)"
	@mkdir -p build || true
	@CC_SRCS="$(filter %.c,$(COMPLEX_SRCS))"; \
	CXX_SRCS="$(filter %.cpp,$(COMPLEX_SRCS))"; \
	OBJS=""; \
	for f in $$CC_SRCS; do \
		o=build/$(notdir $${f%.c}).o; \
		$(CC) $(CFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	for f in $$CXX_SRCS; do \
		o=build/$(notdir $${f%.cpp}).o; \
		$(CXX) $(CXXFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	$(CXX) $(CXXFLAGS) -o $@ $$OBJS $(LDFLAGS) || exit 1;
	@echo "Built: $@"
endif
endif

# Emoji directory
ifneq ($(strip $(EMOJI_SRCS)),)
ifneq ($(ENABLE_EMOJI),0)
$(EMOJI_BIN):
	@echo "Building Emoji integration from: $(EMOJI_SRCS)"
	@mkdir -p build || true
	@CC_SRCS="$(filter %.c,$(EMOJI_SRCS))"; \
	CXX_SRCS="$(filter %.cpp,$(EMOJI_SRCS))"; \
	OBJS=""; \
	for f in $$CC_SRCS; do \
		o=build/$(notdir $${f%.c}).o; \
		$(CC) $(CFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	for f in $$CXX_SRCS; do \
		o=build/$(notdir $${f%.cpp}).o; \
		$(CXX) $(CXXFLAGS) -c $$f -o $$o || exit 1; \
		OBJS="$$OBJS $$o"; \
	done; \
	$(CXX) $(CXXFLAGS) -o $@ $$OBJS $(LDFLAGS) || exit 1;
	@echo "Built: $@"
endif
endif

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -f $(C_BIN) $(CPP_BIN) $(INTEGRATION_BINS)
	rm -f build/*
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
	@echo "\n============================================"
	@echo "Running Integrations (if any)"
	@echo "============================================"
	@for b in $(INTEGRATION_BINS); do \
		if [ -x "$$b" ]; then echo "--- Running $$b"; ./$$b; fi; \
	done

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
	@echo "  integrations - Build detected integrations (yfinance auto-detected). Use ENABLE_*=1 to enable optional ones"
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
	@echo "Optional integration toggles (default: 0):"
	@echo "  ENABLE_AI, ENABLE_NEURAL, ENABLE_ML, ENABLE_GPU, ENABLE_COMPLEX_THEORY, ENABLE_EMOJI"
	@echo "To enable AI integration: make ENABLE_AI=1 integrations"
	@echo ""
	@echo "Debug build:"
	@echo "  make DEBUG=1 all"
