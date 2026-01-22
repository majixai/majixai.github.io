# Makefile for building all components
# Compiles Cython, C, and Java code for optimal performance

.PHONY: all clean cython c java test install

CC=gcc
CFLAGS=-O3 -march=native -fPIC -shared -fopenmp -mavx2
JAVAC=javac
PYTHON=python3

all: cython c java
	@echo "All components built successfully"

# Cython compilation
cython:
	@echo "Compiling Cython modules..."
	$(PYTHON) setup_cython.py build_ext --inplace
	@echo "Cython compilation complete"

# C library compilation
c: ticker_analyzer.c
	@echo "Compiling C library..."
	$(CC) $(CFLAGS) -o ticker_analyzer.so ticker_analyzer.c -lm
	@echo "C library compiled: ticker_analyzer.so"

# Java compilation
java: TickerProcessor.java
	@echo "Compiling Java classes..."
	$(JAVAC) TickerProcessor.java
	@echo "Java compilation complete"

# Install dependencies
install:
	@echo "Installing Python dependencies..."
	pip install -r requirements_ml.txt
	@echo "Dependencies installed"

# Test all components
test:
	@echo "Testing Cython..."
	$(PYTHON) -c "from data_processor import TickerDataProcessor; print('Cython OK')"
	@echo "Testing C library..."
	test -f ticker_analyzer.so && echo "C library OK" || echo "C library FAILED"
	@echo "Testing Java..."
	test -f TickerProcessor.class && echo "Java OK" || echo "Java FAILED"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -f *.so *.o *.pyc *.class
	rm -rf build/ __pycache__/ *.egg-info/
	rm -f data_processor.c data_processor.cpp
	@echo "Clean complete"

# Setup automation
setup-automation:
	@echo "Setting up automation..."
	chmod +x daily_updater.sh fetch_1m_daily.py setup_cron.sh
	./setup_cron.sh
	@echo "Automation setup complete"
