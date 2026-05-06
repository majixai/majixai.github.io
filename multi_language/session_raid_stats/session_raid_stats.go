// session_raid_stats.go — Go port of the Session Raid Stats Pine Script indicator
// ================================================================================
// Tracks up to three intraday sessions, detects range-extension raids, buckets
// raid sizes, and computes empirical reach-probabilities for each level.
//
// Build & run:
//   go run session_raid_stats.go

package main

import (
	"fmt"
	"math"
	"math/rand"
	"time"
)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const (
	MaxBuckets = 6
	BC         = MaxBuckets + 1 // 7 buckets: 0-5 + overflow
)

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// SessionConfig holds parameters for one session.
type SessionConfig struct {
	SessionStartH int     // hour (local exchange time)
	SessionStartM int     // minute
	SessionEndH   int
	SessionEndM   int
	MinRaidPts    float64
	CutoffMins    int     // 0 = no cutoff
	BucketStart   float64
	BucketStep    float64
	TZOffsetHrs   float64 // e.g. -5.0 for ET (simplified, no DST)
}

// LevelPts returns the threshold in points for level n (1-indexed).
func (c *SessionConfig) LevelPts(n int) float64 {
	return c.BucketStart + float64(n-1)*c.BucketStep
}

// Levels returns all six level thresholds.
func (c *SessionConfig) Levels() [MaxBuckets]float64 {
	var lvls [MaxBuckets]float64
	for i := 0; i < MaxBuckets; i++ {
		lvls[i] = c.LevelPts(i + 1)
	}
	return lvls
}

// ---------------------------------------------------------------------------
// Bucket helpers
// ---------------------------------------------------------------------------

// BucketIndex maps a raid-size value to a 0-based bucket index.
func BucketIndex(value float64, cfg *SessionConfig) int {
	lvls := cfg.Levels()
	for i := 0; i < MaxBuckets-1; i++ {
		if value < lvls[i+1] {
			return i
		}
	}
	if value < lvls[MaxBuckets-1]+cfg.BucketStep {
		return MaxBuckets - 1
	}
	return MaxBuckets // overflow
}

// CumulativeCounts computes the reverse-cumulative sum.
func CumulativeCounts(counts [BC]int) [BC]int {
	var cum [BC]int
	running := 0
	for i := BC - 1; i >= 0; i-- {
		running += counts[i]
		cum[i] = running
	}
	return cum
}

// UpdateProbCache recalculates ECDF probabilities.
func UpdateProbCache(hiCounts, loCounts [BC]int, dayCount int, probHi, probLo *[BC]float64) {
	if dayCount <= 0 {
		return
	}
	cumH := CumulativeCounts(hiCounts)
	cumL := CumulativeCounts(loCounts)
	for i := 0; i < BC; i++ {
		probHi[i] = float64(cumH[i]) / float64(dayCount) * 100.0
		probLo[i] = float64(cumL[i]) / float64(dayCount) * 100.0
	}
}

// ---------------------------------------------------------------------------
// Session time helpers
// ---------------------------------------------------------------------------

func barLocalTime(timeMS int64, tzOffsetHrs float64) time.Time {
	offsetSec := int64(tzOffsetHrs * 3600)
	return time.Unix(timeMS/1000+offsetSec, 0).UTC()
}

func inSession(timeMS int64, cfg *SessionConfig) bool {
	t     := barLocalTime(timeMS, cfg.TZOffsetHrs)
	h, m  := t.Hour(), t.Minute()
	mins  := h*60 + m
	start := cfg.SessionStartH*60 + cfg.SessionStartM
	end   := cfg.SessionEndH*60 + cfg.SessionEndM
	return mins >= start && mins < end
}

func withinCutoff(timeMS, rangeEndMS int64, cutoffMins int) bool {
	if cutoffMins == 0 {
		return true
	}
	return (timeMS - rangeEndMS) <= int64(cutoffMins)*60_000
}

// ---------------------------------------------------------------------------
// Raid engine
// ---------------------------------------------------------------------------

// RaidState holds per-session mutable tracking state.
type RaidState struct {
	Hi, Lo            float64
	EndMS             int64
	Active            bool
	HiMax             float64
	HiTouch, HiConf   bool
	HiPts             float64
	LoMin             float64
	LoTouch, LoConf   bool
	LoPts             float64
	CutExp            bool
	hiSet, loSet      bool
}

// RaidStats holds the computed statistics for a session.
type RaidStats struct {
	ProbHi   [BC]float64
	ProbLo   [BC]float64
	DayCount int
}

// RaidEngine processes chronological OHLC bars for one session.
type RaidEngine struct {
	cfg        *SessionConfig
	maxDays    int
	state      RaidState
	hiCounts   [BC]int
	loCounts   [BC]int
	probHi     [BC]float64
	probLo     [BC]float64
	dayCount   int
	prevInSess bool
}

