/**
 * SessionRaidStats.java — Java 11+ port of the Session Raid Stats Pine Script indicator
 * =======================================================================================
 * Tracks up to three intraday sessions, detects range-extension raids, buckets
 * raid sizes, and computes empirical reach-probabilities for each level.
 *
 * Compile & run:
 *   javac SessionRaidStats.java && java SessionRaidStats
 */

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.Random;

public class SessionRaidStats {

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    static final int MAX_BUCKETS = 6;
    static final int BC          = MAX_BUCKETS + 1; // 7 buckets: 0-5 + overflow

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    static class SessionConfig {
        final int     sessionStartH;
        final int     sessionStartM;
        final int     sessionEndH;
        final int     sessionEndM;
        final double  minRaidPts;
        final int     cutoffMins;   // 0 = no cutoff
        final double  bucketStart;
        final double  bucketStep;
        final double  tzOffsetHrs;  // simplified, no DST

        SessionConfig(int startH, int startM, int endH, int endM,
                      double minRaidPts, int cutoffMins,
                      double bucketStart, double bucketStep, double tzOffsetHrs) {
            this.sessionStartH = startH;  this.sessionStartM = startM;
            this.sessionEndH   = endH;    this.sessionEndM   = endM;
            this.minRaidPts    = minRaidPts;
            this.cutoffMins    = cutoffMins;
            this.bucketStart   = bucketStart;
            this.bucketStep    = bucketStep;
            this.tzOffsetHrs   = tzOffsetHrs;
        }

        double levelPts(int n) {
            return bucketStart + (n - 1) * bucketStep;
        }

        double[] levels() {
            double[] lvls = new double[MAX_BUCKETS];
            for (int i = 0; i < MAX_BUCKETS; i++) lvls[i] = levelPts(i + 1);
            return lvls;
        }
    }

    // -----------------------------------------------------------------------
    // Bucket helpers
    // -----------------------------------------------------------------------

    static int bucketIndex(double value, SessionConfig cfg) {
        double[] lvls = cfg.levels();
        for (int i = 0; i < MAX_BUCKETS - 1; i++) {
            if (value < lvls[i + 1]) return i;
        }
        if (value < lvls[MAX_BUCKETS - 1] + cfg.bucketStep) return MAX_BUCKETS - 1;
        return MAX_BUCKETS; // overflow
    }

    static int[] cumulativeCounts(int[] counts) {
        int[] cum = new int[counts.length];
        int running = 0;
        for (int i = counts.length - 1; i >= 0; i--) {
            running += counts[i];
            cum[i] = running;
        }
        return cum;
    }

    static void updateProbCache(int[] hiCounts, int[] loCounts, int dayCount,
                                 double[] probHi, double[] probLo) {
        if (dayCount <= 0) return;
        int[] cumH = cumulativeCounts(hiCounts);
        int[] cumL = cumulativeCounts(loCounts);
        for (int i = 0; i < BC; i++) {
            probHi[i] = (double) cumH[i] / dayCount * 100.0;
            probLo[i] = (double) cumL[i] / dayCount * 100.0;
        }
    }

    // -----------------------------------------------------------------------
    // Session time helpers
    // -----------------------------------------------------------------------

    static int barLocalMins(long timeMs, double tzOffsetHrs) {
        long offsetMs = (long)(tzOffsetHrs * 3_600_000L);
        Instant inst  = Instant.ofEpochMilli(timeMs + offsetMs);
        ZonedDateTime zdt = inst.atZone(ZoneOffset.UTC);
        return zdt.getHour() * 60 + zdt.getMinute();
    }

    static boolean inSession(long timeMs, SessionConfig cfg) {
        int mins  = barLocalMins(timeMs, cfg.tzOffsetHrs);
        int start = cfg.sessionStartH * 60 + cfg.sessionStartM;
        int end   = cfg.sessionEndH   * 60 + cfg.sessionEndM;
        return mins >= start && mins < end;
    }

    static boolean withinCutoff(long timeMs, long rangeEndMs, int cutoffMins) {
        if (cutoffMins == 0) return true;
        return (timeMs - rangeEndMs) <= (long) cutoffMins * 60_000L;
    }

    // -----------------------------------------------------------------------
    // Raid state (mutable per-session)
    // -----------------------------------------------------------------------

    static class RaidState {
        double hi = Double.NaN, lo = Double.NaN;
        long   endMs   = Long.MIN_VALUE;
        boolean active = false;
        double hiMax   = Double.NaN;
        boolean hiTouch = false, hiConf = false;
        double  hiPts   = Double.NaN;
        double  loMin   = Double.NaN;
        boolean loTouch = false, loConf = false;
        double  loPts   = Double.NaN;
        boolean cutExp  = false;

        void reset(double firstHigh, double firstLow) {
            hi = firstHigh; lo = firstLow;
            endMs = Long.MIN_VALUE; active = false;
            hiMax = Double.NaN; hiTouch = false; hiConf = false; hiPts = Double.NaN;
            loMin = Double.NaN; loTouch = false; loConf = false; loPts = Double.NaN;
            cutExp = false;
        }
    }

    // -----------------------------------------------------------------------
    // Raid stats snapshot
    // -----------------------------------------------------------------------

