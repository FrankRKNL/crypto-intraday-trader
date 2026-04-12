import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const btc = JSON.parse(readFileSync('./data/btcusdt-1h-long.json', 'utf8'));
console.log('BTC 1H:', btc.length, 'candles,', (btc.length/24).toFixed(0), 'days');
console.log('Range:', new Date(btc[0].t).toISOString(), 'to', new Date(btc[btc.length-1].t).toISOString());

function calcEMA(values, period) {
  const k = 2 / (period + 1);
  const emas = [values.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < values.length; i++) {
    emas.push(values[i] * k + emas[emas.length - 1] * (1 - k));
  }
  return emas;
}

const closes = btc.map(c => c.c);
const ema20 = calcEMA(closes, 20);
const ema50 = calcEMA(closes, 50);

console.log('\n=== 1H EMA(20,50) Crossover, Hold 24h ===');

const CONFIG = { feesBps: 15 };

// Test different holding periods
for (const holdHours of [4, 8, 12, 24, 48]) {
  const trades = [];
  let totalPnl = 0, wins = 0, losses = 0;
  
  for (let i = 60; i < btc.length - holdHours; i++) {
    const prevFast = ema20[i - 2];
    const prevSlow = ema50[i - 2];
    const currFast = ema20[i];
    const currSlow = ema50[i];
    
    if (currFast > currSlow && prevFast <= prevSlow) {
      // Golden cross - LONG
      const entry = btc[i].c;
      const exitIdx = Math.min(i + holdHours, btc.length - 1);
      const exit = btc[exitIdx].c;
      const pnl = (exit - entry) / entry * 100 - CONFIG.feesBps / 100;
      totalPnl += pnl;
      if (pnl > 0) wins++; else losses++;
      trades.push({ t: new Date(btc[i].t).toISOString().slice(0, 16), dir: 'LONG', pnl, hold: holdHours + 'h' });
    } else if (currFast < currSlow && prevFast >= prevSlow) {
      // Death cross - SHORT
      const entry = btc[i].c;
      const exitIdx = Math.min(i + holdHours, btc.length - 1);
      const exit = btc[exitIdx].c;
      const pnl = (entry - exit) / entry * 100 - CONFIG.feesBps / 100;
      totalPnl += pnl;
      if (pnl > 0) wins++; else losses++;
      trades.push({ t: new Date(btc[i].t).toISOString().slice(0, 16), dir: 'SHORT', pnl, hold: holdHours + 'h' });
    }
  }
  
  const wr = trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : '0';
  const avg = trades.length > 0 ? (totalPnl / trades.length).toFixed(2) : '0';
  console.log(`Hold ${String(holdHours).padStart(2)}h: ${String(trades.length).padStart(3)} trades | WR ${wr}% | PnL ${totalPnl.toFixed(1).padStart(7)}% | Avg ${avg}%`);
}

// Also test with stricter EMA periods
console.log('\n=== Different EMA Periods (Hold 24h) ===');
for (const [fast, slow] of [[10, 30], [20, 50], [20, 100], [50, 200]]) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  
  const trades = [];
  let totalPnl = 0, wins = 0, losses = 0;
  
  for (let i = slow + 5; i < btc.length - 24; i++) {
    const prevFast = emaFast[i - 2];
    const prevSlow = emaSlow[i - 2];
    const currFast = emaFast[i];
    const currSlow = emaSlow[i];
    
    if (currFast > currSlow && prevFast <= prevSlow) {
      const entry = btc[i].c;
      const exit = btc[i + 24].c;
      const pnl = (exit - entry) / entry * 100 - CONFIG.feesBps / 100;
      totalPnl += pnl;
      if (pnl > 0) wins++; else losses++;
      trades.push({ dir: 'LONG' });
    } else if (currFast < currSlow && prevFast >= prevSlow) {
      const entry = btc[i].c;
      const exit = btc[i + 24].c;
      const pnl = (entry - exit) / entry * 100 - CONFIG.feesBps / 100;
      totalPnl += pnl;
      if (pnl > 0) wins++; else losses++;
      trades.push({ dir: 'SHORT' });
    }
  }
  
  const wr = trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : '0';
  const avg = trades.length > 0 ? (totalPnl / trades.length).toFixed(2) : '0';
  console.log(`EMA(${String(fast).padStart(3)},${String(slow).padStart(3)}) : ${String(trades.length).padStart(3)} trades | WR ${wr}% | PnL ${totalPnl.toFixed(1).padStart(7)}% | Avg ${avg}%`);
}

// Monthly breakdown for EMA(20,50) Hold 24h
console.log('\n=== Monthly Breakdown (EMA 20,50 | Hold 24h) ===');
const emaF = calcEMA(closes, 20);
const emaS = calcEMA(closes, 50);

const monthly = {};
for (let i = 60; i < btc.length - 24; i++) {
  const month = new Date(btc[i].t).toISOString().slice(0, 7);
  if (!monthly[month]) monthly[month] = { trades: [], pnl: 0 };
  
  const prevFast = emaF[i - 2];
  const prevSlow = emaS[i - 2];
  const currFast = emaF[i];
  const currSlow = emaS[i];
  
  let pnl = 0;
  if (currFast > currSlow && prevFast <= prevSlow) {
    pnl = (btc[i + 24].c - btc[i].c) / btc[i].c * 100 - CONFIG.feesBps / 100;
  } else if (currFast < currSlow && prevFast >= prevSlow) {
    pnl = (btc[i].c - btc[i + 24].c) / btc[i].c * 100 - CONFIG.feesBps / 100;
  }
  
  if (pnl !== 0) {
    monthly[month].trades.push(pnl);
    monthly[month].pnl += pnl;
  }
}

for (const [month, data] of Object.entries(monthly)) {
  const wr = data.trades.length > 0 ? (data.trades.filter(t => t > 0).length / data.trades.length * 100).toFixed(0) : '0';
  console.log(month + ': ' + data.trades.length + ' trades | WR ' + wr + '% | PnL ' + data.pnl.toFixed(1).padStart(6) + '%');
}
