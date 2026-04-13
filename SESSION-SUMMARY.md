# Research Session Summary - 2026-04-13 00:15 UTC

## 4 Validators Running:
1. **RO15 Live** (PID 223) - BTC+ETH LONG, shadow mode
2. **ETH Drawdown 1H Original** (PID 3500) - DD>=5%, no extra filters
3. **ETH Drawdown Optimized** (PID 5122) - DD>=6%, Block US+Friday
4. **ETH Drawdown Speed** (PID 5469) - DD>=6%, Speed>2, Block US

## Key Discoveries (2026-04-12 23:30-00:15 UTC)

### 1. SPEED FILTER - MAJOR FINDING
**Capitulation Pattern**: Fast initial drop + slow grinding = best entry
- Speed ratio = (early drop %) / (late drop %)
- Speed > 2 = early drop is 2x faster than late drop
- Speed > 2 + DD>=6%: 100% WR, +3.338% avg (n=5)
- Speed > 2: 80% WR, +1.66% avg (n=15)

### 2. CONDITIONAL ANALYSIS
- Low volatility beats high: 78% vs 48% WR
- BEST days: Tue (83% WR), Wed (100% WR)
- WORST days: Fri (63% WR), Sun (0% WR)
- US market hours (16-19 UTC): WORST (50% WR, -0.34%)
- 6%+ DD beats 5-6%: 75% vs 51% WR

### 3. OPTIMIZED CONFIG
- DD>=6% + Block US + Block Fri
- n=9, WR=77.8%, Avg=1.845%
- P1: +0.05%, P2: +2.74% (P1 very weak!)

### 4. WEEKEND EFFECT
- BTC weekend reversal (from earlier research)
- Combined signals too rare (3 occurrences in 11 months)

## Research Scripts (this session)
- drawdown-conditional-analysis.mjs
- drawdown-optimized-test.mjs
- eth-drawdown-optimized-validator.mjs
- eth-drawdown-speed-validator.mjs
- weekend-drawdown-combo.mjs
- btc-weekend-eth-drawdown.mjs
- speed-filter-combo.mjs
- advanced-filters-test.mjs

## GitHub: bee9ef0
Committed and pushed 18 files.

## Current ETH Price: $2,196 (DD=0.98% from 4h high)
No signals active. Validators monitoring.

## Next Tests To Consider:
1. Lower speed threshold to 1.5 (get more samples)
2. Test trailing stop instead of fixed 8h hold
3. Combine speed + volatility filters
4. Test with different hold periods (12h, 16h, 24h)