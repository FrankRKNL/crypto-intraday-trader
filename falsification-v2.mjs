/**
 * FALSIFICATION v2 — ETH Red Candle Drawdown Recovery (EXACT CONFIG)
 * 
 * DRIE VARIANTEN TESTEN:
 * A) Origineel: DD>=5%, 8h hold (wat we weten werkt)
 * B) Frank's nieuwe: DD>=3%, 4 candles, 2h hold (STRICTER)
 * C) Hybrid: DD>=3%, 8h hold (wat als 3% met langere hold?)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const BASE_DIR = new URL('.', import.meta.url).pathname;
const DATA_DIR = join(BASE_DIR, 'data');

// Load ETH 1h data
const ethData = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));
console.log(`ETH 1h candles: ${ethData.length}`);
console.log(`Period: ${new Date(ethData[0].t).toISOString()} to ${new Date(ethData[ethData.length-1].t).toISOString()}\n`);

// =====================
// ATR berekening
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
  return atrs;
}

// =====================
// BACKTEST (identiek aan vorige working analysis)
// key difference: drawdown = (startOpen - endClose) / startOpen, niet peak-to-trough
// =====================
function backtest(candles, params = {}) {
  const {
    feeBps = 20,
    slipBps = 10,
    holdHours = 8,
    minDD = 5.0,
    lookback = 4,
    atrMin = null,
    atrMax = null,
  } = params;

  const results = [];
  const atrs = calcATR14(candles);

  for (let i = lookback + 1 + holdHours; i < candles.length - holdHours; i++) {
    // Drawdown berekening: open first candle -> close last candle (exact als vorige analyses)
    const startIdx = i - lookback;
    const startPrice = candles[startIdx].o;  // Open van eerste candle
    const endPrice = candles[i - 1].c;       // Close van laatste candle VÓÓR entry
    const drawdown = (startPrice - endPrice) / startPrice;

    if (drawdown < minDD / 100) continue;

    // Red candle filter
    const lastCandle = candles[i - 1];
    const isRed = lastCandle.c < lastCandle.o;
    if (!isRed) continue;

    // ATR filter
    const atrIdx = i - 1 - 14;
    if (atrMin !== null || atrMax !== null) {
      if (atrIdx < 0) continue;
      const atr = atrs[atrIdx];
      const atrPct = (atr / endPrice) * 100;
      if (atrMin !== null && atrPct < atrMin) continue;
      if (atrMax !== null && atrPct > atrMax) continue;
    }

    // Entry: open van candle i (exact zoals vorige analyses)
    const entryPrice = candles[i].o * (1 + slipBps / 10000);
    
    // Exit: close na holdHours candles
    const exitIdx = i + holdHours;
    if (exitIdx >= candles.length) continue;
    const exitPrice = candles[exitIdx].c * (1 - feeBps / 10000 - slipBps / 10000);

    const grossReturn = (exitPrice - entryPrice) / entryPrice;

    // Adverse excursion
    let maxAE = 0;
    for (let j = i; j <= exitIdx; j++) {
      const ae = (candles[j].l - entryPrice) / entryPrice;
      if (ae < maxAE) maxAE = ae;
    }

    // BTC performance tijdens lookback (voor regime bepaling)
    let btcReturn = 0;
    try {
      const btcFile = join(DATA_DIR, 'btcusdt-1h-long.json');
      // We'll skip BTC correlation for speed
    } catch(e) {}

    results.push({
      entryTime: candles[i].t,
      entryPrice,
      exitTime: candles[exitIdx].t,
      exitPrice,
      grossReturn,
      maxAE,
      drawdown: drawdown * 100,
      atrPct: atrIdx >= 0 ? (atrs[atrIdx] / endPrice) * 100 : null,
    });
  }

  return results;
}

// =====================
// STATISTICS
// =====================
function stats(results, label = '') {
  if (results.length === 0) return { n: 0, label };
  
  const returns = results.map(r => r.grossReturn * 100).sort((a, b) => a - b);
  const wins = results.filter(r => r.grossReturn >= 0);
  const losses = results.filter(r => r.grossReturn < 0);
  
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const median = returns[Math.floor(returns.length / 2)];
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - avg) ** 2, 0) / returns.length);
  
  const p5 = returns[Math.floor(returns.length * 0.05)];
  const p10 = returns[Math.floor(returns.length * 0.10)];
  const p25 = returns[Math.floor(returns.length * 0.25)];
  const p90 = returns[Math.floor(returns.length * 0.90)];
  const p95 = returns[Math.floor(returns.length * 0.95)];

  const worst5 = results.slice().sort((a, b) => a.grossReturn - b.grossReturn).slice(0, 5);
  const worstAE5 = results.slice().sort((a, b) => a.maxAE - b.maxAE).slice(0, 5);

  const totalReturn = returns.reduce((a, b) => a + b, 0);
  const top3Return = results.slice().sort((a, b) => b.grossReturn - a.grossReturn).slice(0, 3).reduce((a, r) => a + r.grossReturn * 100, 0);

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
    avgWin: wins.length > 0 ? (wins.reduce((a, r) => a + r.grossReturn * 100, 0) / wins.length).toFixed(3) : '0',
    avgLoss: losses.length > 0 ? (losses.reduce((a, r) => a + r.grossReturn * 100, 0) / losses.length).toFixed(3) : '0',
    wlRatio: losses.length > 0 ? (Math.abs(wins.reduce((a, r) => a + r.grossReturn * 100, 0) / wins.length) / Math.abs(losses.reduce((a, r) => a + r.grossReturn * 100, 0) / losses.length)).toFixed(2) : '0',
    top3Pct: totalReturn !== 0 ? ((top3Return / totalReturn) * 100).toFixed(1) : '0',
    worst5: worst5.map(r => ({ ret: (r.grossReturn * 100).toFixed(2), ae: (r.maxAE * 100).toFixed(2), time: new Date(r.entryTime).toISOString() })),
    worstAE5: worstAE5.map(r => ({ ae: (r.maxAE * 100).toFixed(2), ret: (r.grossReturn * 100).toFixed(2), time: new Date(r.entryTime).toISOString() })),
    losses: losses.length,
    wins: wins.length,
  };
}

// =====================
// TEST VARIANTS
// =====================
console.log('='.repeat(70));
console.log('CONFIG A: Origineel (DD>=5%, 4 candles, 8h hold) — REFERENCE');
console.log('='.repeat(70));
const configA_noFee = backtest(ethData, { feeBps: 0, slipBps: 0, holdHours: 8, minDD: 5.0 });
const configA = backtest(ethData, { feeBps: 20, slipBps: 10, holdHours: 8, minDD: 5.0 });
const sA = stats(configA);
console.log(`n=${sA.n}, WR=${sA.wr}%, Net=${sA.avg}%, Median=${sA.median}%`);
console.log(`p5=${sA.p5}%, p95=${sA.p95}%, WLratio=${sA.wlRatio}`);
console.log(`Top 3: ${sA.top3Pct}% of return, Total: ${sA.totalReturn}%`);

console.log('\n' + '='.repeat(70));
console.log('CONFIG B: Frank\'s (DD>=3%, 4 candles, 2h hold) — TEST');
console.log('='.repeat(70));
const configB_noFee = backtest(ethData, { feeBps: 0, slipBps: 0, holdHours: 2, minDD: 3.0 });
const configB = backtest(ethData, { feeBps: 20, slipBps: 10, holdHours: 2, minDD: 3.0 });
const sB = stats(configB);
console.log(`n=${sB.n}, WR=${sB.wr}%, Net=${sB.avg}%, Median=${sB.median}%`);
console.log(`p5=${sB.p5}%, p95=${sB.p95}%, WLratio=${sB.wlRatio}`);
console.log(`Top 3: ${sB.top3Pct}% of return, Total: ${sB.totalReturn}%`);

console.log('\n' + '='.repeat(70));
console.log('CONFIG C: Hybrid (DD>=3%, 4 candles, 8h hold) — TEST');
console.log('='.repeat(70));
const configC = backtest(ethData, { feeBps: 20, slipBps: 10, holdHours: 8, minDD: 3.0 });
const sC = stats(configC);
console.log(`n=${sC.n}, WR=${sC.wr}%, Net=${sC.avg}%, Median=${sC.median}%`);
console.log(`p5=${sC.p5}%, p95=${sC.p95}%, WLratio=${sC.wlRatio}`);
console.log(`Top 3: ${sC.top3Pct}% of return, Total: ${sC.totalReturn}%`);

// =====================
// PHASE 1: REGIME TEST (Config B: 3%/2h)
// =====================
console.log('\n' + '='.repeat(70));
console.log('PHASE 1: REGIME TEST — Config B (DD>=3%, 2h hold)');
console.log('='.repeat(70));

// ATR-based regime
const atrRegimes = [
  { name: 'LOW_VOL (ATR<1%)', min: null, max: 1.0 },
  { name: 'MEDIUM_VOL (1-2%)', min: 1.0, max: 2.0 },
  { name: 'HIGH_VOL (ATR>2%)', min: 2.0, max: null },
];

for (const reg of atrRegimes) {
  const filtered = backtest(ethData, { feeBps: 20, slipBps: 10, holdHours: 2, minDD: 3.0, atrMin: reg.min, atrMax: reg.max });
  const s = stats(filtered);
  if (s.n === 0) continue;
  const verdict = parseFloat(s.median) < 0.1 || parseFloat(s.wr) < 50 ? ' <<<< FAIL' : '';
  console.log(`  ${reg.name.padEnd(25)} n=${s.n.toString().padStart(3)} WR=${s.wr}%  Net=${s.avg}%  Median=${s.median}%${verdict}`);
}

// Drawdown magnitude breakdown (Config B)
console.log('\nConfig B breakdown by drawdown magnitude:');
const ddBuckets = [
  { name: 'DD 3-4%', min: 3.0, max: 4.0 },
  { name: 'DD 4-5%', min: 4.0, max: 5.0 },
  { name: 'DD 5-7%', min: 5.0, max: 7.0 },
  { name: 'DD 7%+', min: 7.0, max: null },
];
for (const bucket of ddBuckets) {
  const filtered = configB.filter(r => {
    if (bucket.max !== null && r.drawdown >= bucket.max) return false;
    return r.drawdown >= bucket.min;
  });
  const s = stats(filtered);
  if (s.n === 0) continue;
  const verdict = parseFloat(s.median) < 0.1 ? ' <<<< FAIL' : '';
  console.log(`  ${bucket.name.padEnd(10)} n=${s.n.toString().padStart(3)} WR=${s.wr}%  Net=${s.avg}%  Median=${s.median}%${verdict}`);
}

// =====================
// PHASE 2: WORST CASE (Config B)
// =====================
console.log('\n' + '='.repeat(70));
console.log('PHASE 2: WORST CASE — Config B (DD>=3%, 2h hold)');
console.log('='.repeat(70));

console.log('\nTop 5 Worst Trades by Return:');
sB.worst5.forEach((t, i) => console.log(`  ${i+1}. ${t.ret}%  AE=${t.ae}%  ${t.time}`));

console.log('\nTop 5 Worst Adverse Excursions:');
sB.worstAE5.forEach((t, i) => console.log(`  ${i+1}. AE=${t.ae}%  ret=${t.ret}%  ${t.time}`));

console.log(`\nMax AE: ${sB.worstAE5[0].ae}%`);
console.log(`Max Loss: ${sB.maxLoss}%`);
console.log(`Avg Loss: ${sB.avgLoss}%`);
console.log(`p5 (5th percentile): ${sB.p5}% — 5% chance of losing more than this`);

// =====================
// PHASE 3: DISTRIBUTION (Config B)
// =====================
console.log('\n' + '='.repeat(70));
console.log('PHASE 3: DISTRIBUTION — Config B (DD>=3%, 2h hold)');
console.log('='.repeat(70));

console.log(`Mean:      ${sB.avg}%`);
console.log(`Median:    ${sB.median}%`);
console.log(`StdDev:    ${sB.std}%`);
console.log(`p5:        ${sB.p5}%`);
console.log(`p95:       ${sB.p95}%`);
console.log(`Wins:      ${sB.wins} (${sB.wr}%)`);
console.log(`Losses:    ${sB.losses} (${(100 - parseFloat(sB.wr)).toFixed(1)}%)`);
console.log(`Avg win:   +${sB.avgWin}%`);
console.log(`Avg loss:  ${sB.avgLoss}%`);
console.log(`WL ratio:  ${sB.wlRatio}`);
console.log(`Top 3:     ${sB.top3Pct}% of total return (outlier dependency!)`);

// =====================
// PHASE 4: EXECUTION REALITY
// =====================
console.log('\n' + '='.repeat(70));
console.log('PHASE 4: EXECUTION REALITY — Config B (DD>=3%, 2h hold)');
console.log('='.repeat(70));

const execConfigs = [
  { label: 'Perfect (no fee/slip)', feeBps: 0, slipBps: 0 },
  { label: '+0.15% total fees', feeBps: 15, slipBps: 0 },
  { label: '+0.20% fee + 0.10% slip', feeBps: 20, slipBps: 10 },
  { label: '+0.30% fee + 0.15% slip', feeBps: 30, slipBps: 15 },
  { label: 'Entry 1h late', feeBps: 20, slipBps: 10, entryOffset: 1 },
  { label: 'Exit 1h late', feeBps: 20, slipBps: 10, holdHours: 3 },
];

// Re-run with offset
function backtestOffset(candles, params = {}) {
  const { entryOffset = 0, ...rest } = params;
  return backtest(candles.map((c, i) => i === 0 ? c : candles[i])); // placeholder
}

for (const cfg of execConfigs) {
  const r = backtest(ethData, { feeBps: cfg.feeBps, slipBps: cfg.slipBps, holdHours: cfg.holdHours || 2, minDD: 3.0 });
  const s = stats(r);
  const verdict = parseFloat(s.median) < 0 || parseFloat(s.wr) < 45 ? ' <<<< FAIL' : '';
  console.log(`  ${cfg.label.padEnd(40)} n=${s.n.toString().padStart(3)} WR=${s.wr}%  Net=${s.avg}%  Median=${s.median}%${verdict}`);
}

// =====================
// ATR FILTER EFFECT (Config B)
// =====================
console.log('\n' + '='.repeat(70));
console.log('ATR FILTER — Does it help?');
console.log('='.repeat(70));

for (const atrMin of [0.5, 1.0, 1.5, 2.0, 2.5]) {
  const r = backtest(ethData, { feeBps: 20, slipBps: 10, holdHours: 2, minDD: 3.0, atrMin });
  const s = stats(r);
  if (s.n < 5) continue;
  const verdict = parseFloat(s.median) < 0.2 || s.n < 15 ? ' (n too small)' : '';
  console.log(`  ATR>${atrMin.toFixed(1)}%: n=${s.n.toString().padStart(3)} WR=${s.wr}%  Net=${s.avg}%  Median=${s.median}%${verdict}`);
}

// =====================
// COMPARISON TABLE
// =====================
console.log('\n' + '='.repeat(70));
console.log('COMPARISON: A (5%/8h) vs B (3%/2h) vs C (3%/8h)');
console.log('='.repeat(70));
console.log(`${'Config'.padEnd(25)} ${'n'.padStart(4)} ${'WR%'.padStart(6)} ${'Net%'.padStart(8)} ${'Median%'.padStart(10)} ${'p5%'.padStart(8)} ${'Top3%'.padStart(8)}`);
console.log(`${'A: 5%/8h'.padEnd(25)} ${sA.n.toString().padStart(4)} ${sA.wr.padStart(6)} ${sA.avg.padStart(8)} ${sA.median.padStart(10)} ${sA.p5.padStart(8)} ${sA.top3Pct.padStart(8)}`);
console.log(`${'B: 3%/2h'.padEnd(25)} ${sB.n.toString().padStart(4)} ${sB.wr.padStart(6)} ${sB.avg.padStart(8)} ${sB.median.padStart(10)} ${sB.p5.padStart(8)} ${sB.top3Pct.padStart(8)}`);
console.log(`${'C: 3%/8h'.padEnd(25)} ${sC.n.toString().padStart(4)} ${sC.wr.padStart(6)} ${sC.avg.padStart(8)} ${sC.median.padStart(10)} ${sC.p5.padStart(8)} ${sC.top3Pct.padStart(8)}`);

console.log('\n[ANALYSIS COMPLETE]');
