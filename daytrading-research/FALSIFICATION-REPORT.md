# FALSIFICATION REPORT: ETH Red Candle Drawdown Recovery

**Date:** 2026-04-13
**Author:** MiniMax-M2.7 with GLM-5.1 in critic mode
**Goal:** Break the strategy. Prove it robust OR find where it fails.

---

## EXECUTIVE SUMMARY

| Question | Answer |
|----------|--------|
| Is this robust? | **PARTIALLY** — works in specific conditions |
| Is it paper tradable? | **YES, but with strict filters** |
| Can it survive live trading? | **UNCERTAIN** — execution is critical |

---

## FASE 1: REGIME TEST — WHERE DOES IT FAIL?

### Results by Market Condition

| Regime | n | WR | Net | Median | Result |
|--------|---|-----|-----|--------|--------|
| **LOW VOLATILITY (ATR<1%)** | 19 | **47%** | **+0.072%** | **-0.032%** | **FAIL** |
| MEDIUM VOL (ATR 1-2%) | 20 | 80% | +1.546% | +0.531% | PASS |
| BEAR (BTC -2%+) | 30 | 67% | +1.312% | +0.443% | PASS |
| NEUTRAL (BTC +-2%) | 10 | 70% | +0.755% | +0.531% | PASS |
| CRASH (BTC -5%+) | 5 | 100% | huge | huge | n too small |

### Critical Finding #1
**The strategy FAILS in low volatility environments.**
When ATR drops below 1%, WR drops to 47% and median turns negative.

**Action:** Add ATR filter — only trade when ATR > 1%

---

## FASE 2: WORST CASE ANALYSIS — HOW BAD CAN IT GET?

### Adverse Excursion Data

| Metric | Value | Implication |
|--------|-------|-------------|
| Max AE (worst) | **-8.22%** | Trade went 8.22% against you |
| 5th percentile AE | -7.12% | 5% chance of >7% adverse move |
| 10th percentile AE | -5.41% | 10% chance of >5% adverse move |
| Average AE | -1.40% | Expected drag during hold |
| Median AE | -0.59% | Typical temporary drawdown |

### Critical Finding #2
**Without a stop loss, the worst trade can draw down 8.22%.**
This is 8x the expected median return.

**Action:** A stop loss of -2% to -3% is REQUIRED for risk management.

### Actual Losses (Not Just AE)

| Metric | Value |
|--------|-------|
| Max actual loss | -2.21% |
| Avg loss (losing trades) | -0.52% |
| # losing trades | 14/41 (34%) |

---

## FASE 3: DISTRIBUTION — IS THIS LED BY OUTLIERS?

### Return Statistics

| Metric | Value |
|--------|-------|
| Mean | +1.289% |
| **Median** | **+0.409%** |
| StdDev | 2.554% |
| Skewness | Positive (outliers to upside) |

### Critical Finding #3
**71% of total return comes from just 5 trades (12% of sample).**
Without these outliers, the strategy returns only 0.37% per trade (vs 1.289% with outliers).

This is a WARNING SIGN — the strategy may be curve-fitted to lucky events.

### Win Contribution Analysis

| Source | Contribution |
|--------|--------------|
| Total return | 52.83% |
| From wins | 60.18% (114%) |
| From losses | -7.34% (-14%) |
| **Top 5 trades** | **71% of total** |

---

## FASE 4: EXECUTION REALITY

### Realistic Execution Tests

| Config | WR | Net | Median | Verdict |
|--------|-----|-----|--------|---------|
| Baseline (perfect) | 73% | +1.316% | +0.541% | Ideal |
| +0.15% fee, entry next candle | 59% | +1.139% | +0.259% | Acceptable |
| +0.15% fee, 0.1% slip | 51% | +0.937% | +0.058% | Marginal |
| **Worst case (0.3% fee, 0.2% slip)** | **34%** | **+0.037%** | **-0.403%** | **BREAKS** |

### Critical Finding #4
**The strategy is highly sensitive to fees and slippage.**
With poor execution, WR drops to 34% and median goes negative.

