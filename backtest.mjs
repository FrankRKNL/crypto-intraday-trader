/**
 * Intraday Trader - Volatility Expansion Backtester v2
 * 
 * Hypothesis H2: When volatility drops to low levels, a breakout tends 
 * to produce a move that can be traded profitably.
 * 
 * v2 changes: looser filters to find signals, better indexing
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_DIR = new URL('.', import.meta.url).pathname;
const DATA_DIR = join(BASE_DIR, 'data');

// ============ CONFIGURATION ============
const CONFIG = {
  hvPeriod: 20,           // Period for HV calculation (shorter = more signals)
  hvLowPercentile: 0.35,  // Bottom 35% = squeeze detected
  
  volumeSmaPeriod: 10,    // Volume SMA period
  volumeMultiplier: 1.5,  // Volume must be > 1.5x SMA
  
  minBodyPercent: 0.0005, // Min candle body (0.05%)
  
  sessionFilter: false,   // Disabled for initial testing
  
  maxHoldMinutes: 180,   // 3 hours hard stop
  feesBps: 10,           // 10 bps per side
  slippageBps: 5,         // 5 bps slippage
  
  atrPeriod: 14,
  atrMultiplier: 1.5,
};

// ============ INDICATORS ============
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
  // Returns array aligned with candles[period] onwards
  const hvs = [];
  for (let i = period; i < candles.length; i++) {
    const returns = [];
    for (let j = i - period + 1; j <= i; j++) {
      returns.push(Math.log(candles[j].c / candles[j - 1].c));
    }
    const mean = returns.reduce((a, b) => a + b, 0) / period;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    hvs.push(Math.sqrt(variance * 252 * 96)); // Annualized for 15m
  }
  return hvs; // Length = candles.length - period
}

function calcVolumeSMA(candles, period = 10) {
  const smas = [];
  for (let i = period; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].v;
    smas.push(sum / period);
  }
  return smas; // Length = candles.length - period
}

function isInSession(hourUtc) {
  if (!CONFIG.sessionFilter) return true;
  const london = hourUtc >= 7 && hourUtc <= 11;
  const ny = hourUtc >= 13 && hourUtc <= 16;
  return london || ny;
}

// ============ BACKTESTER ============
function backtestVolatilityExpansion(symbol, candles) {
  // Align all indicators
  const warmup = Math.max(CONFIG.hvPeriod, CONFIG.volumeSmaPeriod, CONFIG.atrPeriod);
  
  const atrs = calcATR(candles, CONFIG.atrPeriod);
  const hvs = calcHV(candles, CONFIG.hvPeriod);
  const volSMAs = calcVolumeSMA(candles, CONFIG.volumeSmaPeriod);
  
  // Debug: count filter passes
  let countLowHv = 0, countHighVol = 0, countSession = 0, countAll = 0;
  
  const trades = [];
  let totalPnl = 0, wins = 0, losses = 0;
  
  // Trade on candle i, entry at close of candle i
  // ATR index: i - atrPeriod (since ATR[0] corresponds to candles[atrPeriod])
  // HV index: i - hvPeriod
  // VolSMA index: i - volumeSmaPeriod
  
  for (let i = warmup; i < candles.length - 1; i++) {
    const hvIdx = i - CONFIG.hvPeriod;
    const volIdx = i - CONFIG.volumeSmaPeriod;
    const atrIdx = i - CONFIG.atrPeriod;
    
    if (hvIdx < 0 || volIdx < 0 || atrIdx < 0) continue;
    
    const currentHV = hvs[hvIdx];
    const hvWindow = hvs.slice(hvIdx - CONFIG.hvPeriod + 1, hvIdx + 1);
    
    // Percentile rank
    const sorted = [...hvWindow].sort((a, b) => a - b);
    const rank = sorted.indexOf(currentHV);
    const percentile = rank / (sorted.length - 1);
    
    if (percentile > CONFIG.hvLowPercentile) continue;
    countLowHv++;
    
    const volSMA = volSMAs[volIdx];
    const volRatio = candles[i].v / volSMA;
    if (volRatio < CONFIG.volumeMultiplier) continue;
    countHighVol++;
    
    const hour = new Date(candles[i].t).getUTCHours();
    if (!isInSession(hour)) continue;
    countSession++;
    
    // Direction from candle body
    const body = candles[i].c - candles[i].o;
    const bodyPct = Math.abs(body) / candles[i].o;
    if (bodyPct < CONFIG.minBodyPercent) continue;
    
    countAll++;
    
    const direction = body > 0 ? 1 : -1;
    const entryPrice = candles[i].c;
    const atr = atrs[atrIdx];
    const stopLoss = direction === 1 
      ? entryPrice - atr * CONFIG.atrMultiplier
      : entryPrice + atr * CONFIG.atrMultiplier;
    
    const entryTime = candles[i].t;
    const maxExitTime = entryTime + CONFIG.maxHoldMinutes * 60 * 1000;
    
    let exitPrice = candles[candles.length - 1].c;
    let exitTime = candles[candles.length - 1].t;
    let exitReason = 'end_data';
    
    for (let j = i + 1; j < candles.length && candles[j].t <= maxExitTime; j++) {
      if (direction === 1 && candles[j].l <= stopLoss) {
        exitPrice = stopLoss;
        exitTime = candles[j].t;
        exitReason = 'stop_loss';
        break;
      }
      if (direction === -1 && candles[j].h >= stopLoss) {
        exitPrice = stopLoss;
        exitTime = candles[j].t;
        exitReason = 'stop_loss';
        break;
      }
      // Time stop after 4 candles (1 hour)
      if (j - i >= 4) {
        exitPrice = candles[j].c;
        exitTime = candles[j].t;
        exitReason = 'time_stop';
        break;
      }
    }
    
    const grossPnl = direction === 1
      ? (exitPrice - entryPrice) / entryPrice
      : (entryPrice - exitPrice) / entryPrice;
    const netPnl = grossPnl - (CONFIG.feesBps + CONFIG.slippageBps) / 10000;
    
    trades.push({
      entryTime: new Date(entryTime).toISOString(),
      exitTime: new Date(exitTime).toISOString(),
      direction: direction === 1 ? 'LONG' : 'SHORT',
      entryPrice,
      exitPrice,
      exitReason,
      grossPnlPct: (grossPnl * 100).toFixed(3),
      netPnlPct: (netPnl * 100).toFixed(3),
      atr,
      hv: currentHV.toFixed(4),
      percentile: percentile.toFixed(3),
      volRatio: volRatio.toFixed(2),
      bodyPct: (bodyPct * 100).toFixed(3),
      holdCandles: Math.round((exitTime - entryTime) / (15 * 60 * 1000))
    });
    
    totalPnl += netPnl;
    if (netPnl > 0) wins++;
    else losses++;
  }
  
  console.log(`  Filter stats: lowHV=${countLowHv}, highVol=${countHighVol}, session=${countSession}, all=${countAll}`);
  
  return {
    stats: {
      totalTrades: trades.length,
      wins, losses,
      winRate: trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : '0',
      totalPnlPct: (totalPnl * 100).toFixed(3),
      avgPnlPct: trades.length > 0 ? (totalPnl / trades.length * 100).toFixed(4) : '0',
    },
    trades
  };
}

// ============ MAIN ============
function main() {
  console.log('=== Intraday Volatility Expansion Backtest v2 ===\n');
  console.log('Config:', JSON.stringify(CONFIG, null, 2));
  
  console.log('\n--- BTC ---');
  const btcData = JSON.parse(readFileSync(join(DATA_DIR, 'btcusdt-15m.json'), 'utf8'));
  const btcResults = backtestVolatilityExpansion('BTC', btcData);
  
  console.log(`Trades: ${btcResults.stats.totalTrades}`);
  console.log(`Win Rate: ${btcResults.stats.winRate}%`);
  console.log(`Total PnL: ${btcResults.stats.totalPnlPct}%`);
  console.log(`Avg PnL: ${btcResults.stats.avgPnlPct}%`);
  
  if (btcResults.trades.length > 0) {
    console.log('\nFirst 5 trades:');
    btcResults.trades.slice(0, 5).forEach(t => {
      console.log(`  ${t.entryTime} ${t.direction} ${t.netPnlPct}% (${t.exitReason}) vol:${t.volRatio}x hv:${t.hv}`);
    });
  }
  
  console.log('\n--- ETH ---');
  const ethData = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-15m.json'), 'utf8'));
  const ethResults = backtestVolatilityExpansion('ETH', ethData);
  
  console.log(`Trades: ${ethResults.stats.totalTrades}`);
  console.log(`Win Rate: ${ethResults.stats.winRate}%`);
  console.log(`Total PnL: ${ethResults.stats.totalPnlPct}%`);
  console.log(`Avg PnL: ${ethResults.stats.avgPnlPct}%`);
  
  if (ethResults.trades.length > 0) {
    console.log('\nFirst 5 trades:');
    ethResults.trades.slice(0, 5).forEach(t => {
      console.log(`  ${t.entryTime} ${t.direction} ${t.netPnlPct}% (${t.exitReason}) vol:${t.volRatio}x hv:${t.hv}`);
    });
  }
  
  // Save results
  const output = {
    config: CONFIG,
    btc: btcResults,
    eth: ethResults,
    timestamp: new Date().toISOString()
  };
  writeFileSync(join(BASE_DIR, 'results.json'), JSON.stringify(output, null, 2));
  console.log('\nResults saved to results.json');
}

main();
