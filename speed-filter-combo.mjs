/**
 * ETH Drawdown Recovery - Speed Filter Deep Dive
 * 
 * FAST DROP = 80% WR, +1.66% avg (best single filter!)
 * Now combining with other filters to find the optimal config
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

const eth = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));

console.log(`Testing speed filter combinations\n`);

const LOOKBACK = 4;
const HOLD = 8;

function getTrades() {
  const trades = [];
  
  for (let i = LOOKBACK + 1; i < eth.length - HOLD; i++) {
    const startIdx = i - LOOKBACK;
    const startPrice = eth[startIdx].o;
    const lastCandle = eth[i - 1];
    const endPrice = lastCandle.c;
    const dd = (startPrice - endPrice) / startPrice * 100;
    
    if (dd < 5) continue;
    if (lastCandle.c >= lastCandle.o) continue; // Red candle
    
    // Speed calculation
    const priceAtStart = eth[startIdx].c;
    const priceAtMid = eth[startIdx + 2].c;
    const earlyDD = (priceAtStart - priceAtMid) / priceAtStart * 100;
    const lateDD = dd - earlyDD;
    const speedRatio = lateDD > 0 ? earlyDD / lateDD : 1;
    
    // Other filters
    const hour = new Date(eth[i].t).getUTCHours();
    const dayOfWeek = new Date(eth[i].t).getDay();
    
    const entryPrice = eth[i].o;
    const exitPrice = eth[i + HOLD].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    
    trades.push({
      idx: i,
      time: new Date(eth[i].t).toISOString(),
      entryPrice,
      dd: dd.toFixed(2),
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
console.log(`Found ${allTrades.length} trades\n`);

console.log('=== SPEED + DRAWDOWN MAGNITUDE ===\n');

const configs = [
  // Speed only
  { label: 'Speed > 1 (all DD)', speedMin: 1 },
  { label: 'Speed > 1.5 (all DD)', speedMin: 1.5 },
  { label: 'Speed > 2 (all DD)', speedMin: 2 },
  { label: 'Speed > 2.5 (all DD)', speedMin: 2.5 },
  
  // Speed + DD >= 6
  { label: 'Speed > 1 + DD>=6%', speedMin: 1, ddMin: 6 },
  { label: 'Speed > 2 + DD>=6%', speedMin: 2, ddMin: 6 },
  
  // Speed + Block US
  { label: 'Speed > 2 + Block US', speedMin: 2, blockUS: true },
  
  // Speed + Block Fri
  { label: 'Speed > 2 + Block Fri', speedMin: 2, blockFri: true },
  
  // Speed + Tue/Wed
  { label: 'Speed > 2 + Tue/Wed only', speedMin: 2, tueWedOnly: true },
  
  // Triple combo
  { label: 'Speed > 2 + DD>=6% + Block US', speedMin: 2, ddMin: 6, blockUS: true },
  { label: 'Speed > 2 + DD>=6% + Block US + Block Fri', speedMin: 2, ddMin: 6, blockUS: true, blockFri: true },
  
  // Best of all: Speed > 2 + Tue/Wed + Block US
  { label: 'Speed > 2 + Tue/Wed + Block US', speedMin: 2, tueWedOnly: true, blockUS: true },
];

configs.forEach(c => {
  const subset = allTrades.filter(t => {
    if (t.speedRatio < c.speedMin) return false;
    if (c.ddMin && parseFloat(t.dd) < c.ddMin) return false;
    if (c.blockUS && (t.hour >= 16 && t.hour < 20)) return false;
    if (c.blockFri && t.dayOfWeek === 5) return false;
    if (c.tueWedOnly && t.dayOfWeek !== 2 && t.dayOfWeek !== 3) return false;
    return true;
  });
  
  if (subset.length >= 3) {
    const wins = subset.filter(t => t.win).length;
    const avg = subset.reduce((s, t) => s + t.pnl, 0) / subset.length;
    const median = subset.map(t => t.pnl).sort((a,b) => a-b)[Math.floor(subset.length/2)];
    
    console.log(`${c.label}:`);
    console.log(`  n=${subset.length}, WR=${(wins/subset.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%, Median=${median.toFixed(3)}%`);
  } else if (subset.length > 0) {
    console.log(`${c.label}: n=${subset.length} (too few)`);
  }
});

console.log('\n=== EXTREME SPEED TEST (Speed > 3) ===\n');

const extreme = allTrades.filter(t => t.speedRatio > 3);
if (extreme.length >= 3) {
  const wins = extreme.filter(t => t.win).length;
  const avg = extreme.reduce((s, t) => s + t.pnl, 0) / extreme.length;
  console.log(`Speed > 3: n=${extreme.length}, WR=${(wins/extreme.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%`);
  
  // Show details
  extreme.forEach(t => {
    console.log(`  ${t.time}: DD=${t.dd}%, Speed=${t.speedRatio}, PnL=${t.pnl.toFixed(2)}%`);
  });
}

// Now test: What if we require BOTH fast start AND slow finish?
// (Capitulation then exhaustion)
console.log('\n=== CAPITULATION PATTERN (Fast start, Slow finish) ===\n');

const capPatterns = allTrades.filter(t => {
  // Fast start: earlyDD > 2x lateDD
  // This is already what speedRatio > 2 means
  // Now add: lateDD must be present (not instant drop)
  return t.speedRatio > 2 && parseFloat(t.dd) >= 6;
});

if (capPatterns.length >= 3) {
  const wins = capPatterns.filter(t => t.win).length;
  const avg = capPatterns.reduce((s, t) => s + t.pnl, 0) / capPatterns.length;
  console.log(`Capitulation (speed>2, DD>=6%): n=${capPatterns.length}, WR=${(wins/capPatterns.length*100).toFixed(1)}%, Avg=${avg.toFixed(3)}%`);
}

// Save results
writeFileSync('results-speed-filter-combo.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  allTrades
}, null, 2));

console.log('\nSaved to results-speed-filter-combo.json');