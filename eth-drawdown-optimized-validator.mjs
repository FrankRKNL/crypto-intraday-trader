/**
 * ETH Drawdown Recovery Optimized Validator (v2)
 * 
 * Based on conditional analysis:
 * - MIN_DD = 6% (raise from 5%)
 * - Block US market hours (16-20 UTC) - worst performance
 * - Block Friday entries - worst day
 * - Red candle filter (already in)
 * 
 * Historical performance (8000 1H candles):
 * - DD>=6% + Block US: n=10, WR=80%, Avg=1.939%, Median=2.794%
 * - P1: +0.736%, P2: +2.742%
 * 
 * Live mode: Check every 5 minutes for new signals
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = join(__dirname);
const DATA_DIR = join(BASE_DIR, 'data');
const LOGS_DIR = join(BASE_DIR, 'logs-optimized');

// Config - OPTIMIZED
const ASSET = 'ETHUSDT';
const BTC_ASSET = 'BTCUSDT';
const MIN_DD = 6.0;           // Raised from 5% (78% WR vs 63%)
const LOOKBACK = 4;           // 4 consecutive 1H candles
const HOLD = 8;              // Hold 8 hours
const RED_CANDLE = true;     // Last candle must close red
const BLOCK_US_HOURS = true; // BLOCK 16-20 UTC (worst performance)
const BLOCK_FRIDAY = true;   // BLOCK Friday entries
const MAX_BTC_SPIKE = 3.0;   // Skip if BTC pumps >3% during lookback (risk)
const POLL_MS = 5 * 60 * 1000;
const EQUITY = 10000;

// State
let state = {
  position: 'FLAT',
  entryPrice: 0,
  entryCandleTime: 0,
  trades: 0,
  wins: 0,
  losses: 0,
  equity: EQUITY,
  lastTradeResult: null
};

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  const logFile = join(LOGS_DIR, `live-${new Date().toISOString().split('T')[0]}.log`);
  appendFileSync(logFile, line + '\n');
}

async function fetchKlines(symbol, interval, limit = 500) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  return raw.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5])
  }));
}

function loadLocalETH() {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));
  } catch { return []; }
}

function loadLocalBTC() {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, 'btcusdt-1h-long.json'), 'utf8'));
  } catch { return []; }
}

function checkSignal(ethCandles, btcCandles) {
  if (ethCandles.length < LOOKBACK + 2) return null;
  
  const now = ethCandles[ethCandles.length - 1];
  const nowTime = new Date(now.t);
  const hour = nowTime.getUTCHours();
  const dayOfWeek = nowTime.getDay();
  
  // Filters
  if (BLOCK_US_HOURS && hour >= 16 && hour < 20) {
    return { signal: false, reason: 'US market hours blocked' };
  }
  if (BLOCK_FRIDAY && dayOfWeek === 5) {
    return { signal: false, reason: 'Friday blocked' };
  }
  
  // Calculate drawdown over lookback
  const startIdx = ethCandles.length - LOOKBACK - 1;
  const startPrice = ethCandles[startIdx].o;
  const lastCandle = ethCandles[ethCandles.length - 2]; // Entry is at current candle open
  const endPrice = lastCandle.c;
  const dd = (startPrice - endPrice) / startPrice * 100;
  
  if (dd < MIN_DD) {
    return { signal: false, reason: `DD=${dd.toFixed(2)}% < ${MIN_DD}%` };
  }
  
  // Red candle check
  if (RED_CANDLE && lastCandle.c >= lastCandle.o) {
    return { signal: false, reason: 'Last candle not red' };
  }
  
  // BTC spike check (skip if BTC pumped >3% during lookback)
  const btcStartIdx = btcCandles.length - LOOKBACK - 1;
  const btcStart = btcCandles[btcStartIdx].o;
  const btcLast = btcCandles[btcCandles.length - 2].c;
  const btcChange = (btcLast - btcStart) / btcStart * 100;
  
  if (btcChange > MAX_BTC_SPIKE) {
    return { signal: false, reason: `BTC spiked ${btcChange.toFixed(2)}%` };
  }
  
  return {
    signal: true,
    entryPrice: now.o,
    dd: dd.toFixed(2),
    btcChange: btcChange.toFixed(2),
    entryTime: nowTime.toISOString(),
    hour,
    dayOfWeek
  };
}

async function liveMode() {
  log('=== ETH Drawdown Recovery OPTIMIZED Validator v2 ===');
  log(`Config: DD>=${MIN_DD}%, ${LOOKBACK}h lookback, ${HOLD}h hold`);
  log(`Filters: Red candle, Block US hours=${BLOCK_US_HOURS}, Block Friday=${BLOCK_FRIDAY}`);
  log(`Paper trading mode, equity: $${EQUITY}\n`);
  
  // Load local cache first
  let ethCandles = loadLocalETH();
  let btcCandles = loadLocalBTC();
  
  if (ethCandles.length > 0) {
    log(`Loaded ${ethCandles.length} cached ETH candles`);
  }
  
  while (true) {
    try {
      // Fetch latest candles
      const [ethNew, btcNew] = await Promise.all([
        fetchKlines(ASSET, '1h', 10),
        fetchKlines(BTC_ASSET, '1h', 10)
      ]);
      
      // Merge new candles
      if (ethNew.length > 0 && ethCandles.length > 0) {
        const lastTime = ethCandles[ethCandles.length - 1].t;
        const newETH = ethNew.filter(k => k.t > lastTime);
        const newBTC = btcNew.filter(k => k.t > lastTime);
        
        if (newETH.length > 0) {
          ethCandles.push(...newETH);
          btcCandles.push(...newBTC);
          log(`New candles: ETH=${newETH.length}, BTC=${newBTC.length}`);
        }
      } else if (ethNew.length > 0) {
        ethCandles = ethNew;
        btcCandles = btcNew;
      }
      
      const currentPrice = ethCandles[ethCandles.length - 1].c;
      
      // Check for signal
      const check = checkSignal(ethCandles, btcCandles);
      
      if (state.position === 'FLAT') {
        if (check.signal) {
          log(`===== SIGNAL! =====`);
          log(`Entry: $${check.entryPrice.toFixed(2)} | DD: ${check.dd}% | BTC: ${check.btcChange}%`);
          log(`Time: ${check.entryTime} (${check.hour}h UTC, day ${check.dayOfWeek})`);
          
          state.position = 'LONG';
          state.entryPrice = check.entryPrice;
          state.entryCandleTime = ethCandles[ethCandles.length - 1].t;
          state.entryIndex = ethCandles.length - 1;
          
          // Calculate expected hold exit time
          const exitIndex = state.entryIndex + HOLD;
          if (exitIndex < ethCandles.length) {
            const exitCandle = ethCandles[exitIndex];
            log(`Expected exit at ${new Date(exitCandle.t).toISOString()}`);
          }
        } else {
          if (Math.random() < 0.1) { // Log occasionally
            log(`FLAT | Price: $${currentPrice.toFixed(2)} | ${check.reason}`);
          }
        }
      } else {
        // In position - check for exit
        const elapsed = ethCandles.length - state.entryIndex;
        
        if (elapsed >= HOLD) {
          const exitPrice = ethCandles[ethCandles.length - 1].c;
          const pnl = (exitPrice - state.entryPrice) / state.entryPrice * 100;
          const win = pnl > 0;
          
          state.trades++;
          if (win) state.wins++; else state.losses++;
          
          log(`===== EXIT =====`);
          log(`Entry: $${state.entryPrice.toFixed(2)} | Exit: $${exitPrice.toFixed(2)}`);
          log(`PnL: ${pnl.toFixed(3)}% | ${win ? 'WIN' : 'LOSS'}`);
          log(`Stats: ${state.trades} trades (${state.wins}W/${state.losses}L)`);
          
          state.position = 'FLAT';
          state.lastTradeResult = { pnl, win };
        } else {
          const peak = Math.max(...ethCandles.slice(state.entryIndex).map(c => c.h));
          const pnl = (currentPrice - state.entryPrice) / state.entryPrice * 100;
          if (Math.random() < 0.2) {
            log(`LONG | Price: $${currentPrice.toFixed(2)} | PnL: ${pnl.toFixed(2)}% | ${elapsed}/${HOLD}h`);
          }
        }
      }
      
    } catch (err) {
      log(`Error: ${err.message}`);
    }
    
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

// Simple backtest for validation
async function backtest() {
  log('Running backtest...');
  
  const ethCandles = loadLocalETH();
  const btcCandles = loadLocalBTC();
  
  if (ethCandles.length === 0) {
    log('No local data, fetching...');
    const data = await fetchKlines(ASSET, '1h', 8000);
    writeFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), JSON.stringify(data));
    return;
  }
  
  log(`Backtesting ${ethCandles.length} candles...`);
  
  let trades = 0, wins = 0, totalPnL = 0;
  const details = [];
  
  for (let i = LOOKBACK + 1; i < ethCandles.length - HOLD; i++) {
    const check = checkSignal(ethCandles, btcCandles);
    
    // Simulate signal detection at this candle
    const nowTime = new Date(ethCandles[i].t);
    const hour = nowTime.getUTCHours();
    const dayOfWeek = nowTime.getDay();
    
    // Apply filters
    if (BLOCK_US_HOURS && hour >= 16 && hour < 20) continue;
    if (BLOCK_FRIDAY && dayOfWeek === 5) continue;
    
    // Drawdown check
    const startIdx = i - LOOKBACK;
    const startPrice = ethCandles[startIdx].o;
    const lastCandle = ethCandles[i - 1];
    const endPrice = lastCandle.c;
    const dd = (startPrice - endPrice) / startPrice * 100;
    
    if (dd < MIN_DD) continue;
    if (RED_CANDLE && lastCandle.c >= lastCandle.o) continue;
    
    // BTC check
    const btcStartIdx = btcCandles.length - (btcCandles.length - ethCandles.length + startIdx);
    const btcStart = btcCandles[startIdx].o;
    const btcEnd = btcCandles[i - 1].c;
    const btcChange = (btcEnd - btcStart) / btcStart * 100;
    
    if (btcChange > MAX_BTC_SPIKE) continue;
    
    // Entry and exit
    const entryPrice = ethCandles[i].o;
    const exitPrice = ethCandles[i + HOLD].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    const win = pnl > 0;
    
    trades++;
    if (win) wins++;
    totalPnL += pnl;
    
    details.push({
      entry: new Date(ethCandles[i].t).toISOString(),
      exit: new Date(ethCandles[i+HOLD].t).toISOString(),
      entryPrice,
      exitPrice,
      pnl: pnl.toFixed(3),
      win
    });
  }
  
  log(`\n=== BACKTEST RESULTS ===`);
  log(`Trades: ${trades} | WR: ${(wins/trades*100).toFixed(1)}% | Avg: ${(totalPnL/trades).toFixed(3)}%`);
  log(`Filters: DD>=${MIN_DD}%, Red candle, Block US=${BLOCK_US_HOURS}, Block Fri=${BLOCK_FRIDAY}`);
  
  // Period split
  const mid = Math.floor(ethCandles.length / 2);
  const p1Trades = details.filter(d => new Date(d.entry) < new Date(ethCandles[mid].t));
  const p2Trades = details.filter(d => new Date(d.entry) >= new Date(ethCandles[mid].t));
  
  log(`P1: ${p1Trades.length} trades, avg=${(p1Trades.reduce((s,t) => s + parseFloat(t.pnl), 0) / p1Trades.length).toFixed(3)}%`);
  log(`P2: ${p2Trades.length} trades, avg=${(p2Trades.reduce((s,t) => s + parseFloat(t.pnl), 0) / p2Trades.length).toFixed(3)}%`);
  
  writeFileSync('results-optimized-backtest.json', JSON.stringify(details, null, 2));
  log('Saved detailed results');
}

// Entry point
const mode = process.argv.includes('--live') ? 'live' : 'backtest';
mkdirSync(LOGS_DIR, { recursive: true });

if (mode === 'live') {
  liveMode();
} else {
  backtest();
}