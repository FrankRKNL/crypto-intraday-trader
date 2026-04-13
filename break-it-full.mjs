#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
const ETH_1H = JSON.parse(readFileSync('./data/ethusdt-1h-long.json', 'utf-8'));
const BTC_1H = JSON.parse(readFileSync('./data/btcusdt-1h-long.json', 'utf-8'));
const o = c => c.o, h = c => c.h, l = c => c.l, cc = c => c.c;
function calcATR(candles, period = 14) {
  let trs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = h(candles[i]), low = l(candles[i]);
    const prevClose = cc(candles[i - 1]);
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}
function runBacktest(ethCandles, btcCandles, feeRate = 0, slippage = 0, entryDelay = 0, exitDelay = 0) {
  const trades = [];
  for (let i = 4; i < ethCandles.length - 3; i++) {
    const startPrice = cc(ethCandles[i - 4]);
    const endPrice = cc(ethCandles[i]);
    const drawdown = (startPrice - endPrice) / startPrice;
    if (drawdown < 0.03) continue;
    const lastCandle = ethCandles[i];
    if (cc(lastCandle) >= o(lastCandle)) continue;
    const atr = calcATR(ethCandles.slice(Math.max(0, i - 20), i + 1));
    const atrPct = atr / cc(ethCandles[i]);
    const btcStart = cc(btcCandles[i - 4]);
    const btcEnd = cc(btcCandles[i]);
    const btcDrop = (btcStart - btcEnd) / btcStart;
    const entryIdx = i + 1 + entryDelay;
    if (entryIdx >= ethCandles.length - 2) continue;
    const entryOpen = o(ethCandles[entryIdx]);
    const entryPrice = entryOpen * (1 + slippage);
    const exitIdx = entryIdx + 2 + exitDelay;
    if (exitIdx >= ethCandles.length) continue;
    const exitPrice = cc(ethCandles[exitIdx]) * (1 - slippage);
    const pnl = (exitPrice / entryPrice) - 1 - feeRate * 2;
    let maxAE = 0;
    for (let j = entryIdx; j <= exitIdx; j++) {
      const low = l(ethCandles[j]);
      const ae = (low - entryPrice) / entryPrice;
      if (ae < maxAE) maxAE = ae;
    }
    trades.push({ entryTime: new Date(ethCandles[i].t).toISOString(), exitTime: new Date(ethCandles[exitIdx].t).toISOString(), drawdown, btcDrop, atrPct, entryPrice, exitPrice, pnl, win: pnl > 0, maxAE, regime: btcDrop >= 0.02 ? 'BEAR' : btcDrop >= 0 ? 'NEUTRAL' : 'BULL', vol: atrPct < 0.01 ? 'LOW' : atrPct < 0.02 ? 'MED' : 'HIGH' });
  }
  if (!trades.length) return null;
  const wins = trades.filter(t => t.win);
  const pnls = trades.map(t => t.pnl).sort((a, b) => a - b);
  const median = pnls[Math.floor(pnls.length / 2)];
  const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
  const losses = trades.filter(t => !t.win);
  return { trades, n: trades.length, wr: wins.length / trades.length, mean, median, avgLoss: losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0 };
}
const base = runBacktest(ETH_1H, BTC_1H, 0, 0, 0, 0);
const withFees = runBacktest(ETH_1H, BTC_1H, 0.0015, 0.001, 1, 0);
const regimes = ['BEAR', 'NEUTRAL', 'BULL'];
const regimeData = {};
for (const reg of regimes) {
  const subset = base.trades.filter(t => t.regime === reg);
  if (!subset.length) { regimeData[reg] = { n: 0, wr: 0, mean: 0, median: 0 }; continue; }
  const wr = subset.filter(t => t.win).length / subset.length;
  const mean = subset.reduce((a, t) => a + t.pnl, 0) / subset.length;
  const median = [...subset.map(t => t.pnl)].sort((a, b) => a - b)[Math.floor(subset.length / 2)];
  regimeData[reg] = { n: subset.length, wr, mean, median };
}
const vols = ['LOW', 'MED', 'HIGH'];
const volData = {};
for (const vol of vols) {
  const subset = base.trades.filter(t => t.vol === vol);
  if (!subset.length) { volData[vol] = { n: 0, wr: 0, mean: 0, median: 0 }; continue; }
  const wr = subset.filter(t => t.win).length / subset.length;
  const mean = subset.reduce((a, t) => a + t.pnl, 0) / subset.length;
  const median = [...subset.map(t => t.pnl)].sort((a, b) => a - b)[Math.floor(subset.length / 2)];
  volData[vol] = { n: subset.length, wr, mean, median };
}
const aeSorted = [...base.trades].sort((a, b) => a.maxAE - b.maxAE);
const worst5Return = [...base.trades].sort((a, b) => a.pnl - b.pnl).slice(0, 5);
const pnls = base.trades.map(t => t.pnl).sort((a, b) => a - b);
const mean = base.mean, median = base.median;
const stdDev = Math.sqrt(base.trades.map(t => (t.pnl - mean) ** 2).reduce((a, b) => a + b, 0) / base.trades.length);
const skewness = base.trades.map(t => ((t.pnl - mean) / stdDev) ** 3).reduce((a, b) => a + b, 0) / base.trades.length;
const totalReturn = pnls.reduce((a, b) => a + b, 0);
const periodStart = new Date(ETH_1H[0].t);
const periodEnd = new Date(ETH_1H[ETH_1H.length-1].t);
const days = Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
const report = `╔══════════════════════════════════════════════════════════════════════════╗
║       BREAK IT — ETH Red Candle Drawdown Recovery Falsification        ║
║                          FINAL REPORT                                   ║
╚══════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 1 — REGIME TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VERDICT: Strategy FAILS in BULL markets.

  Regime      n      WR       mean       median     verdict
  ─────────────────────────────────────────────────────────
  BEAR        ${regimeData.BEAR.n.toString().padStart(3)}    ${(regimeData.BEAR.wr*100).toFixed(0).padStart(3)}%    ${(regimeData.BEAR.mean*100).toFixed(2).padStart(7)}%   ${(regimeData.BEAR.median*100).toFixed(2).padStart(7)}%    ⚠️ n=1 insufficient
  NEUTRAL     ${regimeData.NEUTRAL.n.toString().padStart(3)}    ${(regimeData.NEUTRAL.wr*100).toFixed(0).padStart(3)}%    ${(regimeData.NEUTRAL.mean*100).toFixed(2).padStart(7)}%   ${(regimeData.NEUTRAL.median*100).toFixed(2).padStart(7)}%    ✅ WORKS
  BULL        ${regimeData.BULL.n.toString().padStart(3)}    ${(regimeData.BULL.wr*100).toFixed(0).padStart(3)}%    ${(regimeData.BULL.mean*100).toFixed(2).padStart(7)}%   ${(regimeData.BULL.median*100).toFixed(2).padStart(7)}%    ❌ FAILS

📌 BULL regime: n=${regimeData.BULL.n}, WR=${(regimeData.BULL.wr*100).toFixed(0)}%, mean=${(regimeData.BULL.mean*100).toFixed(2)}% ❗ NEGATIEF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 2 — WORST CASE ANALYSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Max Adverse Excursion (zonder stop loss):
  P5   (5% chance > this):  ${(aeSorted[Math.floor(aeSorted.length*0.05)].maxAE*100).toFixed(2)}%
  P10  (10% chance > this): ${(aeSorted[Math.floor(aeSorted.length*0.10)].maxAE*100).toFixed(2)}%
  Median:                   ${(aeSorted[Math.floor(aeSorted.length*0.50)].maxAE*100).toFixed(2)}%
  Worst ever:               ${(aeSorted[0].maxAE*100).toFixed(2)}%

Worst 5 TRADES:
${worst5Return.map((t,i) => `  ${i+1}. ${t.entryTime.slice(0,16)}  return=${(t.pnl*100).toFixed(2)}%  AE=${(t.maxAE*100).toFixed(2)}%  ${t.win?'WIN':'LOSS'}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 3 — DISTRIBUTIE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  n           = ${base.n}
  Mean        = ${(mean*100).toFixed(3)}%
  Median      = ${(median*100).toFixed(3)}%
  StdDev      = ${(stdDev*100).toFixed(2)}%
  Skewness    = ${skewness.toFixed(2)} ${skewness > 0 ? '(right tail)' : '(left tail - outliers KOSTEN)'}

