/*
 * bitcoin_miner/miner.c
 *
 * Educational Bitcoin-style proof-of-work miner in C.
 *
 * Demonstrates:
 *   - Exact 80-byte block header layout (Bitcoin protocol)
 *   - Double SHA-256 (SHA256d) using OpenSSL
 *   - Difficulty target parsing from "bits" compact format
 *   - Little-endian / big-endian byte-order handling
 *   - Multi-threaded nonce search with pthreads
 *   - Per-thread hashrate measurement and global termination
 *
 * Build:
 *   make          (see Makefile)
 *   OR manually:
 *   gcc -O2 -Wall -Wextra -pthread miner.c -o miner -lssl -lcrypto
 *
 * Usage:
 *   ./miner [--threads N] [--bits 0x1d00ffff] [--no-color]
 *
 * NOTE: Mining real Bitcoin on a CPU in 2026 is purely academic.
 *       Network difficulty is so high that the probability of finding
 *       a block is effectively zero. This code is for education only.
 */

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <time.h>
#include <pthread.h>
#include <openssl/sha.h>

/* ─────────────────────────────────────────────────────────────────
 * Constants
 * ───────────────────────────────────────────────────────────────── */

#define BLOCK_HEADER_SIZE   80      /* Bitcoin block header is exactly 80 bytes */
#define HASH_SIZE           32      /* SHA-256 digest length in bytes            */
#define DEFAULT_THREADS     4       /* Default worker thread count               */

/* ANSI colour codes (disabled if --no-color is passed) */
static int use_color = 1;
#define CLR_RESET  (use_color ? "\033[0m"  : "")
#define CLR_ORANGE (use_color ? "\033[33m" : "")
#define CLR_GREEN  (use_color ? "\033[32m" : "")
#define CLR_RED    (use_color ? "\033[31m" : "")
#define CLR_CYAN   (use_color ? "\033[36m" : "")
#define CLR_BOLD   (use_color ? "\033[1m"  : "")

/* ─────────────────────────────────────────────────────────────────
 * Block Header Structure
 *
 * Matches the Bitcoin wire format exactly (packed, little-endian).
 * Total: 4 + 32 + 32 + 4 + 4 + 4 = 80 bytes.
 * ───────────────────────────────────────────────────────────────── */
#pragma pack(push, 1)   /* disable compiler padding */
typedef struct {
    int32_t  version;           /*  4 bytes – block version number         */
    uint8_t  prev_block[32];    /* 32 bytes – SHA-256 hash of previous hdr */
    uint8_t  merkle_root[32];   /* 32 bytes – Merkle root of transactions  */
    uint32_t timestamp;         /*  4 bytes – Unix timestamp               */
    uint32_t bits;              /*  4 bytes – compact difficulty target     */
    uint32_t nonce;             /*  4 bytes – the field we iterate over    */
} BlockHeader;
#pragma pack(pop)

/* Sanity-check the struct size at compile time */
typedef char assert_header_size[ (sizeof(BlockHeader) == BLOCK_HEADER_SIZE) ? 1 : -1 ];

/* ─────────────────────────────────────────────────────────────────
 * Double SHA-256 (SHA256d)
 *
 * Bitcoin hashing always applies SHA-256 twice:
 *   hash = SHA256( SHA256( data ) )
 *
 * The second pass was introduced to defend against length-extension
 * attacks on the Merkle tree.
 * ───────────────────────────────────────────────────────────────── */
static void double_sha256(const uint8_t *data, size_t len, uint8_t *out)
{
    uint8_t tmp[HASH_SIZE];
    SHA256(data, len, tmp);       /* first pass  */
    SHA256(tmp, HASH_SIZE, out);  /* second pass */
}

/* ─────────────────────────────────────────────────────────────────
 * Difficulty Target
 *
 * The "bits" field is a compact 4-byte encoding of a 256-bit target:
 *
 *   bits  = 0x1d00ffff   (Genesis block)
 *   exponent (byte 0)  = 0x1d = 29
 *   coefficient (bytes 1-3) = 0x00ffff
 *
 *   target = coefficient * 256^(exponent - 3)
 *
 * We expand this into a full 32-byte (256-bit) target array.
 * A hash is valid if, when treated as a big-endian integer, it is
 * strictly less than the target.
 * ───────────────────────────────────────────────────────────────── */
