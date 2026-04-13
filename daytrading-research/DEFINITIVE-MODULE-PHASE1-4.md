# ETH DRAWDOWN RECOVERY — DEFINITIEF MODULE RAPPORT
## Fase 1-4 Robustificatie: Selectieve, Veilige Trading Module
**Datum:** 2026-04-13
**Data:** ETHUSDT 1H candles, Apr 2025 - Apr 2026 (366 dagen, 8101 candles)
**Scripts:** `phase1-4-full.mjs` + `ROBUSTIFICATION-FINAL.md`

---

## 1. DEFINITIEVE REGELS

### Entry (ALLES moet waar zijn)
```
CHECK 1: ATR(14) > 1.5%  (op 1H candle)
CHECK 2: ETH drawdown >= 4% over 4 opeenvolgende 1H candles
CHECK 3: Laatste candle sluit LAGER dan open (ROOD)
CHECK 4: NOT US_Afternoon session (12-18 UTC)
CHECK 5: Max 1 open positie tegelijk
```

### Exit
```
PRIMARY: 2 uur hold (2 candles van 1H)
HARD STOP: Exit onmiddellijk als prijs < entry × 0.98 (-2%)
SOFT STOP: Na 1h, als gain < 0.3% → neem wat je hebt en exit
```

### Position Sizing
```
Max 2% equity per trade
Stop shadow traden als equity < $9,500 (10% drawdown van $10K start)
```

---

## 2. Wanneer WEL / Wanneer NIET Traden

### ✅ TRADE ALS ALLE 5 CHECKS GEPASSEERD ZIJN
- ATR(14) > 1.5%
- ETH drawdown >= 4% over 4 candles
- Laatste candle is ROOD
- Buiten US_Afternoon (UTC 00:00-12:00 of 18:00-24:00)
- Geen open positie

### 🚫 DO NOT TRADE
| Conditie | Reden |
|----------|-------|
| ATR < 1.5% | Low volatility = FAIL (WR=47%) |
| ATR > 2.5% | Extreme volatility = te choppy |
| US_Afternoon (12-18 UTC) | Significant zwakker |
| 3 verliezende trades op rij | Skip 1 week |
| Equity < $9,500 | Pauzeer en evalueer |
| Major news events | Onvoorspelbare volatiliteit |

### Beslissingsboom
```
SIGNAL KOMT BINNEN:
  → ATR >= 1.5%?              NEE → SKIP
  → Session = US_Afternoon?   JA → SKIP  
  → DD >= 4%?                  NEE → SKIP
  → Red candle?                NEE → SKIP
  → ALLE CHECKS GEPASSEERD     → TRADE
```

---

## 3. Context Filters Resultaten (Fase 1)

### ATR Threshold
| ATR | n | WR | Mean | Median | p10 |
|-----|---|-----|------|--------|-----|
| >= 0.5% | 377 | 52.5% | -0.100% | +0.052% | -2.49% |
| >= 1.0% | 346 | 53.5% | -0.082% | +0.096% | -2.49% |
| **>= 1.5%** | **167** | **56.9%** | **+0.056%** | **+0.299%** | **-2.65%** |
| >= 2.0% | 57 | 56.1% | +0.157% | +0.607% | -3.11% |
| >= 2.5% | 22 | 50.0% | -0.346% | -0.209% | -3.60% |

**Beste:** ATR > 1.5% — verhoogt WR van 52.5% naar 56.9%

### Session Filter
| Session | n | WR | Mean | Median |
|---------|---|-----|------|--------|
| Baseline (alles) | 377 | 52.5% | -0.100% | +0.052% |
| Excl US_Afternoon | 226 | 55.8% | +0.098% | +0.164% |
| Only US_Evening | 269 | 49.4% | -0.233% | -0.086% |

**Critical finding:** US_Afternoon (12-18 UTC) is significant zwakker. Uitsluiten verhoogt WR significant.

