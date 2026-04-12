# Day Trading Research - Update 1

**Date:** 2026-04-12, 21:45 UTC  
**Phase:** Hypothesis testing (3 initial hypotheses)

---

## STATUS UPDATE

### 1. Current Hypotheses Under Investigation

**Hypothesis A: Level-Based Reversal (Yesterday's High/Low)**
- Event: Price breaks yesterday's high/low with volume
- Trade: Mean reversion back to broken level
- Result: ALL NEGATIVE (n=241 BTC, n=228 ETH)
- Verdict: KANSLOOS

**Hypothesis B: Session-Based Bias**
- Event: Trade based on Asian/European/US session timing
- Result: ALL NEGATIVE across all 3 sessions, all 4 assets
- Verdict: KANSLOOS (no systematic intraday session edge)

**Hypothesis C: Large Range + Volume Breakout (Momentum)**
- Event: Range > 1.5-3x average AND volume > 1.5-2x average
- Trade: Follow direction (momentum)
- Result: ALL NEGATIVE across all thresholds, all 4 assets
- Verdict: KANSLOOS

**Hypothesis C2: Extreme Move Reversal**
- Event: After EXTREME move (3-5x average range), price reverses
- Trade: FADE the extreme move (contrarian)
- Result: **INTERESSANT maar NIET ROBUUST**

| Asset | Threshold | Hold | n | WR | Net | RR | Median | Result |
|-------|----------|------|---|-----|-----|-----|--------|--------|
| ETH | 4x | 2h | 72 | 56% | +0.042% | 1.30 | 0.248 | PASS |
| ETH | 5x | 1h | 36 | 64% | +0.100% | 1.22 | 0.242 | PASS |
| ETH | 5x | 2h | 36 | 56% | +0.175% | 1.97 | 0.282 | PASS |
| BTC | 5x | 2h | 36 | 53% | -0.200% | 0.78 | 0.064 | FAIL |
| SOL | 5x | 2h | 25 | 52% | -0.376% | 0.61 | 0.013 | FAIL |

---

### 2. What MiniMax-M2.7 thinks

The ETH reversal at 5x range is the most promising signal so far:
- WR 56-64%, positive expectancy after fees
- RR up to 1.97 (winners are ~2x larger than losers)
- Median returns positive (0.24-0.28%)
- Sample: n=36 (2h hold) to n=72 (4h hold)

**BUT:** 
- Sample size is small (36-72 events in 83 days)
- BTC doesn't replicate the pattern at 5x
- SOL doesn't replicate
- This looks like another "asset-specific" pattern

---

### 3. What GLM-5.1 would say (Critical Analysis)

"The ETH 5x reversal pattern has a fatal flaw: it's tested on ONE asset, ONE period."

**Concerns:**
1. **Sample size:** n=36 at 5x threshold is very small. Could be luck.
2. **BTC fails at same threshold:** BTC at 5x, 2h has n=36, net=-0.200% — opposite direction!
3. **No cross-period validation:** Need to split 83 days into train/test
4. **Mechanism unclear:** WHY does ETH reverse after extreme moves but BTC doesn't?

**Most dangerous assumption:** "ETH at 5x is the pattern" vs "Some assets reverse at extreme moves"

---

### 4. Next Steps (Testing Now)

**Focus:** ETH 5x reversal — but need to validate robustness

1. Test if the edge holds at different hold times (1h, 2h, 3h, 4h)
2. Test if edge exists at 4.5x threshold (more data, slightly less extreme)
3. Split 83 days into periods (Jan-Feb vs Mar-Apr) to check consistency
4. Test on BNB/SOL at 5x threshold (do they show similar behavior?)

**If the pattern holds across periods and assets:** PROCEED to full validation  
**If it doesn't:** DROP and move to next hypothesis

---

### 5. Preliminary Conclusion

So far, 3 of 4 hypotheses have failed completely:
- Level-based reversal: FAIL
- Session timing: FAIL
- Large range momentum: FAIL

Only "extreme move reversal" shows any promise, and only on ETH at very high thresholds (4-5x average range).

**If ETH 5x reversal fails cross-period validation, we need new hypothesis directions.**

---

*Data: 83 days of 15m candles for BTC, ETH, BNB, SOL (2026-01-12 to 2026-04-06)*  
*Scripts: Hypothesis A/B/C tested in node.js*