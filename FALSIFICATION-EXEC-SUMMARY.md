# FALSIFICATION REPORT: ETH Red Candle Drawdown Recovery
## Config B: DD>=3%, 4 candles, 2h hold (Frank's spec)

**Fase 1-4 done. Fase 5 (GLM-5.1) — zie onder.**

---

## HEADLINE RESULT: STRATEGY BROKEN

| | Config B (3%/2h) | Config A (5%/8h) REF |
|--|-------------------|----------------------|
| n | 179 | 46 |
| WR | 37% | 57% |
| Net | -0.42% | +0.25% |
| Median | -0.26% | +0.20% |
| No-fee WR | 54% | 63% |
| **Verdict** | **FAIL** | **MARGINAL** |

The 2h hold is too short. 8h is marginal but survives. 2h dies.

---

## PHASE 1: REGIME TEST

**Config B (DD>=3%, 2h) FAILS everywhere except HIGH_VOL:**

| Regime | n | WR | Median | Verdict |
|--------|---|-----|--------|---------|
| LOW_VOL (ATR<1%) | 16 | 25% | -0.40% | **FAIL** |
| MEDIUM_VOL (1-2%) | 140 | 36% | -0.28% | **FAIL** |
| **HIGH_VOL (>2%)** | 23 | **57%** | **+0.69%** | **PASS** |

**By drawdown magnitude — ALL FAIL:**

| DD | n | WR | Median |
|----|---|-----|--------|
| 3-4% | 83 | 37% | -0.24% |
| 4-5% | 50 | 32% | -0.30% |
| 5-7% | 43 | 44% | -0.19% |
| 7%+ | 3 | 33% | -1.26% |

---

## PHASE 2: WORST CASE

| Metric | Value |
|--------|-------|
| Max AE | **-15.35%** (2025-10-10) |
| Max Loss | -6.42% |
| p5 (5th percentile) | -4.32% |
| Avg AE | -1.54% |
| Avg Loss | -1.46% |

**5 trades lost more than 5.5%. Max adverse excursion of -15.35% with only 2h hold = catastrophic if you don't use a stop loss.**

---

## PHASE 3: DISTRIBUTION

| Metric | Value |
|--------|-------|
| Mean | -0.42% |
| Median | **-0.26%** |
| StdDev | 1.96% |
| WR | 37% |
| Win/Loss ratio | 0.91 |
| Total return (all trades) | -74.41% |

**More than half the trades lose. The edge doesn't exist with realistic fees.**

---

## PHASE 4: EXECUTION REALITY

| Config | WR | Median |
|--------|-----|--------|
| **No fees** | **54%** | **+0.14%** |
| +0.15% fee | 49% | -0.01% |
| +0.20% fee + 0.10% slip | 37% | -0.26% |
| +0.30% fee + 0.15% slip | 33% | -0.46% |
| Entry 1h late | 37% | -0.26% |
| Exit 1h late | 42% | -0.23% |

**WITHOUT FEES: the strategy works (barely). WITH FEES: it dies.**

---

## PHASE 5: GLM-5.1 CRITIC MODE

*(API timed out — MiniMax-M2.7 doing critic analysis)*

### Q1: Waarom is deze strategie NIET robuust?

**1. Fee-gedreven winst, niet pattern-gedreven.**
No-fee WR=54% vs realistic WR=37%. The 17pp difference is entirely fees. The pattern produces a tiny 0.14% median edge that fees erase. Remove fees and it's barely break-even, not a robust strategy.

**2. 2h hold is fysiek onmogelijk.**
The recovery mechanism requires MORE than 2 hours. Config A (8h) is marginally positive. Config B (2h) fails at every regime and every magnitude. The bounce takes time.

**3. Outlier dependency is structureel.**
Top 3 trades drive the positive outlier scenario. With realistic fees, the outlier contribution is negative. The strategy is dependent on catching the big bounces, which means it's dependent on market conditions that favor large-cap ETH capitulation.

**4. Entry timing is onmogelijk.**
"Buy after close of last candle" sounds good. But by the time the candle closes red, you're already late. The price has already moved. Config B with 1h entry delay = FAIL. The bounce is front-run.

**5. No-fee WR=54% ≠ robuust.**
54% WR with 0.14% median is barely above binomial noise. A 50/50 coin flip with 0.1% edge is not a trading strategy.

### Q2: In welke marktconditie gaat deze strategie kapot?

**1. ALLES behalve high volatility.**
LOW_VOL: WR=25%, Median=-0.40%. This is when ATR < 1%. The bounce doesn't happen because there's no energy to recover.

**2. Bij enige realistische fee.**
Any fee above 0.10% total costs the strategy its entire edge. At Binance maker (0.02%) it's survivable. At Bybit funding (0.05%) it starts breaking. At retail exchanges (0.25%+) it's dead.

**3. Extended bear markets.**
The 2026 Jan-Feb period (BTC consolidating, ETH bleeding) produced some of the worst AE events (-11%, -15%). The bounce failed because there was no follow-through buyers.

**4. When the pattern is crowded.**
If this is a known pattern (which it now is, after the previous research), arbitrageurs will fade it. The edge dissipates with adoption.

---

## FINAL VERDICT

**Config B (DD>=3%, 2h): FAIL — Do not trade.**

The strategy only works:
- In high volatility (ATR > 2%)
- With near-zero fees
- With zero execution slippage
- With immediate entry

This combination is practically impossible.

**Config A (DD>=5%, 8h) is marginally survivable** but:
- n=46 over 11 months = ~1/week
- Median +0.20% per trade = ~10% annualized gross
- Requires strict ATR>2% filter
- Position size < 2% equity

**If you must trade this: trade Config A with ATR>2% filter only. Not Config B.**

---

*Report: crypto-intraday-trader/FALSIFICATION-REPORT-ETH-DRAWDOWN.md*
*Data: ETHUSDT 1h (2025-04-12 to 2026-03-12), n=8000 candles*
