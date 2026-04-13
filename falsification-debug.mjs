/**
 * Debug: replicate exact methodology from previous working analysis
 * Previous found: n=41, WR=66%, net=+1.139%, median=+0.541% for 3%/2h
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join('/home/node/.openclaw/workspace/crypto-intraday-trader', 'data');
const ethData = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));

console.log(`ETH 1h: ${ethData.length} candles`);
console.log(`Period: ${new Date(ethData[0].t).toISOString()} → ${new Date(ethData[ethData.length-1].t).toISOString()}\n`);

// Method 1: Previous analysis approach (open-to-close over lookback window)
function method1_ddOpenClose(candles, minDD = 3.0, lookback = 4, holdHours = 2) {
  const results = [];
  for (let i = lookback + 1 + holdHours; i < candles.length - holdHours; i++) {
    const startIdx = i - lookback;
    const startPrice = candles[startIdx].o;  // OPEN first candle
    const endPrice = candles[i - 1].c;       // CLOSE last candle before entry
    const dd = (startPrice - endPrice) / startPrice;

    if (dd < minDD / 100) continue;

    // Red candle filter
    const lastCandle = candles[i - 1];
    if (lastCandle.c >= lastCandle.o) continue; // must close RED

    // Entry at next candle open
    const entryPrice = candles[i].o;
    const exitIdx = i + holdHours;
    if (exitIdx >= candles.length) continue;
    const exitPrice = candles[exitIdx].c;

    const grossReturn = (exitPrice - entryPrice) / entryPrice * 100;

    results.push({ entryTime: candles[i].t, grossReturn, dd: dd * 100, win: grossReturn > 0 });
  }
  return results;
}

// Method 2: Peak-to-trough over lookback window
function method2_ddPeakTrough(candles, minDD = 3.0, lookback = 4, holdHours = 2) {
  const results = [];
  for (let i = lookback + 1 + holdHours; i < candles.length - holdHours; i++) {
    const window = candles.slice(i - lookback, i);
    const peak = Math.max(...window.map(c => c.h));
    const trough = Math.min(...window.map(c => c.l));
    const dd = (peak - trough) / peak;

    if (dd < minDD / 100) continue;

    const lastCandle = candles[i - 1];
    if (lastCandle.c >= lastCandle.o) continue;

    const entryPrice = candles[i].o;
    const exitIdx = i + holdHours;
    if (exitIdx >= candles.length) continue;
    const exitPrice = candles[exitIdx].c;

    const grossReturn = (exitPrice - entryPrice) / entryPrice * 100;

    results.push({ entryTime: candles[i].t, grossReturn, dd: dd * 100, win: grossReturn > 0 });
  }
  return results;
}

// Method 3: Any candle in window drops >=3% from ITS OWN open (rolling)
function method3_rollingDrop(candles, minDD = 3.0, lookback = 4, holdHours = 2) {
  const results = [];
  for (let i = lookback + 1 + holdHours; i < candles.length - holdHours; i++) {
    const window = candles.slice(i - lookback, i);
    
    // Check: any candle drops >= minDD% from ITS OWN open
    let maxCandleDD = 0;
    for (const c of window) {
      const candleDD = (c.o - c.l) / c.o;  // drop from open to low
      if (candleDD > maxCandleDD) maxCandleDD = candleDD;
    }
    if (maxCandleDD < minDD / 100) continue;

    // Red candle: last candle closes lower than its open
    const lastCandle = window[window.length - 1];
    if (lastCandle.c >= lastCandle.o) continue;

    const entryPrice = candles[i].o;
    const exitIdx = i + holdHours;
    if (exitIdx >= candles.length) continue;
    const exitPrice = candles[exitIdx].c;

    const grossReturn = (exitPrice - entryPrice) / entryPrice * 100;
    results.push({ entryTime: candles[i].t, grossReturn, dd: maxCandleDD * 100, win: grossReturn > 0 });
  }
  return results;
}

// Method 4: 4 candles ago to current: total drop
function method4_dropSince4ago(candles, minDD = 3.0, lookback = 4, holdHours = 2) {
  const results = [];
  for (let i = lookback + 1 + holdHours; i < candles.length - holdHours; i++) {
    const startPrice = candles[i - lookback].o;  // 4 candles AGO
    const endPrice = candles[i - 1].c;           // close of candle before entry
    const dd = (startPrice - endPrice) / startPrice;

    if (dd < minDD / 100) continue;

    const lastCandle = candles[i - 1];
    if (lastCandle.c >= lastCandle.o) continue;

    const entryPrice = candles[i].o;
    const exitIdx = i + holdHours;
    if (exitIdx >= candles.length) continue;
    const exitPrice = candles[exitIdx].c;

    const grossReturn = (exitPrice - entryPrice) / entryPrice * 100;
    results.push({ entryTime: candles[i].t, grossReturn, dd: dd * 100, win: grossReturn > 0 });
  }
  return results;
}

function analyze(label, trades) {
  if (trades.length === 0) return;
  const returns = trades.map(t => t.grossReturn);
  const wins = returns.filter(r => r > 0);
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const median = returns.slice().sort((a, b) => a - b)[Math.floor(returns.length / 2)];
  const p5 = returns.slice().sort((a, b) => a - b)[Math.floor(returns.length * 0.05)];
  console.log(`${label}:`);
  console.log(`  n=${trades.length}, WR=${(wins.length/trades.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%, Median=${median.toFixed(3)}%, p5=${p5.toFixed(3)}%\n`);
}

// Test all methods with different minDD and holdHours
console.log('=== METHOD COMPARISON: 3% drawdown, 2h hold ===\n');
analyze('M1: open-close', method1_ddOpenClose(ethData, 3, 4, 2));
analyze('M2: peak-trough', method2_ddPeakTrough(ethData, 3, 4, 2));
analyze('M3: rolling drop', method3_rollingDrop(ethData, 3, 4, 2));
analyze('M4: drop since 4ago', method4_dropSince4ago(ethData, 3, 4, 2));

console.log('=== METHOD COMPARISON: 5% drawdown, 8h hold ===\n');
analyze('M1: open-close', method1_ddOpenClose(ethData, 5, 4, 8));
analyze('M2: peak-trough', method2_ddPeakTrough(ethData, 5, 4, 8));
analyze('M3: rolling drop', method3_rollingDrop(ethData, 5, 4, 8));
analyze('M4: drop since 4ago', method4_dropSince4ago(ethData, 5, 4, 8));

// Now check which method matches the previous analysis (n=41 for 3%/2h)
console.log('=== SEARCHING FOR METHOD THAT PRODUCES n~41, WR~66% ===\n');

// Try lookback=5
analyze('M1: lookback=5', method1_ddOpenClose(ethData, 3, 5, 2));
analyze('M2: lookback=5', method2_ddPeakTrough(ethData, 3, 5, 2));

// Try hold=4
analyze('M1: hold=4', method1_ddOpenClose(ethData, 3, 4, 4));
analyze('M1: hold=8', method1_ddOpenClose(ethData, 3, 4, 8));

// Try lookback=4, hold=8 (same as config A essentially)
analyze('M1: DD>=4% 4h hold', method1_ddOpenClose(ethData, 4, 4, 4));
analyze('M1: DD>=4% 8h hold', method1_ddOpenClose(ethData, 4, 4, 8));
