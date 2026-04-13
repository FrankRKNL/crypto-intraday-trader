/**
 * BTC Weekend Reversal + Drawdown Recovery
 * 
 * BTC has the STRONGEST weekend reversal effect (90% WR in previous research)
 * Now combining with drawdown recovery for ETH
 * 
 * Strategy:
 * 1. BTC drops >3% over weekend -> SHORT BTC on Monday open
 * 2. ETH drops >= 5% over week -> LONG ETH on Monday (drawdown recovery)
 * 
 * Exit: Monday close for BTC shorts, 8h hold for ETH longs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

const eth = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));
const btc = JSON.parse(readFileSync(join(DATA_DIR, 'btcusdt-1h-long.json'), 'utf8'));

console.log(`Testing BTC weekend reversal + ETH drawdown combo\n`);
console.log(`Period: ${new Date(eth[0].t).toISOString()} to ${new Date(eth[eth.length-1].t).toISOString()}\n`);

// === TEST 1: BTC WEEKEND SHORT ===
console.log('=== BTC WEEKEND SHORT (Entry: Monday open, Exit: Monday close) ===\n');

function testBTCWeekendShort(minDrop) {
  const trades = [];
  
  for (let i = 100; i < eth.length - 24; i++) { // Need weekend data
    const entryTime = new Date(eth[i].t);
    const dayOfWeek = entryTime.getDay();
    const hour = entryTime.getUTCHours();
    
    // Only Monday, 0-4h UTC (entry window)
    if (dayOfWeek !== 1 || hour < 0 || hour > 4) continue;
    
    // Find Friday 20:00 close
    let friIdx = i - 1;
    while (friIdx > 0 && new Date(eth[friIdx].t).getUTCHours() !== 20) friIdx--;
    if (friIdx < 10) continue;
    
    // Get Friday close and Monday open for BTC
    const btcStartIdx = btc.findIndex(k => k.t >= eth[friIdx].t);
    if (btcStartIdx < 0 || btcStartIdx + 24 >= btc.length) continue;
    
    const btcFriClose = btc[btcStartIdx + 1].c; // Friday 21:00 close
    const btcMonOpen = btc[btcStartIdx + 25].c; // Monday 02:00 open (approx)
    
    // Find exact Monday open in BTC data
    const exactMonIdx = btc.findIndex(k => k.t >= eth[i].t);
    if (exactMonIdx < 0) continue;
    
    const btcCurrentOpen = btc[exactMonIdx].o;
    const btcWeekendDrop = (btcCurrentOpen - btcFriClose) / btcFriClose * 100;
    
    if (btcWeekendDrop >= minDrop) {
      // BTC dropped enough - SHORT
      const exitIdx = exactMonIdx + 12; // Hold 12h (until ~14:00 UTC)
      if (exitIdx >= btc.length) continue;
      
      const exitPrice = btc[exitIdx].c;
      const pnl = (btcFriClose - exitPrice) / btcFriClose * 100; // Short: gain when price drops
      
      trades.push({
        entryTime: entryTime.toISOString(),
        btcWeekendDrop: btcWeekendDrop.toFixed(2),
        entryPrice: btcFriClose,
        exitPrice,
        pnl: pnl.toFixed(3),
        win: pnl > 0
      });
    }
  }
  
  if (trades.length < 3) return null;
  
  const wins = trades.filter(t => t.win).length;
  const wr = (wins / trades.length * 100).toFixed(1);
  const avg = (trades.reduce((s,t) => s + parseFloat(t.pnl), 0) / trades.length).toFixed(3);
  
  return { n: trades.length, wr, avg, trades };
}

// Test BTC weekend short with different thresholds
[-1, -2, -3, -4, -5].forEach(drop => {
  const result = testBTCWeekendShort(drop);
  if (result) {
    console.log(`BTC drop >= ${drop}%: n=${result.n}, WR=${result.wr}%, Avg=${result.avg}%`);
  }
});

// === TEST 2: ETH DRAWDOWN RECOVERY (MONDAY ONLY) ===
console.log('\n=== ETH DRAWDOWN RECOVERY (MONDAY ONLY) ===\n');

function testETHDrawdownMonday(minDD) {
  const trades = [];
  
  for (let i = 5; i < eth.length - 8; i++) {
    const entryTime = new Date(eth[i].t);
    const dayOfWeek = entryTime.getDay();
    const hour = entryTime.getUTCHours();
    
    // Monday only, 0-8h UTC
    if (dayOfWeek !== 1 || hour < 0 || hour > 8) continue;
    
    // Drawdown check
    const startIdx = i - 4;
    const startPrice = eth[startIdx].o;
    const lastCandle = eth[i - 1];
    const endPrice = lastCandle.c;
    const dd = (startPrice - endPrice) / startPrice * 100;
    
    if (dd < minDD) continue;
    if (lastCandle.c >= lastCandle.o) continue; // Red candle
    
    const entryPrice = eth[i].o;
    const exitPrice = eth[i + 8].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    
    trades.push({
      entryTime: entryTime.toISOString(),
      dd: dd.toFixed(2),
      pnl: pnl.toFixed(3),
      win: pnl > 0
    });
  }
  
  if (trades.length < 3) return null;
  
  const wins = trades.filter(t => t.win).length;
  const wr = (wins / trades.length * 100).toFixed(1);
  const avg = (trades.reduce((s,t) => s + parseFloat(t.pnl), 0) / trades.length).toFixed(3);
  
  return { n: trades.length, wr, avg, trades };
}

[4, 5, 6].forEach(dd => {
  const result = testETHDrawdownMonday(dd);
  if (result) {
    console.log(`DD>=${dd}%: n=${result.n}, WR=${result.wr}%, Avg=${result.avg}%`);
  }
});

// === TEST 3: COMBINED - BTC Weekend Drop + ETH Drawdown ===
console.log('\n=== COMBINED STRATEGY (BTC Weekend Short + ETH Drawdown Long) ===\n');

// Track both strategies and see if they align
const combinedTrades = [];

for (let i = 100; i < eth.length - 24; i++) {
  const entryTime = new Date(eth[i].t);
  const dayOfWeek = entryTime.getDay();
  const hour = entryTime.getUTCHours();
  
  // Only Monday, 0-4h UTC
  if (dayOfWeek !== 1 || hour < 0 || hour > 4) continue;
  
  // Find Friday 20:00 in ETH
  let friIdx = i - 1;
  while (friIdx > 0 && new Date(eth[friIdx].t).getUTCHours() !== 20) friIdx--;
  if (friIdx < 10) continue;
  
  // BTC weekend drop
  const btcStartIdx = btc.findIndex(k => k.t >= eth[friIdx].t);
  if (btcStartIdx < 0 || btcStartIdx + 25 >= btc.length) continue;
  
  const btcFriClose = btc[btcStartIdx + 1].c;
  const exactMonIdx = btc.findIndex(k => k.t >= eth[i].t);
  if (exactMonIdx < 0) continue;
  
  const btcMonOpen = btc[exactMonIdx].o;
  const btcWeekendDrop = (btcMonOpen - btcFriClose) / btcFriClose * 100;
  
  // ETH drawdown on Monday
  const startIdx = i - 4;
  const startPrice = eth[startIdx].o;
  const lastCandle = eth[i - 1];
  const endPrice = lastCandle.c;
  const ethDD = (startPrice - endPrice) / startPrice * 100;
  
  // Check both conditions
  const btcShort = btcWeekendDrop <= -3; // BTC dropped >3% weekend -> short
  const ethLong = ethDD >= 5 && lastCandle.c < lastCandle.o; // ETH drawdown -> long
  
  if (btcShort && ethLong) {
    // BOTH signals align!
    const ethEntry = eth[i].o;
    const ethExit = eth[i + 8].c;
    const ethPnl = (ethExit - ethEntry) / ethEntry * 100;
    
    const btcExitIdx = exactMonIdx + 12;
    const btcExit = btc[btcExitIdx].c;
    const btcPnl = (btcFriClose - btcExit) / btcFriClose * 100;
    
    combinedTrades.push({
      date: entryTime.toISOString().split('T')[0],
      btcDrop: btcWeekendDrop.toFixed(1),
      ethDD: ethDD.toFixed(1),
      btcPnl: btcPnl.toFixed(2),
      ethPnl: ethPnl.toFixed(2),
      totalPnl: (btcPnl + ethPnl).toFixed(2),
      win: btcPnl > 0 && ethPnl > 0
    });
  }
}

if (combinedTrades.length >= 3) {
  const wins = combinedTrades.filter(t => t.win).length;
  const avg = combinedTrades.reduce((s,t) => s + parseFloat(t.totalPnl), 0) / combinedTrades.length;
  console.log(`Both signals align: ${combinedTrades.length} times`);
  console.log(`Win rate: ${(wins/combinedTrades.length*100).toFixed(1)}%`);
  console.log(`Average total return: ${avg.toFixed(2)}%`);
  console.log('\nDetails:');
  combinedTrades.forEach(t => {
    console.log(`${t.date}: BTC ${t.btcPnl}% + ETH ${t.ethPnl}% = ${t.totalPnl}% (${t.win?'WIN':'LOSS'})`);
  });
} else {
  console.log(`Only ${combinedTrades.length} combined signals (need more for significance)`);
  
  // Show individual counts
  let btcSignals = 0, ethSignals = 0;
  for (let i = 100; i < eth.length - 24; i++) {
    const entryTime = new Date(eth[i].t);
    if (entryTime.getDay() !== 1 || entryTime.getUTCHours() > 4) continue;
    
    // BTC drop
    let friIdx = i - 1;
    while (friIdx > 0 && new Date(eth[friIdx].t).getUTCHours() !== 20) friIdx--;
    if (friIdx >= 10) {
      const btcStartIdx = btc.findIndex(k => k.t >= eth[friIdx].t);
      if (btcStartIdx >= 0) {
        const exactMonIdx = btc.findIndex(k => k.t >= eth[i].t);
        if (exactMonIdx >= 0) {
          const btcFriClose = btc[btcStartIdx + 1].c;
          const btcMonOpen = btc[exactMonIdx].o;
          if ((btcMonOpen - btcFriClose) / btcFriClose <= -0.03) btcSignals++;
        }
      }
    }
    
    // ETH drawdown
    const startIdx = i - 4;
    if (startIdx >= 0) {
      const startPrice = eth[startIdx].o;
      const lastCandle = eth[i - 1];
      const dd = (startPrice - lastCandle.c) / startPrice * 100;
      if (dd >= 5 && lastCandle.c < lastCandle.o) ethSignals++;
    }
  }
  
  console.log(`BTC short signals (>3% drop): ${btcSignals}`);
  console.log(`ETH long signals (DD>=5%, red): ${ethSignals}`);
}

// Save results
writeFileSync('results-btc-weekend-eth-drawdown.json', JSON.stringify({
  combined: combinedTrades
}, null, 2));
console.log('\nSaved to results-btc-weekend-eth-drawdown.json');