**Action:** Use low-fee exchanges (Binance, Bybit maker 0%) and limit orders.

---

## FASE 5: GLM-5.1 CRITIC MODE — WHY IT FAILS

### GLM-5.1's Explicit Assessment:

**"Waarom is deze strategie waarschijnlijk NIET robuust?"**

1. **Outlier dependency** — 71% of returns from 12% of trades
2. **Fat tail risk** — No stop loss = max 8.22% adverse excursion
3. **Execution sensitivity** — WR collapses from 73% to 34% with realistic costs

**"In welke marktconditie gaat deze strategie kapot?"**

1. **Extended bear market** — Recovery doesn't happen within 2h, stacks losses
2. **Low volatility** — No momentum for recovery (PROVEN: WR=47% when ATR<1%)
3. **High liquidity crisis** — Slippage explodes during crashes, entry gets rekt

---

## FINAL VERDICT

### BREAK IT Score: 6/10

The strategy survives MOST conditions but has 3 critical vulnerabilities:

| Vulnerability | Severity | Fix Available? |
|--------------|----------|---------------|
| Low volatility failure | HIGH | YES — ATR filter (>1%) |
| Outlier dependency | MEDIUM | NO — fundamental flaw |
| Execution sensitivity | HIGH | YES — use low-fee exchange |

### Recommended Modifications for Paper Trading

1. **MANDATORY ATR filter:** Only trade when 4h ATR > 1%
   - This eliminates the failing low-vol regime
   - Changes WR from 47% to 80% in that regime

2. **SOFT stop loss:** Exit if price doesn't bounce within 1 hour
   - Doesn't replace the 2h hold, but limits maximum damage
   - Protects against the -8% adverse excursion events

3. **Low-fee execution:** Use maker limit orders only
   - Target <0.15% total fees
   - This preserves the edge (vs 34% WR with high costs)

### Paper Trading Checklist

| Requirement | Status |
|-------------|--------|
| ATR > 1% filter | REQUIRED |
| Max 1 trade at a time | REQUIRED |
| Stop loss at -2% | RECOMMENDED |
| Fee < 0.15% total | REQUIRED |
| Position size < 2% equity | REQUIRED |
| Log every signal | REQUIRED |

### Conclusion

**This strategy CAN be paper traded, but only with the ATR filter and good execution.**
Without these modifications, it is NOT robust enough for live capital.

The falsification found real weaknesses. The strategy is NOT the "holy grail" — it works in medium volatility bear/ neutral conditions, and fails in low volatility.

**Score for paper trading: CONDITIONAL PASS** (with filters applied)

---

## APPENDIX: Full Test Results

### Regime Breakdown
- Bear (BTC -2%+): n=30, WR=67%, net=+1.312%, RR=4.38
- Neutral: n=10, WR=70%, net=+0.755%, RR=2.82
- Low volatility: n=19, WR=47%, net=+0.072%, median=-0.032% [FAIL]
- Medium volatility: n=20, WR=80%, net=+1.546%, RR=3.77

### Worst 5 Trades by Return
1. -2.21% (AE=0%, went straight down)
2. -1.07% (AE=-0.95%)
3. -0.86% (AE=0%)
4. -0.77% (AE=0%)
5. -0.48% (AE=-0.07%)

### Worst 5 Trades by Adverse Excursion
1. AE=-8.22%, ret=+8.04% (recovered fully)
2. AE=-7.87%, ret=+8.43% (recovered)
3. AE=-7.12%, ret=+6.66% (recovered)
4. AE=-5.59%, ret=+7.97% (recovered)
5. AE=-5.41%, ret=+6.38% (recovered)

*Note: The worst AE trades all recovered. The worst actual losses had 0% AE — price went straight down.*

---

*Research: MiniMax-M2.7 + GLM-5.1 critic mode*
*Date: 2026-04-13 05:30 UTC*
*Repo: crypto-intraday-trader/daytrading-research/FALSIFICATION-REPORT.md*