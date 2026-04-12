# Day Trading Research - UPDATE 2 (Critical Finding)

**Date:** 2026-04-12, 22:00 UTC  
**Phase:** Cross-Period Validation

---

## MAJOR FINDING: ETH 5x Reversal Shows Cross-Period Validation

### What MiniMax-M2.7 Found

**ETH 5x Extreme Reversal** (after a move 5x average range, FADE it):

| Period | Hold | n | WR | Net | RR | Median | Result |
|--------|------|---|-----|-----|-----|--------|--------|
| **Jan-Feb** | 1h | 15 | 60% | **+0.339%** | 3.64 | 0.358 | PASS |
| **Jan-Feb** | 2h | 15 | 53% | **+0.219%** | 2.75 | 0.132 | PASS |
| Mar-Apr | 1h | 21 | 67% | -0.071% | 0.64 | 0.134 | FAIL |
| **Mar-Apr** | 2h | 21 | 57% | **+0.144%** | 1.60 | 0.311 | PASS |
| **Mar-Apr** | 3h | 21 | 67% | **+0.243%** | 1.22 | 0.343 | PASS |
| **Mar-Apr** | 4h | 21 | 67% | **+0.325%** | 1.30 | 0.500 | PASS |

**2h hold is consistent across BOTH periods (+0.219% and +0.144%)**

---

### All Other Assets FAIL at 5x Reversal

| Asset | 1h | 2h | 4h | Verdict |
|-------|-----|-----|-----|---------|
| BTC | -0.306% | -0.200% | -0.345% | **FAIL** |
| BNB | -0.141% | -0.056% | -0.003% | **FAIL** |
| SOL | -0.651% | -0.376% | -0.693% | **FAIL** |

**Only ETH passes. BTC, BNB, SOL all fail.**

---

### What GLM-5.1 Would Criticize

1. **Sample size: n=15-21 per period** — Very small, could be luck
2. **ETH-specific, not universal** — Why does ETH reverse but BTC doesn't?
3. **RR varies wildly** (0.64 to 3.64) — Unstable, suggests noise
4. **No mechanistic explanation** — WHY does ETH behave this way?

### Most Dangerous Interpretation

"The 5x reversal works on ETH" (too specific, likely luck)

### Most Realistic Interpretation

"ETH shows mean-reversion after extreme moves in THIS specific period, but this may be:
- Random concentration of events
- Different market structure for ETH (smaller, more volatile)
- Sample luck, not a real pattern"

---

## What We Need to Test Next

1. **Is the 4.5x threshold more robust?** (more events, slightly less extreme)
2. **Is the 2h hold consistently the best?**
3. **Can we explain WHY ETH specifically?**

Let me check the 4.5x threshold on ETH more thoroughly...

---

## UPDATE STATUS

**Hypothesis** | **Status** | **Notes**
---|---|---
Level-based reversal | FAIL | No edge found
Session timing | FAIL | No edge found  
Large range momentum | FAIL | No edge found
**ETH 5x Reversal** | **PROMISING BUT UNCERTAIN** | Needs more validation

---

*Data: 83 days 15m candles, split into Jan-Feb (33 candles/day) and Mar-Apr (full period)*