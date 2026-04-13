# FALSIFICATION REPORT: ETH Red Candle Drawdown Recovery v2
**Date:** 2026-04-13
**Author:** MiniMax-M2.7
**Strategy (FIXED):** ETH drops >=3% in 4 candles (open→close), last candle red, buy after close, hold 2h
**Data:** ETHUSDT 1h, 8000 candles (2025-04-12 to 2026-03-12)

---

## EXECUTIVE SUMMARY

| Config | n | WR | Net | Median | Verdict |
|--------|---|-----|-----|--------|---------|
| **A: DD>=5%, 8h (REF)** | 46 | 56% | +0.25% | +0.20% | MARGINAL |
| **B: DD>=3%, 2h (TEST)** | 179 | 37% | -0.42% | -0.26% | **FAIL** |
| **C: DD>=3%, 8h** | 179 | 50% | -0.09% | -0.01% | FAIL |

**The 2h exit is too short.** The original 8h hold works (marginally). Reducing to 2h KILLS the pattern.

**Fees are devastating.** The "66% WR" from previous reports was NO-FEE. Realistic fees (20bps + 10bps slippage) drop WR from 54% to 37%.

---

## CRITICAL METHODOLOGY NOTE

Drawdown definition: `(open_first_lookback_candle - close_last_lookback_candle) / open_first_lookback_candle`

This is NOT peak-to-trough. This is the open-to-close drop over the lookback window.

4 different methods tested. This one matches previous analysis (n=179 for DD>=3%/2h = correct).

---

## PHASE 1: REGIME TEST (Config B: DD>=3%, 2h, with fees)

| Regime | n | WR | Net | Median | Verdict |
|--------|---|-----|-----|--------|---------|
| LOW_VOL (ATR<1%) | 16 | 25% | -0.19% | -0.40% | **FAIL** |
| MEDIUM_VOL (1-2%) | 140 | 36% | -0.54% | -0.28% | **FAIL** |
| **HIGH_VOL (ATR>2%)** | 23 | **57%** | **+0.17%** | **+0.69%** | **PASS** |

**Key insight:** The strategy ONLY works in HIGH VOLATILITY environments (ATR>2%). When volatility is low or medium, it fails catastrophically.

### By Drawdown Magnitude (2h hold)

| DD | n | WR | Net | Median | Verdict |
|----|---|-----|-----|--------|---------|
| 3-4% | 83 | 37% | -0.40% | -0.24% | FAIL |
| 4-5% | 50 | 32% | -0.73% | -0.30% | FAIL |
| 5-7% | 43 | 44% | -0.01% | -0.19% | FAIL |
| 7%+ | 3 | 33% | -1.41% | -1.26% | FAIL |

**The pattern fails at EVERY drawdown magnitude with 2h hold.** It is NOT robust.

### ATR Filter Analysis (2h hold)

| ATR min | n | WR | Net | Median |
|---------|---|-----|-----|--------|
| 0.5% | 179 | 37% | -0.42% | -0.26% |
| 1.0% | 163 | 39% | -0.44% | -0.26% |
| 1.5% | 77 | 46% | -0.19% | -0.04% |
| **2.0%** | **23** | **57%** | **+0.17%** | **+0.69%** |

**ATR>2% filter saves the strategy.** But n=23 is too small for confidence.

---

## PHASE 2: WORST CASE ANALYSIS (Config B, 2h hold)

### Worst 5 Trades by Return

| # | Return | Max AE | Date |
|---|--------|--------|------|
| 1 | -6.42% | -11.30% | 2026-01-31 |
| 2 | -5.82% | -6.05% | 2025-10-10 |
| 3 | -5.71% | -6.74% | 2026-01-31 |
| 4 | -5.50% | -6.52% | 2026-02-05 |
| 5 | -5.49% | -6.08% | 2025-11-13 |

### Worst 5 Adverse Excursions

| # | Max AE | Return | Date |
|---|--------|--------|------|
| 1 | -15.35% | -2.95% | 2025-10-10 |
| 2 | -11.36% | -1.47% | 2025-10-10 |
| 3 | -11.30% | -6.42% | 2026-01-31 |
| 4 | -9.46% | -4.41% | 2026-01-31 |
| 5 | -7.55% | -3.07% | 2025-11-04 |

### Key Metrics

| Metric | Value |
|--------|-------|
| Max AE | **-15.35%** |
| Max Loss | -6.42% |
| p5 (5th percentile) | -4.32% |
| Average AE | -1.54% |
| Avg Loss | -1.46% |

