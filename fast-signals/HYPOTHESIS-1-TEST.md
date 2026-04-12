# HYPOTHESIS 1 TEST: BTC Extreme Move -> ETH Delayed Reaction

**Date:** 2026-04-12  
**Hypothesis:** Extreme BTC moves create a delayed, exploitable reaction in ETH

---

## Test Design

1. **Event (BTC):** Move >= threshold in 1 candle
2. **Entry:** Next 15m candle (simulates detection latency)
3. **Trade:** Follow BTC direction in ETH
4. **Hold:** 15min to 4h

---

## Results on 15m Data (60 days)

| Threshold | Direction | n | Hold | WR | Net |
|-----------|-----------|---|------|-----|-----|
| >= 1.0% (30min) | All | 129 | 60min | 58% | -0.040% |
| >= 1.5% (1h) | All | 109 | 60min | 56% | -0.043% |
| >= 2.0% (1h) | All | 41 | 60min | 59% | +0.027% |
| >= 2.0% (1h) | **UP only** | 32 | 30min | 69% | +0.037% |
| >= 2.0% (1h) | **UP only** | 32 | 60min | 66% | **+0.114%** |
| >= 2.0% (1h) | DOWN only | 9 | 60min | 33% | -0.282% |

**Initial finding:** UP moves only showed positive edge. DOWN moves failed completely.

---

## Results on 1H Data (333 days) — VALIDATION

| Threshold | Direction | n | Hold | WR | Net |
|-----------|-----------|---|------|-----|-----|
| >= 1.5% | All | 115 | 2h | 52% | -0.221% |
| >= 1.8% | All | 58 | 2h | 50% | -0.334% |
| >= 2.0% | All | 41 | 2h | 46% | -0.403% |
| >= 2.0% | UP only | 17 | 2h | 47% | -0.229% |
| >= 2.0% | DOWN only | 24 | 2h | 46% | -0.526% |

**VALIDATION FAILED:** The positive result on 60-day 15m data was a statistical fluke. On 333 days of data, ALL variations show NEGATIVE net expectancy.

---

## VERDICT: ❌ REJECTED

**Why it failed:**
1. The positive result on 15m data (60 days) did NOT replicate on 1H data (333 days)
2. This suggests the 60-day result was noise/random variation
3. The UP-only asymmetry was also not replicated

**Key lesson:**
- 60 days is NOT enough data to validate an intraday strategy
- Must validate on at least 1+ year of data before considering production

---

## Criteria Assessment

| Criterion | Result |
|-----------|--------|
| Net positive after fees | ❌ No (all negative on 333d) |
| Sufficient events (n > 100) | ⚠️ Depends on threshold |
| Consistent behavior | ❌ Failed cross-period validation |
| Cross-asset robust | ❌ Failed validation |

---

## Conclusion

**Hypothesis 1 is rejected.** The BTC -> ETH delayed follow-through does not provide a robust intraday edge.

---

*Files: data/btcusdt-15m-aligned.json (60d), data/btcusdt-1h-long.json (333d)*
