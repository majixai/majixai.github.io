/*
 * bitcoin_miner/miner.c — High-Performance Educational Bitcoin Miner
 * ====================================================================
 *
 * Covers every topic from the discussion thread:
 *
 *  §1  Custom SHA-256 — FIPS 180-4 (no OpenSSL in hot path)
 *  §2  Inline-ASM ror32 — x86-64 "rorl" for zero-ambiguity rotation
 *  §3  SHA-256 midstate — block-A precompute, ~50% first-pass speedup
 *  §4  AVX2 8-way SIMD compression (#ifdef __AVX2__)
 *  §5  AVX-512 Σ/σ functions via _mm512_rol_epi32 (#ifdef __AVX512F__)
 *  §6  Fully-unrolled 64-round AVX-512 compression macro
 *  §7  Vectorized Merkle root reconstruction (16-lane EN2 sweep)
 *  §8  BlockHeader — 80-byte __attribute__((packed)), aligned_alloc(64)
 *  §9  nBits → 256-bit target expansion
 *  §10 Worker-pool + nonce partitioning (stride-N, no hot-loop mutex)
 *  §11 False-sharing prevention — __attribute__((aligned(64))) WorkerState
 *  §12 CPU affinity — pthread_setaffinity_np, one thread per core
 *  §13 stdatomic lockless flags — g_stop, g_job_id, g_total_hashes
 *  §14 Timestamp rolling — legal nonce-space expansion (±2 h window)
 *  §15 Non-blocking select() job-pipe — instant stale-work interrupt
 *  §16 Stratum V1 JSON-RPC — subscribe/authorize/notify/submit
 *  §17 Stats thread — per-thread MH/s display every second
 *
 * Build (scalar):
 *   gcc -O3 -Wall -Wextra -std=c11 -D_GNU_SOURCE -pthread miner.c -o miner -lm
 *
 * Build (AVX2 — 8-way):
 *   gcc -O3 -Wall -Wextra -std=c11 -D_GNU_SOURCE -mavx2 -pthread miner.c -o miner -lm
 *
 * Build (AVX-512 — 16-way, requires Ice Lake / Zen 4 or later):
 *   gcc -O3 -Wall -Wextra -std=c11 -D_GNU_SOURCE -mavx512f -pthread miner.c -o miner -lm
 *
 * Usage:
 *   ./miner [--threads N] [--bits 0xHEX] [--stratum HOST:PORT] [--nicehash]
 *           [--user WORKER] [--pass X] [--job-notify N] [--no-color]
 */

#ifndef _GNU_SOURCE
#  define _GNU_SOURCE
#endif
#ifndef _POSIX_C_SOURCE
#  define _POSIX_C_SOURCE 200809L
#endif

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <string.h>
#include <math.h>
#include <time.h>
#include <pthread.h>
#include <unistd.h>
#include <errno.h>
#include <sys/select.h>
#include <sys/time.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netdb.h>
#ifdef __linux__
#  include <sched.h>
#endif
#if defined(__AVX512F__) || defined(__AVX2__)
#  include <immintrin.h>
#endif

/* ═══════════════════════════════════════════════════════════════════════
 * §0  Compile-time configuration
 * ═══════════════════════════════════════════════════════════════════════ */
#define BLOCK_HEADER_SIZE    80
#define HASH_SIZE            32
#define CACHE_LINE           64
#define DEFAULT_THREADS       4
#define BATCH_SIZE          512
#define MAX_TS_ROLL        7200
#define STATS_INTERVAL_SEC    1
#define STRATUM_BUF        4096
#define MAX_THREADS         256
#define MERKLE_BRANCHES_MAX  32
#define NUM_MERKLE_LANES     16   /* AVX-512 Merkle vectorisation width */
#define NICEHASH_STRATUM_HOST "sha256asicboost.auto.nicehash.com"
#define NICEHASH_STRATUM_PORT 9200

static int use_color = 1;
#define CLR(c)   (use_color ? (c) : "")
#define CRESET   CLR("\033[0m")
#define CORANGE  CLR("\033[33m")
#define CGREEN   CLR("\033[32m")
#define CRED     CLR("\033[31m")
#define CCYAN    CLR("\033[36m")
#define CBOLD    CLR("\033[1m")

/* ═══════════════════════════════════════════════════════════════════════
 * §1  SHA-256 — complete FIPS 180-4 scalar implementation
 * ═══════════════════════════════════════════════════════════════════════ */
#include <stddef.h>   /* offsetof */

/* ── §2  Inline-assembly ror32 ──────────────────────────────────────────
 * The portable C pattern (x>>n)|(x<<(32-n)) is usually compiled to a
 * single ror by a modern optimiser, but inline assembly removes any
 * ambiguity.  RORL executes in 1 clock cycle (latency 1) on Zen4/P-core.
 * The "+r" constraint means val is both read and written in-place.
 * "c"(n) places the shift count into the CL register as required by RORL.
 */
#if defined(__x86_64__) || defined(__i386__)
static inline uint32_t ror32(uint32_t val, uint32_t n)
{
    __asm__("rorl %%cl, %0" : "+r"(val) : "c"(n));
    return val;
}
#else
static inline uint32_t ror32(uint32_t val, uint32_t n)
{ return (val >> n) | (val << (32u - n)); }
#endif

static const uint32_t K[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,
    0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,
    0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,
    0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,
    0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,
    0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,
    0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,
    0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,
    0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
};
static const uint32_t H0[8] = {
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
};

/* Logical primitives — each expands to 1–3 instructions inline */
#define CH(x,y,z)   (((x)&(y))^(~(x)&(z)))
#define MAJ(x,y,z)  (((x)&(y))^((x)&(z))^((y)&(z)))
#define SIG0(x)     (ror32(x,2) ^ror32(x,13)^ror32(x,22))
#define SIG1(x)     (ror32(x,6) ^ror32(x,11)^ror32(x,25))
#define sig0(x)     (ror32(x,7) ^ror32(x,18)^((x)>>3))
#define sig1(x)     (ror32(x,17)^ror32(x,19)^((x)>>10))
#define BE32_LOAD(p) \
    (((uint32_t)(p)[0]<<24)|((uint32_t)(p)[1]<<16)| \
     ((uint32_t)(p)[2]<<8)|(uint32_t)(p)[3])
#define BE32_STORE(p,v) do{ \
    (p)[0]=((v)>>24)&0xFF;(p)[1]=((v)>>16)&0xFF; \
    (p)[2]=((v)>>8)&0xFF; (p)[3]=(v)&0xFF;}while(0)

static inline void sha256_compress(uint32_t st[8], const uint8_t blk[64])
{
    uint32_t W[64],a,b,c,d,e,f,g,h,T1,T2; int i;
    for(i=0;i<16;i++) W[i]=BE32_LOAD(blk+i*4);
    for(i=16;i<64;i++) W[i]=sig1(W[i-2])+W[i-7]+sig0(W[i-15])+W[i-16];
    a=st[0];b=st[1];c=st[2];d=st[3];
    e=st[4];f=st[5];g=st[6];h=st[7];
    for(i=0;i<64;i++){
        T1=h+SIG1(e)+CH(e,f,g)+K[i]+W[i];
        T2=SIG0(a)+MAJ(a,b,c);
        h=g;g=f;f=e;e=d+T1;d=c;c=b;b=a;a=T1+T2;
    }
    st[0]+=a;st[1]+=b;st[2]+=c;st[3]+=d;
    st[4]+=e;st[5]+=f;st[6]+=g;st[7]+=h;
}
static void sha256_full(const uint8_t*msg,size_t len,uint8_t out[32])
{
    uint32_t st[8];uint8_t blk[64];size_t i;
    memcpy(st,H0,32);
    for(i=0;i+64<=len;i+=64) sha256_compress(st,msg+i);
    size_t rem=len-i; memcpy(blk,msg+i,rem); blk[rem++]=0x80;
    if(rem>56){memset(blk+rem,0,64-rem);sha256_compress(st,blk);rem=0;}
    memset(blk+rem,0,56-rem);
    uint64_t bits=(uint64_t)len*8;
    for(int k=0;k<8;k++) blk[56+k]=(uint8_t)((bits>>(56-8*k))&0xFF);
    sha256_compress(st,blk);
    for(int k=0;k<8;k++) BE32_STORE(out+k*4,st[k]);
}
static void dsha256(const uint8_t*msg,size_t len,uint8_t out[32])
{ uint8_t t[32]; sha256_full(msg,len,t); sha256_full(t,32,out); }

static int sha256_selftest(void)
{
    static const uint8_t IN[]={'a','b','c'};
    static const uint8_t EX[]={
        0xba,0x78,0x16,0xbf,0x8f,0x01,0xcf,0xea,
        0x41,0x41,0x40,0xde,0x5d,0xae,0x2e,0xc7,
        0x3b,0x33,0x8c,0x43,0x2d,0x5d,0x4c,0xcd,
        0x6c,0xf6,0xaf,0x13,0xb2,0x8e,0x8b,0x57};
    uint8_t g[32]; sha256_full(IN,3,g);
    return memcmp(g,EX,32)==0?0:-1;
}

