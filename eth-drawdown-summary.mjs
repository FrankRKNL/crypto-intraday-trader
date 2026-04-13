#!/usr/bin/env node
/**
 * ETH Drawdown Recovery — Daily Summary Report
 * 
 * Reads state.json and generates a compact daily report
 * Usage: node eth-drawdown-summary.mjs [date]
 *        date format: YYYY-MM-DD (default: today)
 */

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, 'logs', 'eth-drawdown');
const STATE_FILE = join(__dirname, 'logs', 'eth-drawdown', 'state.json');
const REPORT_DIR = join(__dirname, 'logs', 'eth-drawdown', 'reports');

function log(msg) {
  console.log(msg);
}

function formatDate(unixTs) {
  return new Date(unixTs * 1000).toISOString().replace('T', ' ').split('.')[0];
}

function formatDateShort(unixTs) {
  return new Date(unixTs * 1000).toISOString().split('T')[0];
}

function getStatus(state, todayStr) {
  const todaySignals = state.signals.filter(s => formatDateShort(s.time) === todayStr);
  const todayTrades = state.trades.filter(t => formatDateShort(t.entryTime) === todayStr);
  
  if (state.trades.length === 0 && state.signals.length === 0) {
    return { label: 'NO SIGNALS', color: 'YELLOW' };
  }
  
  if (todaySignals.length === 0 && todayTrades.length === 0) {
    return { label: 'NO SIGNALS TODAY', color: 'YELLOW' };
  }
  
  // Check for errors in recent logs
  const logFile = join(LOG_DIR, `shadow-${todayStr}.log`);
  if (existsSync(logFile)) {
    const content = readFileSync(logFile, 'utf8');
    if (content.includes('ERROR') || content.includes('FATAL')) {
      return { label: 'WARNING', color: 'RED' };
    }
  }
  
  return { label: 'NORMAL', color: 'GREEN' };
}

function calculateStats(trades) {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgReturn: 0,
      medianReturn: 0,
      avgDuration: 0,
      maxAE: 0,
      maxFE: 0,
      worstAE: 0,
      bestFE: 0,
      totalPnL: 0,
    };
  }
  
  const returns = trades.map(t => t.netReturn);
  const wins = returns.filter(r => r > 0);
  const durations = trades.map(t => t.holdCandles * 15); // minutes
  const aes = trades.map(t => t.maxAE);
  const fes = trades.map(t => t.maxFE);
  
  const sorted = [...returns].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  return {
    totalTrades: trades.length,
    winRate: (wins.length / trades.length * 100).toFixed(0),
    avgReturn: (returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(4),
    medianReturn: median.toFixed(4),
    avgDuration: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0),
    maxAE: Math.min(...aes).toFixed(4),
    maxFE: Math.max(...fes).toFixed(4),
    worstAE: Math.min(...aes).toFixed(4),
    bestFE: Math.max(...fes).toFixed(4),
    totalPnL: returns.reduce((a, b) => a + b, 0).toFixed(4),
  };
}

