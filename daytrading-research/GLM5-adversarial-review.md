# GLM-5.1 Adversarial Review: ETH DRAW20 RECOVERY
**Date:** 2026-04-13
**Reviewer:** GLM-5.1 (adversarial critic mode)
**Data:** ETHUSDT 1H, 366 days, 52 qualifying trades

---

## EXECUTIVE SUMMARY

1. **Strategy is CONDITIONAL PASS for paper trading** — but has 3 structural weaknesses that could cause live failure
2. **P2 (Jul-Oct 2025) failure is a red flag** — 6 trades with negative mean/median suggests regime dependency
3. **Outlier dependency is NOT resolved** — the "best config" still relies on fat-tail distribution; the 1H data shows similar pathology as the 15m data

---

## STRUCTURAL WEAKNESSES

### 1. Regime Dependency — Strategy Works in ONLY 2 of 4 Periods

| Period | WR | Mean | Median | Verdict |
|--------|-----|------|--------|---------|
| P1 (Bull) | 50% | +0.165% | +0.013% | **MARGINAL** |
| **P2 (Jul-Oct 2025)** | **50%** | **-0.154%** | **-0.171%** | **FAIL** |
| P3 (Crash/Recovery) | 70.6% | +0.738% | +0.875% | PASS |
| P4 (Bull/Range) | 64.7% | +1.084% | +0.991% | PASS |

**P2 fails on BOTH mean AND median.** This is not noise — Jul-Oct 2025 was a stale, choppy recovery market where ETH drawdowns of 4% did NOT recover within 2 hours.

**Implication:** The strategy works best in EXTREME conditions (crash recovery, bull runs). It struggles in "meh" markets — exactly the conditions that occur most often.

### 2. Exit Time is Arbitrary — 2h is NOT Optimized

The "2h hold" was chosen without proper optimization. The exit hour sweep shows:

| Hold | WR | Mean | Median |
|------|-----|------|--------|
| 2h | 61.5% | +0.496% | +0.352% |
| 4h | 75.0% | +0.892% | +0.900% |
| 6h | 71.2% | +1.262% | +1.143% |

**But:** This is a SAME-SIGNALS reanalysis. You're measuring the SAME 52 trades at different exit times. This is NOT out-of-sample. The 4h numbers say "if you had held these specific trades 2 hours longer, they would have returned more" — but this is hindsight, not a forward strategy.

**Real question:** Would a 4h-entry strategy generate the same signals as a 2h-entry strategy? Likely NOT — the signal generation depends on the drawdown occurring within a lookback window. Longer hold = different signals.

**Verdict:** Exit time is a free parameter that was curve-fitted to the 2h mark. There is NO theoretical reason why 2h is optimal vs 3h or 4h.

### 3. Fee Sensitivity is Catastrophic Below 30bps

| Fee | Median | Verdict |
|-----|--------|---------|
| 10bps | +0.352% | GOOD |
| 20bps | +0.252% | MARGINAL |
| 30bps | +0.152% | BORDERLINE |
| 40bps | +0.052% | FAIL |
| 50bps | **-0.048%** | **NEGATIVE** |

The strategy has a **2-3x wider bid-ask spread tolerance** than typical intraday strategies, BUT:
- The median at 30bps is only +0.152% — this is razor thin
- At 40bps the median barely stays positive (+0.052%)
- At 50bps median turns negative

**Mitigation requires:** Binance/Bybit maker orders (< 5bps) + no slippage. Any degradation from market orders, weekend illiquidity, or high-volatility periods could push costs above 10bps.

### 4. Outlier Dependency (Previously Known, NOT Resolved)

From the earlier FALSIFICATION-REPORT: "71% of total return comes from just 5 trades (12% of sample)."

**This analysis does NOT fix that.** The 1H data (n=52) is still too small to distinguish genuine edge from lucky outliers. With only 52 trades, the 5 biggest wins could still represent a disproportionate share of returns.

**If the top 5 trades in this dataset are statistical anomalies (they all occurred in Mar-Apr 2025, a specific market condition), the strategy has ZERO real edge.**

---

## FORWARD-LOOKING BIAS CHECK

### What could have favored this strategy in the analysis?

1. **Lookback window was set BEFORE seeing results** — but the 4-candle lookback was chosen because it maximized edge in early testing, not from theory
2. **Red candle filter was selected post-hoc** — multiple filters were tested, and the combination that "worked" was reported; this is textbook multiple testing bias
3. **ATR threshold of 1.5% was chosen after testing 0.5%, 1.0%, 1.5%, 2.0%, 2.5%, 3.0%** — selecting the threshold that works best inflates apparent performance
4. **Session exclusion (US_Afternoon) was chosen from 4 sessions** — again, multiple testing inflates apparent edge
5. **Period splits are in-sample** — P1, P2, P3, P4 are all from the SAME dataset used to optimize the strategy. True out-of-sample testing requires data the strategy was NOT optimized on (e.g., testing on Jan-Mar 2025 AFTER optimizing on Apr-Dec 2024).

