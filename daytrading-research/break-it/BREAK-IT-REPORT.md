# BREAK IT REPORT — ETH Red Candle Drawdown Recovery
**Date:** 2026-04-13
**Author:** MiniMax-M2.7
**Data:** ETHUSDT 1h, 8000 candles (Apr 2025 — Mar 2026, ~333 days)
**Strategy:** 3% drop in 4 candles (1h) + RED candle filter + 2h hold

---

## Strategie (FIXED — geen aanpassingen)

| Parameter | Waarde |
|-----------|--------|
| Event | ETH daalt >= 3% over 4 consecutive 1h candles |
| Filter | Laatste candle sluit ROOD |
| Entry | Buy na close laatste candle |
| Exit | Exact 2 uur later (2 candles) |
| Stop Loss | GEEN |

---

## FASE 1 — REGIME TEST

**Vraag: Waar FAALT de strategie?**

| Regime | n | WR | Mean | Median | Verdict |
|--------|---|-----|------|--------|---------|
| **BULL** (BTC up) | 91 | **48%** | **-0.14%** | **-0.11%** | **❌ FAIL** |
| NEUTRAL (BTC -2/+2%) | 87 | 60% | +0.08% | +0.30% | ⚠️ Marginal |
| BEAR (BTC -2%+) | 1 | 100% | +2.34% | +2.34% | n=1, inconclusive |

| Volatiliteit | n | WR | Mean | Median | Verdict |
|-------------|---|-----|------|--------|---------|
| **LOW** (ATR<1%) | 17 | 53% | +0.42% | **0.00%** | ⚠️ Median=0 |
| MED (ATR 1-2%) | 139 | 53% | -0.12% | +0.11% | ⚠️ Marginal |
| **HIGH** (ATR>2%) | 23 | **65%** | **+0.30%** | **+0.96%** | ✅ PASS |

### Kritische bevinding #1
**De strategie FAALT in BULL markten.** WR=48%, mean=-0.14%. In bull markten
gaan ETH dumps snel weer omhoog — maar de bounce na 2u is te vroeg omdat
de downtrend doorzet. 91 trades (51% van sample) zijn verliesgevend.

**De strategie werkt het BEST in HIGH volatility.** WR=65%, median=+0.96%.
Grote dumps met hoge ATR = betere recovery kansen binnen 2u.

---

## FASE 2 — WORST CASE ANALYSE

**Vraag: Hoe erg kan het misgaan zonder stop loss?**

### Max Adverse Excursion (AE)
| Percentiel | AE | Interpretatie |
|-----------|-----|---------------|
| P5 (5% kans > dit) | -6.42% | 1 op 20 trades gaat 6%+ tegen |
| P10 | -4.87% | 1 op 10 trades gaat 5%+ tegen |
| Median | -1.22% | Typische tijdelijke dip |
| Worst ever | **-15.27%** | Catastrofaal |

### Slechtste 5 trades (return)
| # | Datum | Return | AE | Opmerking |
|---|-------|--------|-----|-----------|
| 1 | 2026-01-31 15:00 | **-6.04%** | -11.21% | Nooit gerecovered |
| 2 | 2025-10-10 17:00 | **-5.44%** | -5.96% | 2e golf verkoop |
| 3 | 2026-01-31 14:00 | **-5.33%** | -6.64% | Zelfde dag als #1 |
| 4 | 2026-02-05 18:00 | **-5.12%** | -6.42% | Corrections |
| 5 | 2025-11-13 15:00 | **-5.11%** | -5.99% | Altseason top |

### Kritische bevinding #2
**Zonder stop loss: max verlies = -6.04%.** Maar het ergste is dat de trade
tot -11.21% TEGEN je ging voordat hij "recoverede" naar -6.04%. Dit is
11% adverse excursion voor een strategie met +0.14% median return.
Risk/reward is ronduit gevaarlijk zonder SL.

**Gemiddeld verlies (78 losing trades): -1.53% per trade.**

---

## FASE 3 — DISTRIBUTIE

**Vraag: Is dit afhankelijk van outliers?**

| Statistic | Value |
|-----------|-------|
| n | 179 |
| Mean | -0.016% |
| **Median** | **+0.139%** |
| StdDev | 1.972% |
| Skewness | -0.14 (licht left-skew) |
| Total return | -2.89% |

### Return distributie
| Percentiel | Return |
|-----------|--------|
| p10 | -2.47% |
| p25 | -0.86% |
| **p50 (median)** | **+0.14%** |
| p75 | +1.09% |
| p90 | +2.16% |

### Kritische bevinding #3
**Mean is negatief (-0.016%), median is positief (+0.14%).**
De distributie is licht left-skew. De "outliers" zijn de slechte kant —
de slechtste 5 trades zijn -5% tot -6%. Dit is GEEN outlier-dependency
in de positieve zin (zoals de 15m versie). Dit is een distribuutie
waar de median de waarheid vertelt: +0.14% per trade, nauwelijks de moeite waard.

**Maar: mean is 0. De strategie breekt zelfs in het gunstigste geval niet.**

---

## FASE 4 — EXECUTION REALITY

**Vraag: Overleeft het realistic execution?**

| Configuratie | WR | Mean | Median | Verdict |
|-------------|-----|------|--------|---------|
| Baseline (perfect) | 54% | -0.02% | +0.14% | Nauwelijks break-even |
| +0.1% fee | 46% | -0.22% | -0.06% | ❌ Verlies |
| +0.2% fee | 38% | -0.42% | -0.26% | ❌ Verlies |
| +0.2% fee + 0.1% slip | 33% | -0.62% | -0.46% | ❌ Catastravaal |
| Entry delay 1 candle | 57% | +0.06% | +0.26% | ⚠️ Marginal |
| Exit delay 1 candle | 56% | +0.05% | +0.18% | ⚠️ Marginal |
| **Realistic (0.15% fee+0.1% slip+delay)** | **42%** | **-0.44%** | **-0.25%** | **❌ FAIL** |
| WORST (0.3% fee+0.2% slip+delays) | 29% | -0.95% | -0.71% | ❌ Catastravaal |

