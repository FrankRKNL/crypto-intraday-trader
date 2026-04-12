# Day Trading Research - UPDATE 3 (Pattern Confirmed on ETH Only)

**Date:** 2026-04-12, 22:15 UTC  
**Phase:** Cross-Asset Validation Complete

---

## PATTERN: ETH 4.5x Extreme Reversal (2h hold)

### Configuration
- **Event:** ETH moves >= 4.5x average range in 15m candle
- **Entry:** FADE the move (short after extreme rise, long after extreme drop)
- **Exit:** 2 hours (8 candles of 15m)
- **Fees:** 0.15%

### Cross-Asset Results

| Asset | Full Period (83d) | Period 1 (Jan-Feb) | Period 2 (Mar-Apr) |
|-------|-------------------|-------------------|-------------------|
| **ETH** | **PASS** +0.180% | **PASS** +0.188% | **PASS** +0.175% |
| BTC | FAIL -0.188% | FAIL -0.286% | FAIL -0.112% |
| BNB | FAIL -0.291% | FAIL -0.593% | FAIL -0.071% |
| SOL | FAIL -0.443% | FAIL -0.489% | FAIL -0.411% |

**ETH is the ONLY asset that works. BTC, BNB, SOL all fail.**

---

### ETH Detail

| Period | n | WR | Net | RR | Median |
|--------|---|-----|-----|-----|--------|
| Full | 51 | 59% | +0.180% | 1.73 | 0.302% |
| Jan-Feb | 19 | 58% | +0.188% | 2.05 | 0.282% |
| Mar-Apr | 32 | 59% | +0.175% | 1.58 | 0.369% |

**Consistent across both periods:**
- Win rate: 58-59%
- Net: +0.175% to +0.188%
- RR: 1.58-2.05
- Median positive: +0.28-0.37%

---

### What MiniMax-M2.7 Thinks

**This is a REAL pattern on ETH**, but:
1. Small sample (19-32 per period, 51 total)
2. ETH-specific (fails on all other assets)
3. No clear mechanism explanation
4. Could be coincidence / market structure

**Concerns:**
- Why only ETH? BTC fails at same threshold
- 19 events in Period 1 is very small
- RR varies (1.58 to 2.05) — instability
- No fundamental explanation identified

---

### What GLM-5.1 Would Critique

1. **"Why ETH?"** — If the mechanism is "extreme moves reverse," BTC should also show this. The fact it doesn't suggests either:
   - ETH has different market microstructure
   - This period had specific ETH events (possible airdrops, governance, etc.)
   - Sample luck

2. **Sample size** — n=19 in Period 1 is borderline. Could be 5-6 winners making the difference.

3. **No out-of-sample validation** — We've validated on Jan-Feb vs Mar-Apr, but both are in the same market regime (2026 crypto). Need bear/bull/sideways validation.

4. **The "ETH effect"** — Could be due to ETH's higher volatility or different participant behavior

---

## PATH FORWARD

### Option A: Accept ETH-only and investigate mechanism
- Try to understand WHY ETH reverses after extreme moves
- Test if the edge exists in older ETH data (2024, 2023)
- Consider this a "crypto microstructure observation" not a "general pattern"

### Option B: Drop and look for other patterns
- This is asset-specific, not a universal intraday edge
- Move to hypothesis D (new direction)

### Option C: Test if filters can make it cross-asset
- Maybe add a volatility filter that ETH meets but others don't
- Or add a market regime filter

---

## CURRENT STATUS

| Hypothesis | Status | Notes |
|------------|--------|-------|
| Level-based reversal | FAIL | No edge |
| Session timing | FAIL | No edge |
| Large range momentum | FAIL | No edge |
| **ETH 4.5x Reversal** | **PROMISING BUT ETH-ONLY** | Works on ETH, fails on BTC/BNB/SOL |

---

*Data: 83 days 15m candles for BTC, ETH, BNB, SOL*
*Period split: Jan-Feb (n≈33 candles/day) vs Mar-Apr*