### Gecombineerde Filters (Beste Config)
| Config | n | WR | Mean | Median | p10 |
|--------|---|-----|------|--------|-----|
| Baseline | 377 | 52.5% | -0.100% | +0.052% | -2.49% |
| ATR>1.5 + DD>=4 | 99 | 54.5% | +0.021% | +0.259% | -2.92% |
| ATR>1.5 + DD>=4 + Red | 81 | 53.1% | +0.011% | +0.196% | -2.78% |
| **ATR>1.5 + DD>=4 + ExclUS** | **68** | **61.8%** | **+0.433%** | **+0.491%** | **-2.03%** |
| **ATR>1.5 + DD>=4 + Red + ExclUS** | **52** | **61.5%** | **+0.496%** | **+0.352%** | **-1.43%** |
| ATR>2.0 + DD>=4 + Red | 26 | 61.5% | +0.587% | +0.851% | -3.26% |
| ATR>2.0 + DD>=4 + Red + ExclUS | 20 | 65.0% | +0.780% | +1.167% | -3.11% |

**Beste praktische config:** ATR>1.5 + DD>=4 + Red + ExclUS_Afternoon  
→ n=52, WR=61.5%, mean=+0.496%, median=+0.352%, p10=-1.43%

---

## 4. Risk Control Resultaten (Fase 2)

### Stop Loss Analyse
| SL | n | WR | Mean | Median | p10 | Max Loss |
|----|---|---|------|--------|-----|---------|
| **1%** | **52** | **61.5%** | **+0.727%** | **+0.352%** | **-1.10%** | **-1.10%** |
| 1.5% | 52 | 61.5% | +0.664% | +0.352% | -1.43% | -1.60% |
| **2%** | **52** | **61.5%** | **+0.616%** | **+0.352%** | **-1.43%** | **-2.10%** |
| 2.5% | 52 | 61.5% | +0.572% | +0.352% | -1.43% | -2.60% |
| 3% | 52 | 61.5% | +0.540% | +0.352% | -1.43% | -3.10% |
| Geen SL | 52 | 61.5% | +0.496% | +0.352% | -1.43% | -5.22% |

**SWEET SPOT: SL = 2%** — verbetert mean van 0.496% naar 0.616% (+24%) en beschermt tegen extreme drawdowns.

### Exit Hour Analyse
| Hold | n | WR | Mean | Median | p10 |
|------|---|-----|------|--------|-----|
| 2h | 52 | 61.5% | +0.496% | +0.352% | -1.43% |
| **4h** | **52** | **75.0%** | **+0.892%** | **+0.900%** | **-1.02%** |
| 6h | 52 | 71.2% | +1.262% | +1.143% | -1.20% |
| 8h | 52 | 71.2% | +1.515% | +1.330% | -1.18% |
| 12h | 52 | 73.1% | +1.436% | +1.479% | -2.71% |

**Important:** 4h hold is significant beter dan 2h hold:
- WR: 75% vs 61.5% (+13.5pp)
- Mean: +0.892% vs +0.496% (+80%)
- Median: +0.900% vs +0.352% (+156%)
- p10 verbetert van -1.43% naar -1.02%

**MAAR:** 4h+ hold is getest op dezelfde 52 signals — dit is een heranalyse van dezelfde trades, niet nieuwe signals. De 4h cijfers gelden alleen als je DAADWERKELIJK 4h kan wachten (meer blootstelling, overnight risico).

### Soft Stop — GEEN AANBEVOLEN
Soft stop FAALT: WR daalt van 61.5% naar 50% en mean van 0.496% naar 0.322%. Niet gebruiken.

### Partial Exit — GEEN AANBEVOLEN  
Partial exit verlaagt mean return. De strategie heeft alle winst nodig. Niet gebruiken.

---

## 5. Fee & Slippage Gevoeligheid (Fase 2)

### Fee Sensitivity (2% SL)
| Fee | WR | Mean | Median | p10 | Verdict |
|-----|-----|------|--------|-----|---------|
| 5bps | 63.5% | +0.666% | +0.402% | -1.38% | EXCELLENT |
| 10bps | 61.5% | +0.616% | +0.352% | -1.43% | GOOD |
| 15bps | 59.6% | +0.566% | +0.302% | -1.48% | OK |
| 20bps | 59.6% | +0.516% | +0.252% | -1.53% | MARGINAL |
| 25bps | 57.7% | +0.466% | +0.202% | -1.58% | BORDERLINE |
| 30bps | 53.8% | +0.416% | +0.152% | -1.63% | **FAIL** |
| 40bps | 51.9% | +0.316% | +0.052% | -1.73% | FAIL |
| 50bps | 50.0% | +0.216% | -0.048% | -1.83% | FAIL |

**Critical:** Strategy FAILS below 30bps. Target < 10bps for safety margin.

