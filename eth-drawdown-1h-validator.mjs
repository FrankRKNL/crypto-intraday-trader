/**
 * ETH Drawdown Recovery Paper Trading Validator (1H Timeframe)
 * 
 * Strategy: 
 * - Entry: ETH drops >= 4% over 4 consecutive 1H candles, all down, last candle closes RED
 * - Exit: Hold exactly 8 candles (8 hours)
 * - No SL, No TP
 * 
 * Config:
 * - MIN_DD = 4.0%
 * - LOOKBACK = 4 candles (4 hours)
 * - HOLD = 8 candles (8 hours)
 * - RED_CANDLE = true
 * 
 * Historical stats (8000 1H candles):
 * - 50 trades, 72% WR, +1.006% avg
 * - Fee insensitive (60bps barely changes)
 * - Both halves positive (P1: +0.782%, P2: +1.230%)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = join(__dirname);
const DATA_DIR = join(BASE_DIR, 'data');
const LOGS_DIR = join(BASE_DIR, 'logs-drawdown-1h');

// Config
const ASSET = 'ETHUSDT';
const BTC_ASSET = 'BTCUSDT';
const MIN_DD = 5.0;        // >= 5% drop (sweet spot: 5-7% has 85%+ WR)
const MAX_DD = 999;        // No max (or set 7.0 for stricter)
const LOOKBACK = 4;        // 4 consecutive 1H candles
const HOLD = 8;            // Hold 8 hours (8 candles)
const RED_CANDLE = true;   // Last candle must close red
const BLOCK_US_HOURS = true; // Block 16-20 UTC (US market, weaker WR)
const BTC_MAX_DD = 3.0;   // Skip if BTC drops >3% in same window (too risky)
const POLL_MS = 5 * 60 * 1000;  // Poll every 5 minutes
const EQUITY = 10000;      // Paper money per asset

// State
let state = {
  position: 'FLAT',
  entryPrice: 0,
  entryCandleTime: 0,
  entryIndex: 0,
  peakPrice: 0,
  trades: 0,
  wins: 0,
  losses: 0,
  totalPnLPct: 0,
  equity: EQUITY,
  lastPoll: null
};

function loadLocalData() {
  try {
    const eth = JSON.parse(readFileSync(join(DATA_DIR, 'ethusdt-1h-long.json'), 'utf8'));
    const btc = JSON.parse(readFileSync(join(DATA_DIR, 'btcusdt-1h-long.json'), 'utf8'));
    return { eth, btc };
  } catch {
    return { eth: [], btc: [] };
  }
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

function checkSignal(eth, btc, currentIndex) {
  if (currentIndex < LOOKBACK) return null;
  
  const lookback = eth.slice(currentIndex - LOOKBACK, currentIndex);
  if (lookback.length < LOOKBACK) return null;
  
  // Check drawdown
  const startPrice = lookback[0].o;
  const endPrice = lookback[LOOKBACK - 1].c;
  const dd = (startPrice - endPrice) / startPrice * 100;
  if (dd < MIN_DD || dd > MAX_DD) return null;
  
  // All candles must be down
  const allDown = lookback.every(c => c.c < c.o);
  if (!allDown) return null;
  
  // Last candle must close red
  if (RED_CANDLE && lookback[LOOKBACK - 1].c >= lookback[LOOKBACK - 1].o) return null;
  
  // Block US market hours (16-20 UTC)
  if (BLOCK_US_HOURS) {
    const h = new Date(eth[currentIndex].t).getUTCHours();
    if (h >= 16 && h < 20) return null;
  }
  
  // BTC filter: skip if BTC drops >3% (macro dump = too risky)
  if (BTC_MAX_DD > 0) {
    const btcLookback = btc.slice(currentIndex - LOOKBACK, currentIndex);
    if (btcLookback.length >= LOOKBACK) {
      const btcStart = btcLookback[0].o;
      const btcEnd = btcLookback[LOOKBACK - 1].c;
      const btcDD = (btcStart - btcEnd) / btcStart * 100;
      if (btcDD > BTC_MAX_DD) return null;
    }
  }
  
  return {
    dd,
    entryPrice: eth[currentIndex].o,
    signalCandle: eth[currentIndex]
  };
}

async function backtest() {
  console.log('\n=== BACKTEST: ETH Drawdown Recovery 1H (DD>=4%, 8h hold) ===\n');
  const { eth, btc } = loadLocalData();
  
  if (eth.length === 0) {
    console.log('No data found!');
    return;
  }
  
  console.log(`Data: ${eth.length} ETH 1H candles`);
  console.log(`Period: ${new Date(eth[0].t).toISOString()} to ${new Date(eth[eth.length-1].t).toISOString()}`);
  console.log(`DD>=${MIN_DD}%, ${LOOKBACK} candles lookback, ${HOLD} candles hold, Red candle: ${RED_CANDLE}\n`);
  
  const trades = [];
  
  for (let i = LOOKBACK; i < eth.length - HOLD; i++) {
    const signal = checkSignal(eth, btc, i);
    if (!signal) continue;
    
    const entry = eth[i + 1].o;
    const exitIdx = i + 1 + HOLD;
    if (exitIdx >= eth.length) continue;
    const exit = eth[exitIdx].c;
    
    const pnl = (exit - entry) / entry * 100;
    trades.push({
      entryTime: new Date(eth[i+1].t).toISOString(),
      exitTime: new Date(eth[exitIdx].t).toISOString(),
      entry, exit, pnl,
      win: pnl > 0,
      dd: signal.dd
    });
  }
  
  if (trades.length === 0) {
    console.log('No trades found!');
    return;
  }
  
  const wins = trades.filter(t => t.win);
  const losses = trades.filter(t => !t.win);
  const avgPnL = trades.reduce((a, t) => a + t.pnl, 0) / trades.length;
  const medianPnL = [...trades].sort((a, b) => a.pnl - b.pnl)[Math.floor(trades.length / 2)].pnl;
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, t) => a + t.pnl, 0) / losses.length : 0;
  
  console.log(`Results (${trades.length} trades):`);
  console.log(`  Win Rate: ${(wins.length / trades.length * 100).toFixed(1)}% (${wins.length}W/${losses.length}L)`);
  console.log(`  Avg Return: ${avgPnL.toFixed(3)}%`);
  console.log(`  Median Return: ${medianPnL.toFixed(3)}%`);
  console.log(`  Avg Win: ${avgWin.toFixed(3)}%`);
  console.log(`  Avg Loss: ${avgLoss.toFixed(3)}%`);
  if (avgLoss !== 0) console.log(`  Risk:Reward: ${Math.abs(avgWin / avgLoss).toFixed(2)}`);
  
  // Period split
  const mid = Math.floor(trades.length / 2);
  const p1 = trades.slice(0, mid);
  const p2 = trades.slice(mid);
  console.log(`\nPeriod Split:`);
  console.log(`  First Half (${p1.length} trades): ${(p1.reduce((a, t) => a + t.pnl, 0) / p1.length).toFixed(3)}% avg`);
  console.log(`  Second Half (${p2.length} trades): ${(p2.reduce((a, t) => a + t.pnl, 0) / p2.length).toFixed(3)}% avg`);
  
  // Fee sensitivity
  console.log(`\nFee Sensitivity:`);
  for (const fee of [0, 10, 20, 30, 40, 50, 60]) {
    const net = trades.map(t => t.pnl - fee / 10000).reduce((a, v) => a + v, 0) / trades.length;
    const pos = trades.filter(t => t.pnl > fee / 10000).length;
    console.log(`  ${fee}bps: net=${net.toFixed(3)}%/trade, WR=${(pos / trades.length * 100).toFixed(0)}%`);
  }
  
  // Annualized estimate
  const tradesPerDay = trades.length / (eth.length / 24);
  const annualReturn = avgPnL * tradesPerDay * 365;
  console.log(`\nAnnualized Estimate:`);
  console.log(`  Trades/day: ${tradesPerDay.toFixed(2)}`);
  console.log(`  Annual return (gross): ${annualReturn.toFixed(1)}%`);
  
  // Save trades
  writeFileSync(join(BASE_DIR, 'results-drawdown-1h-backtest.json'), JSON.stringify(trades, null, 2));
  
  // Save summary
  const summary = {
    strategy: 'ETH Drawdown Recovery 1H',
    config: { MIN_DD, LOOKBACK, HOLD, RED_CANDLE },
    results: {
      n: trades.length,
      wr: (wins.length / trades.length * 100).toFixed(1),
      avg: avgPnL.toFixed(3),
      median: medianPnL.toFixed(3),
      avgWin: avgWin.toFixed(3),
      avgLoss: avgLoss.toFixed(3),
      rr: avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : 'N/A',
      p1: (p1.reduce((a, t) => a + t.pnl, 0) / p1.length).toFixed(3),
      p2: (p2.reduce((a, t) => a + t.pnl, 0) / p2.length).toFixed(3),
      annualized: annualReturn.toFixed(1)
    },
    period: {
      start: eth[0].t,
      end: eth[eth.length - 1].t,
      candles: eth.length
    }
  };
  writeFileSync(join(BASE_DIR, 'results-drawdown-1h-summary.json'), JSON.stringify(summary, null, 2));
  
  console.log('\nResults saved to results-drawdown-1h-backtest.json');
  return trades;
}

async function liveMode() {
  console.log('\n=== LIVE MODE: ETH Drawdown Recovery 1H ===');
  console.log('Paper trading. Monitoring 1H candles...');
  console.log(`DD>=${MIN_DD}%, ${LOOKBACK}h lookback, ${HOLD}h hold\n`);
  
  mkdirSync(LOGS_DIR, { recursive: true });
  const logFile = join(LOGS_DIR, `live-${new Date().toISOString().slice(0, 10)}.log`);
  
  function log(msg) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${msg}`);
    appendFileSync(logFile, `[${ts}] ${msg}\n`);
  }
  
  // Load cached data
  let { eth, btc } = loadLocalData();
  log(`Loaded ${eth.length} cached ETH candles`);
  
  let lastCandleTime = eth.length > 0 ? eth[eth.length - 1].t : 0;
  
  while (true) {
    try {
      // Fetch latest candles
      const latestEth = await fetchKlines(ASSET, '1h', 100);
      const latestBtc = await fetchKlines(BTC_ASSET, '1h', 100);
      
      // Find new candles
      let newEth = [];
      for (const c of latestEth) {
        if (c.t > lastCandleTime) {
          newEth.push(c);
          if (lastCandleTime === 0 || c.t > lastCandleTime) {
            lastCandleTime = c.t;
          }
        }
      }
      
      if (newEth.length > 0) {
        log(`New ${newEth.length} candle(s). Current price: ${latestEth[latestEth.length-1].c.toFixed(2)}`);
        
        // Add to our data
        eth = eth.concat(newEth.filter(c => !eth.find(e => e.t === c.t)));
        btc = btc.concat(latestBtc.filter(c => !btc.find(e => e.t === c.t)));
        
        // Save updated data
        writeFileSync(join(DATA_DIR, 'ethusdt-1h-live.json'), JSON.stringify(eth));
        
        // Find current index
        const currentIndex = eth.length - 1;
        
        // Check for signal (at candle close - current candle is still forming)
        // Only check after candle closes
        if (state.position === 'FLAT') {
          // Check signal at previous candle (we need closed candles for lookback)
          for (let idx = currentIndex - 1; idx >= Math.max(LOOKBACK, currentIndex - 5); idx--) {
            // Only check candles we haven't checked before
            const signalKey = `sig_${eth[idx].t}`;
            if (state[signalKey]) continue;
            state[signalKey] = true;
            
            const signal = checkSignal(eth, btc, idx);
            if (signal) {
              log(`🚨 SIGNAL at ${new Date(eth[idx].t).toISOString()}`);
              log(`   Drawdown: ${signal.dd.toFixed(2)}%, Entry: ${signal.entryPrice.toFixed(2)}`);
              
              state.position = 'LONG';
              state.entryPrice = signal.entryPrice;
              state.entryCandleTime = eth[idx].t;
              state.entryIndex = idx;
              state.peakPrice = signal.entryPrice;
              state.trades++;
              
              log(`📝 ENTRY LONG @ ${signal.entryPrice.toFixed(2)}`);
              appendFileSync(logFile, JSON.stringify({
                event: 'ENTRY', price: signal.entryPrice,
                time: new Date().toISOString(),
                dd: signal.dd, equity: state.equity
              }) + '\n');
              break;
            }
          }
        }
        
        if (state.position === 'LONG') {
          const candlesHeld = currentIndex - state.entryIndex;
          state.peakPrice = Math.max(state.peakPrice, eth[currentIndex].c);
          
          if (candlesHeld >= HOLD) {
            const exitPrice = eth[currentIndex].c;
            const pnlPct = (exitPrice - state.entryPrice) / state.entryPrice * 100;
            const win = pnlPct > 0;
            
            state.trades++;
            state.totalPnLPct += pnlPct;
            state.equity = state.equity * (1 + pnlPct / 100);
            if (win) state.wins++;
            else state.losses++;
            
            log(`📤 EXIT after ${candlesHeld} candles (${HOLD}h hold)`);
            log(`   Exit: ${exitPrice.toFixed(2)}, PnL: ${pnlPct.toFixed(3)}% (${win ? 'WIN' : 'LOSS'})`);
            log(`   Equity: $${state.equity.toFixed(2)}, Total PnL: ${state.totalPnLPct.toFixed(2)}%`);
            
            appendFileSync(logFile, JSON.stringify({
              event: 'EXIT', price: exitPrice, time: new Date().toISOString(),
              pnlPct, candlesHeld, equity: state.equity
            }) + '\n');
            
            state.position = 'FLAT';
            state.entryPrice = 0;
            state.entryIndex = 0;
          } else {
            const unrealized = ((eth[currentIndex].c - state.entryPrice) / state.entryPrice * 100);
            log(`   HOLD: price ${eth[currentIndex].c.toFixed(2)}, held ${candlesHeld}/${HOLD}h, unrealized: ${unrealized.toFixed(3)}%`);
          }
        }
      }
      
      // Status every 30 min
      if (!state.lastPoll || Date.now() - state.lastPoll > 30 * 60 * 1000) {
        const price = latestEth[latestEth.length - 1].c;
        const status = state.position === 'LONG' 
          ? `LONG @ ${state.entryPrice.toFixed(2)} | ${((price - state.entryPrice) / state.entryPrice * 100).toFixed(2)}%`
          : 'FLAT';
        log(`STATUS | ${status} | Trades: ${state.trades} (${state.wins}W/${state.losses}L) | Equity: $${state.equity.toFixed(2)} | PnL: ${state.totalPnLPct.toFixed(2)}%`);
        state.lastPoll = Date.now();
      }
      
    } catch (err) {
      log(`ERROR: ${err.message}`);
    }
    
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

// Main
const mode = process.argv[2] || 'backtest';
if (mode === 'backtest') {
  await backtest();
} else if (mode === 'live') {
  await liveMode();
}
