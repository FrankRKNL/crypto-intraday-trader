/**
 * ETH Drawdown Recovery - Advanced Filters Test
 * 
 * Tests:
 * 1. Volume during drawdown (high vol = capitulation = stronger recovery?)
 * 2. RSI at entry (oversold < 30 = better?)
 * 3. Trailing stop vs fixed hold (which exit is better?)
 * 4. Drawdown speed (fast drop vs slow grind)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

const eth = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));

console.log(`Testing ${eth.length} ETH candles for advanced filters\n`);

// Calculate RSI function
function calcRSI(candles, period = 14) {
  if (candles.length < period + 1) return null;
  
  let gains = 0, losses = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const change = candles[i].c - candles[i - 1].c;
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate Average Volume
function avgVolume(candles, lookback = 20) {
  if (candles.length < lookback) return 0;
  const recent = candles.slice(-lookback);
  return recent.reduce((s, c) => s + c.v, 0) / lookback;
}

// Main test function
function testAdvancedFilters(minDD) {
  const LOOKBACK = 4;
  const HOLD = 8;
  const trades = [];
  
  for (let i = LOOKBACK + 1; i < eth.length - HOLD; i++) {
    // Basic filter: drawdown
    const startIdx = i - LOOKBACK;
    const startPrice = eth[startIdx].o;
    const lastCandle = eth[i - 1];
    const endPrice = lastCandle.c;
    const dd = (startPrice - endPrice) / startPrice * 100;
    
    if (dd < minDD) continue;
    if (lastCandle.c >= lastCandle.o) continue; // Red candle
    
    // Calculate metrics at entry
    const entryCandles = eth.slice(i - HOLD, i); // Lookback period for RSI
    const rsi = calcRSI(entryCandles);
    
    // Volume check: compare to average
    const recentVol = avgVolume(eth.slice(0, i));
    const currentVol = lastCandle.v;
    const volRatio = currentVol / recentVol;
    
    // Drawdown speed: how fast did it drop?
    const priceAtStart = eth[startIdx].c;
    const priceAtMid = eth[startIdx + 2].c;
    const earlyDD = (priceAtStart - priceAtMid) / priceAtStart * 100;
    const lateDD = dd - earlyDD;
    const speedRatio = lateDD > 0 ? earlyDD / lateDD : 1; // Fast then slow = capitulation
    
    // Entry and exit
    const entryPrice = eth[i].o;
    const exitPrice = eth[i + HOLD].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    
    trades.push({
      idx: i,
      time: new Date(eth[i].t).toISOString(),
      entryPrice,
      dd: dd.toFixed(2),
      rsi: rsi ? rsi.toFixed(1) : 'N/A',
      volRatio: volRatio.toFixed(2),
      speedRatio: speedRatio.toFixed(2),
      pnl: pnl.toFixed(3),
      win: pnl > 0
    });
  }
  
  return trades;
}

// Test each filter
console.log('=== VOLUME FILTER TEST ===\n');
const allTrades = testAdvancedFilters(5);

const volBuckets = [
  { label: 'Very Low Vol (<0.5x)', max: 0.5 },
  { label: 'Low Vol (0.5-1x)', min: 0.5, max: 1 },
  { label: 'Normal Vol (1-2x)', min: 1, max: 2 },
  { label: 'High Vol (2-3x)', min: 2, max: 3 },
  { label: 'Very High Vol (>3x)', min: 3 }
];

volBuckets.forEach(b => {
  let subset;
  if (b.max) {
    subset = allTrades.filter(t => parseFloat(t.volRatio) <= b.max);
  } else {
    subset = allTrades.filter(t => parseFloat(t.volRatio) >= b.min);
  }
  
  if (subset.length >= 3) {
    const wins = subset.filter(t => t.win).length;
    const avg = subset.reduce((s, t) => s + parseFloat(t.pnl), 0) / subset.length;
    console.log(`${b.label}: n=${subset.length}, WR=${(wins/subset.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%`);
  }
});

console.log('\n=== RSI FILTER TEST ===\n');
const rsiBuckets = [
  { label: 'Very Oversold (<20)', max: 20 },
  { label: 'Oversold (20-30)', min: 20, max: 30 },
  { label: 'Neutral (30-50)', min: 30, max: 50 },
  { label: 'Overbought (50-70)', min: 50, max: 70 },
  { label: 'Very Overbought (>70)', min: 70 }
];

rsiBuckets.forEach(b => {
  let subset;
  if (b.max) {
    subset = allTrades.filter(t => t.rsi !== 'N/A' && parseFloat(t.rsi) <= b.max);
  } else {
    subset = allTrades.filter(t => t.rsi !== 'N/A' && parseFloat(t.rsi) >= b.min);
  }
  
  if (subset.length >= 3) {
    const wins = subset.filter(t => t.win).length;
    const avg = subset.reduce((s, t) => s + parseFloat(t.pnl), 0) / subset.length;
    console.log(`${b.label}: n=${subset.length}, WR=${(wins/subset.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%`);
  }
});

console.log('\n=== DRAWDOWN SPEED TEST ===\n');
const speedBuckets = [
  { label: 'Fast drop (speed > 2)', min: 2 },
  { label: 'Medium (speed 1-2)', min: 1, max: 2 },
  { label: 'Slow grind (speed < 1)', max: 1 }
];

speedBuckets.forEach(b => {
  let subset;
  if (b.max) {
    subset = allTrades.filter(t => parseFloat(t.speedRatio) <= b.max);
  } else {
    subset = allTrades.filter(t => parseFloat(t.speedRatio) >= b.min);
  }
  
  if (subset.length >= 3) {
    const wins = subset.filter(t => t.win).length;
    const avg = subset.reduce((s, t) => s + parseFloat(t.pnl), 0) / subset.length;
    console.log(`${b.label}: n=${subset.length}, WR=${(wins/subset.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%`);
  }
});

console.log('\n=== COMBINED BEST FILTERS TEST ===\n');

// Best combo: High vol + oversold RSI + fast drop
const bestCombo = allTrades.filter(t => {
  const vol = parseFloat(t.volRatio);
  const rsi = parseFloat(t.rsi);
  const speed = parseFloat(t.speedRatio);
  
  return vol > 1.5 && rsi < 35 && speed > 1.5;
});

if (bestCombo.length >= 3) {
  const wins = bestCombo.filter(t => t.win).length;
  const avg = bestCombo.reduce((s, t) => s + parseFloat(t.pnl), 0) / bestCombo.length;
  console.log(`High Vol + Oversold + Fast Drop: n=${bestCombo.length}, WR=${(wins/bestCombo.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%`);
}

// Worst combo: Low vol + high RSI + slow drop
const worstCombo = allTrades.filter(t => {
  const vol = parseFloat(t.volRatio);
  const rsi = parseFloat(t.rsi);
  const speed = parseFloat(t.speedRatio);
  
  return vol < 0.8 && rsi > 45 && speed < 1;
});

if (worstCombo.length >= 3) {
  const wins = worstCombo.filter(t => t.win).length;
  const avg = worstCombo.reduce((s, t) => s + parseFloat(t.pnl), 0) / worstCombo.length;
  console.log(`Low Vol + High RSI + Slow Drop: n=${worstCombo.length}, WR=${(wins/worstCombo.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%`);
}

console.log('\n=== TRAILING STOP TEST ===\n');

// Compare fixed 8h hold vs trailing stop
function testWithTrailingStop(trades, trailPct) {
  // Simulate trailing stop on existing trades
  // This is an approximation - real implementation needs intraday data
  
  let wins = 0, losses = 0;
  let totalPnL = 0;
  
  trades.forEach(t => {
    // Approximate: if PnL > trailPct at any point during hold, we exit
    const hitTrail = parseFloat(t.pnl) > trailPct;
    
    if (hitTrail) {
      wins++;
      totalPnL += parseFloat(t.pnl); // Assume we captured most of the move
    } else {
      if (parseFloat(t.pnl) > 0) wins++;
      else losses++;
      totalPnL += parseFloat(t.pnl);
    }
  });
  
  return {
    n: trades.length,
    wr: (wins / trades.length * 100).toFixed(1),
    avg: (totalPnL / trades.length).toFixed(3)
  };
}

[1, 2, 3, 4].forEach(trail => {
  const result = testWithTrailingStop(allTrades, trail);
  console.log(`Trailing stop ${trail}%: n=${result.n}, WR=${result.wr}%, Avg=${result.avg}%`);
});

console.log('\n=== ORIGINAL FIXED HOLD (8h) ===');
const wins = allTrades.filter(t => t.win).length;
const avg = allTrades.reduce((s, t) => s + parseFloat(t.pnl), 0) / allTrades.length;
console.log(`Baseline (no filter): n=${allTrades.length}, WR=${(wins/allTrades.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%`);

// Save results
writeFileSync('results-advanced-filters.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  totalTrades: allTrades.length,
  trades: allTrades
}, null, 2));

console.log(`\nSaved ${allTrades.length} trades to results-advanced-filters.json`);