### What is genuinely out-of-sample?

- **P2 failure (Jul-Oct 2025):** This IS out-of-sample relative to any optimization done on later data. But n=6 is too small for statistical significance.
- **Fee sensitivity:** This is a mathematical transform, not an empirical finding. True out-of-sample.

---

## CONCRETE IMPROVEMENTS

### 1. Walk-Forward Validation (REQUIRED before paper trading)

Split the data:
- **Train:** Apr 2025 - Sep 2025 (6 months)
- **Test:** Oct 2025 - Apr 2026 (6 months)

Optimize parameters on TRAIN only. Validate on TEST only. If TEST performance is similar to TRAIN, the strategy is robust. If TEST performance degrades >30%, the strategy is curve-fitted.

**Current analysis is NOT walk-forward.** All optimization and reporting is on the full dataset.

### 2. Increase Signal Count — Trade BTC Too

Current: n=52 (ETH only, 1 year)

If you add BTC with the same rules (DD>=4%, Red, ATR>1.5%, Excl US_Afternoon):
- You would have ~52 BTC signals + ~52 ETH signals = ~104 signals
- This gives 2x the sample size
- BTC signals provide a SEPARATE asset validation

**If BTC signals ALSO show ~61% WR and positive mean/median, the strategy is more credible.**

### 3. Stress-Test the P2 Failure

The Jul-Oct 2025 window (6 trades, WR=50%, mean=-0.154%) is the biggest red flag.

**Proposed fix:** In Jul-Oct windows, either:
- Raise ATR threshold to >2.5% (only trade in high-vol conditions)
- Raise DD threshold to >6% (only trade extreme capitulation)
- Skip entirely

This would reduce signals but increase win rate in this regime.

### 4. Formalize Entry/Exit Rules with Quantifiable Thresholds

Currently:
- Entry: "ATR > 1.5%" — OK, quantifiable
- Entry: "DD >= 4%" — OK
- Entry: "Last candle is RED" — OK
- Exit: "2 hours" — ARBITRARY (see weakness #2)

**Better:** The exit time should be tied to a measurable property of the market at entry, not an arbitrary number.

Proposed: Exit when:
- Price recovers to within X% of the pre-drawdown peak, OR
- 2 hours have passed (whichever comes first)

This is an active exit vs passive time-based exit, and it captures the intuition "the bounce should happen within a reasonable time."

---

## FINAL VERDICT

### CONDITIONAL PASS (with mandatory walk-forward test)

**What must happen BEFORE paper trading:**

| Step | Requirement | Status |
|------|-------------|--------|
| 1 | Walk-forward validation (train/test split) | **NOT DONE** — MUST DO |
| 2 | BTC validation (same rules) | **NOT DONE** — RECOMMENDED |
| 3 | P2 stress test (Jul-Oct mitigation) | **NOT DONE** — RECOMMENDED |
| 4 | Fee < 10bps confirmed | REQUIRED |
| 5 | Position sizing ≤ 2% equity | REQUIRED |
| 6 | Logging every signal | REQUIRED |

**Score: 6/10** (structureel zwak, maar met fixes verdedigbaar)

**Reasoning:**
- The strategy has a REAL signal (DD recovery after capitulation)
- BUT: P2 failure is a genuine regime weakness, not noise
- AND: Multiple testing bias in filter selection means the reported 61.5% WR is likely an overestimate
- AND: n=52 is too small to distinguish real edge from outliers

**If walk-forward test shows TEST WR > 55% AND TEST mean > 0.3%:**
→ Upgrade to UNCONDITIONAL PASS for paper trading

**If walk-forward test shows TEST WR < 55% OR TEST mean < 0.3%:**
→ FAIL — strategy is curve-fitted; do not paper trade

---

## RECOMMENDED IMMEDIATE ACTION

1. Implement walk-forward test: train on Apr-Sep 2025, test on Oct 2025-Apr 2026
2. Report TEST metrics (not train metrics)
3. If TEST WR > 55%, proceed with paper trading
4. If TEST WR < 55%, STOP — the strategy is not ready

**Do NOT paper trade without this validation.**

---

*Review: GLM-5.1 adversarial mode*
*Date: 2026-04-13*
*Based on: phase1-4-full.mjs output + DEFINITIVE-MODULE-PHASE1-4.md*
