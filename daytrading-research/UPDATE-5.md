# UPDATE 5: Stop Loss / Take Profit / Trailing Stop Analysis

Date: 2026-04-12

## ETH Drawdown Recovery (3% in 4 candles, hold 2h)

### Stop Loss Test

| Config | WR | Net | RR | Stops % | Result |
|---------|-----|-----|-----|---------|--------|
| No SL | 61% | +0.757% | 2.43 | 0% | PASS |
| SL 0.5% | 41% | +0.517% | 3.58 | 51% | PASS |
| SL 1% | 52% | +0.535% | 2.12 | 30% | PASS |
| SL 2% | 59% | +0.646% | 1.98 | 11% | PASS |
| SL 3% | 59% | +0.646% | 1.97 | 3% | PASS |

**Conclusion:** Stop loss REDUCES net expectancy. Best is NO stop.

### Take Profit Test

| Config | WR | Net | RR | TP Hit % | Result |
|---------|-----|-----|-----|---------|--------|
| No TP | 61% | +0.757% | 2.43 | 0% | PASS |
| TP +0.5% | 75% | +0.484% | 1.24 | 74% | PASS |
| TP +1% | 66% | +0.437% | 1.63 | 48% | PASS |
| TP +2% | 61% | +0.499% | 1.92 | 23% | PASS |

**Conclusion:** Take profit REDUCES net expectancy. Best is NO TP.

### Trailing Stop Test

| Config | WR | Net | RR | Trail % | Result |
|---------|-----|-----|-----|---------|--------|
| No trail | 61% | +0.757% | 2.43 | 0% | PASS |
| Trail 1% | 52% | +0.574% | 2.29 | 57% | PASS |
| Trail 2% | 54% | +0.528% | 2.05 | 30% | PASS |
| Trail 2.5% | 59% | +0.698% | 2.27 | 10% | PASS |

**Conclusion:** Trailing stop REDUCES net expectancy slightly. Best is NO trailing stop.

## KEY FINDINGS

The best configuration is SIMPLE:
- Entry: Buy when ETH drops 3% in 4 candles (1h)
- Exit: Hold for 2 hours, no stop, no TP
- Result: +0.757% net, 61% WR, RR=2.43

Adding stop loss, take profit, or trailing stop ALL reduce performance.

## SUMMARY: Best ETH Day Trading Pattern

| Parameter | Value |
|-----------|-------|
| Asset | ETH only |
| Event | ETH drops >= 3% within 4x 15m candles (1h) |
| Entry | Buy at close of candle after detection |
| Exit | Hold 2 hours (8 candles) |
| Stop Loss | None |
| Take Profit | None |
| Trailing Stop | None |
| Expected Return | +0.757% per trade |
| Win Rate | 61% |
| Reward:Risk | 2.43 |
| Median Return | +0.409% |
| Sample Size | 61 trades (83 days) |

## Cross-Period Validation

| Period | n | WR | Net | RR | Result |
|--------|---|-----|-----|-----|--------|
| Full | 61 | 61% | +0.757% | 2.43 | PASS |
| Period 1 (Jan-Feb) | 51 | 61% | +0.851% | 2.46 | PASS |
| Period 2 (Mar-Apr) | 10 | 60% | +0.278% | 2.07 | PASS |

**Validated across both periods.**