**The max adverse excursion of -15.35% means you can be 15% in the red before the 2h is up. Without a stop loss, this is catastrophic.**

---

## PHASE 3: DISTRIBUTION (Config B, 2h hold, with fees)

| Metric | Value |
|--------|-------|
| Mean | -0.42% |
| **Median** | **-0.26%** |
| StdDev | 1.96% |
| p5 | -4.32% |
| p95 | +2.30% |
| Win Rate | 37% |
| Avg Win | +1.32% |
| Avg Loss | -1.46% |
| Win/Loss Ratio | 0.91 |
| Total Return | -74.41% |

**The median is negative. More than half the trades lose money. The outliers don't compensate.**

---

## PHASE 4: EXECUTION REALITY (Config B, 2h hold)

| Config | n | WR | Net | Median | Verdict |
|--------|---|-----|-----|--------|---------|
| **Perfect (no fees)** | 179 | **54%** | **-0.02%** | **+0.14%** | BREAK-EVEN |
| +0.15% fee only | 179 | 49% | -0.17% | -0.01% | FAIL |
| +0.20% fee + 0.10% slip | 179 | 37% | -0.42% | -0.26% | **FAIL** |
| +0.30% fee + 0.15% slip | 179 | 33% | -0.62% | -0.46% | **FAIL** |
| Entry 1h late | 179 | 37% | -0.42% | -0.26% | **FAIL** |
| Exit 1h late | 179 | 42% | -0.36% | -0.23% | **FAIL** |

**WITHOUT FEES: the strategy is break-even (WR=54%, median=+0.14%). WITH FEES: it fails.**

The previous analysis claiming 66% WR was likely no-fee. The realistic fee environment destroys the edge.

---

## PHASE 5: GLM-5.1 CRITIC MODE

**"Waarom is deze strategie waarschijnlijk NIET robuust?"**

1. **Fees eat all edge.** No-fee WR=54% → realistic fees WR=37%. The spread between these is entirely fee-driven.
2. **2h hold is too short.** Config A (8h hold) is marginally positive. Config B (2h) is negative. Recovery takes TIME.
3. **Outlier dependency at EVERY magnitude.** Even DD>=7% (n=3) has WR=33%. No sweet spot.
4. **The HIGH_VOL regime is the ONLY survivor.** This means the pattern is essentially "buy volatility expansion" — not a directional bounce play.

**"In welke marktconditie gaat deze strategie kapot?"**

1. **Low/medium volatility** — WR drops to 25-36%. The bounce doesn't happen within 2h.
2. **Low-fee assumption** — At maker 0% exchanges (Binance), the 20bps is unrealistic. But 10bps slippage IS realistic in volatile markets.
3. **Execution delay** — Even 1h entry delay kills it. By the time you confirm the red candle close, the bounce has already started.

---

## FINAL VERDICT

### BREAK IT Score: 9/10 — STRATEGY BROKEN

Config B (DD>=3%, 2h hold) **FAILS** on:
- Low volatility: WR=25%
- Medium volatility: WR=36%
- High fees: WR=37%
- Entry delay: WR=37%
- ALL drawdown magnitudes: ALL negative median

The ONLY pass condition is: **HIGH VOLATILITY (ATR>2%) + LOW FEES + IMMEDIATE ENTRY**

This is too many conditions for a robust strategy.

### What actually works

Config A (DD>=5%, 8h hold) with no fees:
- n=46, WR=63%, median=+0.60%, net=+0.65%

**But with realistic fees: n=46, WR=57%, median=+0.20%, net=+0.25%**

Still marginally positive, but:
- n=46 over 11 months = ~1 trade per week
- Median return per trade = +0.20%
- Annualized (50 trades): ~10% gross (before slippage)

**This is not a standalone strategy. It is a mild signal at best.**

---

## RECOMMENDATION

**Do NOT trade Config B (DD>=3%, 2h hold). It is broken.**

If you want to trade ETH drawdown recovery:
- Use Config A (DD>=5%, 8h hold)
- Only in HIGH VOLATILITY (ATR>2%)
- Only with low-fee exchanges (Binance maker)
- With tight slippage control
- Position size accordingly (1-2% equity per trade)

**Score for Config B (Frank's spec): CONDITIONAL FAIL**
**Score for Config A (original): CONDITIONAL PASS (with caveats)**