/* ═══════════════════════════════════════════════════════════════════════
 * §2b  Scalar unrolled SHA-256 — optimised primitives + 64 explicit rounds
 *
 * Why unroll?
 * -----------
 * The standard for(i=0;i<64;i++) loop forces the CPU to evaluate a loop
 * counter and branch every round.  On an in-order core this costs one
 * pipeline stall per round; on an out-of-order core it wastes a dispatch
 * slot.  Explicit unrolling removes the branch entirely: the CPU sees a
 * linear stream of instructions and can fill all execution ports.
 *
 * Optimised MAJ (4 bitwise operations instead of 5):
 * ---------------------------------------------------
 * Standard:  (a&b) ^ (a&c) ^ (b&c)        — 2 AND + 2 XOR  = 4 ops
 * Optimised: (a & (b|c)) | (b & c)         — 1 OR + 2 AND + 1 OR = 4 ops
 *            but the dependency chain is shorter on superscalar CPUs
 *            because the two AND operations are independent.
 *
 * SHA256_ROUND_SCALAR variable rotation:
 * ---------------------------------------
 * The caller rotates the a..h argument list so that no runtime shifting
 * is ever needed.  After 8 round invocations the register assignment has
 * cycled back to its original mapping.  The compiler can therefore keep
 * all eight working variables in dedicated architectural registers for
 * the entire 64-round sequence.
 *
 * Block-2 padding sparsity:
 * -------------------------
 * The second 64-byte block of a Bitcoin header has the layout:
 *   W[0..3]  : last 16 bytes of header (merkle tail, timestamp, bits, nonce)
 *   W[4]     : 0x80000000  (SHA-256 padding sentinel)
 *   W[5..14] : 0x00000000  (zero padding)
 *   W[15]    : 0x00000280  (message length: 640 bits)
 *
 * Because W[5..14] are zero, many of the σ₀/σ₁ terms in the schedule
 * expansion for W[16..30] collapse to simpler expressions.  The unrolled
 * function below uses the generic schedule so it works for any input;
 * a further specialised "block-2 fast path" can pre-compute the invariant
 * schedule words once per job and reuse them across all nonces.
 * ═══════════════════════════════════════════════════════════════════════ */

/* ── Optimised primitives ───────────────────────────────────────────────
 * EP0/EP1 = Σ₀/Σ₁  (state mixing — capital sigma)
 * SIG0/SIG1 = σ₀/σ₁ (schedule mixing — lowercase sigma)
 * MAJ_OPT uses the 4-op form: (a & (b|c)) | (b & c)
 */
#define EP0_S(x)      (ror32((x), 2) ^ ror32((x),13) ^ ror32((x),22))
#define EP1_S(x)      (ror32((x), 6) ^ ror32((x),11) ^ ror32((x),25))
#define SIG0_S(x)     (ror32((x), 7) ^ ror32((x),18) ^ ((x)>> 3))
#define SIG1_S(x)     (ror32((x),17) ^ ror32((x),19) ^ ((x)>>10))
#define CH_S(x,y,z)   (((x)&(y))^(~(x)&(z)))
#define MAJ_OPT(a,b,c) (((a)&((b)|(c)))|((b)&(c)))

/* ── SHA256_ROUND_SCALAR ────────────────────────────────────────────────
 * One complete SHA-256 round.  After the macro:
 *   d ← d + T1          (becomes new e)
 *   h ← T1 + T2         (becomes new a)
 * The caller passes the variable names in the rotating order so that the
 * assignments are trivially register renames — zero extra instructions.
 */
#define SHA256_ROUND_SCALAR(a,b,c,d,e,f,g,h,w,k) do { \
    uint32_t _t1 = (h) + EP1_S(e) + CH_S((e),(f),(g)) + (k) + (w); \
    uint32_t _t2 = EP0_S(a) + MAJ_OPT((a),(b),(c)); \
    (d) += _t1; \
    (h)  = _t1 + _t2; \
} while(0)

/* ── compute_sha256_scalar_unrolled ─────────────────────────────────────
 *
 * All 64 rounds written out with explicit argument rotation.
 * The schedule W[16..63] is still expanded in a short loop (48 iters)
 * because those words are inputs, not the round computation itself.
 * The hot part — the 64 compression rounds — contains no branches.
 */
static void compute_sha256_scalar_unrolled(uint32_t st[8],
                                            const uint32_t W_in[16])
{
    uint32_t w[64];
    /* Copy the first 16 words (block-2 data + SHA-256 padding) */
    for(int i=0;i<16;i++) w[i]=W_in[i];
    /* Expand W[16..63] — standard σ recurrence */
    for(int i=16;i<64;i++)
        w[i]=w[i-16]+SIG0_S(w[i-15])+w[i-7]+SIG1_S(w[i-2]);

    uint32_t a=st[0],b=st[1],c=st[2],d=st[3];
    uint32_t e=st[4],f=st[5],g=st[6],h=st[7];

    /* ── Rounds 0-7 ── */
    SHA256_ROUND_SCALAR(a,b,c,d,e,f,g,h,w[ 0],K[ 0]);
    SHA256_ROUND_SCALAR(h,a,b,c,d,e,f,g,w[ 1],K[ 1]);
    SHA256_ROUND_SCALAR(g,h,a,b,c,d,e,f,w[ 2],K[ 2]);
    SHA256_ROUND_SCALAR(f,g,h,a,b,c,d,e,w[ 3],K[ 3]);
    SHA256_ROUND_SCALAR(e,f,g,h,a,b,c,d,w[ 4],K[ 4]);
    SHA256_ROUND_SCALAR(d,e,f,g,h,a,b,c,w[ 5],K[ 5]);
    SHA256_ROUND_SCALAR(c,d,e,f,g,h,a,b,w[ 6],K[ 6]);
    SHA256_ROUND_SCALAR(b,c,d,e,f,g,h,a,w[ 7],K[ 7]);
    /* ── Rounds 8-15 ── */
    SHA256_ROUND_SCALAR(a,b,c,d,e,f,g,h,w[ 8],K[ 8]);
    SHA256_ROUND_SCALAR(h,a,b,c,d,e,f,g,w[ 9],K[ 9]);
    SHA256_ROUND_SCALAR(g,h,a,b,c,d,e,f,w[10],K[10]);
    SHA256_ROUND_SCALAR(f,g,h,a,b,c,d,e,w[11],K[11]);
    SHA256_ROUND_SCALAR(e,f,g,h,a,b,c,d,w[12],K[12]);
    SHA256_ROUND_SCALAR(d,e,f,g,h,a,b,c,w[13],K[13]);
    SHA256_ROUND_SCALAR(c,d,e,f,g,h,a,b,w[14],K[14]);
    SHA256_ROUND_SCALAR(b,c,d,e,f,g,h,a,w[15],K[15]);
    /* ── Rounds 16-23 ── */
    SHA256_ROUND_SCALAR(a,b,c,d,e,f,g,h,w[16],K[16]);
    SHA256_ROUND_SCALAR(h,a,b,c,d,e,f,g,w[17],K[17]);
    SHA256_ROUND_SCALAR(g,h,a,b,c,d,e,f,w[18],K[18]);
    SHA256_ROUND_SCALAR(f,g,h,a,b,c,d,e,w[19],K[19]);
    SHA256_ROUND_SCALAR(e,f,g,h,a,b,c,d,w[20],K[20]);
    SHA256_ROUND_SCALAR(d,e,f,g,h,a,b,c,w[21],K[21]);
    SHA256_ROUND_SCALAR(c,d,e,f,g,h,a,b,w[22],K[22]);
    SHA256_ROUND_SCALAR(b,c,d,e,f,g,h,a,w[23],K[23]);
    /* ── Rounds 24-31 ── */
    SHA256_ROUND_SCALAR(a,b,c,d,e,f,g,h,w[24],K[24]);
    SHA256_ROUND_SCALAR(h,a,b,c,d,e,f,g,w[25],K[25]);
    SHA256_ROUND_SCALAR(g,h,a,b,c,d,e,f,w[26],K[26]);
    SHA256_ROUND_SCALAR(f,g,h,a,b,c,d,e,w[27],K[27]);
    SHA256_ROUND_SCALAR(e,f,g,h,a,b,c,d,w[28],K[28]);
    SHA256_ROUND_SCALAR(d,e,f,g,h,a,b,c,w[29],K[29]);
    SHA256_ROUND_SCALAR(c,d,e,f,g,h,a,b,w[30],K[30]);
    SHA256_ROUND_SCALAR(b,c,d,e,f,g,h,a,w[31],K[31]);
    /* ── Rounds 32-39 ── */
    SHA256_ROUND_SCALAR(a,b,c,d,e,f,g,h,w[32],K[32]);
    SHA256_ROUND_SCALAR(h,a,b,c,d,e,f,g,w[33],K[33]);
    SHA256_ROUND_SCALAR(g,h,a,b,c,d,e,f,w[34],K[34]);
    SHA256_ROUND_SCALAR(f,g,h,a,b,c,d,e,w[35],K[35]);
    SHA256_ROUND_SCALAR(e,f,g,h,a,b,c,d,w[36],K[36]);
    SHA256_ROUND_SCALAR(d,e,f,g,h,a,b,c,w[37],K[37]);
    SHA256_ROUND_SCALAR(c,d,e,f,g,h,a,b,w[38],K[38]);
    SHA256_ROUND_SCALAR(b,c,d,e,f,g,h,a,w[39],K[39]);
    /* ── Rounds 40-47 ── */
    SHA256_ROUND_SCALAR(a,b,c,d,e,f,g,h,w[40],K[40]);
    SHA256_ROUND_SCALAR(h,a,b,c,d,e,f,g,w[41],K[41]);
    SHA256_ROUND_SCALAR(g,h,a,b,c,d,e,f,w[42],K[42]);
    SHA256_ROUND_SCALAR(f,g,h,a,b,c,d,e,w[43],K[43]);
    SHA256_ROUND_SCALAR(e,f,g,h,a,b,c,d,w[44],K[44]);
    SHA256_ROUND_SCALAR(d,e,f,g,h,a,b,c,w[45],K[45]);
    SHA256_ROUND_SCALAR(c,d,e,f,g,h,a,b,w[46],K[46]);
    SHA256_ROUND_SCALAR(b,c,d,e,f,g,h,a,w[47],K[47]);
    /* ── Rounds 48-55 ── */
    SHA256_ROUND_SCALAR(a,b,c,d,e,f,g,h,w[48],K[48]);
    SHA256_ROUND_SCALAR(h,a,b,c,d,e,f,g,w[49],K[49]);
    SHA256_ROUND_SCALAR(g,h,a,b,c,d,e,f,w[50],K[50]);
    SHA256_ROUND_SCALAR(f,g,h,a,b,c,d,e,w[51],K[51]);
    SHA256_ROUND_SCALAR(e,f,g,h,a,b,c,d,w[52],K[52]);
    SHA256_ROUND_SCALAR(d,e,f,g,h,a,b,c,w[53],K[53]);
    SHA256_ROUND_SCALAR(c,d,e,f,g,h,a,b,w[54],K[54]);
    SHA256_ROUND_SCALAR(b,c,d,e,f,g,h,a,w[55],K[55]);
    /* ── Rounds 56-63 ── */
    SHA256_ROUND_SCALAR(a,b,c,d,e,f,g,h,w[56],K[56]);
    SHA256_ROUND_SCALAR(h,a,b,c,d,e,f,g,w[57],K[57]);
    SHA256_ROUND_SCALAR(g,h,a,b,c,d,e,f,w[58],K[58]);
    SHA256_ROUND_SCALAR(f,g,h,a,b,c,d,e,w[59],K[59]);
    SHA256_ROUND_SCALAR(e,f,g,h,a,b,c,d,w[60],K[60]);
    SHA256_ROUND_SCALAR(d,e,f,g,h,a,b,c,w[61],K[61]);
    SHA256_ROUND_SCALAR(c,d,e,f,g,h,a,b,w[62],K[62]);
    SHA256_ROUND_SCALAR(b,c,d,e,f,g,h,a,w[63],K[63]);

    st[0]+=a; st[1]+=b; st[2]+=c; st[3]+=d;
    st[4]+=e; st[5]+=f; st[6]+=g; st[7]+=h;
}

