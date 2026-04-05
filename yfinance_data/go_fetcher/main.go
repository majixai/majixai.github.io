// go_fetcher — goroutine-pool concurrent Yahoo Finance ticker fetcher.
//
// Fetches OHLCV daily/intraday data for a list of tickers in parallel using
// Go goroutines gated behind a semaphore channel.  Results are streamed to
// stdout as newline-delimited JSON (NDJSON) so the Python subprocess caller
// can process records incrementally without waiting for all tickers.
//
// Build:
//   go build -o go_fetcher_bin ./yfinance_data/go_fetcher
//   # or cross-compile for Linux CI:
//   GOOS=linux GOARCH=amd64 go build -o go_fetcher_bin_linux ...
//
// Usage (standalone):
//   ./go_fetcher_bin --tickers AAPL,MSFT,NVDA --period 1y --interval 1d
//
// Usage (from Python via subprocess):
//   import subprocess, json
//   proc = subprocess.run(['./go_fetcher_bin', '--tickers', ','.join(tickers)],
//                         capture_output=True, text=True)
//   for line in proc.stdout.splitlines():
//       record = json.loads(line)

package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const (
	defaultPeriod     = "1y"
	defaultInterval   = "1d"
	defaultConcurrent = 40
	httpTimeout       = 20 * time.Second
	retryAttempts     = 3
	retryBaseDelay    = 500 * time.Millisecond
)

// Yahoo Finance v8 chart API endpoint
const yfChartURL = "https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=%s&range=%s&includePrePost=false"

var userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36"

// ---------------------------------------------------------------------------
// JSON response types
// ---------------------------------------------------------------------------

type yfResponse struct {
	Chart struct {
		Result []struct {
			Meta struct {
				Currency     string  `json:"currency"`
				Symbol       string  `json:"symbol"`
				ExchangeName string  `json:"exchangeName"`
				RegularMarketPrice float64 `json:"regularMarketPrice"`
			} `json:"meta"`
			Timestamp  []int64 `json:"timestamp"`
			Indicators struct {
				Quote []struct {
					Open   []float64 `json:"open"`
					High   []float64 `json:"high"`
					Low    []float64 `json:"low"`
					Close  []float64 `json:"close"`
					Volume []float64 `json:"volume"`
				} `json:"quote"`
			} `json:"indicators"`
		} `json:"result"`
		Error *struct {
			Code        string `json:"code"`
			Description string `json:"description"`
		} `json:"error"`
	} `json:"chart"`
}

// ---------------------------------------------------------------------------
// Output record
// ---------------------------------------------------------------------------

type TickerRecord struct {
	Ticker    string      `json:"ticker"`
	Currency  string      `json:"currency"`
	Exchange  string      `json:"exchange"`
	Records   int         `json:"records"`
	LastClose float64     `json:"last_close"`
	LastRSI   float64     `json:"last_rsi"`
	LastSMA20 float64     `json:"last_sma20"`
	LastMACD  float64     `json:"last_macd"`
	Annvol    float64     `json:"annvol_pct"`
	FetchedAt string      `json:"fetched_at"`
	Error     string      `json:"error,omitempty"`
}

// ---------------------------------------------------------------------------
// HTTP client (shared, connection-pooling)
// ---------------------------------------------------------------------------

var httpClient = &http.Client{
	Timeout: httpTimeout,
	Transport: &http.Transport{
		MaxIdleConns:        200,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
	},
}

// ---------------------------------------------------------------------------
// Fetch one ticker with retries
// ---------------------------------------------------------------------------

func fetchTicker(ticker, period, interval string) TickerRecord {
	rec := TickerRecord{
		Ticker:    ticker,
		FetchedAt: time.Now().UTC().Format(time.RFC3339),
	}

	url := fmt.Sprintf(yfChartURL, ticker, interval, period)

	var body []byte
	var fetchErr error

	for attempt := 0; attempt <= retryAttempts; attempt++ {
		if attempt > 0 {
			delay := time.Duration(float64(retryBaseDelay) * math.Pow(2, float64(attempt-1)))
			time.Sleep(delay)
		}

		req, err := http.NewRequest(http.MethodGet, url, nil)
		if err != nil {
			fetchErr = err
			continue
		}
		req.Header.Set("User-Agent", userAgent)
		req.Header.Set("Accept", "application/json")

		resp, err := httpClient.Do(req)
		if err != nil {
			fetchErr = err
			continue
		}
		if resp.StatusCode == http.StatusNotFound {
			resp.Body.Close()
			rec.Error = "404 not found"
			return rec
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			fetchErr = fmt.Errorf("HTTP %d", resp.StatusCode)
			continue
		}

		body, fetchErr = io.ReadAll(resp.Body)
		resp.Body.Close()
		if fetchErr == nil {
			break
		}
	}

	if fetchErr != nil {
		rec.Error = fetchErr.Error()
		return rec
	}

	// Parse JSON response
	var yf yfResponse
	if err := json.Unmarshal(body, &yf); err != nil {
		rec.Error = "json parse error: " + err.Error()
		return rec
	}
	if yf.Chart.Error != nil {
		rec.Error = yf.Chart.Error.Description
		return rec
	}
	if len(yf.Chart.Result) == 0 {
		rec.Error = "empty result"
		return rec
	}

	r := yf.Chart.Result[0]
	rec.Currency = r.Meta.Currency
	rec.Exchange = r.Meta.ExchangeName

	quotes := r.Indicators.Quote
	if len(quotes) == 0 || len(r.Timestamp) == 0 {
		rec.Error = "no quotes"
		return rec
	}

	closes := quotes[0].Close
	n := len(closes)
	if n == 0 {
		rec.Error = "no close prices"
		return rec
	}
	rec.Records = n

	// Compute indicators (pure Go, no external deps)
	rec.LastClose = closes[n-1]
	rec.LastRSI = rsi14(closes)
	rec.LastSMA20 = sma(closes, 20)
	rec.LastMACD, _ = macd(closes)
	rec.Annvol = annualisedVol(closes) * 100.0

	return rec
}