### Kritische bevinding #4
**De strategie verliest GEMIDDELD geld met realistische executie.**
-0.44% mean per trade. Bij 2 trades per week = -0.88% per week = -45% per jaar.
**Niet tradebaar in praktijk.**

Zelfs met "alleen maar fees" (0.1%): mean = -0.22%, WR daalt naar 46%.
Bij 0.2% fees: mean = -0.42%, WR = 38%.

---

## FASE 5 — GLM-5.1 CRITIC MODE

### "Waarom is deze strategie waarschijnlijk NIET robuust?"

1. **MEAN IS NUL OF NEGATIEF.** Op 1h candles: mean=-0.016%. Op 15m candles:
   +1.139%. Dit is een TIJDSFRAME-afhankelijke strategie, niet een robuuste edge.

2. **BULL MARKETS FAALEN BEWEZEN.** WR=48%, mean=-0.14% in bull markten (n=91).
   In bull markten worden dumps gekochd terwijl de downtrend nog maar net begonnen is.
   2u is te kort voor recovery in een markt die怎么说 moet dalen.

3. **EXEXCUTION MAAKT HET BREUK.** Realistische kosten (0.15% fee + 0.1% slippage):
   mean=-0.44%, WR=42%. Dit is structureel negatief.

4. **GEEN STOP LOSS = FAT-TAIL RISK.** Max adverse excursion = -15.27%.
   P5 = -6.42% (1 op 20 trades). Zonder SL is elke trade een gok van -6% potentieel verlies.

5. **LOOKBACK COMPATIBILITEIT.** Op 15m = 4 candles = 1u lookback. Op 1h = 4 candles = 4u.
   Dit detecteert ANDERE markt events. De strategie werkt op 15m maar faalt op 1h.

### "In welke marktconditie gaat deze strategie KAPOT?"

1. **BULL MARKETS (zwaarste regime).** WR=48%, mean=-0.14%. Koop-de-dip strategie
   faalt wanneer de dip doorzet in plaats van te rebounden. n=91 BEWEZEN.

2. **EXTENDED LOW-VOL SIDEWAYS.** ATR<1%: median=0.00%. G6en momentum voor recovery.
   Koers beweegt Zijwaarts na de dump = tijdsverlies = negatieve expected return.

3. **HIGH FEES + SLIPPAGE COMBO.** Alleen al 0.2% fee + 0.1% slip = -0.62% mean.
   Combineer met slechte timing = regelrecht verlies.

4. **EVENT MET WECKEND-EFFECT.** Weekend dumps (vrijdag/middag) rebounden maandag.
   2u hold eindigt zondag/nacht = geen recovery = verlies.

---

## TIJDSFRAME ANALYSE

### 15m vs 1h — Waarom verschillend?

| Aspect | 15m (83 dagen) | 1h (333 dagen) |
|--------|----------------|-----------------|
| Lookback | 4 x 15m = 1u | 4 x 1h = 4u |
| n (baseline) | 41 | 179 |
| WR | 66% | 54% |
| Mean | +1.139% | **-0.016%** |
| Median | +0.409% | +0.139% |
| Red candle filter | PASS (P1+P2) | FAILS (bull market) |

**Conclusie:** Op 15m detecteert de strategie snelle 1u dumps die binnen 2u rebounden.
Op 1h detecteert het langzamere 4u dumps waarbij 2u hold TE KORT is voor recovery.

**De strategie is TIJDSFRAME-GEVOELIG. 15m werkt, 1h faalt.**

---

## FINAL VERDICT

### BREAK IT Score: 3/10

| Criterium | Score | Reden |
|-----------|-------|-------|
| Win rate (baseline) | 4/10 | 54% nauwelijks break-even |
| Bull market performance | 2/10 | WR=48%, mean=-0.14% |
| Realistic execution | 1/10 | mean=-0.44% |
| Fat-tail risk | 2/10 | Max AE=-15.27%, P5=-6.42% |
| Timeframe robustness | 2/10 | werkt op 15m, faalt op 1h |
| **TOTAAL** | **3/10** | **NIET TRADEBAAR** |

### Conclusie

**Op 1h candles: FAIL.**
- Mean = 0%, niet break-even
- In bull markten: verloor geld (WR=48%)
- Met realistische executie: -0.44% per trade
- Max adverse excursion = -15.27%

**Op 15m candles: PASS (条件付き).**
- De eerder falsification vond +1.139% mean, 66% WR
- MAAR: outlier-afhankelijk en execution-sensitively

### Aanbeveling

1. **1h versie: NIET tradebaar.** Stop onderzoek.
2. **15m versie: Alleen paper trade met strikte filters:**
   - Alleen HIGH volatility (ATR > 2%)
   - Alleen wanneer BTC ook daalt
   - Max 1 trade per keer
   - Position size < 1% equity
   - Fee < 0.15% totaal

### Belangrijkste les

**De strategie is NIET robuust over tijdframes.** Wat op 15m werkt (snelle dumps
rebounden binnen 2u) werkt NIET op 1h (langzamere dumps hebben langere recovery).

---

*Report: break-it/BREAK-IT-REPORT.md*
*Script: break-it.mjs*
*Data: ethusdt-1h-long.json (8000 candles, Apr 2025 — Mar 2026)*