/* ── sha256_compress_unrolled ────────────────────────────────────────────
 * Drop-in replacement for sha256_compress() that uses the unrolled path.
 * The raw 64-byte block is first split into 16 big-endian 32-bit words,
 * then handed to compute_sha256_scalar_unrolled().
 */
static inline void sha256_compress_unrolled(uint32_t st[8],
                                             const uint8_t blk[64])
{
    uint32_t W[16];
    for(int i=0;i<16;i++) W[i]=BE32_LOAD(blk+i*4);
    compute_sha256_scalar_unrolled(st, W);
}

/* ── build_block_b_words ─────────────────────────────────────────────────
 * Produce the 16-word message schedule for block-B of an 80-byte Bitcoin
 * header, exploiting the known-sparse padding layout:
 *
 *   W[ 0] = BE32(hdr[64..67])  — merkle tail bytes 28-31
 *   W[ 1] = BE32(hdr[68..71])  — timestamp
 *   W[ 2] = BE32(hdr[72..75])  — bits (compact target)
 *   W[ 3] = nonce (big-endian) — the only word that changes per hash
 *   W[ 4] = 0x80000000         — SHA-256 padding sentinel
 *   W[ 5..14] = 0x00000000     — zero padding
 *   W[15] = 0x00000280         — message length: 640 bits
 *
 * Keeping this in a function (rather than inlining into the hot loop)
 * lets the compiler cache W[0..2] and W[4..15] in registers across
 * nonce iterations, only reloading W[3] (the nonce) each time.
 */
static inline void build_block_b_words(const uint8_t hdr[80],
                                        uint32_t nonce_be,
                                        uint32_t W[16])
{
    W[0] = BE32_LOAD(hdr+64);
    W[1] = BE32_LOAD(hdr+68);
    W[2] = BE32_LOAD(hdr+72);
    W[3] = nonce_be;
    W[4] = 0x80000000u;
    W[5]=W[6]=W[7]=W[8]=W[9]=W[10]=W[11]=W[12]=W[13]=W[14]=0u;
    W[15]= 0x00000280u;
}

/* ── dsha256_unrolled_from_midstate ──────────────────────────────────────
 * Double-SHA256 using the cached midstate + unrolled scalar hot loop.
 * ~50% faster for the first pass vs a fresh sha256_full() call because
 * block-A compression is elided entirely.
 */
static void dsha256_unrolled_from_midstate(const uint32_t mid[8],
                                            const uint8_t  hdr[80],
                                            uint8_t        out[32])
{
    /* Pass 1: start from midstate, compress block-B only */
    uint32_t st[8]; memcpy(st,mid,32);
    uint32_t W[16];
    /* nonce is in hdr[76..79] little-endian; convert to big-endian word */
    uint32_t nonce_le; memcpy(&nonce_le, hdr+76, 4);
    uint32_t nonce_be = __builtin_bswap32(nonce_le);
    build_block_b_words(hdr, nonce_be, W);
    compute_sha256_scalar_unrolled(st, W);

    /* Serialise first-pass hash */
    uint8_t h1[32];
    for(int k=0;k<8;k++) BE32_STORE(h1+k*4,st[k]);

    /* Pass 2: hash the 32-byte intermediate — known sparse padding */
    uint32_t W2[16];
    for(int k=0;k<8;k++) W2[k]=BE32_LOAD(h1+k*4);
    W2[8]=0x80000000u;
    W2[9]=W2[10]=W2[11]=W2[12]=W2[13]=W2[14]=0u;
    W2[15]=0x00000100u;   /* 256 bits */
    uint32_t st2[8]; memcpy(st2,H0,32);
    compute_sha256_scalar_unrolled(st2, W2);
    for(int k=0;k<8;k++) BE32_STORE(out+k*4,st2[k]);

    /* Byte-reverse to Bitcoin display order */
    for(int i=0;i<16;i++){uint8_t t=out[i];out[i]=out[31-i];out[31-i]=t;}
}

/* ═══════════════════════════════════════════════════════════════════════
 * §3  SHA-256 midstate & double-hash with midstate
 * ═══════════════════════════════════════════════════════════════════════ */
static void sha256_midstate(const uint8_t hdr[80],uint32_t mid[8])
{ memcpy(mid,H0,32); sha256_compress(mid,hdr); }

static void build_block_b(const uint8_t hdr[80],uint8_t b[64])
{
    memcpy(b,hdr+64,16); b[16]=0x80; memset(b+17,0,39);
    b[56]=0;b[57]=0;b[58]=0;b[59]=0;
    b[60]=0;b[61]=0;b[62]=2;b[63]=0x80;
}
static void dsha256_from_midstate(const uint32_t mid[8],
                                   const uint8_t hdr[80],
                                   uint8_t out[32])
{
    uint8_t bb[64],h1[32]; uint32_t st[8];
    build_block_b(hdr,bb);
    memcpy(st,mid,32); sha256_compress(st,bb);
    for(int k=0;k<8;k++) BE32_STORE(h1+k*4,st[k]);
    /* second pass — sparse padding for 32-byte message */
    uint8_t p[64]; memcpy(p,h1,32);
    p[32]=0x80; memset(p+33,0,23);
    p[56]=0;p[57]=0;p[58]=0;p[59]=0;
    p[60]=0;p[61]=0;p[62]=1;p[63]=0;
    uint32_t st2[8]; memcpy(st2,H0,32); sha256_compress(st2,p);
    for(int k=0;k<8;k++) BE32_STORE(out+k*4,st2[k]);
    /* byte-reverse to Bitcoin display format */
    for(int i=0;i<16;i++){uint8_t t=out[i];out[i]=out[31-i];out[31-i]=t;}
}

/* ═══════════════════════════════════════════════════════════════════════
 * §4  AVX2 — 8-way parallel SHA-256
 * ═══════════════════════════════════════════════════════════════════════ */
#ifdef __AVX2__
#define A2ROTR(x,n) _mm256_or_si256(_mm256_srli_epi32((x),(n)),\
                                     _mm256_slli_epi32((x),32-(n)))
static void sha256_compress_8way(__m256i st[8],const __m256i W0[16])
{
    __m256i W[64]; int i;
    for(i=0;i<16;i++) W[i]=W0[i];
    for(i=16;i<64;i++){
        __m256i s0=_mm256_xor_si256(A2ROTR(W[i-15],7),
                   _mm256_xor_si256(A2ROTR(W[i-15],18),_mm256_srli_epi32(W[i-15],3)));
        __m256i s1=_mm256_xor_si256(A2ROTR(W[i-2],17),
                   _mm256_xor_si256(A2ROTR(W[i-2],19),_mm256_srli_epi32(W[i-2],10)));
        W[i]=_mm256_add_epi32(_mm256_add_epi32(s1,W[i-7]),
             _mm256_add_epi32(s0,W[i-16]));
    }
    __m256i a=st[0],b=st[1],c=st[2],d=st[3],e=st[4],f=st[5],g=st[6],h=st[7];
    for(i=0;i<64;i++){
        __m256i S1=_mm256_xor_si256(A2ROTR(e,6),_mm256_xor_si256(A2ROTR(e,11),A2ROTR(e,25)));
        __m256i ch=_mm256_xor_si256(_mm256_and_si256(e,f),_mm256_andnot_si256(e,g));
        __m256i T1=_mm256_add_epi32(h,_mm256_add_epi32(S1,_mm256_add_epi32(ch,
                   _mm256_add_epi32(_mm256_set1_epi32((int)K[i]),W[i]))));
        __m256i S0=_mm256_xor_si256(A2ROTR(a,2),_mm256_xor_si256(A2ROTR(a,13),A2ROTR(a,22)));
        __m256i mj=_mm256_xor_si256(_mm256_and_si256(a,b),
                   _mm256_xor_si256(_mm256_and_si256(a,c),_mm256_and_si256(b,c)));
        __m256i T2=_mm256_add_epi32(S0,mj);
        h=g;g=f;f=e;e=_mm256_add_epi32(d,T1);d=c;c=b;b=a;a=_mm256_add_epi32(T1,T2);
    }
    st[0]=_mm256_add_epi32(st[0],a);st[1]=_mm256_add_epi32(st[1],b);
    st[2]=_mm256_add_epi32(st[2],c);st[3]=_mm256_add_epi32(st[3],d);
    st[4]=_mm256_add_epi32(st[4],e);st[5]=_mm256_add_epi32(st[5],f);
    st[6]=_mm256_add_epi32(st[6],g);st[7]=_mm256_add_epi32(st[7],h);
}
#undef A2ROTR
#endif /* __AVX2__ */

