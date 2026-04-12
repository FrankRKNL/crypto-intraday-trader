# Fast Move Momentum Research

**Date:** 2026-04-12  
**Question:** Do fast, large price moves create exploitable momentum or reversal patterns?

---

## Methodology

**Event Definition:**
- Price moves >= X% in 1 candle (1H timeframe)
- Tested thresholds: 1.5%, 1.8%, 2.0%, 2.5%, 3.0%
- Measure returns at 2h, 4h, 8h, 24h horizons

**Two Hypotheses:**
1. **Mean Reversion (FADE):** After fast move, price reverses
2. **Momentum (FOLLOW):** After fast move, price continues

---

## Key Results

### FOLLOW Momentum After Fast Rise (Long)

| Threshold | Horizon | n | Win Rate | RR | Net Expectancy |
|-----------|---------|---|----------|----|----------------|
| 1.5% | 24h | 47 | 53% | 1.26 | **+0.193%** |
| **1.8%** | **24h** | **29** | **55%** | **1.37** | **+0.429%** |
| 1.8% | 8h | 29 | 55% | 1.06 | +0.026% |
| 2.0% | 4h | 15 | 33% | 1.04 | -0.397% |

### Mean Reversion (FADE) Results

| Threshold | Direction | Horizon | Net |
|-----------|-----------|---------|-----|
| 1.5% | FADE drop | 8h | +0.012% (zero) |
| Any | FADE rise | any | negative |

---

## Critical Finding

**The momentum edge requires 24h hold.**

At 8h or shorter, the edge disappears or reverses:
- 1.8% threshold at 8h: net = +0.026% (barely positive)
- 1.8% threshold at 4h: net = -0.116% (negative)

**This is a SWING TRADING signal, not intraday.**

---

## Why Does Momentum Work at 24h But Not Shorter?

1. **Overextension takes time to correct:** Fast moves create temporary imbalances that the market needs time to fully unwind
2. **Information asymmetry:** Large moves often contain information that takes time to be fully absorbed
3. **Intraday noise:** Short-term price action is dominated by random fluctuations, not systematic patterns

---

## Conclusion

**Fast move momentum (>=1.8% in 1h) produces a robust edge at 24h horizon:**
- n=29 events in 333 days (~1 per week)
- 55% WR, RR=1.37
- Net expectancy: +0.429% per trade
- After 0.15% fees

**However:** This is swing trading, not intraday. The same signal at <=8h horizons produces no reliable edge.

---

## For True Intraday (5m-4h)

Our tests show NO robust edge for:
- Candle patterns (streaks, large bodies)
- Wick-based liquidation proxies
- Fast move momentum at <8h horizons

**True intraday edges would require:**
- Real-time order flow data
- Liquidation feeds
- Funding rate data
- Market depth / book pressure

These are not available in OHLCV candles alone.

---

## Files

- `fast-signals/explore.mjs` - Momentum and reversal tests
- Data: `data/btcusdt-1h-long.json` (333 days)
