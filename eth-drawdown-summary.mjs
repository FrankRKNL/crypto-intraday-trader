#!/usr/bin/env node
/**
 * ETH Drawdown Shadow Validator - Daily Summary Report
 * 
 * Generates a compact daily summary from logs/state for quick health check.
 * Output: terminal (human-readable) + JSON file per day
 * 
 * Usage: node eth-drawdown-summary.mjs [YYYY-MM-DD]
 *        Defaults to today if no date given.
 */

import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, 'logs');
const REPORTS_DIR = join(__dirname, 'logs/daily');

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadJSON(filepath) {
  try {
    return JSON.parse(readFileSync(filepath, 'utf8'));
  } catch {
    return null;
  }
}

function fmt(n, decimals = 2) {
  return typeof n === 'number' ? n.toFixed(decimals) : 'N/A';
}

function fmtDuration(ms) {
  if (!ms || ms === 0) return 'N/A';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pad(str, len = 20) {
  return String(str).padEnd(len).slice(0, len);
}

// ── Date arg ──────────────────────────────────────────────────────────────────

const dateArg = process.argv[2] || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// ── Load state & events ───────────────────────────────────────────────────────

const state = loadJSON(join(LOGS_DIR, 'eth-shadow-state.json'));
const stateHistory = loadJSON(join(LOGS_DIR, 'eth-shadow-state-history.json'));
const dailyEventsPath = join(LOGS_DIR, 'daily', `events-${dateArg}.json`);
const dailyEvents = loadJSON(dailyEventsPath) || [];

const signals = (stateHistory?.signals || []).filter(s => s.time?.startsWith(dateArg));
const trades = (stateHistory?.trades || []).filter(t => 
  t.entryTime?.startsWith(dateArg) || t.exitTime?.startsWith(dateArg)
);

// Also check for ongoing trade from current state
const currentTrade = state?.inTrade ? {
  entryPrice: state.entryPrice,
  entryTime: state.entryTime,
  peakPrice: state.peakPrice,
  currentPrice: state.currentPrice,
  trailLevel: state.trailLevel,
  stopHit: state.stopHit,
  stopReason: state.stopReason,
} : null;

// Compute realized trades (exited)
const closedTrades = trades.filter(t => t.exitTime);
const openTrades = trades.filter(t => !t.exitTime);

// ── Compute metrics ─────────────────────────────────────────────────────────────

const realizedPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
const unrealizedPnL = currentTrade 
  ? ((currentTrade.currentPrice - currentTrade.entryPrice) / currentTrade.entryPrice * 100)
  : 0;

// Trade durations
const durations = closedTrades.map(t => t.exitTime && t.entryTime 
  ? new Date(t.exitTime) - new Date(t.entryTime) 
  : 0
).filter(d => d > 0);

const avgDuration = durations.length > 0 
  ? durations.reduce((a, b) => a + b, 0) / durations.length 
  : 0;

// MAE / MFE (from closed trades that have entry/exit prices)
const maeList = closedTrades.map(t => t.mae).filter(v => v != null);
const mfeList = closedTrades.map(t => t.mfe).filter(v => v != null);
const maxAE = maeList.length > 0 ? Math.max(...maeList) : null;
const maxFE = mfeList.length > 0 ? Math.max(...mfeList) : null;
const avgAE = maeList.length > 0 ? maeList.reduce((a, b) => a + b, 0) / maeList.length : null;

// ── Error / edge case detection ────────────────────────────────────────────────

const errors = dailyEvents.filter(e => e.type === 'error' || e.type === 'warning');
const warnings = dailyEvents.filter(e => e.type === 'warning');
const edgeCases = dailyEvents.filter(e => e.type === 'edge_case' || e.type === 'edge-case');

// ── Status determination ───────────────────────────────────────────────────────

let status = 'NORMAL';
if (errors.length > 0) status = 'ERROR';
else if (warnings.length > 0) status = 'WARNING';
else if (signals.length === 0 && trades.length === 0) status = 'NO SIGNALS';

const allEvents = dailyEvents.filter(e => e.type !== 'log');
const recentErrors = allEvents.filter(e => e.level === 'error');

// ── Print terminal report ──────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════');
console.log(`  ETH DRAWDOWN SHADOW VALIDATOR — Daily Summary`);
console.log(`  ${dateArg}  |  Generated: ${new Date().toISOString().slice(11, 19)} UTC`);
console.log('═══════════════════════════════════════════════════════\n');

console.log(`  [SIGNALS]        ${pad(signals.length.toString(), 6)} detected today`);
console.log(`  [TRADES]         ${pad(`${openTrades.length} open / ${closedTrades.length} closed`, 20)}`);
console.log(`  [REALIZED PnL]   ${fmt(realizedPnL, 4)}%`);
console.log(`  [UNREALIZED PnL] ${unrealizedPnL !== 0 ? fmt(unrealizedPnL, 4) + '%' : 'N/A (no open position)'}\n`);

console.log(`  [AVG DURATION]   ${fmtDuration(avgDuration)}`);
console.log(`  [MAX ADVERSE]    ${maxAE !== null ? fmt(maxAE, 4) + '%' : 'N/A'}`);
console.log(`  [MAX FAVORABLE]  ${maxFE !== null ? fmt(maxFE, 4) + '%' : 'N/A'}`);
console.log(`  [AVG ADVERSE]    ${avgAE !== null ? fmt(avgAE, 4) + '%' : 'N/A'}\n`);

if (currentTrade) {
  const tradeAge = new Date() - new Date(currentTrade.entryTime);
  console.log(`  [CURRENT TRADE]`);
  console.log(`    Entry:     $${fmt(currentTrade.entryPrice)} @ ${currentTrade.entryTime?.slice(11, 19)}`);
  console.log(`    Current:   $${fmt(currentTrade.currentPrice)} (${fmt((currentTrade.currentPrice - currentTrade.entryPrice) / currentTrade.entryPrice * 100, 4)}%)`);
  console.log(`    Peak:      $${fmt(currentTrade.peakPrice)}`);
  console.log(`    Trail:     $${fmt(currentTrade.trailLevel)}`);
  console.log(`    Age:       ${fmtDuration(tradeAge)}`);
  if (currentTrade.stopHit) console.log(`    Stop:      HIT — ${currentTrade.stopReason || 'unknown'}`);
  console.log();
}

if (errors.length > 0) {
  console.log(`  [ERRORS]         ${errors.length} total`);
  errors.slice(0, 3).forEach(e => console.log(`    ⚠  ${e.msg || e.message || JSON.stringify(e)}`));
  console.log();
}
if (warnings.length > 0) {
  console.log(`  [WARNINGS]       ${warnings.length} total`);
  warnings.slice(0, 3).forEach(e => console.log(`    ⚑  ${e.msg || e.message || JSON.stringify(e)}`));
  console.log();
}
if (edgeCases.length > 0) {
  console.log(`  [EDGE CASES]     ${edgeCases.length} total`);
  edgeCases.slice(0, 3).forEach(e => console.log(`    ◇  ${e.msg || JSON.stringify(e)}`));
  console.log();
}

// Status line
const statusIcon = status === 'NORMAL' ? '✅' : status === 'NO SIGNALS' ? '⭕' : status === 'WARNING' ? '⚠️' : '❌';
console.log(`  ─────────────────────────────────────────────────────`);
console.log(`  STATUS:  ${statusIcon}  ${status}`);
console.log('═══════════════════════════════════════════════════════\n');

// ── Write JSON report ─────────────────────────────────────────────────────────

try { mkdirSync(REPORTS_DIR, { recursive: true }); } catch {}

const report = {
  date: dateArg,
  generatedAt: new Date().toISOString(),
  summary: {
    signalsDetected: signals.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    realizedPnL: parseFloat(fmt(realizedPnL, 4)),
    unrealizedPnL: parseFloat(fmt(unrealizedPnL, 4)),
    avgDurationMs: avgDuration,
    maxAdverseExcursion: maxAE !== null ? parseFloat(fmt(maxAE, 4)) : null,
    maxFavorableExcursion: maxFE !== null ? parseFloat(fmt(maxFE, 4)) : null,
    avgAdverseExcursion: avgAE !== null ? parseFloat(fmt(avgAE, 4)) : null,
  },
  currentTrade: currentTrade ? {
    entryPrice: currentTrade.entryPrice,
    entryTime: currentTrade.entryTime,
    peakPrice: currentTrade.peakPrice,
    currentPrice: currentTrade.currentPrice,
    trailLevel: currentTrade.trailLevel,
    unrealizedPnL: parseFloat(fmt(unrealizedPnL, 4)),
    ageMs: currentTrade ? new Date() - new Date(currentTrade.entryTime) : null,
    stopHit: currentTrade.stopHit || false,
    stopReason: currentTrade.stopReason || null,
  } : null,
  errors: errors.map(e => ({ msg: e.msg || e.message || JSON.stringify(e), time: e.time })),
  warnings: warnings.map(e => ({ msg: e.msg || e.message || JSON.stringify(e), time: e.time })),
  edgeCases: edgeCases.map(e => ({ msg: e.msg || JSON.stringify(e), time: e.time })),
  closedTradeDetails: closedTrades.map(t => ({
    entryTime: t.entryTime,
    exitTime: t.exitTime,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    pnl: t.pnl,
    mae: t.mae,
    mfe: t.mfe,
    exitReason: t.exitReason,
    holdingPeriodMs: t.exitTime ? new Date(t.exitTime) - new Date(t.entryTime) : null,
  })),
  status,
};

const jsonPath = join(REPORTS_DIR, `summary-${dateArg}.json`);
import { writeFileSync } from 'fs';
writeFileSync(jsonPath, JSON.stringify(report, null, 2));
console.log(`  📄 JSON report: ${jsonPath}\n`);