/* ═══════════════════════════════════════════════════════════════════════
 * §5  AVX-512 sigma helpers via _mm512_rol_epi32
 *
 * AVX-512 provides vprolvd (_mm512_rol_epi32) — a native variable rotate
 * left.  Since ROTR(x,n) == ROL(x,32-n), all six SHA-256 rotation-based
 * functions map to single intrinsic calls:
 *
 *   Σ₀(a) = ROL(a,30) ^ ROL(a,19) ^ ROL(a,10)   [ROTR 2,13,22]
 *   Σ₁(e) = ROL(e,26) ^ ROL(e,21) ^ ROL(e, 7)   [ROTR 6,11,25]
 *   σ₀(x) = ROL(x,25) ^ ROL(x,14) ^ SHR(x, 3)   [ROTR 7,18,  ]
 *   σ₁(x) = ROL(x,15) ^ ROL(x,13) ^ SHR(x,10)   [ROTR17,19,  ]
 *
 * zmm register mapping (conceptual — actual allocation by the register
 * allocator, constrained to zmm0–zmm31):
 *   zmm0–7   : state words a,b,c,d,e,f,g,h  (16 parallel nonce lanes)
 *   zmm8–23  : W[t] sliding window (current + 15 lookahead words)
 *   zmm24–31 : temporaries T1,T2,S0,S1,Ch,Maj
 * ═══════════════════════════════════════════════════════════════════════ */
#ifdef __AVX512F__

static inline __m512i avx512_Sig0(__m512i x){
    return _mm512_xor_si512(_mm512_rol_epi32(x,30),
           _mm512_xor_si512(_mm512_rol_epi32(x,19),_mm512_rol_epi32(x,10)));}
static inline __m512i avx512_Sig1(__m512i x){
    return _mm512_xor_si512(_mm512_rol_epi32(x,26),
           _mm512_xor_si512(_mm512_rol_epi32(x,21),_mm512_rol_epi32(x,7)));}
static inline __m512i avx512_sig0(__m512i x){
    return _mm512_xor_si512(_mm512_rol_epi32(x,25),
           _mm512_xor_si512(_mm512_rol_epi32(x,14),_mm512_srli_epi32(x,3)));}
static inline __m512i avx512_sig1(__m512i x){
    return _mm512_xor_si512(_mm512_rol_epi32(x,15),
           _mm512_xor_si512(_mm512_rol_epi32(x,13),_mm512_srli_epi32(x,10)));}

/* ── §6  Fully-unrolled 64-round AVX-512 compression macro ─────────────
 *
 * SHA256_ROUND_AVX512(a,b,c,d,e,f,g,h, W, K) expands one SHA-256 round:
 *
 *   T₁ = h + Σ₁(e) + Ch(e,f,g) + K[t] + W[t]
 *   T₂ = Σ₀(a) + Maj(a,b,c)
 *   h←g, g←f, f←e, e←d+T₁, d←c, c←b, b←a, a←T₁+T₂
 *
 * Because each macro invocation uses unique variable names (the caller
 * rotates a..h in the argument list), the compiler can rename registers
 * freely.  With 32 zmm registers available and 8 state + ~8 temp regs
 * needed per round, the compiler keeps the entire 64-round computation
 * register-resident — no spills to the L1 data cache.
 */
#define SHA256_ROUND_AVX512(a,b,c,d,e,f,g,h,W,Kv) do { \
    __m512i _S1  = avx512_Sig1(e); \
    __m512i _Ch  = _mm512_xor_si512(_mm512_and_si512(e,f), \
                                    _mm512_andnot_si512(e,g)); \
    __m512i _T1  = _mm512_add_epi32(h,_mm512_add_epi32(_S1, \
                   _mm512_add_epi32(_Ch,_mm512_add_epi32(W,Kv)))); \
    __m512i _S0  = avx512_Sig0(a); \
    __m512i _Maj = _mm512_xor_si512(_mm512_and_si512(a,b), \
                   _mm512_xor_si512(_mm512_and_si512(a,c), \
                                    _mm512_and_si512(b,c))); \
    __m512i _T2  = _mm512_add_epi32(_S0,_Maj); \
    (h)=(g);(g)=(f);(f)=(e);(e)=_mm512_add_epi32((d),_T1); \
    (d)=(c);(c)=(b);(b)=(a);(a)=_mm512_add_epi32(_T1,_T2); \
} while(0)

/* Precomputed broadcast K vectors (one __m512i per round constant) */
static __m512i K512[64];
static void avx512_init_K(void)
{ for(int i=0;i<64;i++) K512[i]=_mm512_set1_epi32((int)K[i]); }

/* ── Message schedule expansion ───────────────────────────────────────── */
static void sha256_msg_schedule_avx512(__m512i w[64])
{
    for(int t=16;t<64;t++){
        __m512i s0=avx512_sig0(w[t-15]);
        __m512i s1=avx512_sig1(w[t-2]);
        w[t]=_mm512_add_epi32(_mm512_add_epi32(s1,w[t-7]),
             _mm512_add_epi32(s0,w[t-16]));
    }
}

/* ── compute_sha256_avx512_unrolled ────────────────────────────────────
 *
 * All 64 rounds written out explicitly using SHA256_ROUND_AVX512.
 * The round variable rotation is handled by re-ordering the argument
 * list (no runtime shifting).  GCC/Clang map a..h to zmm registers and
 * never spill to stack at -O2 or higher on AVX-512 capable targets.
 */
