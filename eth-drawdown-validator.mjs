/**
 * ETH Drawdown Recovery Paper Trading Validator
 * Strategy: Buy ETH after >= 3% drop in 4 consecutive 15m candles, with red candle filter
 * Exit: Hold 8 candles (2h), no SL/TP
 * 
 * Live mode: polls Binance every 15m
 * Backtest mode: use historical data
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = join(__dirname);
const DATA_DIR = join(BASE_DIR, 'data');
const LOGS_DIR = join(BASE_DIR, 'logs-drawdown');

// Config
const ASSET = 'ETHUSDT';
const LOOKBACK_CANDLES = 4;      // 4 consecutive 15m candles
const MIN_DRAWDOWN_PCT = 3.0;    // >= 3% drop
const HOLD_CANDLES = 8;          // 8 candles = 2 hours
const RED_CANDLE_FILTER = true;  // Only enter if last candle is red
const BTC_FILTER = false;        // Optional: BTC must drop >= 2%
const POLL_INTERVAL_MS = 60 * 1000; // Poll every minute
const DRY_RUN = true;            // Paper trading mode

// State
let state = {
  position: 'FLAT',
  entryPrice: 0,
  entryCandle: null,
  entryIndex: 0,
  peakPrice: 0,
  trades: 0,
  wins: 0,
  losses: 0,
  totalPnL: 0,
  equity: 20000,  // Starting paper money
  tradesLog: []
};

function loadData() {
  const btcData = JSON.parse(readFileSync(join(DATA_DIR, 'btcusdt-15m-extended.json'), 'utf8'));
  const ethData = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-15m-extended.json'), 'utf8'));
  return { btcData, ethData };
}

async function fetchLatestCandles(symbol, limit = 100) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=${limit}`;
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

function toCandles(raw) {
  return raw.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5])
  }));
}

function checkDrawdown(ethCandles, btcCandles, currentIndex) {
  if (currentIndex < LOOKBACK_CANDLES) return false;
  
  // Check ETH drawdown over last 4 candles
  const lookback = ethCandles.slice(currentIndex - LOOKBACK_CANDLES, currentIndex + 1);
  if (lookback.length < LOOKBACK_CANDLES + 1) return false;
  
  const startPrice = lookback[0].o;  // Open of first candle
  const endPrice = lookback[lookback.length - 1].c;  // Close of last candle
  const drawdownPct = (startPrice - endPrice) / startPrice * 100;
  
  if (drawdownPct < MIN_DRAWDOWN_PCT) return false;
  
  // Check all 4 candles are DOWN
  let allDown = true;
  for (let i = 0; i < LOOKBACK_CANDLES; i++) {
    if (lookback[i].c >= lookback[i].o) {  // Not a down candle
      allDown = false;
      break;
    }
  }
  
  if (!allDown) return false;
  
  // Red candle filter: last candle must close LOWER than open
  const lastCandle = lookback[LOOKBACK_CANDLES - 1];
  if (RED_CANDLE_FILTER && lastCandle.c >= lastCandle.o) {
    return false;  // Not a red candle
  }
  
  // BTC filter: BTC must drop >= 2% in same period
  if (BTC_FILTER) {
    const btcLookback = btcCandles.slice(currentIndex - LOOKBACK_CANDLES, currentIndex + 1);
    if (btcLookback.length < LOOKBACK_CANDLES + 1) return false;
    const btcStart = btcLookback[0].o;
    const btcEnd = btcLookback[btcLookback.length - 1].c;
    const btcDrawdown = (btcStart - btcEnd) / btcStart * 100;
    if (btcDrawdown < 2.0) return false;
  }
  
  return {
    drawdownPct,
    entryPrice: lastCandle.c,
    entryCandle: lastCandle
  };
}

function backtest(ethData, btcData) {
  console.log('\n=== BACKTEST: ETH Drawdown Recovery (Red Candle Filter) ===');
  console.log(`Data: ${ethData.length} ETH candles, ${btcData.length} BTC candles`);
  console.log(`Period: ${new Date(ethData[0].t).toISOString()} to ${new Date(ethData[ethData.length-1].t).toISOString()}`);
  
  const trades = [];
  
  for (let i = LOOKBACK_CANDLES; i < ethData.length - HOLD_CANDLES; i++) {
    const signal = checkDrawdown(ethData, btcData, i);
    if (!signal) continue;
    
    // Simulate entry at next candle open
    const entryCandle = ethData[i + 1];
    const entryPrice = entryCandle.o;
    const peakPrice = entryPrice;
    
    // Simulate hold for 8 candles
    let exitPrice = null;
    let exitIndex = i + HOLD_CANDLES;
    if (exitIndex < ethData.length) {
      exitPrice = ethData[exitIndex].c;
    }
    
    if (exitPrice === null) continue;
    
    const pnlPct = (exitPrice - entryPrice) / entryPrice * 100;
    const win = pnlPct > 0;
    
    trades.push({
      entryTime: new Date(entryCandle.t).toISOString(),
      entryPrice,
      exitTime: new Date(ethData[exitIndex].t).toISOString(),
      exitPrice,
      pnlPct,
      win,
      drawdownPct: signal.drawdownPct
    });
  }
  
  if (trades.length === 0) {
    console.log('No trades found!');
    return;
  }
  
  const wins = trades.filter(t => t.win);
  const losses = trades.filter(t => !t.win);
  const avgWin = wins.reduce((a, t) => a + t.pnlPct, 0) / wins.length;
  const avgLoss = losses.reduce((a, t) => a + t.pnlPct, 0) / losses.length;
  const netPnL = trades.reduce((a, t) => a + t.pnlPct, 0);
  const avgPnL = netPnL / trades.length;
  const medianPnL = [...trades].sort((a, b) => a.pnlPct - b.pnlPct)[Math.floor(trades.length / 2)].pnlPct;
  
  console.log(`\nResults (${trades.length} trades):`);
  console.log(`  Win Rate: ${(wins.length/trades.length*100).toFixed(1)}% (${wins.length}W/${losses.length}L)`);
  console.log(`  Avg Return: ${avgPnL.toFixed(3)}%`);
  console.log(`  Median Return: ${medianPnL.toFixed(3)}%`);
  console.log(`  Avg Win: ${avgWin.toFixed(3)}%`);
  console.log(`  Avg Loss: ${avgLoss.toFixed(3)}%`);
  console.log(`  Risk:Reward: ${Math.abs(avgWin/avgLoss).toFixed(2)}`);
  console.log(`  Total PnL: ${netPnL.toFixed(2)}%`);
  
  // Period split
  const midPoint = Math.floor(trades.length / 2);
  const firstHalf = trades.slice(0, midPoint);
  const secondHalf = trades.slice(midPoint);
  
  console.log(`\nPeriod Split:`);
  console.log(`  First Half (${firstHalf.length} trades): ${(firstHalf.reduce((a,t)=>a+t.pnlPct,0)/firstHalf.length).toFixed(3)}% avg`);
  console.log(`  Second Half (${secondHalf.length} trades): ${(secondHalf.reduce((a,t)=>a+t.pnlPct,0)/secondHalf.length).toFixed(3)}% avg`);
  
  // Fee sensitivity
  console.log(`\nFee Sensitivity:`);
  for (const fee of [0, 10, 20, 30, 40]) {
    const net = trades.map(t => t.pnlPct - fee/10000).reduce((a, v) => a + v, 0);
    const pos = trades.filter(t => t.pnlPct > fee/10000).length;
    console.log(`  ${fee}bps fee: net=${(net/trades.length).toFixed(3)}%/trade, win%=${(pos/trades.length*100).toFixed(0)}%`);
  }
  
  return trades;
}

async function liveMode() {
  console.log('\n=== LIVE MODE: ETH Drawdown Recovery Validator ===');
  console.log('Paper trading mode. Monitoring 15m candles...');
  
  mkdirSync(LOGS_DIR, { recursive: true });
  
  // Load cached data to start
  let { btcData, ethData } = loadData();
  console.log(`Loaded ${ethData.length} ETH candles, ${btcData.length} BTC candles`);
  
  let lastCandleTime = ethData[ethData.length - 1].t;
  let lastLogTime = Date.now();
  
  while (true) {
    try {
      // Fetch latest candles
      const latestCandles = await fetchLatestCandles(ASSET);
      const latest = latestCandles[latestCandles.length - 1];
      
      // Check if we have a new candle
      if (latest.t > lastCandleTime) {
        console.log(`\n[${new Date().toISOString()}] New candle: ${latest.o.toFixed(2)} → ${latest.c.toFixed(2)}`);
        
        // Add to our data
        ethData.push(latest);
        lastCandleTime = latest.t;
        
        // Check for signals
        if (state.position === 'FLAT') {
          const signal = checkDrawdown(ethData, btcData, ethData.length - 1);
          if (signal) {
            console.log(`  🚨 SIGNAL! Drawdown: ${signal.drawdownPct.toFixed(2)}%`);
            console.log(`  🚨 Entry at ${signal.entryPrice.toFixed(2)}`);
            
            // Paper trade entry
            state.position = 'LONG';
            state.entryPrice = signal.entryPrice;
            state.entryCandle = latest;
            state.entryIndex = ethData.length - 1;
            state.peakPrice = signal.entryPrice;
            
            const entryValue = `ENTRY LONG @ ${signal.entryPrice.toFixed(2)}`;
            console.log(`  📝 ${entryValue}`);
            logTrade({ event: 'ENTRY', price: signal.entryPrice, time: new Date().toISOString(), drawdown: signal.drawdownPct });
          }
        } else if (state.position === 'LONG') {
          // Check exit condition
          const candlesHeld = ethData.length - 1 - state.entryIndex;
          state.peakPrice = Math.max(state.peakPrice, latest.c);
          
          if (candlesHeld >= HOLD_CANDLES) {
            const pnlPct = (latest.c - state.entryPrice) / state.entryPrice * 100;
            const win = pnlPct > 0;
            
            console.log(`  📤 EXIT after ${candlesHeld} candles`);
            console.log(`  📤 PnL: ${pnlPct.toFixed(3)}% (${win ? 'WIN' : 'LOSS'})`);
            
            state.trades++;
            state.totalPnL += pnlPct;
            if (win) state.wins++;
            else state.losses++;
            
            logTrade({
              event: 'EXIT',
              price: latest.c,
              time: new Date().toISOString(),
              pnlPct,
              candlesHeld,
              peak: state.peakPrice
            });
            
            state.position = 'FLAT';
            state.entryPrice = 0;
            state.entryCandle = null;
            state.entryIndex = 0;
          }
        }
        
        // Save updated data
        writeFileSync(join(DATA_DIR, 'ethusdt-15m-live.json'), JSON.stringify(ethData));
      }
      
      // Status log every 5 minutes
      if (Date.now() - lastLogTime > 5 * 60 * 1000) {
        const equity = state.equity * (1 + state.totalPnL / 100);
        console.log(`\n[${new Date().toISOString()}] Status: ${state.position} | Trades: ${state.trades} (${state.wins}W/${state.losses}L) | Total PnL: ${state.totalPnL.toFixed(2)}% | Equity: $${equity.toFixed(2)}`);
        lastLogTime = Date.now();
      }
      
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
    
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

function logTrade(trade) {
  const logFile = join(LOGS_DIR, `trades-${new Date().toISOString().slice(0,10)}.json`);
  let trades = [];
  if (existsSync(logFile)) {
    trades = JSON.parse(readFileSync(logFile, 'utf8'));
  }
  trades.push({ ...trade, timestamp: Date.now() });
  writeFileSync(logFile, JSON.stringify(trades, null, 2));
}

// ============================================================
// MAIN
// ============================================================
const mode = process.argv[2] || 'backtest';

if (mode === 'backtest') {
  const { btcData, ethData } = loadData();
  const trades = backtest(btcData, ethData);
  if (trades) {
    writeFileSync(join(BASE_DIR, 'results-drawdown-backtest.json'), JSON.stringify(trades, null, 2));
    console.log('\nTrades saved to results-drawdown-backtest.json');
  }
} else if (mode === 'live') {
  liveMode().catch(console.error);
}
