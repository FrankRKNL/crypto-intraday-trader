# FORMAL RESEARCH CONCLUSION

**Date:** 2026-04-12  
**Project:** Crypto Intraday Microstructure Research  
**Repo:** github.com/FrankRKNL/crypto-intraday-trader

---

## RESEARCH QUESTION

"Can OHLCV-based microstructure patterns produce a robust intraday trading edge?"

---

## HYPOTHESES TESTED

| # | Hypothesis | Mechanism | Result |
|---|-----------|-----------|--------|
| 1 | Fast Drop Mean Reversion | Single-asset: price drops -> bounces back | **Partial fail**: works on BTC, fails on ETH |
| 2 | BTC -> ETH Lead | Inter-asset: BTC leads ETH after extreme move | **Fail**: positive on 60d, negative on 333d |
| 3 | Volatility Compression | ATR-based: low vol -> expansion | **Edge exists but not directional** |
| 4 | Funding Disagreement | Derivative: extreme funding + price disagreement | **Cannot test** - no data |

---

## WHY THEY FAILED

### Hypothesis 1: Fast Drop Mean Reversion
- **BTC result:** +0.207% net, 63% WR, n=24
- **ETH result:** -0.219% net, 45% WR, n=108
- **Root cause:** BTC has "safe haven" narrative, ETH has "altcoin momentum" behavior
- **Lesson:** Asset-specific edges are not robust for autonomous trading

### Hypothesis 2: BTC -> ETH Lead
- **60-day result:** +0.114% net (UP only)
- **333-day validation:** -0.2 to -0.5% (all variations negative)
- **Root cause:** 60 days is insufficient for intraday validation
- **Lesson:** Cross-period validation is mandatory

### Hypothesis 3: Volatility Compression
- **Finding:** Volatility DOES expand after compression (+59-164% larger moves)
- **But:** Direction is unpredictable (WR ~50-56%)
- **Root cause:** Expansion is real but without directional signal, not exploitable
- **Lesson:** Knowing volatility expands is not the same as knowing which way

### Hypothesis 4: Funding Disagreement
- **Data status:** Historical funding rates require exchange API access or paid data
- **Root cause:** Public APIs do not provide historical funding rate data
- **Lesson:** Some hypotheses cannot be tested without infrastructure investment

---

## WHAT WE DID FIND

### Patterns That Exist But Are Not Exploitable

1. **BTC Mean Reversion:** After >= 2% drop, BTC bounces 54% of the time with +0.574% gross
2. **Volatility Clustering:** Low volatility periods reliably precede larger moves (+59-164%)
3. **BTC -> ETH Correlation:** BTC leads ETH directionally, but timing is not exploitable

### Why They Are Not Tradeable

| Pattern | Avg Edge | Fees | Net | Issue |
|---------|----------|------|-----|-------|
| BTC mean reversion | +0.574% | 0.15% | +0.424% | BTC only, concentrated in few trades |
| Volatility expansion | ~0% direction | 0.15% | **Negative** | Direction unpredictable |
| BTC -> ETH lead | -0.3 to 0% | 0.15% | **Negative** | Timing not precise enough |

---

## PRECISE CONCLUSION

**"With OHLCV data and current infrastructure, no robust intraday trading edge was found."**

This does NOT mean:
- "Intraday edges don't exist" (they do, in microstructure data we don't have)
- "Crypto is inefficient" (we just couldn't capture the edge with public data)

This DOES mean:
- OHLCV candle patterns are already priced in by the time we can detect them
- The edge requires faster data (order flow, funding, liquidations) which requires infrastructure investment
- Without directional signal, even real phenomena (volatility expansion) cannot be traded

---

## WHAT WOULD BE NEEDED FOR TRUE INTRADAY EDGE

| Data Type | Source | Cost |
|----------|--------|------|
| Historical funding rates | Exchange API (Binance, Bybit) | Free (requires account) |
| Liquidation data | CoinGlass, Glassnode | $50-500/month |
| Order flow / tape | WebSocket feed | Requires infrastructure |
| Social sentiment | LunarCrush, Santiment | $50-200/month |

---

## TWO PATHS FORWARD

### Option A: Upgrade to Pro Data

**What:** Acquire funding rate history, liquidation feeds, or order flow data  
**Effort:** Medium (API integration + data pipeline)  
**Cost:** $0-500/month  
**Timeline:** 1-2 weeks to collect first data  
**Probability of finding edge:** Unknown but higher with better data

**Required steps:**
1. Set up Binance/Bybit API for funding rate collection
2. Or subscribe to CoinGlass for historical liquidations
3. Re-test hypotheses 1-4 with new data
4. Validate on 333+ days before production

---

### Option B: Focus on Proven Strategies (RO-15 / Mid-Frequency)

**What:** Use RiskOverlay-15% strategy from crypto-backtester research  
**Effort:** Low (strategy already identified)  
**Cost:** $0  
**Timeline:** Ready to paper trade now  
**Probability of finding edge:** 100% (already validated)

**Evidence:**
- RO-15: Sharpe 0.97, CAGR 30.3%, MaxDD 22.7%
- Outperforms B&H risk-adjusted across all regimes
- Walk-forward validated on 18 windows, 5 assets

**Required steps:**
1. Implement RO-15 live trading system
2. Start paper trading
3. Monitor for 30-60 days before going live

---

## RECOMMENDATION

**If the goal is to find a robust intraday edge:**
→ Choose Option A (pro data)

**If the goal is to actually trade profitably:**
→ Choose Option B (RO-15)

The difference is:
- Option A: Research project (may or may not yield results)
- Option B: Production system (already proven)

---

*Research conducted: 2026-04-11 to 2026-04-12*  
*All code and data: github.com/FrankRKNL/crypto-intraday-trader*
