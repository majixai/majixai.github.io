# bitcoin_miner/Makefile
#
# Build the educational Bitcoin proof-of-work miner.
#
# Targets:
#   make          – build optimised binary
#   make debug    – build with AddressSanitizer + debug symbols
#   make clean    – remove generated files
#
# Requirements:
#   gcc, make, libssl-dev (OpenSSL), pthreads (usually included in libc)
#
# On Debian/Ubuntu:
#   sudo apt-get install build-essential libssl-dev

CC      = gcc
BINARY  = miner

# Release flags: O2, full warnings, link OpenSSL and pthreads
CFLAGS  = -O2 -Wall -Wextra -Wpedantic -std=c11
LDFLAGS = -lssl -lcrypto -lpthread

# Debug flags: no optimisation, sanitizers, debug symbols
DBGFLAGS = -O0 -g -fsanitize=address,undefined -Wall -Wextra -std=c11

SRCS = miner.c
OBJS = $(SRCS:.c=.o)

.PHONY: all debug clean

all: $(BINARY)

$(BINARY): $(SRCS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)
	@echo "Built: $(BINARY)"

debug: $(SRCS)
	$(CC) $(DBGFLAGS) -o $(BINARY)_debug $^ $(LDFLAGS)
	@echo "Built: $(BINARY)_debug (debug+sanitizers)"

clean:
	rm -f $(BINARY) $(BINARY)_debug $(OBJS)
