import { readFileSync, writeFileSync } from 'fs';

// Multi-Timeframe Trend Following Strategy
// 1H EMA(20) > EMA(50) = Bullish bias → only LONG 15m
// 1H EMA(20) < EMA(50) = Bearish bias → only SHORT 15m
// Entry: 15m price pulls back to 15m EMA(20) and bounces
// Exit: opposite 15m EMA cross

const btc15m = JSON.parse(readFileSync('./data/btcusdt-15m-extended.json', 'utf8'));
const btc1h = JSON.parse(readFileSync('./data/btcusdt-1h.json', 'utf8'));

console.log('BTC 15m:', btc15m.length, 'candles,', (btc15m.length/96).toFixed(0), 'days');
console.log('BTC 1H:', btc1h.length, 'candles,', (btc1h.length/24).toFixed(0), 'days');

// Calculate EMAs
function calcEMA(values, period) {
  const k = 2 / (period + 1);
  const emas = [values.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < values.length; i++) {
    emas.push(values[i] * k + emas[emas.length - 1] * (1 - k));
  }
  return emas;
}

// Get 1H EMA values
const btc1hCloses = btc1h.map(c => c.c);
const ema20_1h = calcEMA(btc1hCloses, 20);
const ema50_1h = calcEMA(btc1hCloses, 50);

// Get 15m EMA values
const btc15mCloses = btc15m.map(c => c.c);
const ema20_15m = calcEMA(btc15mCloses, 20);
const ema50_15m = calcEMA(btc15mCloses, 50);

console.log('\n1H EMA20 > EMA50:', ema20_1h[ema20_1h.length-1] > ema50_1h[ema50_1h.length-1]);
console.log('Current 1H price:', btc1h[btc1h.length-1].c);

// Test: simple EMA crossover on 1H with 15m entries
// When 1H EMA20 crosses above EMA50 → go LONG at next 15m pullback to 15m EMA20
// When 1H EMA20 crosses below EMA50 → go SHORT

const CONFIG = {
  emaFast: 20,
  emaSlow: 50,
  maxHold15m: 16, // 4 hours = 16 candles
  feesBps: 15,
  pullbackThreshold: 0.001 // 0.1% pullback from EMA
};

let trades = [];
let totalPnl = 0, wins = 0, losses = 0;

// Track 1H trend state
let trendState = null; // 'bull' or 'bear'
let trendChangeTime = null;

for (let i = 100; i < btc1h.length - 1; i++) {
  // Check 1H EMA crossover
  const prevFast = ema20_1h[i - 2];
  const prevSlow = ema50_1h[i - 2];
  const currFast = ema20_1h[i];
  const currSlow = ema50_1h[i];
  
  const prevTrend = prevFast > prevSlow ? 'bull' : 'bear';
  const currTrend = currFast > currSlow ? 'bull' : 'bear';
  
  if (currTrend !== prevTrend) {
    trendState = currTrend;
    trendChangeTime = btc1h[i].t;
    console.log(`  ${new Date(btc1h[i].t).toISOString().slice(0,16)} 1H trend changed to ${currTrend.toUpperCase()}`);
  }
  
  if (!trendState) continue;
  
  // Find corresponding 15m candles for this 1H period
  const hStart = btc1h[i].t;
  const hEnd = btc1h[i + 1] ? btc1h[i + 1].t : btc1h[i].t + 3600 * 1000;
  
  // For each 15m candle in this hour
  for (let j = 0; j < btc15m.length - 1; j++) {
    if (btc15m[j].t < hStart || btc15m[j].t >= hEnd) continue;
    
    const idx15m = j;
    if (idx15m < 50 || ema20_15m[idx15m - 50] === undefined) continue;
    
    // Check for pullback entry
    const price = btc15m[j].c;
    const emaVal = ema20_15m[idx15m - 50];
    const distanceFromEma = (price - emaVal) / emaVal;
    
    // Long if: bull trend, price below EMA (pullback), then bounces
    if (trendState === 'bull' && distanceFromEma < -CONFIG.pullbackThreshold) {
      // Check if next candle bounces
      if (j + 1 < btc15m.length) {
        const nextClose = btc15m[j + 1].c;
        if (nextClose > emaVal) {
          // Entry LONG
          const entry = nextClose;
          const stop = entry * 0.995; // 0.5% stop
          const target = entry * 1.01; // 1% target
          
          let exitPrice = entry, exitReason = 'time';
          for (let k = j + 2; k < Math.min(j + CONFIG.maxHold15m, btc15m.length); k++) {
            if (btc15m[k].l <= stop) { exitPrice = stop; exitReason = 'stop'; break; }
            if (btc15m[k].c >= target) { exitPrice = target; exitReason = 'target'; break; }
          }
          
          const pnl = (exitPrice - entry) / entry * 100 - CONFIG.feesBps / 100;
          totalPnl += pnl;
          if (pnl > 0) wins++; else losses++;
          trades.push({ t: new Date(btc15m[j].t).toISOString(), dir: 'LONG', pnl: pnl.toFixed(3), exit: exitReason });
        }
      }
    }
    
    // Short if: bear trend, price above EMA (pullback), then drops
    if (trendState === 'bear' && distanceFromEma > CONFIG.pullbackThreshold) {
      if (j + 1 < btc15m.length) {
        const nextClose = btc15m[j + 1].c;
        if (nextClose < ema20_15m[idx15m - 50]) {
          const entry = nextClose;
          const stop = entry * 1.005;
          const target = entry * 0.99;
          
          let exitPrice = entry, exitReason = 'time';
          for (let k = j + 2; k < Math.min(j + CONFIG.maxHold15m, btc15m.length); k++) {
            if (btc15m[k].h >= stop) { exitPrice = stop; exitReason = 'stop'; break; }
            if (btc15m[k].c <= target) { exitPrice = target; exitReason = 'target'; break; }
          }
          
          const pnl = (entry - exitPrice) / entry * 100 - CONFIG.feesBps / 100;
          totalPnl += pnl;
          if (pnl > 0) wins++; else losses++;
          trades.push({ t: new Date(btc15m[j].t).toISOString(), dir: 'SHORT', pnl: pnl.toFixed(3), exit: exitReason });
        }
      }
    }
  }
}

