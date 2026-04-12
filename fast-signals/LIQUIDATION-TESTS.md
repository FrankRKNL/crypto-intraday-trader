# Liquidation Proxy Testing

**Date:** 2026-04-12  
**Conclusion:** OHLCV-based liquidation proxies do NOT produce robust tradable edges

---

## Methodology

Used wick-to-range ratio as proxy for liquidation sweeps:
- Wick > 75-90% of total candle range
- Body < 10-25% of range
- Direction: UP sweep (upper wick dominates) or DOWN sweep

## Results Summary

| Threshold | Type | n | WR | Avg Gross | Net After Fees |
|-----------|------|---|-----|-----------|----------------|
| >75% | UP fade | 197 | 56% | 0.087% | **-0.063%** |
| >80% | UP fade | 110 | 55% | 0.084% | **-0.066%** |
| >85% | UP fade | 46 | 57% | 0.118% | **-0.032%** |
| >90% | UP fade | 23 | 48% | 0.082% | **-0.068%** |

## Key Findings

1. **Edge exists** (gross 0.06-0.12%) but is **killed by fees** (0.15% round-trip)
2. **Higher threshold = fewer signals, not better edge** per trade
3. **WR 55-57%** with RR ~1.2-1.3 is insufficient when avg move < 0.15%

## Trading Simulation

Requiring >0.3% profit to take trade (after extreme sweep):
- Wick > 80%: 26 wins vs 34 losses = **43% success rate**
- Wick > 90%: 6 wins vs 6 losses = **50% success rate**

**Conclusion:** The OHHCV wick pattern is a weak proxy for actual liquidations. The signal exists but is too subtle for OHLCV candles to capture reliably.

## What Would Be Needed

Real liquidation data from:
- Coinglass API
- Binance Liquidation API
- Bybit liquidation feeds

Direct liquidation data would show stronger reversal patterns because:
1. Actual forced liquidations create more definitive bottoms
2. Precision timing vs candle-close approximation
3. Size information (how much was liquidated)

---

## Files

- `explore.mjs` - Initial fast-signal exploration
- Data: `data/btcusdt-15m-long.json` (52d), `data/btcusdt-1h-long.json` (333d)