static void expand_target(uint32_t bits, uint8_t *target /* 32 bytes */)
{
    memset(target, 0, HASH_SIZE);

    uint8_t exponent    = (bits >> 24) & 0xFF;
    uint32_t coefficient = bits & 0x007FFFFF;

    /* Coefficient occupies 3 bytes; exponent encodes total byte length */
    if (exponent < 3 || exponent > 32) return;  /* malformed – leave zero */

    /* Place the 3-byte coefficient at byte offset (exponent - 3) from
     * the most-significant end of the 32-byte target. */
    int offset = (int)exponent - 3;
    if (offset >= 0 && offset + 2 < HASH_SIZE) {
        target[offset]     = (coefficient >> 16) & 0xFF;
        target[offset + 1] = (coefficient >>  8) & 0xFF;
        target[offset + 2] =  coefficient        & 0xFF;
    }
}

/*
 * Returns 1 if hash < target (valid proof-of-work), 0 otherwise.
 * Both arrays are treated as 32-byte big-endian integers.
 */
static int hash_meets_target(const uint8_t *hash, const uint8_t *target)
{
    for (int i = 0; i < HASH_SIZE; i++) {
        if (hash[i] < target[i]) return 1;
        if (hash[i] > target[i]) return 0;
    }
    return 0; /* equal – not strictly less */
}

/* ─────────────────────────────────────────────────────────────────
 * Hex helpers
 * ───────────────────────────────────────────────────────────────── */
static void print_hex(const uint8_t *data, size_t len)
{
    for (size_t i = 0; i < len; i++) printf("%02x", data[i]);
}

/* Parse a hex string into a byte array (big-endian order). */
static int hex_to_bytes(const char *hex, uint8_t *out, size_t out_len)
{
    size_t hex_len = strlen(hex);
    if (hex_len != out_len * 2) return -1;
    for (size_t i = 0; i < out_len; i++) {
        unsigned int byte_val;
        if (sscanf(hex + i * 2, "%02x", &byte_val) != 1) return -1;
        out[i] = (uint8_t)byte_val;
    }
    return 0;
}

/* ─────────────────────────────────────────────────────────────────
 * Thread coordination
 * ───────────────────────────────────────────────────────────────── */
typedef struct {
    BlockHeader  header;           /* per-thread copy of the header template */
    uint8_t      target[32];       /* expanded difficulty target              */
    uint32_t     nonce_start;      /* first nonce this thread tries           */
    uint32_t     nonce_step;       /* stride (= total thread count)           */
    uint32_t     nonce_end;        /* exclusive upper bound                   */
    int          thread_id;

    /* shared result (protected by result_mutex) */
    volatile int *found;           /* set to 1 when any thread succeeds       */
    pthread_mutex_t *result_mutex;
    uint32_t     *result_nonce;
    uint8_t      *result_hash;

    /* per-thread stats */
    uint64_t     hashes_done;
    double       elapsed_sec;
} MinerThread;

static void *mine_thread(void *arg)
{
    MinerThread *t = (MinerThread *)arg;
    uint8_t hash[HASH_SIZE];
    struct timespec ts_start, ts_end;

    clock_gettime(CLOCK_MONOTONIC, &ts_start);

    for (uint32_t nonce = t->nonce_start;
         nonce != t->nonce_end;
         nonce += t->nonce_step)
    {
        /* Check shared flag without lock for speed; writes happen rarely. */
        if (*t->found) break;

        t->header.nonce = nonce;   /* nonce is 4-byte LE in the header */

        double_sha256((const uint8_t *)&t->header, BLOCK_HEADER_SIZE, hash);
        t->hashes_done++;

        if (hash_meets_target(hash, t->target)) {
            pthread_mutex_lock(t->result_mutex);
            if (!*t->found) {
                *t->found        = 1;
                *t->result_nonce = nonce;
                memcpy(t->result_hash, hash, HASH_SIZE);
            }
            pthread_mutex_unlock(t->result_mutex);
            break;
        }
    }

    clock_gettime(CLOCK_MONOTONIC, &ts_end);
    t->elapsed_sec = (ts_end.tv_sec  - ts_start.tv_sec) +
                     (ts_end.tv_nsec - ts_start.tv_nsec) / 1e9;
    return NULL;
}

/* ─────────────────────────────────────────────────────────────────
 * Argument parsing helpers
 * ───────────────────────────────────────────────────────────────── */
static int parse_uint(const char *s, unsigned long *out)
{
    char *end;
    *out = strtoul(s, &end, 0);
    return (*end == '\0') ? 0 : -1;
}

