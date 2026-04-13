/**
 * ETH Drawdown Recovery - Deep Conditional Analysis
 * 
 * Goal: Find conditions where the pattern works BEST vs WORST
 * This informs position sizing: bigger when confident, smaller when uncertain
 * 
 * Conditions to test:
 * 1. Time-of-day (which hours produce best results?)
 * 2. Drawdown magnitude (5% vs 6% vs 7%+)
 * 3. BTC correlation (BTC up/down/sideways during ETH drawdown)
 * 4. Volatility regime (high vs low VIX/realized vol)
 * 5. Recent streak (after wins vs after losses)
 * 6. Day of week
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

// Load data
const eth = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));
const btc = JSON.parse(readFileSync(join(DATA_DIR, 'btcusdt-1h-long.json'), 'utf8'));

console.log(`Loaded ${eth.length} ETH candles, ${btc.length} BTC candles`);
console.log(`Period: ${new Date(eth[0].t).toISOString()} to ${new Date(eth[eth.length-1].t).toISOString()}\n`);

// Strategy: ETH drops >= 5% over 4 candles, last candle red, hold 8h
const MIN_DD = 5.0;
const LOOKBACK = 4;
const HOLD = 8;

function analyze() {
  const trades = [];
  
  for (let i = LOOKBACK + 1; i < eth.length - HOLD; i++) {
    // Check drawdown over lookback candles
    const startIdx = i - LOOKBACK;
    const startPrice = eth[startIdx].o;
    const endPrice = eth[i - 1].c; // Last candle before entry
    const dd = (startPrice - endPrice) / startPrice * 100;
    
    if (dd >= MIN_DD) {
      // Last candle must be red
      const lastCandle = eth[i - 1];
      const isRed = lastCandle.c < lastCandle.o;
      
      if (isRed) {
        // Entry at this candle close, exit after HOLD candles
        const entryPrice = eth[i].o; // Open of next candle
        const exitPrice = eth[i + HOLD].c;
        const pnl = (exitPrice - entryPrice) / entryPrice * 100;
        const win = pnl > 0;
        
        // Additional context for conditional analysis
        const entryTime = new Date(eth[i].t);
        const hour = entryTime.getUTCHours();
        const dayOfWeek = entryTime.getDay();
        
        // BTC performance during lookback window
        const btcStart = btc[startIdx].o;
        const btcEnd = btc[i - 1].c;
        const btcChange = (btcEnd - btcStart) / btcStart * 100;
        
        // Realized volatility during hold period (intraday vol)
        let realizedVol = 0;
        for (let j = i; j < i + HOLD; j++) {
          const candleReturn = (eth[j+1].c - eth[j].c) / eth[j].c;
          realizedVol += candleReturn * candleReturn;
        }
        realizedVol = Math.sqrt(realizedVol / HOLD) * 100;
        
        trades.push({
          entryTime,
          hour,
          dayOfWeek,
          entryPrice,
          exitPrice,
          pnl,
          win,
          dd: dd.toFixed(2),
          btcChange: btcChange.toFixed(2),
          realizedVol: realizedVol.toFixed(4)
        });
      }
    }
  }
  
  console.log(`Found ${trades.length} trades\n`);
  
  // === CONDITIONAL ANALYSIS ===
  
  // 1. BY HOUR OF DAY
  console.log('=== HOURLY ANALYSIS ===');
  const hourly = {};
  trades.forEach(t => {
    const bucket = Math.floor(t.hour / 4) * 4; // 0-3, 4-7, 8-11, 12-15, 16-19, 20-23
    if (!hourly[bucket]) hourly[bucket] = { n: 0, wins: 0, totalPnL: 0 };
    hourly[bucket].n++;
    if (t.win) hourly[bucket].wins++;
    hourly[bucket].totalPnL += t.pnl;
  });
  
  Object.keys(hourly).sort((a,b) => a-b).forEach(h => {
    const d = hourly[h];
    const wr = (d.wins / d.n * 100).toFixed(1);
    const avg = (d.totalPnL / d.n).toFixed(3);
    console.log(`${h}-${parseInt(h)+3}h UTC: n=${d.n}, WR=${wr}%, Avg=${avg}%, Expected=${(d.n * parseFloat(avg) / 100).toFixed(2)}%`);
  });
  
  // 2. BY DRAWDOWN MAGNITUDE
  console.log('\n=== DRAWDOWN MAGNITUDE ===');
  const ddBuckets = [
    { label: '5-6%', min: 5, max: 6 },
    { label: '6-7%', min: 6, max: 7 },
    { label: '7-8%', min: 7, max: 8 },
    { label: '8%+', min: 8, max: 999 }
  ];
  
  ddBuckets.forEach(b => {
    const subset = trades.filter(t => parseFloat(t.dd) >= b.min && parseFloat(t.dd) < b.max);
    if (subset.length > 0) {
      const wins = subset.filter(t => t.win).length;
      const avg = subset.reduce((s, t) => s + t.pnl, 0) / subset.length;
      const wr = (wins / subset.length * 100).toFixed(1);
      console.log(`${b.label}: n=${subset.length}, WR=${wr}%, Avg=${avg.toFixed(3)}%`);
    }
  });
  
  // 3. BY BTC PERFORMANCE DURING LOOKBACK
  console.log('\n=== BTC CORRELATION ===');
  const btcBuckets = [
    { label: 'BTC Down >2%', min: -999, max: -2 },
    { label: 'BTC Down 0-2%', min: -2, max: 0 },
    { label: 'BTC Flat 0-1%', min: 0, max: 1 },
    { label: 'BTC Up 1-2%', min: 1, max: 2 },
    { label: 'BTC Up >2%', min: 2, max: 999 }
  ];
  
  btcBuckets.forEach(b => {
    const subset = trades.filter(t => parseFloat(t.btcChange) >= b.min && parseFloat(t.btcChange) < b.max);
    if (subset.length > 0) {
      const wins = subset.filter(t => t.win).length;
      const avg = subset.reduce((s, t) => s + t.pnl, 0) / subset.length;
      const wr = (wins / subset.length * 100).toFixed(1);
      console.log(`${b.label}: n=${subset.length}, WR=${wr}%, Avg=${avg.toFixed(3)}%`);
    }
  });
  
  // 4. BY DAY OF WEEK
  console.log('\n=== DAY OF WEEK ===');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daily = {};
  trades.forEach(t => {
    if (!daily[t.dayOfWeek]) daily[t.dayOfWeek] = { n: 0, wins: 0, totalPnL: 0 };
    daily[t.dayOfWeek].n++;
    if (t.win) daily[t.dayOfWeek].wins++;
    daily[t.dayOfWeek].totalPnL += t.pnl;
  });
  
  Object.keys(daily).sort().forEach(d => {
    const dayData = daily[d];
    const wr = (dayData.wins / dayData.n * 100).toFixed(1);
    const avg = (dayData.totalPnL / dayData.n).toFixed(3);
    console.log(`${dayNames[d]}: n=${dayData.n}, WR=${wr}%, Avg=${avg}%`);
  });
  
  // 5. VOLATILITY REGIME
  console.log('\n=== VOLATILITY REGIME ===');
  const vols = trades.map(t => parseFloat(t.realizedVol)).sort((a,b) => a-b);
  const medianVol = vols[Math.floor(vols.length/2)];
  console.log(`Median realized vol during hold: ${medianVol.toFixed(3)}%`);
  
  const lowVol = trades.filter(t => parseFloat(t.realizedVol) < medianVol);
  const highVol = trades.filter(t => parseFloat(t.realizedVol) >= medianVol);
  
  if (lowVol.length > 0) {
    const avg = lowVol.reduce((s,t) => s + t.pnl, 0) / lowVol.length;
    const wr = (lowVol.filter(t=>t.win).length / lowVol.length * 100).toFixed(1);
    console.log(`Low vol (<\$${medianVol.toFixed(2)}%): n=${lowVol.length}, WR=${wr}%, Avg=${avg.toFixed(3)}%`);
  }
  if (highVol.length > 0) {
    const avg = highVol.reduce((s,t) => s + t.pnl, 0) / highVol.length;
    const wr = (highVol.filter(t=>t.win).length / highVol.length * 100).toFixed(1);
    console.log(`High vol (>\$${medianVol.toFixed(2)}%): n=${highVol.length}, WR=${wr}%, Avg=${avg.toFixed(3)}%`);
  }
  
  // 6. COMBINED FILTER: Best conditions
  console.log('\n=== BEST COMBINED CONDITIONS ===');
  
  // Best: 5-6% DD + BTC down + Low vol + European hours
  const best = trades.filter(t => {
    const dd = parseFloat(t.dd);
    const btc = parseFloat(t.btcChange);
    const vol = parseFloat(t.realizedVol);
    const hour = t.hour;
    
    return dd >= 5 && dd < 6.5 && btc < -1 && vol < medianVol && (hour >= 8 && hour <= 14);
  });
  
  if (best.length >= 3) {
    const wins = best.filter(t => t.win).length;
    const avg = best.reduce((s,t) => s + t.pnl, 0) / best.length;
    const wr = (wins / best.length * 100).toFixed(1);
    console.log(`DD 5-6% + BTC down + Low vol + 8-14h UTC: n=${best.length}, WR=${wr}%, Avg=${avg.toFixed(3)}%`);
  }
  
  // Worst: High DD + BTC up + High vol
  const worst = trades.filter(t => {
    const dd = parseFloat(t.dd);
    const btc = parseFloat(t.btcChange);
    const vol = parseFloat(t.realizedVol);
    const hour = t.hour;
    
    return dd >= 7 || (btc > 1) || (vol >= medianVol * 1.5);
  });
  
  if (worst.length >= 3) {
    const wins = worst.filter(t => t.win).length;
    const avg = worst.reduce((s,t) => s + t.pnl, 0) / worst.length;
    const wr = (wins / worst.length * 100).toFixed(1);
    console.log(`High DD OR BTC up OR High vol: n=${worst.length}, WR=${wr}%, Avg=${avg.toFixed(3)}%`);
  }
  
  // Save detailed results
  const results = {
    timestamp: new Date().toISOString(),
    totalTrades: trades.length,
    overall: {
      wr: (trades.filter(t=>t.win).length / trades.length * 100).toFixed(1),
      avg: (trades.reduce((s,t) => s + t.pnl, 0) / trades.length).toFixed(3)
    },
    trades: trades
  };
  
  writeFileSync('results-drawdown-conditional.json', JSON.stringify(results, null, 2));
  console.log('\nSaved results to results-drawdown-conditional.json');
  
  return results;
}

analyze();