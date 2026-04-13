# Research Session Update - 2026-04-12 23:30 UTC

## Current Status: 12+ hours into research session

### Validators Running:
1. RO15 Live (PID 223) - paper trading BTC+ETH LONG, shadow mode
2. ETH Drawdown 1H (PID 3500) - DD>=5%, original config
3. ETH Drawdown Optimized (PID 5122) - DD>=6%, blocked US/Fri, NEW

### Key Findings So Far:

## 1. ETH Drawdown Recovery (1H) - BEST PATTERN
- Config: ETH drops >= 5-6% over 4h, red candle, 8h hold
- Historical: 77% WR, +1.85% avg (with filters)
- 8000 1H candles backtested (April 2025 - March 2026)

## 2. Conditional Analysis Results (NEW - this session)
- LOW volatility beats HIGH volatility: 78% vs 48% WR
- BEST days: Tue (83% WR, +2.9%), Wed (100% WR, +2.7%)  
- WORST days: Fri (63% WR, -0.9%), Sun (0% WR)
- US market hours (16-19 UTC): WORST performance
- 6%+ DD beats 5-6%: 75% vs 51% WR

## 3. Optimized Config (NEW)
- DD>=6% + Block US hours + Block Friday
- n=9, WR=77.8%, Avg=1.845%
- P1: +0.05%, P2: +2.74% (P2 much better - need more data)

## 4. Weekend Effect Discovery (2026-04-12 earlier)
- BTC weekend pump >3% tends to reverse Monday
- But sample size too small (10-28 trades per asset)
- Combined weekend+daily signals: only 3 occurrences in 11 months

## 5. What FAILED:
- All GLM-5.1 microstructure hypotheses (5 ideas)
- Standard TA (EMA, RSI, Bollinger)
- Session timing filters (except US hours blocking)
- Cross-asset BTC→ETH flow
- 15m timeframe (too noisy vs 1H)

## Scripts Written (this session):
- drawdown-conditional-analysis.mjs - Hourly, DD magnitude, BTC, day-of-week, volatility
- drawdown-optimized-test.mjs - Config comparison
- eth-drawdown-optimized-validator.mjs - Live validator v2 with optimized filters
- weekend-drawdown-combo.mjs - Weekend + drawdown combination
- btc-weekend-eth-drawdown.mjs - BTC weekend short + ETH drawdown long combo
- multi-timeframe-test.mjs - Trend detection with SMA200

## Time Remaining: ~5.5 hours

### Next Tests:
1. Test volume profile during drawdown (high volume capitulation vs low volume drift)
2. Test RSI at entry (oversold vs not oversold)
3. Test drawdown recovery with trailing stop (instead of fixed hold)
4. Orderbook-based entry timing (limit buy vs market buy)

### GitHub:
- All scripts in: /home/node/.openclaw/workspace/crypto-intraday-trader/
- Results in: results-drawdown-*.json
- Logs in: logs-optimized/

## Open Questions:
1. Why is P1 so much worse than P2? (0.05% vs 2.74%)
2. Why is volatility such a strong filter?
3. Can we combine weekday + volatility filters for even better results?