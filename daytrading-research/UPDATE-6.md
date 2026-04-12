# Update 6 — ETH Drawdown Recovery 1H Validator (2026-04-12 22:50 UTC)

## Status: 2 Validators Draaiende

### 1. Pump Validator (RO15) — Shadow Mode
- **PID:** 222
- **Status:** FLAT, wacht op daily candle close
- **BTC:** $71,273 | ETH: $2,209
- **Started:** 20:58 UTC
- **Signals:** 0 (wacht op daily candle sluiting ~22:00 UTC)

### 2. ETH Drawdown 1H Validator — NEW (PID 2634)
- **PID:** 2634
- **Strategy:** ETH >= 4% drop in 4h, red candle, 8h hold
- **Mode:** Paper trading, $10,000 equity
- **Status:** FLAT, monitoring 1H candles
- **ETH Price:** $2,198

---

## Belangrijke Nieuwe Bevindingen

### 1H vs 15m: 1H is BETER
Na testen van meerdere timeframe combinaties:

| Timeframe | Config | Trades | WR | Avg | P1 | P2 |
|-----------|--------|--------|-----|-----|-----|-----|
| 15m | DD>=3%, 4 candles, 2h hold | 18 | 61% | +1.775% | NEGATIEF | +3.9% |
| **1H** | **DD>=4%, 4 candles, 8h hold** | **50** | **72%** | **+1.006%** | **+0.782%** | **+1.230%** |

**1H versie wint:**
- 50 trades vs 18 (bijna 3x meer signals)
- 72% WR vs 61% (hoger)
- BEIDE periodes positief (vs P1 fail voor 15m)
- Fee insensitive tot 60bps

### Multi-Asset Test
Alleen ETH werkt goed voor dit patroon:

| Asset | Trades | WR | Avg |
|-------|--------|-----|-----|
| ETH | 18 | 61% | +1.775% |
| SOL | 19 | 47% | +0.704% |
| BNB | 11 | 55% | +0.327% |
| BTC | 9 | 56% | +0.749% |

### Lookback Window Test (ETH 15m)
4 candles isoptimaal:

| Lookback | Trades | WR | Avg |
|----------|--------|-----|-----|
| 2 candles | 12 | 50% | +0.263% |
| 3 candles | 20 | 55% | +1.508% |
| **4 candles** | **18** | **61%** | **+1.775%** |
| 5 candles | 11 | 45% | +1.313% |
| 6 candles | 7 | 29% | +0.558% |

---

## Kritische Bevinding: Strategie is Volatiliteit-Afhankelijk

Tijdens Jan-Feb (volatile): 18 signals in ~6 weken
Tijdens Maart-April (rustig): 0 signals in ~6 weken

**Implicatie:** De strategie vuurt ALLEEN af tijdens volatiele periodes. Dit is een dubbelzijdige eigenschap:
- **Positief:** Je handelt alleen wanneer er daadwerkelijk kansen zijn
- **Negatief:** Tijdens lage volatiliteit (zoals maart-april) verdien je niets

---

## Finale Config: ETH Drawdown Recovery 1H

```
ENTRY:
- ETH daalt >= 4% over 4 opeenvolgende 1H candles (4 uur)
- Alle 4 candles moeten omlaag sluiten
- Laatste candle moet ROOD sluiten
- Entry bij open van volgende candle

EXIT:
- Exact 8 uur na entry (8 candles)
- GEEN stop loss
- GEEN take profit
- GEEN trailing stop

RISK MANAGEMENT:
- Max 1-2% equity per trade
- Position size = (risk%) / (expected loss%)
- With 1.74% avg loss and 1% risk: size = 1/1.74 = ~57% of equity
- USE LESS: 10-20% equity per trade max
```

---

## Voortgang (22:50 UTC)

Nog ~6 uur te gaan (tot ~04:30 UTC).

**Gedaan:**
- [x] ETH Drawdown 1H validator gebouwd en gestart
- [x] Pump validator (RO15) bevestigd draaiend
- [x] Multi-asset test (ETH beste)
- [x] Timeframe test (1H beter dan 15m)
- [x] Lookback window optimalisatie
- [x] Hold period optimalisatie

**Nog Te Doen:**
- [ ] GitHub commit/push van nieuwe validator
- [ ] Diepere markt regime analyse
- [ ] Overweeg Bollinger Band squeeze test
- [ ] Overweeg orderbook-based entry test
- [ ] GLM-5.1 review (probeer opnieuw)

---

## Running Validators
```bash
# Check ETH Drawdown 1H
tail -f /home/node/.openclaw/workspace/crypto-intraday-trader/logs-drawdown-1h/live-2026-04-12.log

# Check Pump Validator
tail -20 /home/node/.openclaw/workspace/crypto-live-validator/logs/validator-2026-04-12.log
```
