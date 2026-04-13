/**
 * ETH Drawdown Recovery - Lower Speed Threshold Test
 * 
 * Speed > 2 only gave n=5 for the best config. 
 * Testing Speed > 1.5 + other filters to get more samples.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

const eth = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));

console.log(`Testing lower speed thresholds\n`);

const LOOKBACK = 4;
const HOLD = 8;

function getTrades() {
  const trades = [];
  
  for (let i = LOOKBACK + 1; i < eth.length - HOLD; i++) {
    const startIdx = i - LOOKBACK;
    const startPrice = eth[startIdx].o;
    const midIdx = startIdx + 2;
    const midPrice = eth[midIdx].c;
    const lastCandle = eth[i - 1];
    const endPrice = lastCandle.c;
    
    const dd = (startPrice - endPrice) / startPrice * 100;
    if (dd < 5) continue;
    if (lastCandle.c >= lastCandle.o) continue; // Red candle
    
    const earlyDD = (startPrice - midPrice) / startPrice * 100;
    const lateDD = dd - earlyDD;
    const speedRatio = lateDD > 0.01 ? earlyDD / lateDD : 999;
    
    const hour = new Date(eth[i].t).getUTCHours();
    const dayOfWeek = new Date(eth[i].t).getDay();
    
    const entryPrice = eth[i].o;
    const exitPrice = eth[i + HOLD].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    
    trades.push({
      idx: i,
      time: new Date(eth[i].t).toISOString(),
      dd: parseFloat(dd.toFixed(2)),
      speedRatio: parseFloat(speedRatio.toFixed(2)),
      hour,
      dayOfWeek,
      pnl: parseFloat(pnl.toFixed(3)),
      win: pnl > 0
    });
  }
  
  return trades;
}

const allTrades = getTrades();
console.log(`Found ${allTrades.length} base trades\n`);

const configs = [
  // Baseline (no speed filter)
  { label: 'Baseline (DD>=5%)', speedMin: 0, ddMin: 5, blockUS: false, blockFri: false },
  
  // Speed > 1 configs
  { label: 'Speed>1 + DD>=5%', speedMin: 1, ddMin: 5, blockUS: false, blockFri: false },
  { label: 'Speed>1 + DD>=6%', speedMin: 1, ddMin: 6, blockUS: false, blockFri: false },
  { label: 'Speed>1 + DD>=5% + Block US', speedMin: 1, ddMin: 5, blockUS: true, blockFri: false },
  { label: 'Speed>1 + DD>=6% + Block US', speedMin: 1, ddMin: 6, blockUS: true, blockFri: false },
  
  // Speed > 1.5 configs
  { label: 'Speed>1.5 + DD>=5%', speedMin: 1.5, ddMin: 5, blockUS: false, blockFri: false },
  { label: 'Speed>1.5 + DD>=6%', speedMin: 1.5, ddMin: 6, blockUS: false, blockFri: false },
  { label: 'Speed>1.5 + DD>=5% + Block US', speedMin: 1.5, ddMin: 5, blockUS: true, blockFri: false },
  { label: 'Speed>1.5 + DD>=6% + Block US', speedMin: 1.5, ddMin: 6, blockUS: true, blockFri: false },
  { label: 'Speed>1.5 + DD>=6% + Block Fri', speedMin: 1.5, ddMin: 6, blockUS: false, blockFri: true },
  
  // Speed > 2 configs (reference)
  { label: 'Speed>2 + DD>=5%', speedMin: 2, ddMin: 5, blockUS: false, blockFri: false },
  { label: 'Speed>2 + DD>=6%', speedMin: 2, ddMin: 6, blockUS: false, blockFri: false },
  { label: 'Speed>2 + DD>=6% + Block US', speedMin: 2, ddMin: 6, blockUS: true, blockFri: false },
];

console.log('| Config | n | WR | Avg | Median | P1 | P2 |');
console.log('|--------|---|-----|-----|--------|----|----|');

configs.forEach(c => {
  const subset = allTrades.filter(t => {
    if (t.speedRatio < c.speedMin) return false;
    if (t.dd < c.ddMin) return false;
    if (c.blockUS && (t.hour >= 16 && t.hour < 20)) return false;
    if (c.blockFri && t.dayOfWeek === 5) return false;
    return true;
  });
  
  if (subset.length >= 3) {
    const wins = subset.filter(t => t.win).length;
    const avg = subset.reduce((s, t) => s + t.pnl, 0) / subset.length;
    const sorted = subset.map(t => t.pnl).sort((a,b) => a-b);
    const median = sorted[Math.floor(sorted.length/2)];
    
    // Period split
    const mid = new Date('2025-09-01T00:00:00Z'); // Approximate mid
    const p1 = subset.filter(t => new Date(t.time) < mid);
    const p2 = subset.filter(t => new Date(t.time) >= mid);
    
    const p1Avg = p1.length > 0 ? (p1.reduce((s,t) => s + t.pnl, 0) / p1.length).toFixed(2) : 'N/A';
    const p2Avg = p2.length > 0 ? (p2.reduce((s,t) => s + t.pnl, 0) / p2.length).toFixed(2) : 'N/A';
    
    const wr = (wins / subset.length * 100).toFixed(1);
    console.log(`| ${c.label} | ${subset.length} | ${wr}% | ${avg.toFixed(3)}% | ${median.toFixed(2)}% | ${p1Avg} | ${p2Avg} |`);
  } else if (subset.length > 0) {
    console.log(`| ${c.label} | ${subset.length} | (too few) | | | |`);
  }
});

console.log('\n=== EXTENDED HOLD TEST (Best configs with Speed>1.5) ===\n');

const extendedHolds = [8, 12, 16, 24];
const speedThresholds = [1.5, 2];

speedThresholds.forEach(speed => {
  console.log(`Speed > ${speed}:`);
  
  extendedHolds.forEach(hold => {
    const trades = [];
    
    for (let i = LOOKBACK + 1; i < eth.length - hold; i++) {
      const startIdx = i - LOOKBACK;
      const startPrice = eth[startIdx].o;
      const midIdx = startIdx + 2;
      const midPrice = eth[midIdx].c;
      const lastCandle = eth[i - 1];
      const endPrice = lastCandle.c;
      
      const dd = (startPrice - endPrice) / startPrice * 100;
      if (dd < 6) continue;
      if (lastCandle.c >= lastCandle.o) continue;
      
      const earlyDD = (startPrice - midPrice) / startPrice * 100;
      const lateDD = dd - earlyDD;
      const speedRatio = lateDD > 0.01 ? earlyDD / lateDD : 999;
      
      if (speedRatio < speed) continue;
      
      // Block US
      const hour = new Date(eth[i].t).getUTCHours();
      if (hour >= 16 && hour < 20) continue;
      
      const entryPrice = eth[i].o;
      const exitPrice = eth[i + hold].c;
      const pnl = (exitPrice - entryPrice) / entryPrice * 100;
      
      trades.push({ pnl, win: pnl > 0 });
    }
    
    if (trades.length >= 3) {
      const wins = trades.filter(t => t.win).length;
      const avg = trades.reduce((s, t) => s + t.pnl, 0) / trades.length;
      console.log(`  Hold ${hold}h: n=${trades.length}, WR=${(wins/trades.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%`);
    }
  });
  
  console.log();
});

// Save best config details
const bestConfig = allTrades.filter(t => 
  t.speedRatio >= 2 && t.dd >= 6 && !(t.hour >= 16 && t.hour < 20)
);

writeFileSync('results-speed-lower-threshold.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  totalBaseTrades: allTrades.length,
  bestConfigTrades: bestConfig
}, null, 2));

console.log('Saved results');