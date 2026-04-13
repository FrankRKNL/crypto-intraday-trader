/**
 * Multi-Timeframe ETH Drawdown Validation
 * 
 * Theory: Combining 1H trend direction with 15m entry timing improves results
 * - 1H: Determine if we're in an UPTREND or DOWNTREND
 * - 15m: Entry only when counter-trend drawdown occurs within uptrend
 * 
 * Hypothesis: Drawdown recovery works BETTER when:
 * - We're in an uptrend (higher highs)
 * - Drawdown is against the trend (buy the dip)
 * - NOT when in downtrend (catch a falling knife)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

// Load data
const eth1h = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));
const eth15m = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-15m-extended.json'), 'utf8')).filter(k => k.t >= eth1h[0].t);

console.log(`Loaded ${eth1h.length} 1H candles, ${eth15m.length} 15m candles`);
console.log(`Period: ${new Date(eth1h[0].t).toISOString()} to ${new Date(eth1h[eth1h.length-1].t).toISOString()}\n`);

// Convert 15m to 1H for easier analysis
function to1H(candles) {
  const result = [];
  for (let i = 0; i < candles.length; i += 4) {
    const chunk = candles.slice(i, i + 4);
    if (chunk.length === 4) {
      result.push({
        t: chunk[0].t,
        o: chunk[0].o,
        h: Math.max(...chunk.map(c => c.h)),
        l: Math.min(...chunk.map(c => c.l)),
        c: chunk[3].c,
        v: chunk.reduce((s, c) => s + c.v, 0)
      });
    }
  }
  return result;
}

const eth1Hfrom15 = to1H(eth15m);
console.log(`Converted to ${eth1Hfrom15.length} 1H candles from 15m\n`);

// Trend detection: Simple EMA200 or SMA on 1H
function detectTrend(eth, idx) {
  if (idx < 200) return 'UNKNOWN';
  
  const recent = eth.slice(idx - 200, idx);
  const sma200 = recent.reduce((s, c) => s + c.c, 0) / 200;
  const currentPrice = eth[idx].c;
  
  // Uptrend: price above SMA200, SMA200 rising
  const sma200prev = eth[idx - 20] ? recent.slice(-20).reduce((s, c) => s + c.c, 0) / 20 : sma200;
  
  if (currentPrice > sma200 && sma200 > sma200prev) return 'UPTREND';
  if (currentPrice < sma200 && sma200 < sma200prev) return 'DOWNTREND';
  return 'RANGE';
}

// Test strategy with trend filter
function testWithTrend(minDD, requireUptrend) {
  const LOOKBACK = 4;
  const HOLD = 8;
  const trades = [];
  
  for (let i = LOOKBACK + 1 + 200; i < eth1Hfrom15.length - HOLD; i++) {
    // Check trend
    const trend = detectTrend(eth1Hfrom15, i);
    if (requireUptrend && trend !== 'UPTREND') continue;
    
    // Drawdown check
    const startIdx = i - LOOKBACK;
    const startPrice = eth1Hfrom15[startIdx].o;
    const lastCandle = eth1Hfrom15[i - 1];
    const endPrice = lastCandle.c;
    const dd = (startPrice - endPrice) / startPrice * 100;
    
    if (dd < minDD) continue;
    if (lastCandle.c >= lastCandle.o) continue; // Red candle
    
    // Entry and exit
    const entryPrice = eth1Hfrom15[i].o;
    const exitPrice = eth1Hfrom15[i + HOLD].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    
    trades.push({
      idx: i,
      time: new Date(eth1Hfrom15[i].t).toISOString(),
      trend,
      dd: dd.toFixed(2),
      pnl: pnl.toFixed(3),
      win: pnl > 0
    });
  }
  
  if (trades.length < 3) return null;
  
  const wins = trades.filter(t => t.win).length;
  const wr = (wins / trades.length * 100).toFixed(1);
  const avg = (trades.reduce((s, t) => s + parseFloat(t.pnl), 0) / trades.length).toFixed(3);
  
  return { n: trades.length, wr, avg, trades };
}

console.log('=== TREND FILTER TEST ===\n');

const configs = [
  { label: 'Baseline (no trend filter)', minDD: 5, requireUptrend: false },
  { label: 'DD>=5% + UPTREND only', minDD: 5, requireUptrend: true },
  { label: 'DD>=6% + UPTREND only', minDD: 6, requireUptrend: true },
  { label: 'DD>=5% + NOT DOWNTREND', minDD: 5, requireUptrend: 'RANGE_OK' },
];

configs.forEach(c => {
  let result;
  if (c.requireUptrend === 'RANGE_OK') {
    // Test with RANGE_OK
    const all = testWithTrend(c.minDD, false);
    const rangeOk = all ? { ...all, trades: all.trades.filter(t => t.trend !== 'DOWNTREND'), label: c.label } : null;
    result = rangeOk;
  } else {
    result = testWithTrend(c.minDD, c.requireUptrend);
  }
  
  if (result && result.n > 0) {
    console.log(`${c.label}: n=${result.n}, WR=${result.wr}%, Avg=${result.avg}%`);
  }
});

// Deeper analysis: What happened in DOWNTREND trades?
console.log('\n=== DOWTREND VS UPTREND ANALYSIS ===\n');

const baseline = testWithTrend(5, false);
if (baseline) {
  const uptrend = baseline.trades.filter(t => t.trend === 'UPTREND');
  const downtrend = baseline.trades.filter(t => t.trend === 'DOWNTREND');
  const range = baseline.trades.filter(t => t.trend === 'RANGE');
  
  const calc = (arr) => {
    if (arr.length === 0) return { n: 0, wr: 'N/A', avg: 'N/A' };
    const wins = arr.filter(t => t.win).length;
    const avg = arr.reduce((s, t) => s + parseFloat(t.pnl), 0) / arr.length;
    return { n: arr.length, wr: (wins/arr.length*100).toFixed(1), avg: avg.toFixed(3) };
  };
  
  const u = calc(uptrend);
  const d = calc(downtrend);
  const r = calc(range);
  
  console.log(`UPTREND: n=${u.n}, WR=${u.wr}%, Avg=${u.avg}%`);
  console.log(`DOWNTREND: n=${d.n}, WR=${d.wr}%, Avg=${d.avg}%`);
  console.log(`RANGE: n=${r.n}, WR=${r.wr}%, Avg=${r.avg}%`);
  
  // Show worst downtrend trades
  if (downtrend.length > 0) {
    console.log('\nWorst DOWNTREND trades:');
    downtrend.sort((a, b) => parseFloat(a.pnl) - parseFloat(b.pnl)).slice(0, 5).forEach(t => {
      console.log(`  ${t.time}: ${t.pnl}% (DD=${t.dd}%)`);
    });
  }
}

// Now test: WHAT IF we SHORT in downtrend instead of buy?
console.log('\n=== DOWNDTREND SHORT TEST ===\n');

function testDowntrendShort(minDD) {
  const LOOKBACK = 4;
  const HOLD = 8;
  const trades = [];
  
  for (let i = LOOKBACK + 1 + 200; i < eth1Hfrom15.length - HOLD; i++) {
    const trend = detectTrend(eth1Hfrom15, i);
    if (trend !== 'DOWNTREND') continue;
    
    // Drawdown check (but this time we look for RALLY, not drop)
    const startIdx = i - LOOKBACK;
    const startPrice = eth1Hfrom15[startIdx].o;
    const lastCandle = eth1Hfrom15[i - 1];
    const endPrice = lastCandle.c;
    const rally = (endPrice - startPrice) / startPrice * 100;
    
    // Look for rally in downtrend (fade the rally)
    if (rally < minDD) continue;
    if (lastCandle.c <= lastCandle.o) continue; // Green candle (rally continued)
    
    // SHORT at open, exit after HOLD
    const entryPrice = eth1Hfrom15[i].o;
    const exitPrice = eth1Hfrom15[i + HOLD].c;
    const pnl = (entryPrice - exitPrice) / entryPrice * 100; // Short: profit when price drops
    
    trades.push({
      time: new Date(eth1Hfrom15[i].t).toISOString(),
      rally: rally.toFixed(2),
      pnl: pnl.toFixed(3),
      win: pnl > 0
    });
  }
  
  if (trades.length < 3) return null;
  
  const wins = trades.filter(t => t.win).length;
  const wr = (wins / trades.length * 100).toFixed(1);
  const avg = (trades.reduce((s, t) => s + parseFloat(t.pnl), 0) / trades.length).toFixed(3);
  
  return { n: trades.length, wr, avg, trades };
}

[3, 4, 5].forEach(dd => {
  const result = testDowntrendShort(dd);
  if (result) {
    console.log(`DOWNTREND SHORT (rally>=${dd}%): n=${result.n}, WR=${result.wr}%, Avg=${result.avg}%`);
  }
});

// Save results
writeFileSync('results-multitimeframe.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  test: 'multi-timeframe trend filter',
  results: configs.map(c => testWithTrend(c.minDD, c.requireUptrend))
}, null, 2));

console.log('\nSaved to results-multitimeframe.json');