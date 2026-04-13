╔══════════════════════════════════════════════════════════════════════════╗
║       BREAK IT — ETH Red Candle Drawdown Recovery Falsification        ║
║                          FINAL REPORT                                   ║
╚══════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 1 — REGIME TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VERDICT: Strategy FAILS in BULL markets.

  Regime      n      WR       mean       median     verdict
  ─────────────────────────────────────────────────────────
  BEAR          1    100%       2.34%      2.34%    ⚠️ n=1 insufficient
  NEUTRAL      87     60%       0.08%      0.30%    ✅ WORKS
  BULL         91     48%      -0.14%     -0.11%    ❌ FAILS

📌 BULL regime: n=91, WR=48%, mean=-0.14% ❗ NEGATIEF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 2 — WORST CASE ANALYSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Max Adverse Excursion (zonder stop loss):
  P5   (5% chance > this):  -6.42%
  P10  (10% chance > this): -4.87%
  Median:                   -1.22%
  Worst ever:               -15.27%

Worst 5 TRADES:
  1. 2026-01-31T15:00  return=-6.04%  AE=-11.21%  LOSS
  2. 2025-10-10T17:00  return=-5.44%  AE=-5.96%  LOSS
  3. 2026-01-31T14:00  return=-5.33%  AE=-6.64%  LOSS
  4. 2026-02-05T18:00  return=-5.12%  AE=-6.42%  LOSS
  5. 2025-11-13T15:00  return=-5.11%  AE=-5.99%  LOSS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 3 — DISTRIBUTIE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  n           = 179
  Mean        = -0.016%
  Median      = 0.139%
  StdDev      = 1.97%
  Skewness    = -0.14 (left tail - outliers KOSTEN)

Distribution percentiles:
  p10  = -2.47%
  p25  = -0.86%
  p50  = 0.14%  (median)
  p75  = 1.09%
  p90  = 2.16%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 4 — EXECUTION REALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Config                                          n     WR       mean       median
  ─────────────────────────────────────────────────────────────────────────────
  Baseline (perfect)                              179   54%      -0.02%      0.14%
  +0.15% fee + 0.1% slip + entry delay           179   42%       -0.44%        -0.25%
  +0.2% fee + 0.1% slip                          179   33%       -0.62%        -0.46%

📌 MET REALISTIC EXECUTION: WR=42%, mean=-0.44% ❌ VERLIESGEVEND

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL VERDICT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BREAK IT SCORE: 2/10

STRATEGIE: ❌ REJECTED

1. ❌ BULL REGIME FAILS: WR=48%, mean=-0.14% (negatief!)
2. ❌ REALISTIC EXECUTION = LOSER: mean=-0.44% met live fees
3. ❌ FAT TAIL RISK: P10 AE=4.9% zonder SL
4. ⚠️ NEUTRAL ONLY: Werkt alleen in range/zijwaartse markt

AANBEVOLEN: Geen paper trading. Strategy rejected.