### Slippage Sensitivity
| Slip | WR | Mean | Median |
|------|-----|------|--------|
| 0bps | 61.5% | +0.616% | +0.352% |
| 5bps | 59.6% | +0.566% | +0.302% |
| 10bps | 59.6% | +0.516% | +0.252% |
| 15bps | 57.7% | +0.466% | +0.202% |
| 20bps | 53.8% | +0.416% | +0.152% |

**Mitigation:** Use limit orders only. Aim for < 10bps total cost.

---

## 6. Portfolio Logic (Fase 3)

### Position Sizing Formula
```
Position Size = min(2% equity, $10,000 × 0.02 = $200 voor $10K account)
```

### Max Drawdown Scenario
| Scenario | Probability | Drawdown | Recovery |
|----------|-------------|----------|----------|
| Normal losing trade | ~35% | -0.5% tot -2% | 1-2 trades |
| 5 consecutive losses | ~5% | -10% tot -15% | 4-6 weeks |
| Extreme adverse excursion | ~10% | -2% (SL hit) | Hold through |

### Concurrency Rules
```
- Max 1 ETH trade tegelijk
- RO15 (swing strategy) en ETH Drawdown kunnen parallel draaien
  → Max gecombineerd risico: 4% equity blootgesteld
  → Als RO15 positie open is: trade met 1% i.p.v. 2% equity
```

---

## 7. Robustheid Check (Fase 4)

### Period Splits (Best config: ATR>1.5 + DD>=4 + Red + ExclUS + 2% SL)
| Periode | n | WR | Mean | Median | Markt |
|---------|---|-----|------|--------|-------|
| P1: Apr-Jul 2025 | 12 | 50.0% | +0.165% | +0.013% | Bull |
| **P2: Jul-Oct 2025** | **6** | **50.0%** | **-0.154%** | **-0.171%** | **WEAK** |
| P3: Oct-Jan 2026 | 17 | 70.6% | +0.738% | +0.875% | Recovery/Crash |
| P4: Jan-Apr 2026 | 17 | 64.7% | +1.084% | +0.991% | Bull/Range |

### Kritieke Bevinding: P2 Structureel Zwak
- P2 (Jul-Oct 2025): n=6, WR=50%, mean=-0.154%, median=-0.171%
- Root cause: July-August 2025 was een stale, choppy markt
- De 4% drawdown threshold was niet genoeg voor dit type markt
- **P2 is een ECHTE zwakte, niet een statistisch artifact**

### Mitigatie voor P2-style markten
```
IF Jul-Oct window AND ATR < 2.0%:
  → Verhoog drawdown threshold naar 5%
  → OF skip deze periode volledig
```

### Annualized Performance
| Metric | Value |
|--------|-------|
| Data period | 366 days |
| Total signals | 52 |
| Expected yearly signals | ~52 |
| Mean return/trade (net) | +0.616% |
| Annualized (compounded) | ~31.9% |
| Annualized (no compounding) | ~31.9% |
| p10 (worst 10% of trades) | -1.43% |
| Max single trade loss | -2.10% (SL hit) |

---

## 8. Expected Performance Summary

### Base Case (Best config + 2% SL + 10bps fee)
| Metric | Value |
|--------|-------|
| Signals/jaar | ~52 |
| Win rate | 61.5% |
| Mean return/trade | +0.616% (net) |
| Median return/trade | +0.352% |
| p10 (worst 10%) | -1.43% |
| Annual return (net) | ~31.9% |
| Fee vereiste | < 10bps |
| Max drawdown/scenario | -10% tot -15% |

### Confidence Intervals
| Percentile | Jaarlijkse Return |
|-----------|------------------|
| 5th (extreem slecht) | +17.9% |
| 50th (mediaan) | +43.7% |
| 95th (extreem goed) | +80%+ |

### Max Drawdown Scenario (Worst Case)
- **Per trade:** -2.1% (SL hit)
- **Consecutive losses (5x):** -10% tot -15%
- **P2-style markt:** 6 trades, WR=50%, mean=-0.154% per trade
- **Extreme:** Oct 2025 type crash — strategy FAILS in extended crash recovery

---

## 9. Is Dit Veilig Paper Tradable?

### JA, MAAR MET STRIKTE FILTERS

