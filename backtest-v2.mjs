/**
 * Intraday Trader - Volatility Expansion Backtest v3
 * 
 * Key change: Require STRUCTURAL BREAKOUT confirmation
 * - Low volatility regime detected first
 * - Then price must break ABOVE or BELOW a recent range
 * - Entry on the retest of the breakout level
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_DIR = new URL('.', import.meta.url).pathname;
const DATA_DIR = join(BASE_DIR, 'data');

// ============ CONFIGURATION ============
const CONFIG = {
  // Volatility squeeze parameters
  hvPeriod: 20,
  hvLowPercentile: 0.30,  // Bottom 30% = squeeze
  
  // Range parameters for breakout detection
  rangePeriod: 20,        // Look back 20 candles for range
  
  // Entry parameters
  volumeSmaPeriod: 10,
  volumeMultiplier: 1.5,
  
  // Breakout confirmation
  breakoutThreshold: 0.001, // Price must break range by 0.1%
  
  // Trade parameters
  maxHoldMinutes: 240,    // 4 hours
  feesBps: 10,
  slippageBps: 5,
  
  atrPeriod: 14,
  atrMultiplier: 2.0,      // Wider stop: 2x ATR
  minRewardRisk: 1.5,     // Require 1.5:1 R:R
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
  const hvs = [];
  for (let i = period; i < candles.length; i++) {
    const returns = [];
    for (let j = i - period + 1; j <= i; j++) {
      returns.push(Math.log(candles[j].c / candles[j - 1].c));
    }
    const mean = returns.reduce((a, b) => a + b, 0) / period;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    hvs.push(Math.sqrt(variance * 252 * 96));
  }
  return hvs;
}

function calcVolumeSMA(candles, period = 10) {
  const smas = [];
  for (let i = period; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].v;
    smas.push(sum / period);
  }
  return smas;
}

function getRangeInfo(candles, i, period) {
  let high = -Infinity, low = Infinity;
  for (let j = i - period + 1; j <= i; j++) {
    if (candles[j].h > high) high = candles[j].h;
    if (candles[j].l < low) low = candles[j].l;
  }
  return { high, low, mid: (high + low) / 2, range: high - low };
}

// ============ BACKTESTER ============
function backtestVolatilityExpansion(symbol, candles) {
  const warmup = Math.max(CONFIG.hvPeriod, CONFIG.volumeSmaPeriod, CONFIG.rangePeriod, CONFIG.atrPeriod);
  
  const atrs = calcATR(candles, CONFIG.atrPeriod);
  const hvs = calcHV(candles, CONFIG.hvPeriod);
  const volSMAs = calcVolumeSMA(candles, CONFIG.volumeSmaPeriod);
  
  let phase = 'waiting'; // 'waiting' | 'squeezed' | 'broken'
  let squeezeStart = 0;
  let breakDirection = 0;
  let breakLevel = 0;
  let entryCandle = -1;
  
  let countSignals = 0, countEntries = 0;
  const trades = [];
  let totalPnl = 0, wins = 0, losses = 0;
  
  for (let i = warmup; i < candles.length - 1; i++) {
    const hvIdx = i - CONFIG.hvPeriod;
    const volIdx = i - CONFIG.volumeSmaPeriod;
    const atrIdx = i - CONFIG.atrPeriod;
    
    if (hvIdx < 0 || volIdx < 0 || atrIdx < 0) continue;
    
    const currentHV = hvs[hvIdx];
    const hvWindow = hvs.slice(Math.max(0, hvIdx - CONFIG.hvPeriod + 1), hvIdx + 1);
    const sorted = [...hvWindow].sort((a, b) => a - b);
    const rank = sorted.indexOf(currentHV);
    const percentile = sorted.length > 1 ? rank / (sorted.length - 1) : 0.5;
    
    const volSMA = volSMAs[volIdx];
    const volRatio = candles[i].v / volSMA;
    
    const range = getRangeInfo(candles, i, CONFIG.rangePeriod);
    const atr = atrs[atrIdx];
    
    // ===== STATE MACHINE =====
    
    // Detect squeeze: low volatility
    const inSqueeze = percentile <= CONFIG.hvLowPercentile;
    
    // Detect breakout: candle closes above range high or below range low
    const closeAboveRange = candles[i].c > range.high * (1 + CONFIG.breakoutThreshold);
    const closeBelowRange = candles[i].c < range.low * (1 - CONFIG.breakoutThreshold);
    
    if (inSqueeze && !inSqueeze && phase === 'waiting') {
      // Entered squeeze
      squeezeStart = i;
      phase = 'squeezed';
    }
    
    if (phase === 'squeezed') {
      // Wait for breakout
      if (closeAboveRange) {
        breakDirection = 1;
        breakLevel = range.high;
        phase = 'broken';
        entryCandle = i + 1; // Entry next candle
      } else if (closeBelowRange) {
        breakDirection = -1;
        breakLevel = range.low;
        phase = 'broken';
        entryCandle = i + 1;
      } else if (i - squeezeStart > 20) {
        // Squeeze lasted too long, reset
        phase = 'waiting';
      }
    }
    
    if (phase === 'broken' && entryCandle === i) {
      // Execute entry
      const direction = breakDirection;
      const entryPrice = candles[i].c;
      
      // Volume confirmation
      if (volRatio < CONFIG.volumeMultiplier) {
        phase = 'waiting';
        continue;
      }
      countSignals++;
      
      // Stop and target
      const stopLoss = direction === 1
        ? entryPrice - atr * CONFIG.atrMultiplier
        : entryPrice + atr * CONFIG.atrMultiplier;
      
      const risk = Math.abs(entryPrice - stopLoss);
      const target = direction === 1
        ? entryPrice + risk * CONFIG.minRewardRisk
        : entryPrice - risk * CONFIG.minRewardRisk;
      
      const maxExitTime = candles[i].t + CONFIG.maxHoldMinutes * 60 * 1000;
      
      let exitPrice = candles[candles.length - 1].c;
      let exitTime = candles[candles.length - 1].t;
      let exitReason = 'end_data';
      
      for (let j = i + 1; j < candles.length && candles[j].t <= maxExitTime; j++) {
        if (direction === 1) {
          if (candles[j].l <= stopLoss) {
            exitPrice = stopLoss;
            exitTime = candles[j].t;
            exitReason = 'stop_loss';
            break;
          }
          if (candles[j].h >= target) {
            exitPrice = target;
            exitTime = candles[j].t;
            exitReason = 'target_hit';
            break;
          }
        } else {
          if (candles[j].h >= stopLoss) {
            exitPrice = stopLoss;
            exitTime = candles[j].t;
            exitReason = 'stop_loss';
            break;
          }
          if (candles[j].l <= target) {
            exitPrice = target;
            exitTime = candles[j].t;
            exitReason = 'target_hit';
            break;
          }
        }
      }
      
      const grossPnl = direction === 1
        ? (exitPrice - entryPrice) / entryPrice
        : (entryPrice - exitPrice) / entryPrice;
      const netPnl = grossPnl - (CONFIG.feesBps + CONFIG.slippageBps) / 10000;
      
      trades.push({
        entryTime: new Date(candles[i].t).toISOString(),
        exitTime: new Date(exitTime).toISOString(),
        direction: direction === 1 ? 'LONG' : 'SHORT',
        entryPrice: entryPrice.toFixed(4),
        exitPrice: exitPrice.toFixed(4),
        exitReason,
        grossPnlPct: (grossPnl * 100).toFixed(3),
        netPnlPct: (netPnl * 100).toFixed(3),
        riskPct: (risk / entryPrice * 100).toFixed(3),
        volRatio: volRatio.toFixed(2),
        hv: currentHV.toFixed(4),
        percentile: percentile.toFixed(3),
        rangePct: (range.range / range.mid * 100).toFixed(3),
        holdCandles: Math.round((exitTime - candles[i].t) / (15 * 60 * 1000))
      });
      
      countEntries++;
      totalPnl += netPnl;
      if (netPnl > 0) wins++;
      else losses++;
      
      phase = 'waiting';
    }
    
    // Reset if squeeze broken without entry
    if (phase === 'squeezed' && !inSqueeze) {
      phase = 'waiting';
    }
  }
  
  console.log(`  Signals=${countSignals}, Entries=${countEntries}`);
  
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
  console.log('=== Intraday Volatility Expansion Backtest v3 ===\n');
  console.log('Key change: State machine with squeeze → breakout → entry\n');
  console.log('Config:', JSON.stringify(CONFIG, null, 2));
  
  console.log('\n--- BTC ---');
  const btcData = JSON.parse(readFileSync(join(DATA_DIR, 'btcusdt-15m.json'), 'utf8'));
  const btcResults = backtestVolatilityExpansion('BTC', btcData);
  
  console.log(`Trades: ${btcResults.stats.totalTrades}`);
  console.log(`Win Rate: ${btcResults.stats.winRate}%`);
  console.log(`Total PnL: ${btcResults.stats.totalPnlPct}%`);
  console.log(`Avg PnL: ${btcResults.stats.avgPnlPct}%`);
  
  if (btcResults.trades.length > 0) {
    console.log('\nAll trades:');
    btcResults.trades.forEach(t => {
      console.log(`  ${t.entryTime} ${t.direction} ${t.netPnlPct}% (${t.exitReason}) R:${t.riskPct}% vol:${t.volRatio}x`);
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
    console.log('\nAll trades:');
    ethResults.trades.forEach(t => {
      console.log(`  ${t.entryTime} ${t.direction} ${t.netPnlPct}% (${t.exitReason}) R:${t.riskPct}% vol:${t.volRatio}x`);
    });
  }
  
  const output = {
    config: CONFIG,
    btc: btcResults,
    eth: ethResults,
    timestamp: new Date().toISOString()
  };
  writeFileSync(join(BASE_DIR, 'results-v3.json'), JSON.stringify(output, null, 2));
  console.log('\nResults saved to results-v3.json');
}

main();