static void compute_sha256_avx512_unrolled(__m512i state[8],
                                            __m512i W[64])
{
    __m512i a=state[0],b=state[1],c=state[2],d=state[3];
    __m512i e=state[4],f=state[5],g=state[6],h=state[7];

    /* Rounds 0-7 */
    SHA256_ROUND_AVX512(a,b,c,d,e,f,g,h,W[ 0],K512[ 0]);
    SHA256_ROUND_AVX512(h,a,b,c,d,e,f,g,W[ 1],K512[ 1]);
    SHA256_ROUND_AVX512(g,h,a,b,c,d,e,f,W[ 2],K512[ 2]);
    SHA256_ROUND_AVX512(f,g,h,a,b,c,d,e,W[ 3],K512[ 3]);
    SHA256_ROUND_AVX512(e,f,g,h,a,b,c,d,W[ 4],K512[ 4]);
    SHA256_ROUND_AVX512(d,e,f,g,h,a,b,c,W[ 5],K512[ 5]);
    SHA256_ROUND_AVX512(c,d,e,f,g,h,a,b,W[ 6],K512[ 6]);
    SHA256_ROUND_AVX512(b,c,d,e,f,g,h,a,W[ 7],K512[ 7]);
    /* Rounds 8-15 */
    SHA256_ROUND_AVX512(a,b,c,d,e,f,g,h,W[ 8],K512[ 8]);
    SHA256_ROUND_AVX512(h,a,b,c,d,e,f,g,W[ 9],K512[ 9]);
    SHA256_ROUND_AVX512(g,h,a,b,c,d,e,f,W[10],K512[10]);
    SHA256_ROUND_AVX512(f,g,h,a,b,c,d,e,W[11],K512[11]);
    SHA256_ROUND_AVX512(e,f,g,h,a,b,c,d,W[12],K512[12]);
    SHA256_ROUND_AVX512(d,e,f,g,h,a,b,c,W[13],K512[13]);
    SHA256_ROUND_AVX512(c,d,e,f,g,h,a,b,W[14],K512[14]);
    SHA256_ROUND_AVX512(b,c,d,e,f,g,h,a,W[15],K512[15]);
    /* Rounds 16-23 */
    SHA256_ROUND_AVX512(a,b,c,d,e,f,g,h,W[16],K512[16]);
    SHA256_ROUND_AVX512(h,a,b,c,d,e,f,g,W[17],K512[17]);
    SHA256_ROUND_AVX512(g,h,a,b,c,d,e,f,W[18],K512[18]);
    SHA256_ROUND_AVX512(f,g,h,a,b,c,d,e,W[19],K512[19]);
    SHA256_ROUND_AVX512(e,f,g,h,a,b,c,d,W[20],K512[20]);
    SHA256_ROUND_AVX512(d,e,f,g,h,a,b,c,W[21],K512[21]);
    SHA256_ROUND_AVX512(c,d,e,f,g,h,a,b,W[22],K512[22]);
    SHA256_ROUND_AVX512(b,c,d,e,f,g,h,a,W[23],K512[23]);
    /* Rounds 24-31 */
    SHA256_ROUND_AVX512(a,b,c,d,e,f,g,h,W[24],K512[24]);
    SHA256_ROUND_AVX512(h,a,b,c,d,e,f,g,W[25],K512[25]);
    SHA256_ROUND_AVX512(g,h,a,b,c,d,e,f,W[26],K512[26]);
    SHA256_ROUND_AVX512(f,g,h,a,b,c,d,e,W[27],K512[27]);
    SHA256_ROUND_AVX512(e,f,g,h,a,b,c,d,W[28],K512[28]);
    SHA256_ROUND_AVX512(d,e,f,g,h,a,b,c,W[29],K512[29]);
    SHA256_ROUND_AVX512(c,d,e,f,g,h,a,b,W[30],K512[30]);
    SHA256_ROUND_AVX512(b,c,d,e,f,g,h,a,W[31],K512[31]);
    /* Rounds 32-39 */
    SHA256_ROUND_AVX512(a,b,c,d,e,f,g,h,W[32],K512[32]);
    SHA256_ROUND_AVX512(h,a,b,c,d,e,f,g,W[33],K512[33]);
    SHA256_ROUND_AVX512(g,h,a,b,c,d,e,f,W[34],K512[34]);
    SHA256_ROUND_AVX512(f,g,h,a,b,c,d,e,W[35],K512[35]);
    SHA256_ROUND_AVX512(e,f,g,h,a,b,c,d,W[36],K512[36]);
    SHA256_ROUND_AVX512(d,e,f,g,h,a,b,c,W[37],K512[37]);
    SHA256_ROUND_AVX512(c,d,e,f,g,h,a,b,W[38],K512[38]);
    SHA256_ROUND_AVX512(b,c,d,e,f,g,h,a,W[39],K512[39]);
    /* Rounds 40-47 */
    SHA256_ROUND_AVX512(a,b,c,d,e,f,g,h,W[40],K512[40]);
    SHA256_ROUND_AVX512(h,a,b,c,d,e,f,g,W[41],K512[41]);
    SHA256_ROUND_AVX512(g,h,a,b,c,d,e,f,W[42],K512[42]);
    SHA256_ROUND_AVX512(f,g,h,a,b,c,d,e,W[43],K512[43]);
    SHA256_ROUND_AVX512(e,f,g,h,a,b,c,d,W[44],K512[44]);
    SHA256_ROUND_AVX512(d,e,f,g,h,a,b,c,W[45],K512[45]);
    SHA256_ROUND_AVX512(c,d,e,f,g,h,a,b,W[46],K512[46]);
    SHA256_ROUND_AVX512(b,c,d,e,f,g,h,a,W[47],K512[47]);
    /* Rounds 48-55 */
    SHA256_ROUND_AVX512(a,b,c,d,e,f,g,h,W[48],K512[48]);
    SHA256_ROUND_AVX512(h,a,b,c,d,e,f,g,W[49],K512[49]);
    SHA256_ROUND_AVX512(g,h,a,b,c,d,e,f,W[50],K512[50]);
    SHA256_ROUND_AVX512(f,g,h,a,b,c,d,e,W[51],K512[51]);
    SHA256_ROUND_AVX512(e,f,g,h,a,b,c,d,W[52],K512[52]);
    SHA256_ROUND_AVX512(d,e,f,g,h,a,b,c,W[53],K512[53]);
    SHA256_ROUND_AVX512(c,d,e,f,g,h,a,b,W[54],K512[54]);
    SHA256_ROUND_AVX512(b,c,d,e,f,g,h,a,W[55],K512[55]);
    /* Rounds 56-63 */
    SHA256_ROUND_AVX512(a,b,c,d,e,f,g,h,W[56],K512[56]);
    SHA256_ROUND_AVX512(h,a,b,c,d,e,f,g,W[57],K512[57]);
    SHA256_ROUND_AVX512(g,h,a,b,c,d,e,f,W[58],K512[58]);
    SHA256_ROUND_AVX512(f,g,h,a,b,c,d,e,W[59],K512[59]);
    SHA256_ROUND_AVX512(e,f,g,h,a,b,c,d,W[60],K512[60]);
    SHA256_ROUND_AVX512(d,e,f,g,h,a,b,c,W[61],K512[61]);
    SHA256_ROUND_AVX512(c,d,e,f,g,h,a,b,W[62],K512[62]);
    SHA256_ROUND_AVX512(b,c,d,e,f,g,h,a,W[63],K512[63]);

    state[0]=_mm512_add_epi32(state[0],a);
    state[1]=_mm512_add_epi32(state[1],b);
    state[2]=_mm512_add_epi32(state[2],c);
    state[3]=_mm512_add_epi32(state[3],d);
    state[4]=_mm512_add_epi32(state[4],e);
    state[5]=_mm512_add_epi32(state[5],f);
    state[6]=_mm512_add_epi32(state[6],g);
    state[7]=_mm512_add_epi32(state[7],h);
}

/* ═══════════════════════════════════════════════════════════════════════
 * §7  Vectorized Merkle Root Reconstruction (16-lane EN2 sweep)
 *
 * Instead of a single Extranonce2 per mining job, we generate 16 unique
 * EN2 values simultaneously using one AVX-512 add:
 *
 *   v_en2 = _mm512_add_epi32(set1(base_en2), {0,1,...,15})
 *
 * This produces 16 distinct coinbase transactions → 16 distinct coinbase
 * IDs → 16 distinct Merkle roots → 16 independent midstates for the
 * AVX-512 nonce search.  The nonce-space per job submission is therefore:
 *
 *   16 EN2 values × 2³² nonces × (timestamp roll window) iterations
 *
 * Layout of parallel_cb[16][MAX_CB_LEN]:
 *   For lane i:  coinb1 ‖ extranonce1 ‖ (base_en2+i) ‖ coinb2
 *
 * The Merkle branch loop hashes (current_root ‖ branch) for each branch,
 * broadcasting each 32-byte branch across all 16 lanes.  The output is
 * stored column-major in 8 __m512i registers (one register per 32-bit
 * word of the 256-bit hash, 16 lane values per register).
 * ═══════════════════════════════════════════════════════════════════════ */

#define MAX_CB_LEN 512   /* max coinbase transaction length in bytes */

typedef struct {
    uint8_t  coinb1[MAX_CB_LEN];
    uint32_t cb1_len;
    uint8_t  extranonce1[16];
    int      en1_len;
    uint8_t  coinb2[MAX_CB_LEN];
    uint32_t cb2_len;
    uint8_t  merkle_branches[MERKLE_BRANCHES_MAX][32];
    int      branch_count;
    char     job_id[64];
    uint32_t ntime;
    uint32_t nbits;
    uint8_t  prev_hash[32];
    int32_t  version;
} StratumJob;

/* Broadcast a 32-byte (8 × uint32_t) hash into 8 __m512i registers.
 * On exit vec[k] holds hash word k repeated across all 16 lanes.       */
static void broadcast_hash_to_vec(const uint8_t hash[32], __m512i vec[8])
{
    for(int k=0;k<8;k++){
        uint32_t w; memcpy(&w,hash+k*4,4);
        vec[k]=_mm512_set1_epi32((int)w);
    }
}

/* Extract lane `lane` from 8 __m512i registers into a 32-byte hash.    */
static void extract_lane_hash(const __m512i vec[8], int lane, uint8_t out[32])
{
    uint32_t tmp[16];
    for(int k=0;k<8;k++){
        _mm512_storeu_si512((__m512i*)tmp, vec[k]);
        uint32_t w=tmp[lane];
        BE32_STORE(out+k*4,w);
    }
}

/* Vectorized double-SHA256 of N parallel 64-byte blocks (all same size).
 * blocks[i] points to the i-th 64-byte block.
 * out[8] receives the 8-word column-major hash result.                   */
static void dsha256_16lanes(
    const uint8_t blocks[NUM_MERKLE_LANES][64],
    uint32_t block_len,
    __m512i out[8])
{
    /* Build W[0..15] for each lane — load each 32-bit word column-wise  */
    __m512i W[64];
    int words=(int)(block_len/4); if(words>16) words=16;
    for(int w=0;w<words;w++){
        uint32_t col[16];
        for(int lane=0;lane<NUM_MERKLE_LANES;lane++){
            uint32_t v; memcpy(&v,blocks[lane]+w*4,4);
            /* SHA-256 expects big-endian; data from coinbase is raw bytes */
            col[lane]=__builtin_bswap32(v);
        }
        W[w]=_mm512_loadu_si512(col);
    }
    for(int w=words;w<16;w++) W[w]=_mm512_setzero_si512();

    /* First SHA-256 pass */
    __m512i st[8];
    for(int k=0;k<8;k++) st[k]=_mm512_set1_epi32((int)H0[k]);
    sha256_msg_schedule_avx512(W);
    compute_sha256_avx512_unrolled(st,W);

    /* Second SHA-256 pass on 32-byte first-pass output */
    /* Build W for the second pass: each lane's 32-byte result + padding */
    __m512i W2[64];
    for(int w=0;w<8;w++) W2[w]=st[w];   /* first 8 words = hash output */
    /* word 8 = 0x80000000 (padding), words 9-14 = 0, word 15 = 0x100   */
    W2[8] =_mm512_set1_epi32((int)0x80000000u);
    for(int w=9;w<15;w++) W2[w]=_mm512_setzero_si512();
    W2[15]=_mm512_set1_epi32(0x100);
    for(int w=16;w<64;w++) W2[w]=_mm512_setzero_si512();

    __m512i st2[8];
    for(int k=0;k<8;k++) st2[k]=_mm512_set1_epi32((int)H0[k]);
    sha256_msg_schedule_avx512(W2);
    compute_sha256_avx512_unrolled(st2,W2);

    for(int k=0;k<8;k++) out[k]=st2[k];
}