// NewRaidEngine creates a new engine for the given configuration.
func NewRaidEngine(cfg *SessionConfig, maxDays int) *RaidEngine {
	return &RaidEngine{cfg: cfg, maxDays: maxDays}
}

// OnBar feeds one OHLC bar to the engine.
func (e *RaidEngine) OnBar(timeMS int64, open, high, low, close float64) {
	inS   := inSession(timeMS, e.cfg)
	state := &e.state

	// Session open — reset state
	if inS && !e.prevInSess {
		*state = RaidState{Hi: high, Lo: low, hiSet: true, loSet: true}
	}

	// Expand range during session
	if inS && state.hiSet {
		if high > state.Hi { state.Hi = high }
		if low  < state.Lo { state.Lo = low  }
	}

	// Session close — activate raid detection
	if !inS && e.prevInSess && state.hiSet {
		state.EndMS  = timeMS
		state.Active = true
		if e.dayCount < e.maxDays {
			e.dayCount++
		}
	}

	// Raid detection
	if state.Active {
		if withinCutoff(timeMS, state.EndMS, e.cfg.CutoffMins) {
			// High-side
			if high > state.Hi {
				ext := high - state.Hi
				if ext >= e.cfg.MinRaidPts {
					if !state.HiTouch || high > state.HiMax {
						state.HiMax   = high
						state.HiPts   = ext
						state.HiTouch = true
					}
				}
			}
			// Low-side
			if low < state.Lo {
				ext := state.Lo - low
				if ext >= e.cfg.MinRaidPts {
					if !state.LoTouch || low < state.LoMin {
						state.LoMin   = low
						state.LoPts   = ext
						state.LoTouch = true
					}
				}
			}
		} else if !state.CutExp {
			if state.HiTouch {
				idx := BucketIndex(state.HiPts, e.cfg)
				e.hiCounts[idx]++
				state.HiConf = true
			}
			if state.LoTouch {
				idx := BucketIndex(state.LoPts, e.cfg)
				e.loCounts[idx]++
				state.LoConf = true
			}
			UpdateProbCache(e.hiCounts, e.loCounts, e.dayCount, &e.probHi, &e.probLo)
			state.CutExp = true
		}
	}

	e.prevInSess = inS
}

// GetStats returns a snapshot of the current statistics.
func (e *RaidEngine) GetStats() RaidStats {
	return RaidStats{ProbHi: e.probHi, ProbLo: e.probLo, DayCount: e.dayCount}
}

// ---------------------------------------------------------------------------
// Three-session facade
// ---------------------------------------------------------------------------

// SessionRaidStats wraps three RaidEngines.
type SessionRaidStats struct {
	E1, E2, E3 *RaidEngine
}

// NewSessionRaidStats constructs the three-engine facade.
func NewSessionRaidStats(c1, c2, c3 *SessionConfig, maxDays int) *SessionRaidStats {
	return &SessionRaidStats{
		E1: NewRaidEngine(c1, maxDays),
		E2: NewRaidEngine(c2, maxDays),
		E3: NewRaidEngine(c3, maxDays),
	}
}

// OnBar feeds a bar to all three engines.
func (s *SessionRaidStats) OnBar(timeMS int64, o, h, l, c float64) {
	s.E1.OnBar(timeMS, o, h, l, c)
	s.E2.OnBar(timeMS, o, h, l, c)
	s.E3.OnBar(timeMS, o, h, l, c)
}

// ---------------------------------------------------------------------------
// main — quick self-test
// ---------------------------------------------------------------------------

func main() {
	cfg := &SessionConfig{
		SessionStartH: 2, SessionStartM: 0,
		SessionEndH:   2, SessionEndM:   15,
		MinRaidPts:    5.0, CutoffMins: 120,
		BucketStart:   20.0, BucketStep: 10.0,
		TZOffsetHrs:   -5.0,
	}
	engine := NewRaidEngine(cfg, 100)

	rng := rand.New(rand.NewSource(42))
	// 2024-01-02 07:00 UTC = 02:00 ET
	baseMS := int64(1704182400000)
	msMin  := int64(60000)
	price  := 4500.0

	for day := 0; day < 5; day++ {
		dayOff := int64(day) * 24 * 60 * msMin
		for minute := 0; minute < 8*60; minute++ {
			t := baseMS + dayOff + int64(minute)*msMin
			o := price
			h := o + rng.Float64()*4
			l := o - rng.Float64()*4
			c := l + rng.Float64()*(h-l)
			price = c
			engine.OnBar(t, o, h, l, c)
		}
	}

	stats := engine.GetStats()
	fmt.Printf("Day count : %d\n", stats.DayCount)
	fmt.Print("prob_hi   :")
	for _, p := range stats.ProbHi {
		fmt.Printf(" %.1f%%", p)
	}
	fmt.Print("\nprob_lo   :")
	for _, p := range stats.ProbLo {
		fmt.Printf(" %.1f%%", math.Round(p*10)/10)
	}
	fmt.Println()
}
