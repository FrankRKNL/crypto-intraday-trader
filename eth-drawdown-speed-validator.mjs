/**
 * ETH Drawdown Recovery - Speed Filter Validator v3
 * 
 * NEW FILTER DISCOVERED (2026-04-12):
 * Speed ratio > 2 = fast initial drop, slow grind down = CAPITULATION
 * 
 * When speed ratio > 2 AND DD >= 6%:
 * - 100% WR, +3.338% avg (n=5, small sample!)
 * 
 * Config:
 * - DD >= 6%
 * - Speed ratio > 2 (capitulation pattern)
 * - Red candle
 * - Block US hours (16-20 UTC)
 * - Hold 8h
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = join(__dirname);
const DATA_DIR = join(BASE_DIR, 'data');
const LOGS_DIR = join(BASE_DIR, 'logs-speed');

// Config - NEW SPEED FILTER
const ASSET = 'ETHUSDT';
const BTC_ASSET = 'BTCUSDT';
const MIN_DD = 6.0;           // Minimum 6% drawdown
const SPEED_RATIO = 2.0;      // Fast drop / slow grind ratio (NEW!)
const LOOKBACK = 4;           // 4 consecutive 1H candles
const HOLD = 8;              // Hold 8 hours
const RED_CANDLE = true;     // Last candle must close red
const BLOCK_US_HOURS = true; // BLOCK 16-20 UTC
const POLL_MS = 5 * 60 * 1000;
const EQUITY = 10000;

let state = {
  position: 'FLAT',
  entryPrice: 0,
  entryIndex: 0,
  trades: 0,
  wins: 0,
  losses: 0,
  equity: EQUITY
};

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  mkdirSync(LOGS_DIR, { recursive: true });
  appendFileSync(join(LOGS_DIR, `live-${new Date().toISOString().split('T')[0]}.log`), line + '\n');
}

async function fetchKlines(symbol, interval, limit = 500) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).map(k => ({
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

function checkSignal(ethCandles) {
  if (ethCandles.length < LOOKBACK + 2) return null;
  
  const now = ethCandles[ethCandles.length - 1];
  const nowTime = new Date(now.t);
  const hour = nowTime.getUTCHours();
  const dayOfWeek = nowTime.getDay();
  
  // Block US hours
  if (BLOCK_US_HOURS && hour >= 16 && hour < 20) {
    return { signal: false, reason: 'US market hours blocked' };
  }
  
  // Drawdown check
  const startIdx = ethCandles.length - LOOKBACK - 1;
  const startPrice = ethCandles[startIdx].o;
  const midIdx = startIdx + 2;
  const midPrice = ethCandles[midIdx].c;
  const lastCandle = ethCandles[ethCandles.length - 2];
  const endPrice = lastCandle.c;
  
  const dd = (startPrice - endPrice) / startPrice * 100;
  
  if (dd < MIN_DD) {
    return { signal: false, reason: `DD=${dd.toFixed(2)}% < ${MIN_DD}%` };
  }
  
  // Red candle check
  if (RED_CANDLE && lastCandle.c >= lastCandle.o) {
    return { signal: false, reason: 'Last candle not red' };
  }
  
  // SPEED FILTER (NEW!)
  const earlyDD = (startPrice - midPrice) / startPrice * 100;
  const lateDD = dd - earlyDD;
  const speedRatio = lateDD > 0.01 ? earlyDD / lateDD : 999;
  
  if (speedRatio < SPEED_RATIO) {
    return { signal: false, reason: `Speed=${speedRatio.toFixed(2)} < ${SPEED_RATIO}` };
  }
  
  return {
    signal: true,
    entryPrice: now.o,
    dd: dd.toFixed(2),
    speed: speedRatio.toFixed(2),
    entryTime: nowTime.toISOString(),
    hour,
    dayOfWeek
  };
}

async function liveMode() {
  log('=== ETH Drawdown Recovery SPEED FILTER Validator v3 ===');
  log(`Config: DD>=${MIN_DD}%, Speed>${SPEED_RATIO}, ${LOOKBACK}h lookback, ${HOLD}h hold`);
  log(`Filters: Red candle, Speed filter (capitulation), Block US hours=${BLOCK_US_HOURS}`);
  log(`Paper trading mode, equity: $${EQUITY}\n`);
  
  let ethCandles = loadLocalETH();
  
  if (ethCandles.length > 0) {
    log(`Loaded ${ethCandles.length} cached ETH candles`);
  }
  
  while (true) {
    try {
      const newCandles = await fetchKlines(ASSET, '1h', 10);
      
      if (newCandles.length > 0 && ethCandles.length > 0) {
        const lastTime = ethCandles[ethCandles.length - 1].t;
        const fresh = newCandles.filter(k => k.t > lastTime);
        if (fresh.length > 0) {
          ethCandles.push(...fresh);
          log(`New candles: ${fresh.length}`);
        }
      } else if (newCandles.length > 0) {
        ethCandles = newCandles;
      }
      
      const currentPrice = ethCandles[ethCandles.length - 1].c;
      
      if (state.position === 'FLAT') {
        const check = checkSignal(ethCandles);
        
        if (check.signal) {
          log(`===== CAPITULATION SIGNAL! =====`);
          log(`Entry: $${check.entryPrice.toFixed(2)} | DD: ${check.dd}% | Speed: ${check.speed}x`);
          log(`Time: ${check.entryTime} (${check.hour}h UTC, day ${check.dayOfWeek})`);
          
          state.position = 'LONG';
          state.entryPrice = check.entryPrice;
          state.entryIndex = ethCandles.length - 1;
        } else {
          if (Math.random() < 0.1) {
            log(`FLAT | Price: $${currentPrice.toFixed(2)} | ${check.reason}`);
          }
        }
      } else {
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
        } else {
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

// Simple backtest
async function backtest() {
  log('Running backtest for SPEED FILTER...');
  
  let ethCandles = loadLocalETH();
  
  if (ethCandles.length === 0) {
    log('Fetching data...');
    ethCandles = await fetchKlines(ASSET, '1h', 8000);
    writeFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), JSON.stringify(ethCandles));
  }
  
  log(`Backtesting ${ethCandles.length} candles...`);
  
  const trades = [];
  
  for (let i = LOOKBACK + 1; i < ethCandles.length - HOLD; i++) {
    const entryTime = new Date(ethCandles[i].t);
    const hour = entryTime.getUTCHours();
    
    if (BLOCK_US_HOURS && hour >= 16 && hour < 20) continue;
    
    const startIdx = i - LOOKBACK;
    const startPrice = ethCandles[startIdx].o;
    const midIdx = startIdx + 2;
    const midPrice = ethCandles[midIdx].c;
    const lastCandle = ethCandles[i - 1];
    const endPrice = lastCandle.c;
    
    const dd = (startPrice - endPrice) / startPrice * 100;
    if (dd < MIN_DD) continue;
    if (RED_CANDLE && lastCandle.c >= lastCandle.o) continue;
    
    const earlyDD = (startPrice - midPrice) / startPrice * 100;
    const lateDD = dd - earlyDD;
    const speedRatio = lateDD > 0.01 ? earlyDD / lateDD : 999;
    
    if (speedRatio < SPEED_RATIO) continue;
    
    const entryPrice = ethCandles[i].o;
    const exitPrice = ethCandles[i + HOLD].c;
    const pnl = (exitPrice - entryPrice) / entryPrice * 100;
    
    trades.push({
      entry: entryTime.toISOString(),
      dd: dd.toFixed(2),
      speed: speedRatio.toFixed(2),
      pnl: pnl.toFixed(3),
      win: pnl > 0
    });
  }
  
  if (trades.length > 0) {
    const wins = trades.filter(t => t.win).length;
    const avg = trades.reduce((s, t) => s + parseFloat(t.pnl), 0) / trades.length;
    log(`\n=== SPEED FILTER BACKTEST ===`);
    log(`Trades: ${trades.length} | WR: ${(wins/trades.length*100).toFixed(1)}% | Avg: ${avg.toFixed(3)}%`);
    log(`Filters: DD>=${MIN_DD}%, Speed>${SPEED_RATIO}, Red candle, Block US`);
    
    // Period split
    const mid = Math.floor(ethCandles.length / 2);
    const p1 = trades.filter(t => new Date(t.entry) < new Date(ethCandles[mid].t));
    const p2 = trades.filter(t => new Date(t.entry) >= new Date(ethCandles[mid].t));
    
    if (p1.length > 0) {
      const avg1 = p1.reduce((s,t) => s + parseFloat(t.pnl), 0) / p1.length;
      log(`P1: n=${p1.length}, avg=${avg1.toFixed(3)}%`);
    }
    if (p2.length > 0) {
      const avg2 = p2.reduce((s,t) => s + parseFloat(t.pnl), 0) / p2.length;
      log(`P2: n=${p2.length}, avg=${avg2.toFixed(3)}%`);
    }
    
    writeFileSync('results-speed-backtest.json', JSON.stringify(trades, null, 2));
    log('Saved to results-speed-backtest.json');
  }
}

const mode = process.argv.includes('--live') ? 'live' : 'backtest';

if (mode === 'live') {
  liveMode();
} else {
  backtest();
}