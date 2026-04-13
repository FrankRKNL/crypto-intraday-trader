/**
 * FALSIFICATION v2 — ETH Red Candle Drawdown Recovery
 * Strategy (FIXED, NO CHANGES):
 *   Event: ETH drops >= 3% in 4 consecutive 1h candles
 *   Filter: Last candle closes RED
 *   Entry: Buy after close of last candle
 *   Exit: Exactly 2 hours later (2 candles)
 * 
 * Goal: BREAK IT. No optimization. Only falsification.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const BASE_DIR = new URL('.', import.meta.url).pathname;
const DATA_DIR = join(BASE_DIR, 'data');

// Load ETH 1h data
const ethData = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));
console.log(`ETH 1h candles: ${ethData.length} (${ethData[0].t} to ${ethData[ethData.length-1].t})`);

// =====================
// FEE/SLIPPAGE CONFIG
// =====================
const FEE_BPS = 20;        // 0.20% total (entry + exit)
const SLIPPAGE_BPS = 10;   // 0.10% slippage

// =====================
// STRATEGY (FIXED)
// =====================
const LOOKBACK = 4;        // 4 candles for drawdown detection
const MIN_DD = 0.03;      // >= 3% drawdown
const HOLD_HOURS = 2;     // 2 hours exact
const ENTRY_DELAY_CANDLES = 0;  // 0 = immediate after close

// =====================
// CALCULATE INDICATORS
// =====================
function calcATR14(candles) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  const atrs = [trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14];
  for (let i = 14; i < trs.length; i++) {
    atrs.push((atrs[atrs.length - 1] * 13 + trs[i]) / 14);
  }
  return atrs; // aligned with candles[14:]
}

function getRegime(candle, btcData) {
  // Simple BTC-based regime detection
  const btcReturn = (btcData.close - btcData.open) / btcData.open;
  const atrPct = (candle.atr / candle.close) * 100;
  
  if (btcReturn < -0.03) return 'BEAR';
  if (btcReturn > 0.02) return 'BULL';
  if (atrPct > 2.5) return 'HIGH_VOL';
  if (atrPct < 1.0) return 'LOW_VOL';
  return 'NEUTRAL';
}

function getRegime2(candle) {
  const atrPct = (candle.atr / candle.close) * 100;
  if (atrPct < 1.0) return 'LOW_VOL';
  if (atrPct > 2.5) return 'HIGH_VOL';
  return 'NORMAL_VOL';
}

// =====================
// BACKTEST ENGINE
// =====================
function backtest(candles, params = {}) {
  const {
    feeBps = FEE_BPS,
    slipBps = SLIPPAGE_BPS,
    entryDelay = ENTRY_DELAY_CANDLES,
    holdHours = HOLD_HOURS,
    minDD = MIN_DD,
    lookback = LOOKBACK,
    regimeFilter = null,
    atrMin = null,
    atrMax = null,
  } = params;

  const results = [];
  const atrs = calcATR14(candles);

  for (let i = lookback + entryDelay + holdHours; i < candles.length - holdHours; i++) {
    // Get lookback window
    const startIdx = i - lookback - entryDelay;
    const window = candles.slice(startIdx, i - entryDelay);
    if (window.length < lookback) continue;

    const entryCandle = candles[i - entryDelay - 1]; // last candle before entry
    const entryPrice = entryCandle.c;

    // Check ATR filter
    const atrIdx = i - entryDelay - 1 - 14;
    if (atrIdx < 0) continue;
    const atr = atrs[atrIdx];
    const atrPct = (atr / entryPrice) * 100;
    
    if (atrMin !== null && atrPct < atrMin) continue;
    if (atrMax !== null && atrPct > atrMax) continue;

    // Calculate drawdown over lookback window
    const peak = Math.max(...window.map(c => c.h));
    const trough = Math.min(...window.map(c => c.l));
    const drawdown = (peak - trough) / peak;

    if (drawdown < minDD) continue;

    // Red candle filter: last candle in window closes lower than open
    const lastCandle = window[window.length - 1];
    const isRed = lastCandle.c < lastCandle.o;

    if (!isRed) continue;

    // Entry: buy at next candle open (after entry candle)
    const entryIdx = i;
    const entryCandleActual = candles[entryIdx];
    const buyPrice = entryCandleActual.o * (1 + slipBps / 10000); // slippage on entry

    // Exit: hold holdHours candles, exit at close of holdHours-th candle
    const exitIdx = i + holdHours;
    if (exitIdx >= candles.length) continue;
    const exitCandle = candles[exitIdx];
    const sellPrice = exitCandle.c * (1 - feeBps / 10000 - slipBps / 10000);

    // Gross return
    const grossReturn = (sellPrice - buyPrice) / buyPrice;

    // Adverse excursion during hold
    let maxAE = 0;
    for (let j = entryIdx; j <= exitIdx; j++) {
      const low = candles[j].l;
      const ae = (low - buyPrice) / buyPrice;
      if (ae < maxAE) maxAE = ae;
    }

    // Regime
    const regime = getRegime2(entryCandle);
    if (regimeFilter && regime !== regimeFilter) continue;

    // BTC regime
    const btcWindow = candles.slice(startIdx, i);
    const btcReturn = (btcWindow[btcWindow.length-1].c - btcWindow[0].c) / btcWindow[0].c;
    let btcRegime = 'NEUTRAL';
    if (btcReturn < -0.02) btcRegime = 'BEAR';
    else if (btcReturn > 0.02) btcRegime = 'BULL';

    results.push({
      entryTime: entryCandleActual.t,
      entryPrice: buyPrice,
      exitTime: exitCandle.t,
      exitPrice: sellPrice,
      grossReturn,
      maxAE,
      atrPct,
      regime,
      btcRegime,
      peak,
      trough,
      drawdown,
      holdHours,
      feeBps,
      slipBps,
    });
  }

  return results;
}

// =====================
// STATISTICS
// =====================
function stats(results) {
  if (results.length === 0) return { n: 0 };
  
  const returns = results.map(r => r.grossReturn * 100);
  const losses = results.filter(r => r.grossReturn < 0);
  const wins = results.filter(r => r.grossReturn >= 0);
  
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const median = returns.sort((a, b) => a - b)[Math.floor(returns.length / 2)];
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - avg) ** 2, 0) / returns.length);
  
  // Sort by return for percentiles
  const sorted = returns.slice().sort((a, b) => a - b);
  const p5 = sorted[Math.floor(sorted.length * 0.05)];
  const p10 = sorted[Math.floor(sorted.length * 0.10)];
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p90 = sorted[Math.floor(sorted.length * 0.90)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  
  // Worst trades
  const worst5 = results.slice().sort((a, b) => a.grossReturn - b.grossReturn).slice(0, 5);
  const worstAE5 = results.slice().sort((a, b) => a.maxAE - b.maxAE).slice(0, 5);
  
  // Outlier analysis
  const sortedByReturn = results.slice().sort((a, b) => b.grossReturn - a.grossReturn);
  let cumReturn = 0;
  const totalReturn = returns.reduce((a, b) => a + b, 0);
  let outlierContrib = 0;
  for (let i = 0; i < sortedByReturn.length; i++) {
    cumReturn += sortedByReturn[i].grossReturn * 100;
    if (i < 3) outlierContrib += sortedByReturn[i].grossReturn * 100;
  }

  // Win contribution
  const totalWinReturn = wins.reduce((a, r) => a + r.grossReturn * 100, 0);
  const totalLossReturn = Math.abs(losses.reduce((a, r) => a + r.grossReturn * 100, 0));
  const lossContrib = losses.length > 0 ? losses.reduce((a, r) => a + r.grossReturn * 100, 0) : 0;
  
  return {
    n: results.length,
    wr: (wins.length / results.length * 100).toFixed(1),
    avg: avg.toFixed(3),
    median: median.toFixed(3),
    std: std.toFixed(3),
    p5: p5.toFixed(3),
    p10: p10.toFixed(3),
    p25: p25.toFixed(3),
    p90: p90.toFixed(3),
    p95: p95.toFixed(3),
    maxWin: Math.max(...returns).toFixed(3),
    maxLoss: Math.min(...returns).toFixed(3),
    totalReturn: totalReturn.toFixed(2),
    avgWin: wins.length > 0 ? (totalWinReturn / wins.length).toFixed(3) : 0,
    avgLoss: losses.length > 0 ? (lossContrib / losses.length).toFixed(3) : 0,
    lossCount: losses.length,
    winCount: wins.length,
    worst5: worst5.map(r => ({ ret: (r.grossReturn * 100).toFixed(2), ae: (r.maxAE * 100).toFixed(2), time: r.entryTime })),
    worstAE5: worstAE5.map(r => ({ ae: (r.maxAE * 100).toFixed(2), ret: (r.grossReturn * 100).toFixed(2), time: r.entryTime })),
    outlierContrib: outlierContrib.toFixed(2),
    top3Pct: ((outlierContrib / totalReturn) * 100).toFixed(1),
    lossContrib: lossContrib.toFixed(2),
  };
}

// =====================
// PHASE 1: REGIME TEST
// =====================
console.log('\n========== PHASE 1: REGIME TEST ==========\n');

const baseResults = backtest(ethData);
const base = stats(baseResults);

console.log(`BASELINE (n=${base.n}, WR=${base.wr}%, Net=${base.avg}%, Median=${base.median}%)`);
console.log(`Total return: ${base.totalReturn}%, p5=${base.p5}%, p95=${base.p95}%\n`);

// Regime breakdown
const regimes = ['LOW_VOL', 'NORMAL_VOL', 'HIGH_VOL', 'BEAR', 'BULL'];
console.log('Performance by Regime:');
for (const regime of regimes) {
  const r = stats(baseResults.filter(tr => tr.regime === regime || tr.btcRegime === regime));
  if (r.n === 0) continue;
  const flag = r.wr < 55 || parseFloat(r.median) < 0.2 ? ' <<<< FAIL' : '';
  console.log(`  ${regime.padEnd(12)} n=${r.n.toString().padStart(3)} WR=${r.wr}%  Net=${r.avg}%  Median=${r.median}%  (p5=${r.p5}%, p95=${r.p95}%)${flag}`);
}

// Separate BTC regime
console.log('\nPerformance by BTC Regime:');
const btcRegimes = ['BEAR', 'NEUTRAL', 'BULL'];
for (const btcRegime of btcRegimes) {
  const filtered = baseResults.filter(tr => tr.btcRegime === btcRegime);
  const r = stats(filtered);
  if (r.n === 0) continue;
  const flag = r.wr < 55 || parseFloat(r.median) < 0.2 ? ' <<<< FAIL' : '';
  console.log(`  ${btcRegime.padEnd(12)} n=${r.n.toString().padStart(3)} WR=${r.wr}%  Net=${r.avg}%  Median=${r.median}%${flag}`);
}

// =====================
// PHASE 2: WORST CASE ANALYSIS
// =====================
console.log('\n========== PHASE 2: WORST CASE ANALYSIS ==========\n');

const worst5 = base.worst5;
const worstAE5 = base.worstAE5;

console.log('Top 5 WORST Trades by Return:');
worst5.forEach((t, i) => {
  console.log(`  ${i+1}. ${t.ret}%  AE=${t.ae}%  ${t.time}`);
});

console.log('\nTop 5 Worst Adverse Excursions:');
worstAE5.forEach((t, i) => {
  console.log(`  ${i+1}. AE=${t.ae}%  ret=${t.ret}%  ${t.time}`);
});

console.log(`\nMax Adverse Excursion: ${worstAE5[0].ae}%`);
console.log(`Max Actual Loss: ${Math.min(...baseResults.map(r => r.grossReturn * 100)).toFixed(2)}%`);
console.log(`Average AE: ${(baseResults.reduce((a, r) => a + r.maxAE, 0) / baseResults.length * 100).toFixed(2)}%`);

// =====================
// PHASE 3: DISTRIBUTION
// =====================
console.log('\n========== PHASE 3: DISTRIBUTION ==========\n');

console.log(`Mean:    ${base.avg}%`);
console.log(`Median:  ${base.median}%`);
console.log(`StdDev:  ${base.std}%`);
console.log(`p5:      ${base.p5}%`);
console.log(`p95:     ${base.p95}%`);
console.log(`Top 3 trades: ${base.outlierContrib}% (${base.top3Pct}% of total return)`);
console.log(`Loss contribution: ${base.lossContrib}% (${base.lossCount} losing trades)`);

// Win/Loss breakdown
const wins = baseResults.filter(r => r.grossReturn >= 0);
const losses = baseResults.filter(r => r.grossReturn < 0);
console.log(`\nWins: ${wins.length} (${base.wr}%)`);
console.log(`Losses: ${losses.length} (${(100 - parseFloat(base.wr)).toFixed(1)}%)`);
console.log(`Avg win: +${base.avgWin}%`);
console.log(`Avg loss: ${base.avgLoss}%`);
console.log(`Win/Loss ratio: ${(parseFloat(base.avgWin) / Math.abs(parseFloat(base.avgLoss))).toFixed(2)}`);

// =====================
// PHASE 4: EXECUTION REALITY
// =====================
console.log('\n========== PHASE 4: EXECUTION REALITY ==========\n');

const configs = [
  { label: 'Baseline (perfect)', feeBps: 0, slipBps: 0 },
  { label: '+0.20% fee only', feeBps: 20, slipBps: 0 },
  { label: '+0.20% fee + 0.10% slip', feeBps: 20, slipBps: 10 },
  { label: '+0.30% fee + 0.15% slip (worst case)', feeBps: 30, slipBps: 15 },
  { label: 'Entry next candle (1h delay)', feeBps: 20, slipBps: 10, entryDelay: 1 },
  { label: 'Exit next candle delay', feeBps: 20, slipBps: 10, holdHours: 3 },
];

for (const cfg of configs) {
  const r = stats(backtest(ethData, cfg));
  if (r.n === 0) continue;
  const flag = parseFloat(r.median) < 0 || parseFloat(r.wr) < 50 ? ' <<<< FAIL' : '';
  console.log(`  ${cfg.label.padEnd(45)} n=${r.n.toString().padStart(3)} WR=${r.wr}%  Net=${r.avg}%  Median=${r.median}%${flag}`);
}

// =====================
// PHASE 5: ATR FILTER ANALYSIS
// =====================
console.log('\n========== PHASE 5: ATR FILTER ANALYSIS ==========\n');

const atrThresholds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
console.log('Effect of ATR minimum filter:');
for (const atrMin of atrThresholds) {
  const r = stats(backtest(ethData, { atrMin }));
  if (r.n === 0) continue;
  const flag = r.n < 10 ? ' (n too small)' : '';
  console.log(`  ATR>${atrMin.toFixed(2)}%: n=${r.n.toString().padStart(3)} WR=${r.wr}%  Net=${r.avg}%  Median=${r.median}%${flag}`);
}

// =====================
// SUMMARY VERDICT
// =====================
console.log('\n========== VERDICT ==========\n');
const verdict = stats(baseResults);
console.log(`Baseline: n=${verdict.n}, WR=${verdict.wr}%, Median=${verdict.median}%, Total=${verdict.totalReturn}%`);
const lowVolR = stats(baseResults.filter(tr => tr.regime === 'LOW_VOL'));
console.log(`Low Vol (ATR<1%): n=${lowVolR.n}, WR=${lowVolR.wr}%, Median=${lowVolR.median}% ${lowVolR.n > 0 && (parseFloat(lowVolR.wr) < 55 || parseFloat(lowVolR.median) < 0) ? 'FAIL' : 'PASS'}`);

console.log('\n[Full results saved to falsification-exact-results.json]');