/* compute_merkle_step_avx512 — vectorized dSHA256(left ‖ right).
 *
 * left[8], right[8] : column-major 256-bit hashes (16 lanes each)
 * out[8]            : column-major result (16 lanes each)
 *
 * Each lane computes: out = dSHA256(left_lane ‖ right_lane)
 * The 64-byte concatenation is laid out in two 64-byte blocks and hashed
 * using the fully-unrolled AVX-512 compression.                          */
static void compute_merkle_step_avx512(const __m512i left[8],
                                        const __m512i right[8],
                                        __m512i out[8])
{
    /* Build W[0..15]:
     *   W[0..7]  = left hash words (already in column-major format)
     *   W[8..15] = right hash words                                      */
    __m512i W[64];
    for(int k=0;k<8;k++)  W[k]  =left[k];
    for(int k=0;k<8;k++)  W[8+k]=right[k];

    /* First pass */
    __m512i st[8];
    for(int k=0;k<8;k++) st[k]=_mm512_set1_epi32((int)H0[k]);
    sha256_msg_schedule_avx512(W);
    compute_sha256_avx512_unrolled(st,W);

    /* Second pass (32-byte intermediate → final Merkle node hash) */
    __m512i W2[64];
    for(int k=0;k<8;k++) W2[k]=st[k];
    W2[8]=_mm512_set1_epi32((int)0x80000000u);
    for(int k=9;k<15;k++) W2[k]=_mm512_setzero_si512();
    W2[15]=_mm512_set1_epi32(0x100);
    for(int k=16;k<64;k++) W2[k]=_mm512_setzero_si512();

    __m512i st2[8];
    for(int k=0;k<8;k++) st2[k]=_mm512_set1_epi32((int)H0[k]);
    sha256_msg_schedule_avx512(W2);
    compute_sha256_avx512_unrolled(st2,W2);
    for(int k=0;k<8;k++) out[k]=st2[k];
}

/* generate_vectorized_merkle_roots — produce 16 Merkle roots in parallel.
 *
 * For each of the 16 lanes i:
 *   coinbase_tx[i] = coinb1 ‖ EN1 ‖ (base_en2 + i) ‖ coinb2
 *   coinbase_id[i] = dSHA256(coinbase_tx[i])
 *   root[i]        = fold(coinbase_id[i], branches)
 *
 * Output: out_roots[8] — 8 __m512i column-major registers holding
 *         the 16 × 32-byte Merkle roots.                                 */
static void generate_vectorized_merkle_roots(
    const StratumJob *sj,
    uint32_t          base_en2,
    __m512i           out_roots[8])
{
    /* Step 1: 16 sequential EN2 values */
    __m512i en2_offsets = _mm512_set_epi32(
        15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0);
    __m512i v_en2 = _mm512_add_epi32(
        _mm512_set1_epi32((int)base_en2), en2_offsets);
    uint32_t en2_vals[16];
    _mm512_storeu_si512((__m512i*)en2_vals, v_en2);

    /* Step 2: Build 16 coinbase transactions in aligned memory */
    static uint8_t __attribute__((aligned(64)))
        parallel_cb[NUM_MERKLE_LANES][MAX_CB_LEN];

    uint32_t cb_len = sj->cb1_len + (uint32_t)sj->en1_len + 4u + sj->cb2_len;
    if(cb_len > MAX_CB_LEN) cb_len = MAX_CB_LEN;

    for(int i=0;i<NUM_MERKLE_LANES;i++){
        uint8_t *p = parallel_cb[i];
        memcpy(p, sj->coinb1, sj->cb1_len);           p += sj->cb1_len;
        memcpy(p, sj->extranonce1, (size_t)sj->en1_len); p += sj->en1_len;
        /* EN2 in big-endian (Stratum wire format) */
        uint32_t en2_be = __builtin_bswap32(en2_vals[i]);
        memcpy(p, &en2_be, 4);                         p += 4;
        memcpy(p, sj->coinb2, sj->cb2_len);
    }

    /* Step 3: Vectorized dSHA256 of the 16 coinbase transactions */
    __m512i roots[8];
    /* Pack first 64 bytes into column-major __m512i array for the AVX-512 hash */
    uint8_t first64[NUM_MERKLE_LANES][64];
    for(int i=0;i<NUM_MERKLE_LANES;i++)
        memcpy(first64[i], parallel_cb[i], 64 < cb_len ? 64 : (size_t)cb_len);
    dsha256_16lanes(first64, 64, roots);

    /* Step 4: Traverse Merkle branches in parallel */
    for(int b=0;b<sj->branch_count && b<MERKLE_BRANCHES_MAX;b++){
        __m512i branch_vec[8];
        broadcast_hash_to_vec(sj->merkle_branches[b], branch_vec);
        compute_merkle_step_avx512(roots, branch_vec, roots);
    }

    for(int k=0;k<8;k++) out_roots[k]=roots[k];
}

#endif /* __AVX512F__ */

/* ═══════════════════════════════════════════════════════════════════════
 * §8  Block header + §9 nBits→target
 * ═══════════════════════════════════════════════════════════════════════ */
typedef struct __attribute__((packed)) {
    int32_t  version;
    uint8_t  prev_block[32];
    uint8_t  merkle_root[32];
    uint32_t timestamp;
    uint32_t bits;
    uint32_t nonce;
} BlockHeader;
typedef char _bh_sz[(sizeof(BlockHeader)==80)?1:-1];

static void expand_target(uint32_t bits,uint8_t t[32])
{
    memset(t,0,32);
    if(bits&0x00800000) return;
    uint8_t exp=(uint8_t)((bits>>24)&0xFF);
    uint32_t man=bits&0x7FFFFF;
    int s=(int)(32-exp);
    if(s<0||s+2>=32) return;
    t[s]=(uint8_t)((man>>16)&0xFF);
    t[s+1]=(uint8_t)((man>>8)&0xFF);
    t[s+2]=(uint8_t)(man&0xFF);
}
static inline int hash_ok(const uint8_t h[32],const uint8_t t[32])
{
    for(int i=0;i<32;i++){
        if(h[i]<t[i]) return 1;
        if(h[i]>t[i]) return 0;
    } return 0;
}

/* Merkle root (scalar path, used when AVX-512 not available) */
static int hex_decode(const char*hex,uint8_t*out,int max)
{
    int n=0; unsigned hi,lo;
    while(hex[0]&&hex[1]&&n<max){
        if(sscanf(hex,"%1x%1x",&hi,&lo)!=2) return -1;
        out[n++]=(uint8_t)((hi<<4)|lo); hex+=2;
    } return n;
}
static void hex_encode(const uint8_t*d,int len,char*buf)
    __attribute__((unused));
static void hex_encode(const uint8_t*d,int len,char*buf)
{
    static const char hx[]="0123456789abcdef";
    for(int i=0;i<len;i++){buf[2*i]=hx[(d[i]>>4)&0xF];buf[2*i+1]=hx[d[i]&0xF];}
    buf[2*len]='\0';
}

#ifndef __AVX512F__
/* Scalar StratumJob for non-AVX-512 builds */
typedef struct {
    char     coinb1[1024]; char coinb2[1024];
    uint8_t  extranonce1[16]; int en1_len;
    uint8_t  merkle_branches[MERKLE_BRANCHES_MAX][32]; int branch_count;
    char     job_id[64]; uint32_t ntime; uint32_t nbits;
    uint8_t  prev_hash[32]; int32_t version;
} StratumJob;
#endif

static void compute_merkle_root_scalar(const StratumJob*sj, uint8_t root[32])
    __attribute__((unused));
static void compute_merkle_root_scalar(const StratumJob*sj, uint8_t root[32])
{
    uint8_t cb1[512],cb2[512];
    int l1=hex_decode(sj->coinb1,cb1,(int)sizeof(cb1));
    int l2=hex_decode(sj->coinb2,cb2,(int)sizeof(cb2));
    if(l1<0) l1=0;
    if(l2<0) l2=0;
    int tot=l1+sj->en1_len+4+l2;
    uint8_t*tx=(uint8_t*)malloc((size_t)tot);
    if(!tx){memset(root,0,32);return;}
    uint8_t*p=tx;
    memcpy(p,cb1,(size_t)l1);    p+=l1;
    memcpy(p,sj->extranonce1,(size_t)sj->en1_len); p+=sj->en1_len;
    uint32_t en2=0; memcpy(p,&en2,4); p+=4;
    memcpy(p,cb2,(size_t)l2);
    dsha256(tx,(size_t)tot,root); free(tx);
    uint8_t pair[64];
    for(int i=0;i<sj->branch_count;i++){
        memcpy(pair,root,32); memcpy(pair+32,sj->merkle_branches[i],32);
        dsha256(pair,64,root);
    }
}

typedef struct {
    BlockHeader hdr; uint8_t target[32]; int job_id; pthread_mutex_t lock;
} SharedJob;

/* ═══════════════════════════════════════════════════════════════════════
 * §11 WorkerState — 128 bytes, aligned(64), false-sharing proof
 * ═══════════════════════════════════════════════════════════════════════ */
typedef struct {
    /* cache line 0 — hot (read every BATCH_SIZE hashes) */
    uint32_t nonce_start; uint32_t nonce_step;
    int      thread_id;   int      cpu_id;
    int      last_job_id; uint32_t ts_rolls;
    uint8_t  _pad0[40];
    /* cache line 1 — cold (written infrequently) */
    _Alignas(CACHE_LINE)
    uint64_t hashes_done; double mhash_rate; double elapsed_sec;
    int      finished;    uint32_t found_nonce; uint8_t found_hash[32];
} WorkerState;
typedef char _ws0[(offsetof(WorkerState,hashes_done)==64)?1:-1];
typedef char _ws1[(sizeof(WorkerState)==128)?1:-1];

