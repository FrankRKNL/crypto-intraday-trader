# NEW DAY TRADING HYPOTHESES - Shortlist

**Date:** 2026-04-12  
**Context:** After rejecting the "fast drop mean reversion" strategy for failing cross-asset validation, we need FUNDAMENTALLY DIFFERENT mechanisms.

---

## Failed Approaches (Do Not Repeat)

| Approach | Why Failed |
|----------|------------|
| EMA trend following | Signals too lagging, no edge |
| Simple candle patterns | No robust edge in OHLCV |
| Mean reversion after fast drops | Works on BTC, not ETH |
| Volume spike continuation | No reliable edge |
| Simple time-of-day | No consistent edge |
| Simple lead-lag | Insufficient edge |

---

## Shortlist: 3 New Hypotheses

---

### HYPOTHESIS 1: Cross-Asset Momentum Lead (BTC → ETH)

**Mechanism:**
BTC is the "leader" in crypto. When BTC makes a sustained move (3+ candles in same direction), ETH typically follows with a DELAYED momentum move in the same direction.

**Why different:**
- Tests inter-asset relationship, not single-asset patterns
- Uses multi-timeframe confirmation (3+ candles vs single candle)
- Not mean reversion, not trend following in the traditional sense — it's a LEAD-LAG ARB strategy

**Data needed:**
- BTC 15m candles (we have 52 days)
- ETH 15m candles (we have 52 days)
- Need to align timestamps precisely

**Hypothesis:**
After BTC 15m makes 3 consecutive candles in same direction, BTC leads ETH by ~15-30 minutes. Trade the FOLLOW-THROUGH on ETH.

**Probability:** KANSRIJK

**Why:** BTC/ETH correlation is well-documented. The question is whether the lead is exploitable after fees. We already know ETH follows BTC — the question is the timing and magnitude.

**Risk:** The delay might be too short to exploit, or already priced in.

---

### HYPOTHESIS 2: Volatility Compression + Expansion (ATR-Based)

**Mechanism:**
Volatility is cyclical. After periods of LOW volatility (ATR below moving average), a VOLATILITY EXPANSION occurs. This expansion tends to happen in the direction of the current trend, but can be traded in either direction with a tight stop.

**Why different:**
- Not price-based entry, but VOLATILITY-BASED entry
- Uses the observation that low-vol periods precede high-vol moves
- Not EMA, not candle pattern — it's a "volatility regime" signal

**Data needed:**
- 1H candles + ATR calculation (we have this)
- Can test on BTC AND ETH simultaneously

**Hypothesis:**
When ATR(14) drops below 25% of its 100-candle SMA, a volatility expansion is imminent within 4-8 hours. Trade the expansion in both directions (straddle) with tight stops.

**Probability:** MIDDELMATIG

**Why:** Volatility clustering is real in financial markets. But exploiting it intraday is hard because the expansion can happen in either direction. We would need a direction filter.

**Alternative:** Only trade expansions in the direction of the dominant trend (EMA filter).

**Risk:** The expansion direction is unpredictable without a filter.

---

### HYPOTHESIS 3: Funding Rate Disagreement + Price

**Mechanism:**
Funding rate is the cost of holding perpetual futures. When funding is EXTREMELY negative (bearish sentiment) but price has NOT dropped significantly, there is a disagreement between futures and spot markets. This disagreement tends to resolve in favor of spot.

**Why different:**
- Uses DERIVATIVE market data (funding), not just price/volume
- Not a pattern in OHLCV — it's a cross-market structural signal
- Funding creates arbitrage pressure that affects spot price

**Data needed:**
- Funding rate history (need to collect from exchange APIs)
- 1H candles (we have this)
- We collected some funding data before (need to check)

**Hypothesis:**
When funding rate drops below -0.5% (extreme bearish) but price is flat/rising, the funding dislocates and creates a short squeeze. Go LONG with tight stop.

**Probability:** MIDDELMATIG

**Why:** Funding extremes are known to create squeezes. The question is whether the timing is precise enough for intraday.

**Risk:** 
1. Weaker exchanges have manipulators that cause funding to misbehave
2. Timing is crucial — when does the squeeze actually happen?

---

## Recommended Priority Order

1. **Hypothesis 1 (Cross-Asset Lead)** — Most testable with existing data, well-documented mechanism
2. **Hypothesis 2 (Volatility Compression)** — Good for understanding regime transitions, but needs direction filter
3. **Hypothesis 3 (Funding Disagreement)** — Most interesting but requires new data collection

---

## Why These Are Different

| Hypothesis | Mechanism | vs Failed Approaches |
|------------|-----------|---------------------|
| Cross-Asset Lead | Inter-asset lead-lag | Uses 2 assets, not single |
| Volatility Expansion | Vol regime change | Uses derived metric (ATR), not price pattern |
| Funding Disagreement | Cross-market structure | Uses derivative data, not spot OHLCV |

---

## Next Steps

1. **Hypothesis 1:** Write a quick script to test BTC→ETH lead on 15m data
2. **Hypothesis 2:** Calculate ATR regime on existing 1H data
3. **Hypothesis 3:** Check if we have funding rate data, collect if not

---

*Generated: 2026-04-12*
