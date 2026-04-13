/**
 * ETH Drawdown Recovery - Optimized Strategy
 * 
 * Key findings from conditional analysis:
 * 1. AVOID Friday (worst day: 63% WR, -0.899% avg)
 * 2. PREFER Tue/Wed (best: 83%/100% WR, +2.9%/+2.7% avg)
 * 3. Low volatility is 60% better than high vol (78% vs 48% WR)
 * 4. 6%+ drawdown beats 5-6% (75% vs 51% WR)
 * 5. US market hours (16-19 UTC) = worst performance
 * 
 * New strategy filters:
 * - MIN_DD = 6% (raise from 5%)
 * - BLOCK Friday entries
 * - BLOCK US market hours (16-20 UTC)
 * - Prefer low volatility windows
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

// Load data
const eth = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));
const btc = JSON.parse(readFileSync(join(DATA_DIR, 'btcusdt-1h-long.json'), 'utf8'));

console.log(`Loaded ${eth.length} ETH candles (${new Date(eth[0].t).toISOString()} to ${new Date(eth[eth.length-1].t).toISOString()})\n`);

// Configurations to test
const configs = [
  { label: 'BASELINE (DD>=5%, no filter)', minDD: 5, blockUS: false, blockFri: false },
  { label: 'DD>=6% only', minDD: 6, blockUS: false, blockFri: false },
  { label: 'DD>=5% + Block US hours', minDD: 5, blockUS: true, blockFri: false },
  { label: 'DD>=6% + Block US hours', minDD: 6, blockUS: true, blockFri: false },
  { label: 'DD>=5% + Block Friday', minDD: 5, blockUS: false, blockFri: true },
  { label: 'DD>=6% + Block US + Block Friday', minDD: 6, blockUS: true, blockFri: true },
  { label: 'DD>=5% + Block US + Block Friday', minDD: 5, blockUS: true, blockFri: true },
  { label: 'DD>=6% + Block US + Block Fri + Tue/Wed only', minDD: 6, blockUS: true, blockFri: true, preferTueWed: true },
];

function testConfig(config) {
  const { label, minDD, blockUS, blockFri, preferTueWed } = config;
  const LOOKBACK = 4;
  const HOLD = 8;
  const trades = [];
  
  for (let i = LOOKBACK + 1; i < eth.length - HOLD; i++) {
    // Time filter
    const entryTime = new Date(eth[i].t);
    const hour = entryTime.getUTCHours();
    const dayOfWeek = entryTime.getDay();
    
    if (blockUS && hour >= 16 && hour < 20) continue;
    if (blockFri && dayOfWeek === 5) continue; // Friday = 5
    if (preferTueWed && dayOfWeek !== 2 && dayOfWeek !== 3) continue; // Tue=2, Wed=3
    
    // Drawdown check
    const startIdx = i - LOOKBACK;
    const startPrice = eth[startIdx].o;
    const endPrice = eth[i - 1].c;
    const dd = (startPrice - endPrice) / startPrice * 100;
    
    if (dd < minDD) continue;
    
    // Red candle check
    const lastCandle = eth[i - 1];
    const isRed = lastCandle.c < lastCandle.o;
    if (!isRed) continue;
    
    // Entry and exit
    const entryPrice = eth[i].o;
    const exitPrice = eth[i + HOLD].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    
    trades.push({ entryTime, dayOfWeek, hour, entryPrice, exitPrice, pnl, win: pnl > 0, dd });
  }
  
  if (trades.length < 5) return null;
  
  const wins = trades.filter(t => t.win).length;
  const wr = (wins / trades.length * 100).toFixed(1);
  const avg = (trades.reduce((s, t) => s + t.pnl, 0) / trades.length).toFixed(3);
  const median = (trades.map(t => t.pnl).sort((a,b) => a-b)[Math.floor(trades.length/2)]).toFixed(3);
  
  // Period split
  const mid = Math.floor(eth.length / 2);
  const midTime = new Date(eth[mid].t);
  const p1Trades = trades.filter(t => t.entryTime < midTime);
  const p2Trades = trades.filter(t => t.entryTime >= midTime);
  
  const calcPeriod = (arr) => {
    if (arr.length === 0) return { n: 0, avg: 'N/A' };
    const avgP = arr.reduce((s,t) => s + t.pnl, 0) / arr.length;
    return { n: arr.length, avg: avgP.toFixed(3) };
  };
  
  const p1 = calcPeriod(p1Trades);
  const p2 = calcPeriod(p2Trades);
  
  return {
    label,
    n: trades.length,
    wr,
    avg,
    median,
    p1,
    p2
  };
}

console.log('Testing configurations...\n');
const results = configs.map(c => testConfig(c)).filter(Boolean);

results.forEach(r => {
  console.log(`${r.label}:`);
  console.log(`  n=${r.n}, WR=${r.wr}%, Avg=${r.avg}%, Median=${r.median}%`);
  console.log(`  P1: n=${r.p1.n}, avg=${r.p1.avg} | P2: n=${r.p2.n}, avg=${r.p2.avg}`);
  console.log();
});

// Best config
const best = results.reduce((b, r) => parseFloat(r.avg) > parseFloat(b.avg) ? r : b, results[0]);
console.log('=== BEST ===');
console.log(`${best.label}: n=${best.n}, WR=${best.wr}%, Avg=${best.avg}%`);
console.log(`P1: ${best.p1.avg} | P2: ${best.p2.avg}`);

// Save results
writeFileSync('results-optimized-configs.json', JSON.stringify(results, null, 2));

// Now test with extended hold periods (test 12h and 24h for best config)
console.log('\n=== EXTENDED HOLD TEST (with best config) ===');
const extendedConfigs = [
  { label: 'Hold 8h', hold: 8 },
  { label: 'Hold 12h', hold: 12 },
  { label: 'Hold 16h', hold: 16 },
  { label: 'Hold 24h', hold: 24 },
];

const bestBase = { minDD: 6, blockUS: true, blockFri: true };

extendedConfigs.forEach(ec => {
  const trades = [];
  const { hold } = ec;
  
  for (let i = 5; i < eth.length - hold; i++) {
    const entryTime = new Date(eth[i].t);
    const hour = entryTime.getUTCHours();
    const dayOfWeek = entryTime.getDay();
    
    if (bestBase.blockUS && hour >= 16 && hour < 20) continue;
    if (bestBase.blockFri && dayOfWeek === 5) continue;
    
    const startIdx = i - 4;
    const startPrice = eth[startIdx].o;
    const endPrice = eth[i - 1].c;
    const dd = (startPrice - endPrice) / startPrice * 100;
    
    if (dd < bestBase.minDD) continue;
    
    const lastCandle = eth[i - 1];
    if (lastCandle.c >= lastCandle.o) continue;
    
    const entryPrice = eth[i].o;
    const exitPrice = eth[i + hold].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    
    trades.push({ entryTime, pnl, win: pnl > 0 });
  }
  
  if (trades.length < 3) return;
  
  const wins = trades.filter(t => t.win).length;
  const wr = (wins / trades.length * 100).toFixed(1);
  const avg = (trades.reduce((s, t) => s + t.pnl, 0) / trades.length).toFixed(3);
  
  console.log(`${ec.label}: n=${trades.length}, WR=${wr}%, Avg=${avg}%`);
});