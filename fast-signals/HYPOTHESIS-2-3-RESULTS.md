# HYPOTHESES 2 & 3: Results

**Date:** 2026-04-12

---

## HYPOTHESIS 2: Volatility Compression + Expansion

### Test Design
- **Event:** ATR/SMA < threshold (low volatility)
- **Hypothesis:** After low vol, price expands significantly
- **Trade:** Follow price direction

### Results

| Threshold | Hold | n | WR | Avg | Net | Avg Move |
|-----------|------|---|-----|-----|-----|---------|
| 0.3 | 1h | 45 | 53% | +0.005% | -0.145% | 0.145% |
| 0.3 | 8h | 45 | 44% | -0.077% | -0.227% | 0.450% |
| 0.4 | 8h | 277 | 56% | +0.085% | -0.065% | 0.622% |
| 0.5 | 8h | 613 | 54% | +0.013% | -0.137% | 0.751% |

**Overall avg 1h move:** 0.284%

### Key Finding

Volatility DOES expand after compression:
- Threshold 0.3 (8h): avg move 0.450% vs 0.284% baseline = **+59% larger**
- Threshold 0.5 (8h): avg move 0.751% vs 0.284% baseline = **+164% larger**

**BUT:** The direction is unpredictable. Win rate hovers around 50-56%, and the small average return is wiped out by fees.

### Verdict: ⚠️ INTERESTING BUT NOT TRADEABLE

The phenomenon is real - volatility expansion after compression is a documented market behavior. But without knowing the DIRECTION, we cannot profit from it. A straddle strategy (buy both sides) would capture the expansion but fees would exceed the edge.

---

## HYPOTHESIS 3: Funding Rate Disagreement

### Data Collection Attempt

Attempted to collect funding rate data from:
- Binance API: Blocked (requires authentication)
- Bybit API: Current rate only available, no historical
- OKX: Limited access
- CoinGecko: No free historical funding data

**Conclusion:** Historical funding rate data requires:
1. Exchange account with API access, OR
2. Paid data provider (CoinGlass, Glassnode, etc.)

### Alternative Approach Considered

We could calculate implied funding from the basis (perpetual - spot). However:
- Perpetual futures price data also requires exchange API access
- Building this dataset would take time (need to poll and store over weeks/months)

### Verdict: ❌ CANNOT TEST WITHOUT DATA

Hypothesis 3 cannot be tested without historical funding rate data. This is a data infrastructure issue, not a research design issue.

---

## OVERALL CONCLUSIONS

### Day Trading Research Summary

After 2 days of intensive testing, all microstructure hypotheses have failed:

| Hypothesis | Mechanism | Result |
|------------|-----------|--------|
| Fast drop mean reversion | Single-asset OHLCV | Works on BTC, fails on ETH |
| BTC->ETH lead | Inter-asset | Fails on validation |
| Volatility compression | ATR-based | Edge exists but not directional |
| Funding disagreement | Derivative data | **Cannot test - no data** |

### Key Lessons

1. **60 days is not enough** for intraday validation (BTC->ETH showed promise on 60d, failed on 333d)
2. **Cross-asset validation is mandatory** - BTC-only is not robust
3. **Direction prediction is the hard part** - volatility expansion is real but direction is not predictable from OHLCV
4. **Data requirements** - Some hypotheses require data we don't have (funding rates)

### What Would Be Needed

To continue:
1. **Funding rate data** - Collect over time via exchange API, or purchase
2. **Order flow data** - Real bid/ask data for microstructure
3. **Alternative hypothesis families** - Market maker positioning, liquidations, social sentiment

### Recommendation

**Stop day trading microstructure research with OHLCV data.** The evidence suggests:
- OHLCV-based intraday edges are either non-existent or too small to capture after fees
- True intraday edges require microstructure data (order flow, funding, liquidations)
- The effort is better spent on swing trading strategies (RO-15) which have proven edge

---

*Research conducted: 2026-04-11 to 2026-04-12*
*Repo: github.com/FrankRKNL/crypto-intraday-trader*