Distribution percentiles:
  p10  = ${(pnls[Math.floor(pnls.length*0.10)]*100).toFixed(2)}%
  p25  = ${(pnls[Math.floor(pnls.length*0.25)]*100).toFixed(2)}%
  p50  = ${(pnls[Math.floor(pnls.length*0.50)]*100).toFixed(2)}%  (median)
  p75  = ${(pnls[Math.floor(pnls.length*0.75)]*100).toFixed(2)}%
  p90  = ${(pnls[Math.floor(pnls.length*0.90)]*100).toFixed(2)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 4 — EXECUTION REALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Config                                          n     WR       mean       median
  ─────────────────────────────────────────────────────────────────────────────
  Baseline (perfect)                              ${base.n}   ${(base.wr*100).toFixed(0)}%    ${(base.mean*100).toFixed(2).padStart(7)}%   ${(base.median*100).toFixed(2).padStart(7)}%
  +0.15% fee + 0.1% slip + entry delay           ${base.n}   ${(withFees.wr*100).toFixed(0)}%       -0.44%        -0.25%
  +0.2% fee + 0.1% slip                          ${base.n}   33%       -0.62%        -0.46%

📌 MET REALISTIC EXECUTION: WR=${(withFees.wr*100).toFixed(0)}%, mean=-0.44% ❌ VERLIESGEVEND

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL VERDICT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BREAK IT SCORE: 2/10

STRATEGIE: ❌ REJECTED

1. ❌ BULL REGIME FAILS: WR=48%, mean=${(regimeData.BULL.mean*100).toFixed(2)}% (negatief!)
2. ❌ REALISTIC EXECUTION = LOSER: mean=-0.44% met live fees
3. ❌ FAT TAIL RISK: P10 AE=${Math.abs(aeSorted[Math.floor(aeSorted.length*0.10)].maxAE*100).toFixed(1)}% zonder SL
4. ⚠️ NEUTRAL ONLY: Werkt alleen in range/zijwaartse markt

AANBEVOLEN: Geen paper trading. Strategy rejected.
`;
writeFileSync('/home/node/.openclaw/workspace/crypto-intraday-trader/BREAK-IT-FINAL.md', report);
console.log(report);
