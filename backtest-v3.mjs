/**
 * Intraday Trader - Momentum Burst after Volatility Squeeze v4
 * 
 * Simple approach:
 * 1. Detect low volatility (bottom 30% HV)
 * 2. Strong body candle (>85th percentile of recent history)
 * 3. Volume confirmation
 * 4. Enter in direction of body
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_DIR = new URL('.', import.meta.url).pathname;
const DATA_DIR = join(BASE_DIR, 'data');

const CONFIG = {
  hvPeriod: 20,
  hvPercentile: 0.30,
  
  bodyPeriod: 100,          // Lookback for body percentile
  bodyPercentile: 0.85,
  bodyMinPct: 0.15,         // But at least 0.15%
  
  volumeSmaPeriod: 10,
  volumeMultiplier: 1.5,
  
  sessionFilter: true,
  londonOpen: 7, londonClose: 12,
  nyOpen: 13, nyClose: 17,
  
  atrPeriod: 14,
  atrStop: 2.0,
  atrTarget: 3.0,
  
  maxHoldMinutes: 240,
  feesBps: 10,
  slippageBps: 5,
};

function calcATR(candles, period = 14) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  const atrs = [trs.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < trs.length; i++) {
    atrs.push((atrs[atrs.length - 1] * (period - 1) + trs[i]) / period);
  }
  return atrs;
}

function calcHV(candles, period = 20) {
  const hvs = [];
  for (let i = period; i < candles.length; i++) {
    const rets = [];
    for (let j = i - period + 1; j <= i; j++) {
      rets.push(Math.log(candles[j].c / candles[j - 1].c));
    }
    const mean = rets.reduce((a, b) => a + b, 0) / period;
    const vari = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    hvs.push(Math.sqrt(vari * 252 * 96));
  }
  return hvs;
}

function calcVolSMA(candles, period = 10) {
  const smas = [];
  for (let i = period; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].v;
    smas.push(sum / period);
  }
  return smas;
}

function isSession(hour) {
  if (!CONFIG.sessionFilter) return true;
  return (hour >= CONFIG.londonOpen && hour <= CONFIG.londonClose) ||
         (hour >= CONFIG.nyOpen && hour <= CONFIG.nyClose);
}

function backtest(candles, symbol) {
  const warmup = Math.max(CONFIG.hvPeriod, CONFIG.volumeSmaPeriod, CONFIG.bodyPeriod, CONFIG.atrPeriod);
  
  const atrs = calcATR(candles, CONFIG.atrPeriod);
  const hvs = calcHV(candles, CONFIG.hvPeriod);
  const volSMAs = calcVolSMA(candles, CONFIG.volumeSmaPeriod);
  
  // Precompute body pct for each candle
  const bodies = candles.map(c => Math.abs(c.c - c.o) / c.o);
  
  // Debug counters
  let nLowVol = 0, nStrongBody = 0, nVol = 0, nSess = 0;
  
  const trades = [];
  let totalPnl = 0, wins = 0, losses = 0;
  
  // Trade on candle i, entry at close of i
  for (let i = warmup; i < candles.length - 1; i++) {
    // Index offsets
    const hvIdx = i - CONFIG.hvPeriod;
    const volIdx = i - CONFIG.volumeSmaPeriod;
    const atrIdx = i - CONFIG.atrPeriod;
    const bodyIdx = i - CONFIG.bodyPeriod;
    
    if (hvIdx < 0 || volIdx < 0 || atrIdx < 0 || bodyIdx < 0) continue;
    
    // HV percentile check
    const hvWindow = hvs.slice(hvIdx - CONFIG.hvPeriod + 1, hvIdx + 1);
    const currentHV = hvs[hvIdx];
    const sortedHV = [...hvWindow].sort((a, b) => a - b);
    const hvRank = sortedHV.indexOf(currentHV);
    const hvPct = sortedHV.length > 1 ? hvRank / (sortedHV.length - 1) : 0.5;
    if (hvPct > CONFIG.hvPercentile) continue;
    nLowVol++;
    
    // Volume check
    const volRatio = candles[i].v / volSMAs[volIdx];
    if (volRatio < CONFIG.volumeMultiplier) continue;
    nVol++;
    
    // Session check
    const hour = new Date(candles[i].t).getUTCHours();
    if (!isSession(hour)) continue;
    nSess++;
    
    // Body percentile check
    const bodyWindow = bodies.slice(bodyIdx, i).sort((a, b) => a - b);
    const bodyThreshold = bodyWindow[Math.floor(bodyWindow.length * CONFIG.bodyPercentile)];
    const bodyMin = Math.max(CONFIG.bodyMinPct / 100, bodyThreshold);
    if (bodies[i] < bodyMin) continue;
    nStrongBody++;
    
    // All filters passed - execute trade
    const direction = candles[i].c > candles[i].o ? 1 : -1;
    const entryPrice = candles[i].c;
    const atr = atrs[atrIdx];
    
    const stopLoss = direction === 1
      ? entryPrice - atr * CONFIG.atrStop
      : entryPrice + atr * CONFIG.atrStop;
    const risk = Math.abs(entryPrice - stopLoss);
    const target = direction === 1
      ? entryPrice + risk * CONFIG.atrTarget
      : entryPrice - risk * CONFIG.atrTarget;
    
    const maxExitTime = candles[i].t + CONFIG.maxHoldMinutes * 60 * 1000;
    
    let exitPrice = candles[candles.length - 1].c;
    let exitTime = candles[candles.length - 1].t;
    let exitReason = 'end_data';
    
    for (let j = i + 1; j < candles.length && candles[j].t <= maxExitTime; j++) {
      if (direction === 1) {
        if (candles[j].l <= stopLoss) { exitPrice = stopLoss; exitTime = candles[j].t; exitReason = 'sl'; break; }
        if (candles[j].h >= target) { exitPrice = target; exitTime = candles[j].t; exitReason = 'tp'; break; }
      } else {
        if (candles[j].h >= stopLoss) { exitPrice = stopLoss; exitTime = candles[j].t; exitReason = 'sl'; break; }
        if (candles[j].l <= target) { exitPrice = target; exitTime = candles[j].t; exitReason = 'tp'; break; }
      }
    }
    
    const grossPnl = direction === 1
      ? (exitPrice - entryPrice) / entryPrice
      : (entryPrice - exitPrice) / entryPrice;
    const netPnl = grossPnl - (CONFIG.feesBps + CONFIG.slippageBps) / 10000;
    
    trades.push({
      t: new Date(candles[i].t).toISOString().slice(11, 16),
      d: direction === 1 ? 'LONG' : 'SHORT',
      ep: +entryPrice.toFixed(2),
      net: +(netPnl * 100).toFixed(3),
      gross: +(grossPnl * 100).toFixed(3),
      r: +(risk / entryPrice * 100).toFixed(3),
      exit: exitReason,
      vol: +volRatio.toFixed(2),
      body: +(bodies[i] * 100).toFixed(3),
      hv: +currentHV.toFixed(4)
    });
    
    totalPnl += netPnl;
    if (netPnl > 0) wins++; else losses++;
  }
  
  console.log(`  Filters: lowVol=${nLowVol} strongBody=${nStrongBody} vol=${nVol} sess=${nSess} => trades=${trades.length}`);
  
  return {
    stats: {
      n: trades.length, wins, losses,
      wr: trades.length ? (wins / trades.length * 100).toFixed(1) : '0',
      pnl: +(totalPnl * 100).toFixed(3),
      avg: trades.length ? (totalPnl / trades.length * 100).toFixed(4) : '0',
    },
    trades
  };
}

function main() {
  console.log('=== Momentum Burst after Squeeze - BTC & ETH ===\n');
  
  const btc = JSON.parse(readFileSync(join(DATA_DIR, 'btcusdt-15m.json'), 'utf8'));
  const eth = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-15m.json'), 'utf8'));
  
  const btcR = backtest(btc, 'BTC');
  console.log(`BTC: ${btcR.stats.n} trades, ${btcR.stats.wr}% WR, ${btcR.stats.pnl}% total, ${btcR.stats.avg}% avg`);
  
  const ethR = backtest(eth, 'ETH');
  console.log(`ETH: ${ethR.stats.n} trades, ${ethR.stats.wr}% WR, ${ethR.stats.pnl}% total, ${ethR.stats.avg}% avg`);
  
  if (btcR.trades.length > 0) {
    console.log('\nBTC trades:');
    btcR.trades.forEach(t => console.log(`  ${t.t} ${t.d} ${t.net >= 0 ? '+' : ''}${t.net}% ${t.exit} R:${t.r}% vol:${t.vol}x body:${t.body}%`));
  }
  
  if (ethR.trades.length > 0) {
    console.log('\nETH trades:');
    ethR.trades.forEach(t => console.log(`  ${t.t} ${t.d} ${t.net >= 0 ? '+' : ''}${t.net}% ${t.exit} R:${t.r}% vol:${t.vol}x body:${t.body}%`));
  }
  
  writeFileSync(join(BASE_DIR, 'results-v4.json'), JSON.stringify({ config: CONFIG, btc: btcR, eth: ethR }, null, 2));
}

main();
