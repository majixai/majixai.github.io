# DJI OHLC TensorFlow Engine

A TensorFlow-powered LSTM model that calculates and predicts the
**Open, High, Low, and Close** of the Dow Jones Industrial Average (`^DJI`)
at nine scheduled times each day.

## Schedule

| Time (ET)  | UTC    | Purpose                                  |
|------------|--------|------------------------------------------|
| 12:00 AM   | 04:00  | Overnight baseline OHLC                  |
| 01:00 AM   | 05:00  | Early pre-market OHLC                    |
| 06:00 AM   | 10:00  | Pre-market OHLC                          |
| 06:15 AM   | 10:15  | Pre-market OHLC update                   |
| 06:30 AM   | 10:30  | Futures open OHLC                        |
| 09:00 AM   | 13:00  | Pre-open OHLC (T-30 min)                 |
| 12:00 PM   | 16:00  | Intraday midday OHLC                     |
| 01:00 PM   | 17:00  | Daily report + feedback mechanism        |
| 10:00 PM   | 02:00  | Next-day projection                      |

## Model Architecture

```
Input (60, 4)  → LSTM-64 (seq) → Dropout(0.2)
               → LSTM-32        → Dropout(0.2)
               → Dense-32 ReLU  → Dense-4 Sigmoid
```

- **Input**: 60-bar rolling window of normalised OHLC values
- **Output**: Next-bar OHLC (4 values, inverse-transformed to price space)
- **Uncertainty**: 100-sample Monte Carlo Dropout gives P10–P90 bands

## Feedback Mechanism (1 PM run)

The `1pm_report` mode:
1. Fills in yesterday's **actual** OHLC against the pending prediction stored by the prior run.
2. Recomputes **MAPE** (Mean Absolute Percentage Error) per OHLC component across all historical predictions.
3. Stores a new pending prediction for tomorrow.

Feedback data accumulates in `output/dji_ohlc_feedback.json`.

## Outputs

| File                             | Description                                  |
|----------------------------------|----------------------------------------------|
| `output/dji_ohlc_results.json`   | Last 200 OHLC prediction records (all modes) |
| `output/dji_ohlc_feedback.json`  | Prediction vs actual log + accuracy metrics  |

## Manual Trigger

Go to **Actions → DJI OHLC TensorFlow Engine → Run workflow** and optionally
supply a `run_mode` override (e.g. `10pm_proj`) and custom epoch count.

## Requirements

- `tensorflow-cpu>=2.13`
- `yfinance>=0.2.18`
- `numpy`, `pandas`, `requests`
