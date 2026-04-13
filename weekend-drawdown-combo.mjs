/**
 * ETH Drawdown Recovery + Weekend Effect Combination Test
 * 
 * Hypothesis: Weekend crypto drops are retail-driven and reverse Monday.
 * Combining this with drawdown recovery could create a stronger signal.
 * 
 * Test: ETH drawdown on Monday morning (after weekend drop) vs regular drawdown
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

const eth = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));
const btc = JSON.parse(readFileSync(join(DATA_DIR, 'btcusdt-1h-long.json'), 'utf8'));

console.log(`Testing ${eth.length} ETH candles for weekend + drawdown combo...\n`);

const configs = [
  { 
    label: 'BASELINE Drawdown (DD>=5%, no weekend filter)', 
    minDD: 5, onlyMonday: false, onlyAfterWeekendDrop: false 
  },
  { 
    label: 'MONDAY ONLY (no weekend drop filter)', 
    minDD: 5, onlyMonday: true, onlyAfterWeekendDrop: false 
  },
  { 
    label: 'MONDAY ONLY (BTC dropped >3% weekend)', 
    minDD: 5, onlyMonday: true, onlyAfterWeekendDrop: true 
  },
  { 
    label: 'MONDAY ONLY (DD>=4%, BTC dropped >2% weekend)', 
    minDD: 4, onlyMonday: true, onlyAfterWeekendDrop: true 
  },
];

function testConfig(config) {
  const { label, minDD, onlyMonday, onlyAfterWeekendDrop } = config;
  const LOOKBACK = 4;
  const HOLD = 8;
  const trades = [];
  
  for (let i = LOOKBACK + 1; i < eth.length - HOLD; i++) {
    const entryTime = new Date(eth[i].t);
    const dayOfWeek = entryTime.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const hour = entryTime.getUTCHours();
    
    // Monday filter
    if (onlyMonday && dayOfWeek !== 1) continue;
    
    // Block US hours
    if (hour >= 16 && hour < 20) continue;
    
    // Check for weekend drop (Fri night to Mon morning)
    let btcWeekendDrop = false;
    if (onlyAfterWeekendDrop) {
      // Find the weekend window (Fri 20:00 to Mon 08:00)
      // We need to look back at BTC performance over the weekend
      const checkTime = eth[i].t;
      
      // Find Friday 20:00 UTC candle index
      let friIdx = i - 1;
      while (friIdx > 0 && new Date(eth[friIdx].t).getDay() !== 5) friIdx--;
      
      // Find Monday 08:00 candle index
      let monIdx = i - 1;
      while (monIdx > 0 && new Date(eth[monIdx].t).getUTCHours() > 8) monIdx--;
      
      if (friIdx > 0 && monIdx > friIdx) {
        // Get BTC performance over weekend
        const btcFriIdx = btc.findIndex(k => k.t >= eth[friIdx].t);
        const btcMonIdx = btc.findIndex(k => k.t >= eth[monIdx].t);
        
        if (btcFriIdx >= 0 && btcMonIdx >= 0 && btcMonIdx > btcFriIdx) {
          const btcStart = btc[btcFriIdx].c;
          const btcEnd = btc[btcMonIdx].c;
          const btcDrop = (btcEnd - btcStart) / btcStart * 100;
          
          if (btcDrop < -3) btcWeekendDrop = true;
        }
      }
      
      if (!btcWeekendDrop) continue;
    }
    
    // Drawdown check
    const startIdx = i - LOOKBACK;
    const startPrice = eth[startIdx].o;
    const lastCandle = eth[i - 1];
    const endPrice = lastCandle.c;
    const dd = (startPrice - endPrice) / startPrice * 100;
    
    if (dd < minDD) continue;
    
    // Red candle check
    if (lastCandle.c >= lastCandle.o) continue;
    
    // Entry and exit
    const entryPrice = eth[i].o;
    const exitPrice = eth[i + HOLD].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    
    trades.push({ entryTime, dayOfWeek, hour, entryPrice, exitPrice, pnl, win: pnl > 0, dd });
  }
  
  if (trades.length < 3) return { label, n: 0, wr: 'N/A', avg: 'N/A' };
  
  const wins = trades.filter(t => t.win).length;
  const wr = (wins / trades.length * 100).toFixed(1);
  const avg = (trades.reduce((s, t) => s + t.pnl, 0) / trades.length).toFixed(3);
  const median = trades.map(t => t.pnl).sort((a,b) => a-b)[Math.floor(trades.length/2)].toFixed(3);
  
  return { label, n: trades.length, wr, avg, median };
}

console.log('=== WEEKEND + DRAWDOWN COMBINATION TEST ===\n');

configs.forEach(c => {
  const result = testConfig(c);
  console.log(`${result.label}:`);
  console.log(`  n=${result.n}, WR=${result.wr}%, Avg=${result.avg}%, Median=${result.median}%\n`);
});

// Save results
writeFileSync('results-weekend-drawdown-combo.json', JSON.stringify(configs.map(testConfig), null, 2));

// Now test the best from above with extended lookback for weekend
console.log('\n=== EXTENDED: Weekend Drop + Drawdown Recovery ===');

// Test different weekend drop thresholds
const weekendThresholds = [
  { label: 'BTC dropped >1% weekend', minBtcDrop: -1 },
  { label: 'BTC dropped >2% weekend', minBtcDrop: -2 },
  { label: 'BTC dropped >3% weekend', minBtcDrop: -3 },
  { label: 'BTC dropped >5% weekend', minBtcDrop: -5 },
];

weekendThresholds.forEach(t => {
  const trades = [];
  
  for (let i = 5; i < eth.length - 8; i++) {
    const entryTime = new Date(eth[i].t);
    const dayOfWeek = entryTime.getDay();
    const hour = entryTime.getUTCHours();
    
    // Only Monday
    if (dayOfWeek !== 1) continue;
    
    // Block US hours
    if (hour >= 16 && hour < 20) continue;
    
    // Find Friday 20:00 in ETH data
    let friIdx = i - 1;
    while (friIdx > 0 && (new Date(eth[friIdx].t).getDay() !== 5 || new Date(eth[friIdx].t).getUTCHours() < 20)) friIdx--;
    
    if (friIdx < 10) continue;
    
    // Get weekend drop for ETH (Fri 20:00 to Mon entry)
    const ethFriClose = eth[friIdx + 1].c; // Friday 21:00 close
    const ethMonOpen = eth[i].o; // Monday open
    const ethWeekendDrop = (ethMonOpen - ethFriClose) / ethFriClose * 100;
    
    if (ethWeekendDrop > t.minBtcDrop) continue; // Need DROP (negative)
    
    // Drawdown check (during early Monday)
    const startIdx = i - 4;
    const startPrice = eth[startIdx].o;
    const lastCandle = eth[i - 1];
    const endPrice = lastCandle.c;
    const dd = (startPrice - endPrice) / startPrice * 100;
    
    if (dd < 4) continue;
    if (lastCandle.c >= lastCandle.o) continue;
    
    const entryPrice = eth[i].o;
    const exitPrice = eth[i + 8].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    
    trades.push({ entryTime, pnl, win: pnl > 0, ethWeekendDrop });
  }
  
  if (trades.length >= 3) {
    const wins = trades.filter(t => t.win).length;
    const avg = trades.reduce((s,t) => s + t.pnl, 0) / trades.length;
    const wr = (wins / trades.length * 100).toFixed(1);
    console.log(`${t.label}: n=${trades.length}, WR=${wr}%, Avg=${avg.toFixed(3)}%`);
  }
});