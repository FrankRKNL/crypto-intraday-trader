# Dynamic Exit Research

**Date:** 2026-04-12  
**Question:** Can we compress the 24h payoff of the momentum edge into intraday (<=8h) using better exits?

---

## Summary of Entry Signal

The underlying entry signal is **mean reversion after fast drop**:
- Event: BTC price drops >= 2.0% in 1 candle (1H)
- Entry: Go LONG at candle close (bet on bounce)
- Data: 333 days of 1H candles

**Previous finding:** This edge required 24h hold for the full payoff. We tested 3 exit strategies to compress this.

---

## Test 1: Dynamic Exit (Momentum Break)

**Hypothesis:** Exit when momentum breaks (2 bearish candles OR price crosses SMA10)

**Results:**
| Max Hold | Win Rate | Net | Avg Hold | Exit Reason |
|---------|----------|-----|----------|-------------|
| 4h | 40% | -0.305% | 3.0h | 2bearish: 30, timeout: 23 |
| 8h | 36% | -0.460% | 4.1h | 2bearish: 46, sma10: 5 |
| 12h | 33% | -0.411% | 4.4h | 2bearish: 49, sma10: 7 |

**Verdict:** FAILS. Exit is too aggressive - cuts winners prematurely.

---

## Test 2: Trailing Stop

**Hypothesis:** Let winners run, exit on pullback from peak

**Entry:** Long after >= 2.0% drop  
**Exit:** Trailing stop (X% from peak) OR max hold (8h or 24h)

**Results (24 events, 333 days):**

| Trail | Max Hold | Win Rate | Net | Avg Hold | Timeouts |
|-------|----------|----------|-----|----------|----------|
| 5% | 8h | **54%** | **+0.574%** | 8.0h | 24/24 |
| 3% | 8h | 54% | +0.394% | 7.5h | 22/24 |
| 2% | 8h | 54% | +0.173% | 7.0h | 19/24 |
| 5% | 24h | 54% | +0.574% | 8.0h | all |

**Verdict:** WORKS. With 5% trailing stop + 8h max hold:
- Average hold = 8h (all trades timeout - price never falls 5% from peak)
- Net expectancy = +0.574% per trade
- Win rate = 54%

**Key insight:** The 5% trail never triggers within 8h! Price never falls 5% from peak during the holding period. All exits are by timeout at 8h.

**This means:** 8h max hold achieves the SAME result as 24h hold because the trailing stop never triggers - the edge is already captured in the 8h window.

---

## Test 3: Partial Take Profit

**Hypothesis:** Lock in partial gains early, let rest run

**Results:**
| TP Size | Trail | Win Rate | Net | Hold |
|---------|-------|----------|-----|------|
| None (baseline) | 5% | 54% | +0.574% | 8.0h |
| 25% at +0.5% | 5% | 58% | +0.401% | 8.0h |
| 50% at +0.5% | 5% | 63% | +0.229% | 8.0h |
| 75% at +0.5% | 5% | 67% | +0.057% | 8.0h |

**Verdict:** PARTIALLY WORKS. WR increases but net expectancy decreases. The partial TP locks in small gains but gives up the big winners that drive the edge.

---

## Test 4: Volatility Exit (ATR Contraction)

**Hypothesis:** Exit when ATR contracts significantly (move is "exhausted")

**Results:** ATR contraction exit almost never triggers within 8h. Most trades exit by timeout.

**Verdict:** INCONCLUSIVE for this timeframe. ATR contraction takes longer to develop.

---

## FINAL RECOMMENDATION

**Best Strategy: Fast Drop Mean Reversion with Trailing Stop**

| Parameter | Value |
|-----------|-------|
| Entry | BTC drops >= 2.0% in 1H candle |
| Action | Go LONG at close |
| Exit | Trailing stop 5% from peak, OR max 8h hold |
| Expected | +0.574% net per trade, 54% WR |
| Frequency | ~24 events per year (~2 per month) |

**This achieves:**
1. Intraday hold (<= 8h)
2. Positive expectancy after fees (+0.574% - 0.15% = +0.424%)
3. Reasonable win rate (54%)

**However:** n=24 is small. Needs validation on more data.

---

## Next Steps

1. Validate on ETH and other assets
2. Test on more recent data (2024-2026)
3. Consider combining with regime filter (only trade in range/bear markets)

---

## Files

- `fast-signals/explore.mjs` - Dynamic exit tests
- Data: `data/btcusdt-1h-long.json` (333 days)
