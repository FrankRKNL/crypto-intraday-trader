# VALIDATION REPORT - Fast Drop Mean Reversion

**Date:** 2026-04-12  
**Strategy:** Fast drop (>= 2.0%) → LONG → 5% trailing stop → 8h max hold

---

## VALIDATION RESULTS

### TEST 1: CROSS-ASSET VALIDATION ❌ FAILS

| Asset | n | Win Rate | Net | Median | Result |
|-------|---|----------|-----|--------|--------|
| BTC | 24 | 63% | **+0.207%** | +0.264% | PASS |
| ETH | 108 | 45% | **-0.219%** | -0.116% | **FAIL** |

**Verdict:** Strategy is NOT cross-asset robust. Works on BTC, FAILS on ETH.

---

### TEST 2: PARAMETER ROBUSTNESS ⚠️ PARTIALLY ROBUST

**BTC:**
| Threshold | Hold | n | WR | Net | Result |
|-----------|------|---|-----|-----|--------|
| 1.5% | 8h | 65 | 49% | -0.194% | FAIL |
| 2.0% | 8h | 24 | 63% | +0.207% | PASS |
| 2.5% | 8h | 6 | 67% | +0.727% | PASS (n too small) |

**ETH:** FAILS at ALL thresholds (1.5%, 2.0%, 2.5%)

**Verdict:** Parameter sensitivity exists. 2.0% threshold is the minimum for BTC, but the strategy fails on ETH entirely.

---

### TEST 3: DISTRIBUTION ANALYSIS ⚠️ CONCENTRATED

**BTC:**
- Median: +0.264% (positive)
- Top 5 trades: 84% of total PnL
- Worst 5 trades: -114% of total PnL
- **Concern:** Top 5 contribute 84% - concentrated but not extreme

**ETH:**
- Median: **-0.116%** (negative - half of trades lose money)
- Top 5 trades: still negative (losing money)
- Worst 5 trades: dominate the distribution
- **Concern:** ETH has a LONG NEGATIVE TAIL - many large losses

**Verdict:** The edge is concentrated in a few trades on BTC. On ETH, the distribution is fundamentally different - mean reversion does NOT occur after fast drops.

---

### TEST 4: FEE SENSITIVITY ⚠️ BTC OK, ETH FAILS

| Fee | BTC Net | ETH Net |
|-----|---------|---------|
| 0.10% | +0.257% | -0.169% |
| 0.15% | +0.207% | -0.219% |
| 0.20% | +0.157% | -0.269% |
| 0.25% | +0.107% | -0.319% |

**Verdict:** BTC is fee-sensitive but survives at reasonable fees. ETH is negative regardless of fees.

---

## FINAL VERDICT

### STRATEGY STATUS: ❌ REJECTED

**Reason:** The strategy is NOT robust. It fails on ETH despite working on BTC.

**Why it fails on ETH:**
1. ETH median return is **negative** (-0.116%)
2. ETH win rate is only 45% (vs BTC's 63%)
3. ETH's "top 5" trades are still losing money
4. The mean reversion pattern that works on BTC does NOT exist on ETH

**Possible explanations:**
1. ETH is more mean-reversion-prone but in the WRONG direction (drops lead to more drops)
2. ETH has different volatility characteristics
3. The 333 days of data may not be enough for ETH
4. Crypto markets are non-stationary - what works on BTC may not transfer

---

## RECOMMENDATION

**Do NOT trade this strategy live.**

The cross-asset validation is the most critical test, and it fails. A strategy must work on multiple assets to be considered robust.

**What would be needed to make this robust:**
1. Test on more assets (BNB, SOL, etc.)
2. Understand WHY ETH fails (different market mechanics?)
3. Find a parameter set that works on ALL assets
4. Consider regime-filtering (only trade in certain market conditions)

---

## Files

- `fast-signals/DYNAMIC-EXIT.md` - Original exit strategy research
- `fast-signals/VALIDATION.md` - This validation report