function generateReport(dateStr = null) {
  const today = dateStr || new Date().toISOString().split('T')[0];
  
  log('═'.repeat(60));
  log('  ETH DRAWDOWN RECOVERY — DAILY SUMMARY');
  log(`  ${today}`);
  log('═'.repeat(60));
  
  // Load state
  if (!existsSync(STATE_FILE)) {
    log('ERROR: No state file found. Validator not running?');
    return;
  }
  
  let state;
  try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    log(`ERROR: Could not read state: ${e.message}`);
    return;
  }
  
  // Status
  const status = getStatus(state, today);
  const statusColor = status.color === 'GREEN' ? '✅' : status.color === 'YELLOW' ? '🟡' : '🔴';
  log(`\n  Status: ${statusColor} ${status.label}`);
  
  // Overall stats
  const allStats = calculateStats(state.trades);
  const todaySignals = state.signals.filter(s => formatDateShort(s.time) === today);
  const todayTrades = state.trades.filter(t => formatDateShort(t.entryTime) === today);
  const todayStats = calculateStats(todayTrades);
  
  log('\n  ── OVERALL ─────────────────────────────────────────────');
  log(`  Signals total:     ${state.signals.length.toString().padStart(4)}`);
  log(`  Trades total:      ${state.trades.length.toString().padStart(4)}`);
  log(`  Cumulative PnL:   ${state.cumulativePnL.toFixed(4).padStart(8)}%`);
  
  log('\n  ── TODAY ──────────────────────────────────────────────');
  log(`  Signals:           ${todaySignals.length.toString().padStart(4)}`);
  log(`  Trades:           ${todayTrades.length.toString().padStart(4)}`);
  log(`  Today's PnL:     ${todayStats.totalTrades > 0 ? todayStats.totalPnL : '0.0000'.padStart(8)}%`);
  
  log('\n  ── TRADE STATISTICS (all time) ─────────────────────────');
  log(`  Win rate:         ${(allStats.winRate + '%').padStart(8)}`);
  log(`  Avg return:       ${String(allStats.avgReturn).padStart(8)}%`);
  log(`  Median return:    ${String(allStats.medianReturn).padStart(8)}%`);
  log(`  Avg duration:     ${String(allStats.avgDuration).padStart(4)} min`);
  
  log('\n  ── RISK METRICS (all time) ───────────────────────────');
  log(`  Worst AE:         ${String(allStats.worstAE).padStart(8)}%`);
  log(`  Best FE:          ${String(allStats.bestFE).padStart(8)}%`);
  log(`  Avg AE:           ${String(allStats.maxAE).padStart(8)}%`);
  log(`  Avg FE:           ${String(allStats.maxFE).padStart(8)}%`);
  
  // Recent trades
  if (state.trades.length > 0) {
    const recent = [...state.trades].slice(-5).reverse();
    log('\n  ── RECENT TRADES ─────────────────────────────────────');
    log('  ID           Entry                 Exit                  Return    AE      FE');
    log('  ─────────────────────────────────────────────────────────────────────────');
    recent.forEach(t => {
      const id = t.id.substring(0, 12);
      const entry = formatDate(t.entryTime).substring(11, 19);
      const exit = formatDate(t.exitTime).substring(11, 19);
      const ret = (t.netReturn >= 0 ? '+' : '') + t.netReturn.toFixed(2);
      const ae = t.maxAE.toFixed(2);
      const fe = t.maxFE.toFixed(2);
      log(`  ${id.padEnd(12)} ${entry}  ${exit}  ${ret.padStart(7)}  ${ae.padStart(6)}  ${fe.padStart(6)}`);
    });
  }
  
  // Recent signals
  if (state.signals.length > 0) {
    const recentSig = [...state.signals].slice(-5).reverse();
    log('\n  ── RECENT SIGNALS ────────────────────────────────────');
    log('  Time                  Price       DD%     ATR%     BTC%');
    log('  ─────────────────────────────────────────────────────────');
    recentSig.forEach(s => {
      const time = formatDate(s.time).substring(11, 19);
      const price = s.ethPrice.toFixed(2);
      const dd = s.drawdown.toFixed(2);
      const atr = (s.atr * 100).toFixed(3);
      const btc = s.btcTrend.toFixed(2);
      log(`  ${time}  ${price.padStart(10)}  ${dd.padStart(5)}%  ${atr.padStart(6)}%  ${btc.padStart(6)}%`);
    });
  }
  
  log('\n' + '═'.repeat(60));
  
  // Write CSV
  const csvHeader = 'date,total_signals,total_trades,cumulative_pnl,win_rate,avg_return,median_return,avg_duration,worst_ae,best_fe,today_signals,today_trades,today_pnl,status\n';
  const csvRow = [
    today,
    state.signals.length,
    state.trades.length,
    state.cumulativePnL.toFixed(4),
    allStats.winRate,
    allStats.avgReturn,
    allStats.medianReturn,
    allStats.avgDuration,
    allStats.worstAE,
    allStats.bestFE,
    todaySignals.length,
    todayTrades.length,
    todayStats.totalPnL,
    status.label
  ].join(',');
  
  const csvFile = join(REPORT_DIR, `summary-${today}.csv`);
  const jsonFile = join(REPORT_DIR, `summary-${today}.json`);
  
  try {
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(csvFile, csvHeader + csvRow);
    writeFileSync(jsonFile, JSON.stringify({
      date: today,
      status: status.label,
      signals: state.signals.length,
      trades: state.trades.length,
      cumulativePnL: state.cumulativePnL,
      stats: allStats,
      today: {
        signals: todaySignals.length,
        trades: todayTrades.length,
        pnl: parseFloat(todayStats.totalPnL),
      },
      recentTrades: state.trades.slice(-10),
      recentSignals: state.signals.slice(-10),
    }, null, 2));
    log(`\n  Reports saved:`);
    log(`  - ${csvFile}`);
    log(`  - ${jsonFile}`);
  } catch (e) {
    log(`\n  Note: Could not write reports (${e.message})`);
  }
}

const dateArg = process.argv[2] || null;
generateReport(dateArg);
