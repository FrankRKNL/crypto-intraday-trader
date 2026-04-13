#!/usr/bin/env node
/**
 * ETH Drawdown Recovery Shadow Validator
 * 
 * Signals only — no real orders
 * Entry: ETH drops >= 3% in 4 candles (1h) + red candle + ATR 0.8-2% + BTC down >2%
 * Exit: 2 hours later, no SL/TP
 * 
 * Usage: node eth-drawdown-shadow.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// === CONFIG ===
const CONFIG = {
  asset: 'ETHUSDT',
  btcAsset: 'BTCUSDT',
  interval: '15m',        // 15m candles for signal detection
  lookback: 4,            // 4 candles (1h) for drawdown
  minDrawdown: 0.03,     // 3% minimum drawdown
  atrPeriod: 16,          // 16 candles (4h) for ATR
  atrMin: 0.008,         // 0.8% minimum ATR
  atrMax: 0.020,         // 2.0% maximum ATR
  btcTrendThreshold: 0.02, // 2% BTC down
  entryDelayCandles: 1,    // Enter at next candle
  holdCandles: 8,         // 8 candles = 2 hours
  pollInterval: 15 * 60 * 1000, // 15 minutes
  logDir: join(__dirname, 'logs', 'eth-drawdown'),
  stateFile: join(__dirname, 'logs', 'eth-drawdown', 'state.json'),
};

// === STATE ===
let state = {
  lastProcessedCandle: 0,
  trades: [],
  signals: [],
  dailySummaries: [],
  currentTrades: [],
  cumulativePnL: 0,
};

// === HELPERS ===
function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function loadState() {
  if (existsSync(CONFIG.stateFile)) {
    try {
      state = JSON.parse(readFileSync(CONFIG.stateFile, 'utf8'));
      log(`State loaded: ${state.trades.length} trades, ${state.cumulativePnL.toFixed(4)} cumulative`);
    } catch (e) {
      log('Could not load state, starting fresh');
    }
  }
}

function saveState() {
  try {
    mkdirSync(CONFIG.logDir, { recursive: true });
    writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2));
  } catch (e) {
    log('Error saving state: ' + e.message);
  }
}

function getLogFile(date) {
  return join(CONFIG.logDir, `shadow-${date}.log`);
}

function appendLog(file, msg) {
  try {
    const ts = new Date().toISOString();
    const entry = `[${ts}] ${msg}\n`;
    writeFileSync(file, entry, { flag: 'a' });
  } catch (e) {
    // ignore
  }
}

// === INDICATORS ===
function calculateATR(candles, index, period) {
  if (index < period) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    const tr = Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c)
    );
    sum += tr / candles[i].c * 100;
  }
  return sum / period;
}

function calculateDrawdown(candles, index, lookback) {
  if (index < lookback) return null;
  const startPrice = candles[index - lookback].c;
  const lowPrice = Math.min(...candles.slice(index - lookback, index).map(c => c.l));
  return (startPrice - lowPrice) / startPrice;
}

// === SIGNAL DETECTION ===
function checkSignal(ethCandles, btcCandles, currentIndex) {
  if (currentIndex < Math.max(CONFIG.atrPeriod, CONFIG.lookback + 1)) {
    return { signal: false, reason: 'insufficient_data' };
  }

  // 1. Check drawdown
  const drawdown = calculateDrawdown(ethCandles, currentIndex, CONFIG.lookback);
  if (drawdown === null || drawdown < CONFIG.minDrawdown) {
    return { signal: false, reason: 'drawdown', value: drawdown };
  }

  // 2. Check red candle (last candle before entry closes lower)
  const lastCandle = ethCandles[currentIndex - 1];
  if (lastCandle.c >= lastCandle.o) {
    return { signal: false, reason: 'not_red_candle', close: lastCandle.c, open: lastCandle.o };
  }

  // 3. Check ATR context
  const atr = calculateATR(ethCandles, currentIndex - 1, CONFIG.atrPeriod);
  if (atr === null || atr < CONFIG.atrMin || atr >= CONFIG.atrMax) {
    return { signal: false, reason: 'atr_out_of_range', atr };
  }

  // 4. Check BTC trend
  const btcStart = btcCandles[currentIndex - 4].c;
  const btcEnd = btcCandles[currentIndex - 1].c;
  const btcTrend = (btcEnd - btcStart) / btcStart;
  if (btcTrend >= -CONFIG.btcTrendThreshold) {
    return { signal: false, reason: 'btc_not_down', btcTrend };
  }

  // SIGNAL!
  const entryCandle = ethCandles[currentIndex];
  const entryPrice = entryCandle.c;
  
  return {
    signal: true,
    entryPrice,
    entryTime: entryCandle.t,
    entryIndex: currentIndex,
    context: {
      drawdown: drawdown * 100,
      atr,
      btcTrend: btcTrend * 100,
      ethPrice: entryPrice,
      btcPrice: btcEnd,
    }
  };
}

// === TRADE SIMULATION ===
function simulateTrade(signal, ethCandles) {
  const entryIndex = signal.entryIndex;
  const entryPrice = signal.entryPrice;
  const exitIndex = entryIndex + CONFIG.holdCandles;
  
  if (exitIndex >= ethCandles.length) {
    return { trade: null, reason: 'wait_for_exit' };
  }

  const exitCandle = ethCandles[exitIndex];
  const exitPrice = exitCandle.c;
  const exitTime = exitCandle.t;

  // Calculate max adverse and favorable excursion during hold
  let maxAE = 0;
  let maxFE = 0;
  let aeTime = null;
  let feTime = null;
  
  for (let i = entryIndex + 1; i <= exitIndex; i++) {
    const price = ethCandles[i].c;
    const ae = (entryPrice - price) / entryPrice * 100;
    const fe = (price - entryPrice) / entryPrice * 100;
    
    if (ae < maxAE) {
      maxAE = ae;
      aeTime = ethCandles[i].t;
    }
    if (fe > maxFE) {
      maxFE = fe;
      feTime = ethCandles[i].t;
    }
  }

  const grossReturn = (exitPrice - entryPrice) / entryPrice * 100;
  const netReturn = grossReturn; // no fees in shadow mode

  const trade = {
    id: `ETH-${entryTime}`,
    entryTime,
    exitTime,
    entryPrice,
    exitPrice,
    grossReturn,
    netReturn,
    maxAE,
    maxAEtime: aeTime,
    maxFE,
    maxFEtime: feTime,
    holdCandles: CONFIG.holdCandles,
    context: signal.context,
    status: 'closed',
  };

  return { trade, reason: 'exit' };
}

// === FETCH CANDLES ===
async function fetchCandles(symbol, interval, limit = 100) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  
  return data.map(c => ({
    t: c[0] / 1000,
    o: parseFloat(c[1]),
    h: parseFloat(c[2]),
    l: parseFloat(c[3]),
    c: parseFloat(c[4]),
    v: parseFloat(c[5]),
  }));
}

// === MAIN LOOP ===
async function poll() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const logFile = getLogFile(dateStr);
  
  log('--- POLL ---');
  
  try {
    // Fetch latest candles
    const [ethCandles, btcCandles] = await Promise.all([
      fetchCandles(CONFIG.asset, CONFIG.interval, 100),
      fetchCandles(CONFIG.btcAsset, CONFIG.interval, 100),
    ]);
    
    log(`Fetched ${ethCandles.length} ETH candles, ${btcCandles.length} BTC candles`);
    log(`Latest ETH candle: ${ethCandles[ethCandles.length-1].t} | price: ${ethCandles[ethCandles.length-1].c}`);
    
    // Find last processed candle
    let startIndex = ethCandles.length - 2; // Check last closed candle
    
    for (let i = startIndex; i >= Math.max(0, ethCandles.length - 20); i--) {
      if (state.lastProcessedCandle > 0 && ethCandles[i].t <= state.lastProcessedCandle) {
        continue;
      }
      
      // Check for signal at this candle
      const result = checkSignal(ethCandles, btcCandles, i);
      
      if (result.signal) {
        log(`SIGNAL DETECTED! ETH ${result.context.ethPrice} | DD ${result.context.drawdown.toFixed(2)}% | ATR ${result.context.atr.toFixed(4)}% | BTC ${result.context.btcTrend.toFixed(2)}%`);
        
        // Add to signals
        state.signals.push({
          time: ethCandles[i].t,
          price: result.context.ethPrice,
          ...result.context,
        });
        
        // Try to simulate trade
        const simResult = simulateTrade(result, ethCandles);
        
        if (simResult.trade) {
          state.trades.push(simResult.trade);
          state.cumulativePnL += simResult.trade.netReturn;
          
          log(`TRADE CLOSED: entry ${simResult.trade.entryPrice} -> exit ${simResult.trade.exitPrice} | return ${simResult.trade.netReturn.toFixed(4)}% | AE ${simResult.trade.maxAE.toFixed(2)}% | FE ${simResult.trade.maxFE.toFixed(2)}%`);
          
          appendLog(logFile, `TRADE | entry=${simResult.trade.entryPrice} | exit=${simResult.trade.exitPrice} | ret=${simResult.trade.netReturn.toFixed(4)}% | AE=${simResult.trade.maxAE.toFixed(2)}% | FE=${simResult.trade.maxFE.toFixed(2)}% | ctx=${JSON.stringify(simResult.trade.context)}`);
        } else if (simResult.reason === 'wait_for_exit') {
          log(`Signal detected but waiting for more candles to close trade`);
        }
        
        state.lastProcessedCandle = ethCandles[i].t;
      }
    }
    
    // Update last processed if not updated
    if (state.lastProcessedCandle === 0) {
      state.lastProcessedCandle = ethCandles[ethCandles.length - 1].t;
    }
    
    // Print daily summary
    const todaySignals = state.signals.filter(s => {
      const d = new Date(s.time * 1000).toISOString().split('T')[0];
      return d === dateStr;
    });
    const todayTrades = state.trades.filter(t => {
      const d = new Date(t.entryTime * 1000).toISOString().split('T')[0];
      return d === dateStr;
    });
    
    log(`Daily summary ${dateStr}:`);
    log(`  Signals today: ${todaySignals.length}`);
    log(`  Trades today: ${todayTrades.length}`);
    log(`  Total signals: ${state.signals.length}`);
    log(`  Total trades: ${state.trades.length}`);
    log(`  Cumulative PnL: ${state.cumulativePnL.toFixed(4)}%`);
    
    // Save state
    saveState();
    
    appendLog(logFile, `POLL | signals_today=${todaySignals.length} | trades_today=${todayTrades.length} | total=${state.trades.length} | pnl=${state.cumulativePnL.toFixed(4)}%`);
    
  } catch (e) {
    log(`ERROR: ${e.message}`);
    appendLog(logFile, `ERROR: ${e.message}`);
  }
  
  log('');
}

// === STARTUP ===
async function main() {
  log('========================================');
  log('ETH Drawdown Recovery Shadow Validator');
  log('========================================');
  log(`Config: minDD=${CONFIG.minDrawdown*100}%, ATR ${CONFIG.atrMin*100}-${CONFIG.atrMax*100}%, BTC ${CONFIG.btcTrendThreshold*100}% down`);
  log('');
  
  // Ensure log dir exists
  mkdirSync(CONFIG.logDir, { recursive: true });
  
  // Load state
  loadState();
  
  // Run first poll
  await poll();
  
  // Schedule periodic polls
  setInterval(poll, CONFIG.pollInterval);
}

main().catch(e => {
  log(`FATAL: ${e.message}`);
  process.exit(1);
});