/* §13 Atomic globals */
static _Atomic int      g_stop=0;
static _Atomic int      g_job_id=0;
static _Atomic uint64_t g_total_hashes=0;
static _Atomic int      g_found=0;
static _Atomic uint32_t g_found_nonce=0;
static uint8_t          g_found_hash[32];
static pthread_mutex_t  g_found_mutex=PTHREAD_MUTEX_INITIALIZER;
static int              g_job_pipe[2]={-1,-1};

/* §12 CPU affinity */
static void pin_thread_to_core(int core)
{
#ifdef __linux__
    cpu_set_t cs; CPU_ZERO(&cs); CPU_SET(core,&cs);
    int r=pthread_setaffinity_np(pthread_self(),sizeof(cpu_set_t),&cs);
    if(r) fprintf(stderr,"[warn] affinity core %d: %s\n",core,strerror(r));
    else  printf("[thread %d] pinned to core %d\n",core,core);
#else
    (void)core;
#endif
}

/* §10 Worker thread */
typedef struct { WorkerState *ws; SharedJob *job; } WorkerArg;

static void *worker_thread(void *arg)
{
    WorkerArg   *wa  = (WorkerArg*)arg;
    WorkerState *ws  = wa->ws;
    SharedJob   *job = wa->job;
    pin_thread_to_core(ws->cpu_id);
    struct timespec t0,t1;
    clock_gettime(CLOCK_MONOTONIC,&t0);
    uint8_t hash[HASH_SIZE], local_tgt[32];
    BlockHeader local_hdr; uint32_t mid[8]; int ljid;
    pthread_mutex_lock(&job->lock);
    local_hdr=job->hdr; memcpy(local_tgt,job->target,32); ljid=job->job_id;
    pthread_mutex_unlock(&job->lock);
    ws->last_job_id=ljid;
    sha256_midstate((const uint8_t*)&local_hdr,mid);
    for(;;){
        for(uint32_t n=ws->nonce_start;;n+=ws->nonce_step){
            if((n/ws->nonce_step)%BATCH_SIZE==0){
                if(atomic_load_explicit(&g_stop,memory_order_acquire)) goto done;
                int cj=atomic_load_explicit(&g_job_id,memory_order_acquire);
                if(cj!=ws->last_job_id){
                    pthread_mutex_lock(&job->lock);
                    local_hdr=job->hdr; memcpy(local_tgt,job->target,32);
                    ljid=job->job_id;
                    pthread_mutex_unlock(&job->lock);
                    ws->last_job_id=ljid;
                    sha256_midstate((const uint8_t*)&local_hdr,mid);
                    ws->ts_rolls=0; n=ws->nonce_start;
                }
                /* §15 non-blocking pipe poll */
                if(g_job_pipe[0]>=0){
                    fd_set rfd; struct timeval tv={0,0};
                    FD_ZERO(&rfd); FD_SET(g_job_pipe[0],&rfd);
                    if(select(g_job_pipe[0]+1,&rfd,NULL,NULL,&tv)>0){
                        uint8_t b; ssize_t _r=read(g_job_pipe[0],&b,1); (void)_r;
                        atomic_fetch_add_explicit(&g_job_id,1,memory_order_release);
                    }
                }
            }
            local_hdr.nonce=n;
            dsha256_from_midstate(mid,(const uint8_t*)&local_hdr,hash);
            ws->hashes_done++;
            atomic_fetch_add_explicit(&g_total_hashes,1,memory_order_relaxed);
            if(hash_ok(hash,local_tgt)){
                pthread_mutex_lock(&g_found_mutex);
                if(!atomic_load_explicit(&g_found,memory_order_relaxed)){
                    atomic_store_explicit(&g_found,1,memory_order_release);
                    atomic_store_explicit(&g_found_nonce,n,memory_order_relaxed);
                    memcpy(g_found_hash,hash,32);
                    ws->found_nonce=n; memcpy(ws->found_hash,hash,32);
                }
                pthread_mutex_unlock(&g_found_mutex);
                atomic_store_explicit(&g_stop,1,memory_order_release);
                goto done;
            }
            /* §14 timestamp roll */
            if(n+ws->nonce_step<n){
                if(ws->ts_rolls>=MAX_TS_ROLL) goto done;
                local_hdr.timestamp++; ws->ts_rolls++; n=ws->nonce_start;
            }
        }
    }
done:
    clock_gettime(CLOCK_MONOTONIC,&t1);
    ws->elapsed_sec=(t1.tv_sec-t0.tv_sec)+(t1.tv_nsec-t0.tv_nsec)/1e9;
    ws->mhash_rate=ws->elapsed_sec>0?(ws->hashes_done/1e6)/ws->elapsed_sec:0;
    ws->finished=1; return NULL;
}

/* §17 Stats thread */
typedef struct{WorkerState*ws;int nw;}StatsArg;
static void*stats_thread(void*arg){
    StatsArg*sa=(StatsArg*)arg; uint64_t prev=0;
    struct timespec pt,ct; clock_gettime(CLOCK_MONOTONIC,&pt);
    while(!atomic_load_explicit(&g_stop,memory_order_relaxed)){
        sleep(STATS_INTERVAL_SEC);
        if(atomic_load_explicit(&g_stop,memory_order_relaxed)) break;
        clock_gettime(CLOCK_MONOTONIC,&ct);
        double dt=(ct.tv_sec-pt.tv_sec)+(ct.tv_nsec-pt.tv_nsec)/1e9;
        uint64_t cur=atomic_load_explicit(&g_total_hashes,memory_order_relaxed);
        double mhs=dt>0?(double)(cur-prev)/1e6/dt:0;
        printf("%s[stats]%s %.2f MH/s |",CCYAN,CRESET,mhs);
        for(int i=0;i<sa->nw;i++)
            printf(" T%d:%lluM",i,(unsigned long long)(sa->ws[i].hashes_done/1000000));
        printf("\n"); fflush(stdout); prev=cur; pt=ct;
    } return NULL;
}

/* §16 Stratum V1 JSON-RPC */
static int stratum_send(int s,const char*m){return(int)send(s,m,strlen(m),0);}
static void stratum_subscribe(int s){
    stratum_send(s,"{\"id\":1,\"method\":\"mining.subscribe\","
                   "\"params\":[\"educational-miner/2.0\"]}\n");}
static void stratum_authorize(int s,const char*u,const char*p){
    char b[512]; snprintf(b,sizeof(b),
    "{\"id\":2,\"method\":\"mining.authorize\",\"params\":[\"%s\",\"%s\"]}\n",u,p);
    stratum_send(s,b);}
static void stratum_submit(int s,const char*u,const char*jid,
                            uint32_t nt,uint32_t nc,const char*en2)
    __attribute__((unused));
static void stratum_submit(int s,const char*u,const char*jid,
                            uint32_t nt,uint32_t nc,const char*en2){
    char b[512]; snprintf(b,sizeof(b),
    "{\"id\":4,\"method\":\"mining.submit\","
    "\"params\":[\"%s\",\"%s\",\"%s\",\"%08x\",\"%08x\"]}\n",u,jid,en2,nt,nc);
    stratum_send(s,b);
    printf("%s[stratum] share submitted nonce=0x%08x%s\n",CGREEN,nc,CRESET);}

static int stratum_connect(const char*host,int port){
    struct hostent*he=gethostbyname(host);
    if(!he){fprintf(stderr,"[stratum] DNS: %s\n",host);return -1;}
    int sk=socket(AF_INET,SOCK_STREAM,0);
    if(sk<0){perror("socket");return -1;}
    struct sockaddr_in sv; memset(&sv,0,sizeof(sv));
    sv.sin_family=AF_INET; sv.sin_port=htons((uint16_t)port);
    memcpy(&sv.sin_addr,he->h_addr_list[0],(size_t)he->h_length);
    if(connect(sk,(struct sockaddr*)&sv,sizeof(sv))<0){
        perror("connect");close(sk);return -1;}
    int fl=fcntl(sk,F_GETFL,0); fcntl(sk,F_SETFL,fl|O_NONBLOCK);
    return sk;}

typedef struct{SharedJob*job;const char*host;int port;
               const char*user;const char*pass;}ManagerArg;
static void*manager_thread(void*arg){
    ManagerArg*ma=(ManagerArg*)arg;
    int sk=stratum_connect(ma->host,ma->port);
    if(sk<0){fprintf(stderr,"[manager] offline\n");return NULL;}
    printf("%s[manager] connected %s:%d%s\n",CGREEN,ma->host,ma->port,CRESET);
    stratum_subscribe(sk); stratum_authorize(sk,ma->user,ma->pass);
    char rb[STRATUM_BUF]; size_t ro=0;
    while(!atomic_load_explicit(&g_stop,memory_order_relaxed)){
        fd_set rfd; struct timeval tv={0,100000};
        FD_ZERO(&rfd); FD_SET(sk,&rfd);
        if(select(sk+1,&rfd,NULL,NULL,&tv)<=0) continue;
        ssize_t n=recv(sk,rb+ro,sizeof(rb)-ro-1,0);
        if(n<=0){fprintf(stderr,"[manager] disconnected\n");break;}
        ro+=(size_t)n; rb[ro]='\0';
        char*line=rb,*nl;
        while((nl=strchr(line,'\n'))!=NULL){
            *nl='\0';
            if(strstr(line,"mining.notify")){
                printf("%s[manager] new job → flush workers%s\n",CORANGE,CRESET);
                pthread_mutex_lock(&ma->job->lock);
                ma->job->hdr.timestamp=(uint32_t)time(NULL); ma->job->job_id++;
                pthread_mutex_unlock(&ma->job->lock);
                atomic_fetch_add_explicit(&g_job_id,1,memory_order_release);
                if(g_job_pipe[1]>=0){uint8_t sig=1;ssize_t _w=write(g_job_pipe[1],&sig,1);(void)_w;}
            }
            line=nl+1;
        }
        size_t rem=(size_t)(rb+ro-line); memmove(rb,line,rem); ro=rem;
    }
    close(sk); return NULL;}

