# Fast-Payoff Event Trading Research

**Date:** 2026-04-12  
**Focus:** Event-driven signals with natural short-horizon payoff (NOT trend-following)

---

## Executive Summary

We tested multiple fast-payoff event hypotheses on BTC 1H and 15m data. **No robust intraday event signal was found that survives fees.**

Key insight from Frank: EMA crossover is a SLOW signal (12-24h payoff). We tested FAST signals - events with natural short-horizon payoff.

---

## Tests Conducted

### 1. Large Candle Follow-through (15m)
- **Hypothesis:** After a large 15m candle (>P95 body), price continues in same direction
- **Data:** 52 days 15m candles
- **Result:** No edge at any horizon (1-4h)
- **Conclusion:** Large candles on 15m are typically noise or start of reversal

### 2. 3-Candle Streak Continuation (15m)
- **Hypothesis:** After 3 consecutive same-direction candles, momentum continues
- **Data:** 52 days, n=1145
- **Result:** avg ~0%, WR 48% at all horizons
- **Conclusion:** No edge - streaks are randomly distributed

### 3. P95 Large Candle Follow-through (1H)
- **Hypothesis:** After large 1H candle, price continues
- **Data:** 333 days, n=397
- **Result:** Slight positive at 2-4h but WR < 50%, RR ~1.2
- **Conclusion:** Edge not robust after fees

### 4. P99 Extreme Candle FADE (1H) - MOST INTERESTING
- **Hypothesis:** After EXTREME 1H candle (>P99), price reverses (mean reversion)
- **Data:** 333 days, n=79 (extreme events)
- **Result:**

| Horizon | Avg Return | Win Rate | RR | Expectancy (gross) |
|---------|-----------|----------|-----|-------------------|
| 4h | +0.105% | 53% | 1.09 | +0.07% |
| 8h | +0.184% | 47% | 1.48 | +0.17% |

- **Fees:** ~0.15% round-trip
- **Net edge:** ~0.02% per trade at 8h

**The P99 fade shows the strongest signal, but:**
- Very rare: ~4 events per month (n=79 in 333 days)
- Edge barely survives fees
- Would require leverage to be economically meaningful

### 5. P99 Fade + Low Volatility Filter
- **Hypothesis:** Fading extreme candles in low-vol environments is stronger
- **Result:** Improved metrics but n=7 (too small)

---

## Key Findings

### Why These Signals Don't Work Robustly

1. **Rarity:** True extreme events (P99) are rare - only ~4/month
2. **Small Edge:** The gross expectancy (~0.17%) minus fees (~0.15%) leaves almost nothing
3. **High Volatility Context:** Extreme candles often occur during high-volatility periods where reversals are unpredictable

### Comparison: Fast vs Slow Signals

| Type | Example | Payoff Horizon | Robustness |
|------|---------|----------------|------------|
| Slow (tested earlier) | EMA(20,50) crossover | 12-24h | +477% / 333d |
| Fast (this research) | P99 fade | 4-8h | ~0% / 333d |

The slow signals work because trends take time to develop. Fast signals are largely noise.

---

## Conclusions

1. **Pure 15m OHLCV events do not provide robust intraday edges**
2. **1H extreme events (P99) show mean-reversion tendency** but edge is too small
3. **For genuine intraday edges:** Need microstructure data (orderflow, liquidations, funding rates) - not available in OHLCV alone

---

## What Would Be Needed For Real Intraday Edges

- Funding rate data (Binance API)
- Liquidation data (Coinglass API)
- Order book data (real-time)
- Large trade flow data

OHLCV candles in isolation are insufficient for intraday trading.

---

## Files

- `explore.mjs` - Fast-signal exploration scripts
- `data/btcusdt-15m-long.json` - 52 days BTC 15m data
- `data/btcusdt-1h-long.json` - 333 days BTC 1H data