console.log('\n=== Multi-Timeframe Trend Following Results ===');
console.log('Trades:', trades.length);
console.log('Wins:', wins, 'Losses:', losses);
const wr = trades.length > 0 ? (wins / trades.length * 100).toFixed(1) + '%' : 'N/A';
const avg = trades.length > 0 ? (totalPnl / trades.length).toFixed(3) + '%' : 'N/A';
console.log('Win Rate:', wr);
console.log('Total PnL:', totalPnl.toFixed(2) + '%');
console.log('Avg PnL:', avg);

// Also test simpler version: just EMA crossover on 1H, hold for 24h
console.log('\n=== Simple: 1H EMA Crossover, Hold 24h ===');
const simpleTrades = [];
let simplePnl = 0, simpleWins = 0, simpleLosses = 0;

for (let i = 50; i < btc1h.length - 24; i++) {
  const prevFast = ema20_1h[i - 2];
  const prevSlow = ema50_1h[i - 2];
  const currFast = ema20_1h[i];
  const currSlow = ema50_1h[i];
  
  if ((currFast > currSlow && prevFast <= prevSlow)) {
    // Golden cross - LONG
    const entry = btc1h[i].c;
    const exit = btc1h[i + 24].c; // 24h later
    const pnl = (exit - entry) / entry * 100 - CONFIG.feesBps / 100;
    simplePnl += pnl;
    if (pnl > 0) simpleWins++; else simpleLosses++;
    simpleTrades.push({ t: new Date(btc1h[i].t).toISOString(), dir: 'LONG', pnl: pnl.toFixed(2) });
  } else if (currFast < currSlow && prevFast >= prevSlow) {
    // Death cross - SHORT
    const entry = btc1h[i].c;
    const exit = btc1h[i + 24].c;
    const pnl = (entry - exit) / entry * 100 - CONFIG.feesBps / 100;
    simplePnl += pnl;
    if (pnl > 0) simpleWins++; else simpleLosses++;
    simpleTrades.push({ t: new Date(btc1h[i].t).toISOString(), dir: 'SHORT', pnl: pnl.toFixed(2) });
  }
}

const swr = simpleTrades.length > 0 ? (simpleWins / simpleTrades.length * 100).toFixed(1) + '%' : 'N/A';
const savg = simpleTrades.length > 0 ? (simplePnl / simpleTrades.length).toFixed(2) + '%' : 'N/A';
console.log('Trades:', simpleTrades.length);
console.log('Wins:', simpleWins, 'Losses:', simpleLosses);
console.log('Win Rate:', swr);
console.log('Total PnL:', simplePnl.toFixed(2) + '%');
console.log('Avg PnL:', savg);

if (simpleTrades.length > 0) {
  console.log('\nFirst 10 trades:');
  simpleTrades.slice(0, 10).forEach(t => console.log(' ', t.t.slice(0, 16), t.dir, t.pnl + '%'));
}