// ---------------------------------------------------------------------------
// Technical indicators (pure Go)
// ---------------------------------------------------------------------------

func sma(arr []float64, w int) float64 {
	if len(arr) < w {
		w = len(arr)
	}
	sum := 0.0
	for _, v := range arr[len(arr)-w:] {
		sum += v
	}
	return sum / float64(w)
}

func ema(arr []float64, span int) []float64 {
	alpha := 2.0 / float64(span+1)
	out := make([]float64, len(arr))
	out[0] = arr[0]
	for i := 1; i < len(arr); i++ {
		out[i] = alpha*arr[i] + (1-alpha)*out[i-1]
	}
	return out
}

func rsi14(arr []float64) float64 {
	if len(arr) < 2 {
		return 50.0
	}
	alpha := 1.0 / 14.0
	var avgGain, avgLoss float64
	for i := 1; i < len(arr); i++ {
		diff := arr[i] - arr[i-1]
		g, l := 0.0, 0.0
		if diff > 0 {
			g = diff
		} else {
			l = -diff
		}
		avgGain = alpha*g + (1-alpha)*avgGain
		avgLoss = alpha*l + (1-alpha)*avgLoss
	}
	if avgLoss < 1e-10 {
		return 100.0
	}
	return 100.0 - 100.0/(1.0+avgGain/avgLoss)
}

func macd(arr []float64) (macdVal, signal float64) {
	if len(arr) < 26 {
		return 0, 0
	}
	e12 := ema(arr, 12)
	e26 := ema(arr, 26)
	macdLine := make([]float64, len(arr))
	for i := range arr {
		macdLine[i] = e12[i] - e26[i]
	}
	sig := ema(macdLine, 9)
	n := len(arr)
	return macdLine[n-1], sig[n-1]
}

func annualisedVol(arr []float64) float64 {
	if len(arr) < 2 {
		return 0
	}
	returns := make([]float64, len(arr)-1)
	for i := 1; i < len(arr); i++ {
		if arr[i-1] > 0 {
			returns[i-1] = math.Log(arr[i] / arr[i-1])
		}
	}
	n := float64(len(returns))
	mean := 0.0
	for _, r := range returns {
		mean += r
	}
	mean /= n
	variance := 0.0
	for _, r := range returns {
		diff := r - mean
		variance += diff * diff
	}
	variance /= (n - 1)
	return math.Sqrt(variance) * math.Sqrt(252)
}

// ---------------------------------------------------------------------------
// Worker pool
// ---------------------------------------------------------------------------

func runPool(tickers []string, period, interval string, concurrent int) {
	sem := make(chan struct{}, concurrent)
	var wg sync.WaitGroup
	enc := json.NewEncoder(os.Stdout)

	// Mutex to serialise stdout writes
	var mu sync.Mutex

	for _, ticker := range tickers {
		wg.Add(1)
		sem <- struct{}{}
		go func(t string) {
			defer wg.Done()
			defer func() { <-sem }()

			rec := fetchTicker(t, period, interval)
			mu.Lock()
			if err := enc.Encode(rec); err != nil {
				fmt.Fprintf(os.Stderr, "encode error for %s: %v\n", t, err)
			}
			mu.Unlock()
		}(ticker)
	}
	wg.Wait()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

func main() {
	tickersFlag := flag.String("tickers", "", "Comma-separated ticker symbols (required)")
	periodFlag := flag.String("period", defaultPeriod, "Data range (e.g. 1y, 5y)")
	intervalFlag := flag.String("interval", defaultInterval, "Bar size (e.g. 1d, 1h)")
	concurrentFlag := flag.Int("concurrent", defaultConcurrent, "Goroutine pool size")
	flag.Parse()

	if *tickersFlag == "" {
		fmt.Fprintln(os.Stderr, "ERROR: --tickers is required")
		flag.Usage()
		os.Exit(1)
	}

	tickers := strings.Split(*tickersFlag, ",")
	clean := make([]string, 0, len(tickers))
	for _, t := range tickers {
		t = strings.TrimSpace(t)
		if t != "" {
			clean = append(clean, strings.ToUpper(t))
		}
	}
	if len(clean) == 0 {
		fmt.Fprintln(os.Stderr, "ERROR: no valid tickers provided")
		os.Exit(1)
	}

	log.Printf("go_fetcher: %d tickers  period=%s interval=%s concurrent=%d",
		len(clean), *periodFlag, *intervalFlag, *concurrentFlag)

	runPool(clean, *periodFlag, *intervalFlag, *concurrentFlag)
}
