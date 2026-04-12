# POST-MORTEM: Fast Drop Mean Reversion Strategy

**Date:** 2026-04-12  
**Status:** REJECTED for production use

---

## 1. Strategy Summary

**Entry:** BTC/ETH drops >= 2.0% in 1H candle → go LONG at close  
**Exit:** 5% trailing stop OR 8h max hold  
**Hypothesis:** After a fast drop, price mean-reverts (bounces back)

---

## 2. Results

| Asset | n | Win Rate | Avg Return | Net | Median | Result |
|-------|---|----------|-----------|-----|--------|--------|
| BTC | 24 | 63% | +0.357% | **+0.207%** | +0.264% | PASS |
| ETH | 108 | 45% | +0.245% | **-0.219%** | -0.116% | FAIL |

**Verdict:** Strategy rejected. BTC-only edge is not robust enough for autonomous trading.

---

## 3. Why Did BTC Work?

**Most plausible explanation:** BTC has stronger "safe haven" narrative. When BTC drops fast, buyers step in expecting:
1. Support/resistance levels
2. "Buy the dip" behavior from retail
3. Larger market cap = more stable price dynamics

BTC's market depth and narrative strength create a real mean-reversion force after overextended drops.

---

## 4. Why Did ETH Fail?

**Most plausible explanations (in order of likelihood):**

### A) Altcoin Momentum Effect
ETH is treated as an "altcoin risk asset," not a safe haven. When ETH drops:
- Traders SELL MORE (stop losses cascade)
- No "buy the dip" narrative like BTC
- ETH drops further after initial drop → continuation, not reversal

### B) Different Volatility Profile
ETH has higher volatility, which changes the payoff structure:
- Larger moves in both directions
- Mean reversion after "normal" drops doesn't work because ETH's normal IS large moves
- The 2% threshold captures a different event for ETH than BTC

### C) Regime Sensitivity
ETH may have had different regime (more trending/bear periods) during the test window, but we didn't filter by regime.

### D) Sample Period
333 days is not enough to be conclusive. ETH might show the pattern in different market conditions.

---

## 5. Most Plausible Hypothesis

**The "Asset Class Effect":**

BTC functions as a "flight to safety" asset within crypto. ETH functions as a "risk-on" asset.

This means:
- BTC drops → buyers step in (mean reversion works)
- ETH drops → sellers exit, risk-off (continuation works)

**This is a MECHANISM difference, not a parameter tuning issue.** No amount of optimization will make ETH behave like BTC for this strategy.

---

## 6. General Lesson

### Cross-Asset Validation is Mandatory

A strategy that works on ONE asset but fails on ANOTHER is NOT a robust strategy. It is at best an "asset-specific observation."

**Required validation protocol:**
1. Test on BTC → promising results
2. Test on ETH → fails
3. **STOP.** Do not pass go. Do not collect optimization ideas.
4. Either:
   - Accept BTC-only (and document the limitation), OR
   - Investigate why the mechanism differs, THEN retest

**What we learned:**
- We did NOT have a robust strategy
- We had a BTC-specific observation
- These are different things

---

## 7. What Would Be Needed for ETH?

To make this work on ETH, we would need to understand:
1. Does ETH show mean reversion at DIFFERENT thresholds?
2. Does ETH require a DIFFERENT exit (not trailing stop)?
3. Does ETH only show mean reversion in SPECIFIC regimes?

But this would be "optimization" of a fundamentally broken hypothesis. We reject the strategy.

---

## 8. Formal Rejection Criteria Met

| Criterion | Status |
|-----------|--------|
| Works on BTC AND ETH | ❌ ETH fails |
| Not dependent on 2-3 trades | ⚠️ BTC top 5 = 84% of PnL |
| Robust to parameter shifts | ⚠️ 1.5% fails, 2.0% works |
| Positive at realistic fees | ✅ BTC yes, ETH no |

**Final verdict:** REJECTED FOR PRODUCTION AUTONOMOUS TRADING

---

## 9. Future Research Direction

This research confirms:
- BTC has unique safe-haven dynamics
- Cross-asset strategies require understanding the MECHANISM, not just the pattern
- Mean reversion after drops works on BTC but NOT on ETH

This finding is valuable for understanding BTC's market microstructure, even if it's not a production strategy.

---

*Research conducted: 2026-04-12*  
*Repo: github.com/FrankRKNL/crypto-intraday-trader*
