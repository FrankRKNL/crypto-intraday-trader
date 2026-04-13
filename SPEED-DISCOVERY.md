# ETH Drawdown Recovery - Speed Filter Discovery (2026-04-12 23:45 UTC)

## MAJOR FINDING: Speed Filter Transforms Results

### The Pattern:
- Early fast drop (capitulation)
- Late slow grind (exhaustion)
- Speed ratio > 2 = early drop is 2x faster than late drop

### Results:

| Config | n | WR | Avg | Median |
|--------|---|-----|-----|--------|
| Speed > 2 (all) | 15 | 80.0% | +1.662% | +1.469% |
| Speed > 2 + DD>=6% | 5 | **100%** | **+3.338%** | +2.794% |
| Speed > 2 + Block US | 8 | **100%** | +2.130% | +2.794% |
| Speed > 2 + Block Fri | 10 | 70.0% | +1.672% | +1.801% |
| Speed > 2 + Tue/Wed | 3 | 66.7% | +3.605% | +3.504% |
| Speed > 3 (extreme) | 10 | 80.0% | +1.808% | - |

### Best Config: Speed > 2 + DD>=6%
- **n=5, WR=100%, Avg=3.338%**
- 5 trades, all winners, average +3.338% per trade
- This is the "CAPITULATION" pattern

### Why Speed Works:
A fast drop followed by slow grinding down = capitulation. 
The market overshoots on the initial fear, then stabilizes as selling exhaustion sets in.
The bounce happens when the "panic" buyers (who bought the dip) get stopped out, but smart money is accumulating.

### Sample Size Warning:
n=5 is very small. Need more out-of-sample validation.

### Next Steps:
1. Lower speed threshold slightly to get more samples
2. Test with trailing stop (instead of fixed 8h hold)
3. Create new validator with speed filter
4. Monitor for next capitulation event

### Scripts Created:
- speed-filter-combo.mjs - Speed filter tests
- results-speed-filter-combo.json - All trades with speed data

### Validators Running:
1. RO15 (PID 223)
2. ETH Drawdown 1H original (PID 3500)
3. ETH Drawdown Optimized v2 (PID 5122)