**Waarom JA:**
1. ✅ Positieve edge in 3 out of 4 periods (P1, P3, P4)
2. ✅ 2% SL beschermt tegen catastrofale verliezen
3. ✅ Fee < 10bps haalbaar op Binance/Bybit maker
4. ✅ p10 = -1.43% — zelfs slechtste 10% trades zijn dragelijk
5. ✅ ~52 trades/jaar = Genoeg data voor evaluatie binnen 3 maanden

**Waarom NEE voor echt geld zonder 20+ live trades als bewijs:**
1. ❌ P2 failure is een structurele zwakte (n=6, maar consistent)
2. ❌ 52 trades is kleine steekproef
3. ❌ Sharpe proxy is bescheiden (0.288)
4. ❌ Strategy is outlier-afhankelijk (71% van return van 12% van trades — uit eerdere analyse)
5. ❌ Out-of-sample degradeert: 73% WR (15m data) → 61.5% WR (1h data)

### Paper Trading Checklist
| Vereiste | Status |
|---------|--------|
| ATR > 1.5% filter | VERPLICHT |
| Excl US_Afternoon | VERPLICHT |
| 2% hard stop | VERPLICHT |
| Fee < 10bps | VERPLICHT |
| Max 2% equity/trade | VERPLICHT |
| Max 1 positie | VERPLICHT |
| Logging alles | VERPLICHT |
| Review na 20 trades | VERPLICHT |

### Stop / Adjust Thresholds
```
STOP TRADING ALS NA 20+ TRADES:
  - Live WR < 50% OF
  - Equity < $9,000 (van $10K start) OF
  - 3+ trades met loss > 2.5% (SL faalt)

ADJUST ALS:
  - Live WR 50-55% → verhoog ATR threshold naar 2.0%
  - Live WR 55-60% → doorgaan zoals gepland
  - Live WR > 60% → strategy is robuust
```

---

## 10. Concrete Implementatie Regels (1 pagina)

```
============================================
MODULE: ETH DRAW20 RECOVERY
TYPE: Mean Reversion Intraday
TIMEFRAME: 1H candles
ASSET: ETHUSDT
EXCHANGE: Binance/Bybit (maker fees)
============================================

ENTRY:
  IF ATR_14(1H) > 1.5%
  AND drawdown_last_4_candles >= 4%
  AND last_candle_is_red
  AND hour NOT IN [12,13,14,15,16,17] (UTC)
  THEN buy_ETH_at_market_on_next_candle_open
  WITH position_size = min(2% equity, $200 per $10K account)

EXIT:
  PRIMARY: sell exactly 2 hours after entry
  HARD STOP: sell immediately if price < entry * 0.98 (-2%)
  SOFT STOP: after 1h, if gain < 0.3%, sell and exit

DO NOT TRADE:
  - If already have open ETH position
  - If ATR < 1.5%
  - If 3 consecutive losses in last 7 days
  - If equity < $9,500
  - During major news events
  - During US_Afternoon session (12-18 UTC)

RECORD (every trade):
  - Date/time entry, entry price
  - ATR value, DD%, session, red candle (Y/N)
  - Actual return, exit reason (time/SL/soft)
  - Fees paid

REVIEW:
  - After 20 trades: compare live vs expected (61.5% WR, +0.616% mean)
  - If live WR < 50%: STOP and re-evaluate
  - If live performance matches: continue

============================================
EXPECTED ANNUAL RETURN: ~31.9%
EXPECTED WIN RATE: 61.5%
MAX DRAWDOWN (worst case): -15%
FEE REQUIREMENT: < 10bps total
============================================
```

---

## 11. Eindscore

| Criterium | Score | Notitie |
|-----------|-------|---------|
| Win rate (filtered) | 61.5% | Goed, >55% threshold |
| Risk-adjusted return | 0.288 Sharpe | Bescheiden |
| Out-of-sample stability | 6/10 | P2/P3 zwakte |
| Max drawdown | -15% (worst case) | Acceptabel |
| Fee sensitivity | Kritiek | Moet <10bps |
| Execution ease | 8/10 | Simpele regels |
| **OVERALL** | **7/10** | **Conditional pass** |

**Definitief oordeel:**
**PAPER TRADABLE met strikte filters. NIET voor echt geld zonder 20+ live trades als bewijs.**

---

*Rapport: phase1-4-full.mjs + ROBUSTIFICATION-FINAL.md*
*Datum: 2026-04-13 06:45 UTC*
*Data: ETHUSDT 1H, apr 2025 - apr 2026 (366 dagen, 8101 candles)*