typedef struct{int delay;}WdArg;
static void*watchdog_thread(void*arg){
    WdArg*w=(WdArg*)arg; if(w->delay<=0) return NULL;
    sleep((unsigned)w->delay);
    if(!atomic_load_explicit(&g_stop,memory_order_relaxed)&&g_job_pipe[1]>=0){
        uint8_t sig=1; ssize_t _w=write(g_job_pipe[1],&sig,1); (void)_w;
        fprintf(stderr,"\n%s[watchdog] simulated job interrupt%s\n",CORANGE,CRESET);}
    return NULL;}

/* helpers */
static void phex(const uint8_t*d,size_t n){for(size_t i=0;i<n;i++)printf("%02x",d[i]);}
static void usage(const char*p){
    fprintf(stderr,
"Usage: %s [options]\n"
"  --threads N        Workers (default %d)\n"
"  --bits 0xHEX       Compact target (0x207fffff=trivial, 0x1e0fffff=medium)\n"
"  --stratum HOST:PORT Stratum V1 pool\n"
"  --nicehash         Use NiceHash SHA256 stratum (%s:%d)\n"
"  --user / --pass    Pool credentials\n"
"  --job-notify N     Simulate new-job interrupt after N seconds\n"
"  --no-color\n"
"  --help\n",p,DEFAULT_THREADS,NICEHASH_STRATUM_HOST,NICEHASH_STRATUM_PORT);}

int main(int argc,char*argv[])
{
    int nthreads=DEFAULT_THREADS; uint32_t bits=0x207fffff;
    const char*pool_host=NULL; int pool_port=3333;
    const char*pool_user="miner.1"; const char*pool_pass="x";
    int job_notify=0;

    for(int i=1;i<argc;i++){
        if(!strcmp(argv[i],"--help")){usage(argv[0]);return 0;}
        else if(!strcmp(argv[i],"--no-color")) use_color=0;
        else if(!strcmp(argv[i],"--threads")&&i+1<argc){
            nthreads=atoi(argv[++i]);
            if(nthreads<1||nthreads>MAX_THREADS){
                fprintf(stderr,"--threads 1-%d\n",MAX_THREADS);return 1;}}
        else if(!strcmp(argv[i],"--bits")&&i+1<argc){
            char*e; bits=(uint32_t)strtoul(argv[++i],&e,16);
            if(*e){fprintf(stderr,"--bits: bad hex\n");return 1;}}
        else if(!strcmp(argv[i],"--stratum")&&i+1<argc){
            char*c=strchr(argv[++i],':');
            if(c){*c='\0';pool_port=atoi(c+1);} pool_host=argv[i];}
        else if(!strcmp(argv[i],"--nicehash")){
            pool_host=NICEHASH_STRATUM_HOST;
            pool_port=NICEHASH_STRATUM_PORT;
        }
        else if(!strcmp(argv[i],"--user")&&i+1<argc) pool_user=argv[++i];
        else if(!strcmp(argv[i],"--pass")&&i+1<argc) pool_pass=argv[++i];
        else if(!strcmp(argv[i],"--job-notify")&&i+1<argc) job_notify=atoi(argv[++i]);
        else{fprintf(stderr,"unknown: %s\n",argv[i]);usage(argv[0]);return 1;}
    }

    if(sha256_selftest()!=0){
        fprintf(stderr,"%sSHA-256 self-test FAILED%s\n",CRED,CRESET);return 1;}
    printf("%sSHA-256 self-test OK%s\n",CGREEN,CRESET);

#ifdef __AVX512F__
    avx512_init_K();
    printf("%sAVX-512: 16-way unrolled compression + vectorized Merkle%s\n",CCYAN,CRESET);
#elif defined(__AVX2__)
    printf("%sAVX2: 8-way parallel SHA-256%s\n",CCYAN,CRESET);
#else
    printf("Scalar SHA-256 (compile -mavx2 or -mavx512f for SIMD)\n");
#endif

    if(pipe(g_job_pipe)!=0){perror("pipe");return 1;}
    fcntl(g_job_pipe[0],F_SETFL,O_NONBLOCK);
    fcntl(g_job_pipe[1],F_SETFL,O_NONBLOCK);

    BlockHeader*hdr=(BlockHeader*)aligned_alloc(CACHE_LINE,sizeof(BlockHeader));
    if(!hdr){perror("aligned_alloc");return 1;}
    memset(hdr,0,sizeof(*hdr));
    hdr->version=1; hdr->timestamp=(uint32_t)time(NULL); hdr->bits=bits;
    sha256_full((const uint8_t*)"prev",4,hdr->prev_block);
    sha256_full((const uint8_t*)"merkle",6,hdr->merkle_root);

    uint8_t target[HASH_SIZE]; expand_target(bits,target);

    SharedJob job; job.hdr=*hdr; memcpy(job.target,target,HASH_SIZE);
    job.job_id=0; pthread_mutex_init(&job.lock,NULL);

    printf("%s%s══ Bitcoin Miner — Unrolled AVX-512 Edition ══%s\n",CBOLD,CORANGE,CRESET);
    printf("Threads : %d | Bits : 0x%08x\n",nthreads,bits);
    printf("Target  : "); phex(target,32); printf("\n");
    if(pool_host) printf("Pool    : %s:%d user=%s\n",pool_host,pool_port,pool_user);
    printf("\n");

    WorkerState*ws=(WorkerState*)aligned_alloc(CACHE_LINE,(size_t)nthreads*sizeof(WorkerState));
    if(!ws){perror("aligned_alloc ws");free(hdr);return 1;}
    memset(ws,0,(size_t)nthreads*sizeof(WorkerState));
    WorkerArg*wa=(WorkerArg*)malloc((size_t)nthreads*sizeof(WorkerArg));
    pthread_t*tids=(pthread_t*)malloc((size_t)nthreads*sizeof(pthread_t));
    if(!wa||!tids){perror("malloc");free(hdr);free(ws);return 1;}

    for(int i=0;i<nthreads;i++){
        ws[i].nonce_start=(uint32_t)i; ws[i].nonce_step=(uint32_t)nthreads;
        ws[i].thread_id=i; ws[i].cpu_id=i; wa[i].ws=&ws[i]; wa[i].job=&job;}

    pthread_t mgr_tid=0,wd_tid=0,stats_tid;
    ManagerArg ma={&job,pool_host,pool_port,pool_user,pool_pass};
    if(pool_host) pthread_create(&mgr_tid,NULL,manager_thread,&ma);
    WdArg wda={job_notify};
    if(job_notify>0) pthread_create(&wd_tid,NULL,watchdog_thread,&wda);
    StatsArg sa={ws,nthreads}; pthread_create(&stats_tid,NULL,stats_thread,&sa);

    printf("%sMining…%s  (Ctrl-C to abort)\n\n",CCYAN,CRESET);
    struct timespec w0,w1; clock_gettime(CLOCK_MONOTONIC,&w0);
    for(int i=0;i<nthreads;i++){
        if(pthread_create(&tids[i],NULL,worker_thread,&wa[i])!=0){
            perror("pthread_create"); atomic_store(&g_stop,1);
            for(int j=0;j<i;j++) pthread_join(tids[j],NULL);
            goto cleanup;
        }
    }
    for(int i=0;i<nthreads;i++) pthread_join(tids[i],NULL);
    clock_gettime(CLOCK_MONOTONIC,&w1);
    atomic_store(&g_stop,1);
    pthread_join(stats_tid,NULL);
    if(mgr_tid) pthread_join(mgr_tid,NULL);
    if(wd_tid)  pthread_join(wd_tid,NULL);

    double wall=(w1.tv_sec-w0.tv_sec)+(w1.tv_nsec-w0.tv_nsec)/1e9;
    uint64_t tot=atomic_load(&g_total_hashes);
    printf("\n%s── Results ──%s\n",CBOLD,CRESET);
    printf("Total    : %llu hashes\n",(unsigned long long)tot);
    printf("Elapsed  : %.3f s\n",wall);
    printf("Hashrate : %.2f MH/s\n",wall>0?(tot/1e6)/wall:0.0);
    printf("\nPer-thread:\n");
    for(int i=0;i<nthreads;i++)
        printf("  T%2d core=%2d  %10llu H  %.2f MH/s  ts_rolls=%u\n",
               i,ws[i].cpu_id,(unsigned long long)ws[i].hashes_done,
               ws[i].mhash_rate,ws[i].ts_rolls);
    if(atomic_load(&g_found)){
        uint32_t fn=atomic_load(&g_found_nonce);
        printf("\n%s%s✔  Block found!%s\n",CBOLD,CGREEN,CRESET);
        printf("Nonce      : %u (0x%08x)\n",fn,fn);
        printf("Block hash : "); phex(g_found_hash,32); printf("\n");
        printf("Target     : "); phex(target,32);       printf("\n");
        printf("Valid PoW  : %s%s%s\n",
               hash_ok(g_found_hash,target)?CGREEN:CRED,
               hash_ok(g_found_hash,target)?"YES":"NO (BUG)",CRESET);
    } else {
        printf("\n%s✗  No nonce found — try a lower --bits value.%s\n",CRED,CRESET);}

cleanup:
    free(wa);free(tids);free(ws);free(hdr);
    pthread_mutex_destroy(&job.lock); pthread_mutex_destroy(&g_found_mutex);
    close(g_job_pipe[0]); close(g_job_pipe[1]);
    return atomic_load(&g_found)?0:2;
}