    static class RaidStatsSnapshot {
        final double[] probHi;
        final double[] probLo;
        final int      dayCount;

        RaidStatsSnapshot(double[] probHi, double[] probLo, int dayCount) {
            this.probHi   = Arrays.copyOf(probHi, probHi.length);
            this.probLo   = Arrays.copyOf(probLo, probLo.length);
            this.dayCount = dayCount;
        }
    }

    // -----------------------------------------------------------------------
    // Engine
    // -----------------------------------------------------------------------

    static class RaidEngine {
        private final SessionConfig cfg;
        private final int           maxDays;
        private final RaidState     state    = new RaidState();
        private final int[]         hiCounts = new int[BC];
        private final int[]         loCounts = new int[BC];
        private final double[]      probHi   = new double[BC];
        private final double[]      probLo   = new double[BC];
        private int     dayCount   = 0;
        private boolean prevInSess = false;

        RaidEngine(SessionConfig cfg, int maxDays) {
            this.cfg     = cfg;
            this.maxDays = maxDays;
        }

        void onBar(long timeMs, double open, double high, double low, double close) {
            boolean inS = inSession(timeMs, cfg);

            // Session open
            if (inS && !prevInSess) {
                state.reset(high, low);
            }

            // Expand range
            if (inS && !Double.isNaN(state.hi)) {
                if (high > state.hi) state.hi = high;
                if (low  < state.lo) state.lo = low;
            }

            // Session close
            if (!inS && prevInSess && !Double.isNaN(state.hi)) {
                state.endMs  = timeMs;
                state.active = true;
                if (dayCount < maxDays) dayCount++;
            }

            // Raid detection
            if (state.active) {
                if (withinCutoff(timeMs, state.endMs, cfg.cutoffMins)) {
                    if (high > state.hi) {
                        double ext = high - state.hi;
                        if (ext >= cfg.minRaidPts && (Double.isNaN(state.hiMax) || high > state.hiMax)) {
                            state.hiMax   = high;
                            state.hiPts   = ext;
                            state.hiTouch = true;
                        }
                    }
                    if (low < state.lo) {
                        double ext = state.lo - low;
                        if (ext >= cfg.minRaidPts && (Double.isNaN(state.loMin) || low < state.loMin)) {
                            state.loMin   = low;
                            state.loPts   = ext;
                            state.loTouch = true;
                        }
                    }
                } else if (!state.cutExp) {
                    if (state.hiTouch) {
                        hiCounts[bucketIndex(state.hiPts, cfg)]++;
                        state.hiConf = true;
                    }
                    if (state.loTouch) {
                        loCounts[bucketIndex(state.loPts, cfg)]++;
                        state.loConf = true;
                    }
                    updateProbCache(hiCounts, loCounts, dayCount, probHi, probLo);
                    state.cutExp = true;
                }
            }

            prevInSess = inS;
        }

        RaidStatsSnapshot getStats() {
            return new RaidStatsSnapshot(probHi, probLo, dayCount);
        }
    }

    // -----------------------------------------------------------------------
    // Three-session facade
    // -----------------------------------------------------------------------

    private final RaidEngine e1, e2, e3;

    public SessionRaidStats(SessionConfig c1, SessionConfig c2, SessionConfig c3, int maxDays) {
        e1 = new RaidEngine(c1, maxDays);
        e2 = new RaidEngine(c2, maxDays);
        e3 = new RaidEngine(c3, maxDays);
    }

    public void onBar(long timeMs, double open, double high, double low, double close) {
        e1.onBar(timeMs, open, high, low, close);
        e2.onBar(timeMs, open, high, low, close);
        e3.onBar(timeMs, open, high, low, close);
    }

    public RaidStatsSnapshot[] stats() {
        return new RaidStatsSnapshot[]{ e1.getStats(), e2.getStats(), e3.getStats() };
    }

    // -----------------------------------------------------------------------
    // main — quick self-test
    // -----------------------------------------------------------------------

    public static void main(String[] args) {
        SessionConfig cfg = new SessionConfig(2, 0, 2, 15,
            5.0, 120, 20.0, 10.0, -5.0);
        RaidEngine engine = new RaidEngine(cfg, 100);

        Random rng     = new Random(42);
        long   baseMs  = 1704182400_000L; // 2024-01-02 07:00 UTC = 02:00 ET
        long   msMin   = 60_000L;
        double price   = 4500.0;

        for (int day = 0; day < 5; day++) {
            long dayOff = (long) day * 24 * 60 * msMin;
            for (int m = 0; m < 8 * 60; m++) {
                long   t = baseMs + dayOff + (long) m * msMin;
                double o = price;
                double h = o + rng.nextDouble() * 4;
                double l = o - rng.nextDouble() * 4;
                double c = l + rng.nextDouble() * (h - l);
                price = c;
                engine.onBar(t, o, h, l, c);
            }
        }

        RaidStatsSnapshot stats = engine.getStats();
        System.out.println("Day count : " + stats.dayCount);
        System.out.print("prob_hi   :");
        for (double p : stats.probHi) System.out.printf(" %.1f%%", p);
        System.out.print("\nprob_lo   :");
        for (double p : stats.probLo) System.out.printf(" %.1f%%", p);
        System.out.println();
    }
}