static void usage(const char *prog)
{
    fprintf(stderr,
        "Usage: %s [options]\n"
        "  --threads N          Worker thread count (default: %d)\n"
        "  --bits 0x<hex>       Compact difficulty target (default: 0x1e0fffff)\n"
        "  --version N          Block version number (default: 1)\n"
        "  --no-color           Disable ANSI colour output\n"
        "  --help               Show this message\n"
        "\n"
        "Examples:\n"
        "  %s --threads 8 --bits 0x1e0fffff\n"
        "  %s --bits 0x1f00ffff --threads 1\n",
        prog, DEFAULT_THREADS, prog, prog);
}

/* ─────────────────────────────────────────────────────────────────
 * Main
 * ───────────────────────────────────────────────────────────────── */
int main(int argc, char *argv[])
{
    /* ── defaults ── */
    int      num_threads  = DEFAULT_THREADS;
    uint32_t bits         = 0x1e0fffff;   /* testnet-like: easier than mainnet */
    int32_t  version      = 1;

    /* ── parse CLI ── */
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--help") == 0) {
            usage(argv[0]); return 0;
        } else if (strcmp(argv[i], "--no-color") == 0) {
            use_color = 0;
        } else if (strcmp(argv[i], "--threads") == 0 && i + 1 < argc) {
            unsigned long v;
            if (parse_uint(argv[++i], &v) != 0 || v < 1 || v > 256) {
                fprintf(stderr, "Error: --threads must be 1-256\n"); return 1;
            }
            num_threads = (int)v;
        } else if (strcmp(argv[i], "--bits") == 0 && i + 1 < argc) {
            unsigned long v;
            if (parse_uint(argv[++i], &v) != 0) {
                fprintf(stderr, "Error: --bits must be a hex or decimal integer\n"); return 1;
            }
            bits = (uint32_t)v;
        } else if (strcmp(argv[i], "--version") == 0 && i + 1 < argc) {
            unsigned long v;
            if (parse_uint(argv[++i], &v) != 0 || v > INT32_MAX) {
                fprintf(stderr, "Error: --version must be a non-negative integer\n"); return 1;
            }
            version = (int32_t)v;
        } else {
            fprintf(stderr, "Unknown argument: %s\n", argv[i]);
            usage(argv[0]); return 1;
        }
    }

    /* ── build a sample block header ── */
    BlockHeader hdr;
    memset(&hdr, 0, sizeof(hdr));

    hdr.version   = version;
    hdr.timestamp = (uint32_t)time(NULL);
    hdr.bits      = bits;
    hdr.nonce     = 0;

    /*
     * Simulate the previous block hash and Merkle root.
     * In a real miner these come from the Bitcoin node / pool.
     * We use the SHA256d of a fixed string as a stand-in so
     * the values are non-trivial.
     */
    {
        const char *prev_str   = "educational-bitcoin-miner:prev-block";
        const char *merkle_str = "educational-bitcoin-miner:merkle-root";
        double_sha256((const uint8_t *)prev_str,   strlen(prev_str),   hdr.prev_block);
        double_sha256((const uint8_t *)merkle_str, strlen(merkle_str), hdr.merkle_root);
    }

    /* ── expand the difficulty target ── */
    uint8_t target[HASH_SIZE];
    expand_target(bits, target);

    /* ── print banner ── */
    printf("%s%s=== Bitcoin Mining Demo (Educational) ===%s\n",
           CLR_BOLD, CLR_ORANGE, CLR_RESET);
    printf("Block version : %d\n",  hdr.version);
    printf("Timestamp     : %u\n",  hdr.timestamp);
    printf("Bits          : 0x%08x\n", hdr.bits);
    printf("Target        : ");
    print_hex(target, HASH_SIZE);
    printf("\n");
    printf("Prev hash     : ");
    print_hex(hdr.prev_block, 32);
    printf("\n");
    printf("Merkle root   : ");
    print_hex(hdr.merkle_root, 32);
    printf("\n");
    printf("Threads       : %d\n\n", num_threads);

    printf("NOTE: This is for educational purposes only.\n"
           "      No connection to the Bitcoin network is made.\n\n");

    /* ── allocate shared result state ── */
    volatile int found     = 0;
    uint32_t result_nonce  = 0;
    uint8_t  result_hash[HASH_SIZE];
    memset(result_hash, 0, HASH_SIZE);

    pthread_mutex_t result_mutex = PTHREAD_MUTEX_INITIALIZER;

    /* ── allocate and configure per-thread state ── */
    MinerThread *threads = calloc((size_t)num_threads, sizeof(MinerThread));
    if (!threads) { perror("calloc"); return 1; }

    pthread_t *tids = calloc((size_t)num_threads, sizeof(pthread_t));
    if (!tids) { perror("calloc"); free(threads); return 1; }

    /*
     * Nonce space partitioning:
     *   Thread 0 tries nonces: 0, N, 2N, 3N, …
     *   Thread 1 tries nonces: 1, N+1, 2N+1, …
     *   etc.
     * This avoids inter-thread communication for nonce distribution
     * while covering the full 2^32 nonce space uniformly.
     */
    for (int i = 0; i < num_threads; i++) {
        threads[i].header       = hdr;
        memcpy(threads[i].target, target, HASH_SIZE);
        threads[i].nonce_start  = (uint32_t)i;
        threads[i].nonce_step   = (uint32_t)num_threads;
        threads[i].nonce_end    = 0xFFFFFFFF;  /* wrap-around is the sentinel */
        threads[i].thread_id    = i;
        threads[i].found        = &found;
        threads[i].result_mutex = &result_mutex;
        threads[i].result_nonce = &result_nonce;
        threads[i].result_hash  = result_hash;
        threads[i].hashes_done  = 0;
        threads[i].elapsed_sec  = 0.0;
    }

    /* ── launch threads ── */
    printf("%sMining…%s  (press Ctrl-C to abort)\n\n", CLR_CYAN, CLR_RESET);
    struct timespec wall_start, wall_end;
    clock_gettime(CLOCK_MONOTONIC, &wall_start);

    for (int i = 0; i < num_threads; i++) {
        if (pthread_create(&tids[i], NULL, mine_thread, &threads[i]) != 0) {
            perror("pthread_create");
            found = 1; /* signal others to stop */
            for (int j = 0; j < i; j++) pthread_join(tids[j], NULL);
            free(tids); free(threads);
            return 1;
        }
    }

    /* ── wait for all threads ── */
    for (int i = 0; i < num_threads; i++) {
        pthread_join(tids[i], NULL);
    }
    clock_gettime(CLOCK_MONOTONIC, &wall_end);

    pthread_mutex_destroy(&result_mutex);

    /* ── aggregate stats ── */
    double wall_sec = (wall_end.tv_sec  - wall_start.tv_sec) +
                      (wall_end.tv_nsec - wall_start.tv_nsec) / 1e9;
    uint64_t total_hashes = 0;
    for (int i = 0; i < num_threads; i++) {
        total_hashes += threads[i].hashes_done;
    }
    double mhs = (wall_sec > 0) ? (total_hashes / 1e6) / wall_sec : 0.0;

    /* ── print result ── */
    printf("\n%s── Results ──%s\n", CLR_BOLD, CLR_RESET);
    printf("Total hashes  : %llu\n", (unsigned long long)total_hashes);
    printf("Elapsed       : %.3f s\n", wall_sec);
    printf("Hashrate      : %.2f MH/s\n", mhs);

    printf("\nPer-thread hashrates:\n");
    for (int i = 0; i < num_threads; i++) {
        double thr_mhs = (threads[i].elapsed_sec > 0)
            ? (threads[i].hashes_done / 1e6) / threads[i].elapsed_sec
            : 0.0;
        printf("  Thread %2d  %8llu hashes  %.2f MH/s\n",
               i, (unsigned long long)threads[i].hashes_done, thr_mhs);
    }

    if (found && result_nonce != 0) {
        printf("\n%s%s✔  Block found!%s\n", CLR_BOLD, CLR_GREEN, CLR_RESET);
        printf("Nonce         : %u (0x%08x)\n", result_nonce, result_nonce);
        printf("Block hash    : ");
        print_hex(result_hash, HASH_SIZE);
        printf("\n");

        /* Verify the hash really meets the target */
        printf("Target        : ");
        print_hex(target, HASH_SIZE);
        printf("\n");
        int valid = hash_meets_target(result_hash, target);
        printf("Valid PoW     : %s%s%s\n",
               valid ? CLR_GREEN : CLR_RED,
               valid ? "YES" : "NO",
               CLR_RESET);
    } else {
        printf("\n%s%s✗  No valid nonce found in the searched range.%s\n",
               CLR_BOLD, CLR_RED, CLR_RESET);
        printf("Try a lower difficulty (higher --bits value), e.g. --bits 0x1f00ffff\n");
    }

    free(tids);
    free(threads);
    return found ? 0 : 2;
}
