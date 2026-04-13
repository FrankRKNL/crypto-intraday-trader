/**
 * ETH Red Candle Drawdown Recovery — Falsification on 15m (83d dataset)
 * Same logic as 1h version, but on 15m candles:
 *   Event: ETH drops >= 3% in 4 consecutive 15m candles
 *   Filter: Last candle closes RED
 *   Entry: Buy at close of last candle (next candle open)
 *   Exit:  EXACTLY 2 hours later (8 candles)
 */

import { readFileSync } from 'fs';

const raw = JSON.parse(readFileSync('/home/node/.openclaw/workspace/crypto-intraday-trader/data/ethusdt-15m-90d.json', 'utf-8'));
// Normalize to object format
const data = raw.map(c => typeof c.t !== 'undefined' ? c : { t: c[0], o: parseFloat(c[1]), h: parseFloat(c[2]), l: parseFloat(c[3]), c: parseFloat(c[4]), v: parseFloat(c[5]) });
console.log(`Loaded ${data.length} ETH 15m candles (${(data.length/4/24).toFixed(1)} days)`);
console.log(`Period: ${new Date(data[0].t).toISOString()} to ${new Date(data[data.length-1].t).toISOString()}`);

function calcATR(candles, period = 14) {
  let trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].h || candles[i].high, l = candles[i].l || candles[i].low;
    const pc = candles[i-1].c || candles[i-1].close;
    const c = candles[i].c || candles[i].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function o(c) { return c.o || c.open; }
function h(c) { return c.h || c.high; }
function l(c) { return c.l || c.low; }
function c(c) { return c.c || c.close; }

// Split into two periods (P1: first 41 days, P2: last 42 days)
const midIdx = Math.floor(data.length / 2);

// =====================================================================
// BASELINE + REGIME + WORST CASE + DISTRIBUTION + EXECUTION
// =====================================================================
function runAll(label, candles, startIdx = 0, endIdx = candles.length) {
  const slice = candles.slice(startIdx, endIdx);
  console.log(`\n=== ${label} (n=${slice.length} candles, ${(slice.length/4/24).toFixed(1)} days) ===`);

  const trades = [];
  for (let i = 4; i < slice.length - 9; i++) {
    const startPrice = c(slice[i - 4]);
    const endPrice = c(slice[i]);
    const drawdown = (startPrice - endPrice) / startPrice;
    if (drawdown < 0.03) continue;

    const lastCandle = slice[i];
    if (c(lastCandle) >= o(lastCandle)) continue; // not red

    // Entry: next candle open
    const entryCandle = slice[i + 1];
    const entryPrice = o(entryCandle);

    // Exit: exactly 8 candles later (2 hours)
    const exitCandle = slice[i + 9];
    if (!exitCandle) continue;
    const exitPrice = c(exitCandle);

    const ret = (exitPrice - entryPrice) / entryPrice;

    // ATR at entry
    const atrLookback = slice.slice(Math.max(0, i - 14), i + 1);
    const atr = calcATR(atrLookback);
    const atrPercent = atr / entryPrice;

    // Adverse excursion
    let maxAE = 0;
    for (let j = i + 1; j <= i + 9; j++) {
      const lowInHold = l(slice[j]);
      const ae = (lowInHold - entryPrice) / entryPrice;
      if (ae < maxAE) maxAE = ae;
    }

    trades.push({
      entryTime: slice[i + 1].t,
      entryPrice,
      exitPrice,
      return: ret,
      maxAE,
      atrPercent,
      drawdown,
    });
  }

  if (trades.length < 5) {
    console.log('  Too few trades to analyze');
    return trades;
  }

  const rets = trades.map(t => t.return);
  const sorted = [...rets].sort((a, b) => a - b);
  const wins = rets.filter(r => r > 0);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  console.log(`  n=${trades.length} | WR=${(wins.length/rets.length*100).toFixed(0)}% | mean=${(mean*100).toFixed(2)}% | median=${(median*100).toFixed(2)}% | std=${(Math.sqrt(rets.map(r=>(r-mean)**2).reduce((a,b)=>a+b,0)/rets.length)*100).toFixed(2)}%`);

  // By ATR
  console.log('  By ATR:');
  const lowVol = trades.filter(t => t.atrPercent < 0.005);
  const medVol = trades.filter(t => t.atrPercent >= 0.005 && t.atrPercent < 0.01);
  const highVol = trades.filter(t => t.atrPercent >= 0.01);
  for (const [g, label] of [[lowVol, '<0.5%'],[medVol,'0.5-1%'],[highVol,'>=1%']]) {
    if (g.length < 2) continue;
    const gr = g.map(t=>t.return);
    const gw = gr.filter(r=>r>0);
    console.log(`    ${label}: n=${g.length}, WR=${(gw.length/gr.length*100).toFixed(0)}%, mean=${(gr.reduce((a,b)=>a+b,0)/gr.length*100).toFixed(2)}%`);
  }

  // Worst trades
  const worst5 = [...trades].sort((a,b)=>a.return-b.return).slice(0,5);
  console.log('  Worst 5 returns:', worst5.map(t=>(t.return*100).toFixed(2)+'%').join(', '));

  // AE
  const aes = trades.map(t=>t.maxAE).sort((a,b)=>a-b);
  console.log(`  AE P5=${(aes[Math.floor(aes.length*0.05)]*100).toFixed(2)}%, P10=${(aes[Math.floor(aes.length*0.10)]*100).toFixed(2)}%, median=${(aes[Math.floor(aes.length*0.5)]*100).toFixed(2)}%`);

  // Execution
  function sim(feeBp=0, slipBp=0, entryDelay=0, exitDelay=0) {
    let wins=0, total=0, rets2=[];
    for (let i = 4; i < slice.length - 9 - entryDelay - exitDelay; i++) {
      const sp = c(slice[i-4]), ep = c(slice[i]);
      if ((sp-ep)/sp < 0.03) continue;
      if (c(slice[i]) >= o(slice[i])) continue;
      const ei = i+1+entryDelay, xi = i+9+entryDelay+exitDelay;
      if (xi >= slice.length) continue;
      const eprice = o(slice[ei]) * (1+slipBp/10000);
      const xprice = c(slice[xi]);
      const ret = (xprice - eprice - eprice*feeBp/10000 - xprice*feeBp/10000) / eprice;
      if (ret > 0) wins++;
      total += ret; rets2.push(ret);
    }
    rets2.sort((a,b)=>a-b);
    return { n: rets2.length, wr: (wins/rets2.length*100).toFixed(0), mean: (total/rets2.length*100).toFixed(2), median: (rets2[Math.floor(rets2.length/2)]*100).toFixed(2) };
  }
  console.log('  Execution: baseline WR=' + sim().wr + ' mean=' + sim().mean + ' | +15bp+10bp: WR=' + sim(15,10,1,1).wr + ' mean=' + sim(15,10,1,1).mean + ' | +30bp+20bp: WR=' + sim(30,20,1,1).wr + ' mean=' + sim(30,20,1,1).mean);

  return trades;
}

// Run on FULL 15m dataset
const allTrades = runAll('FULL 15m (83d)', data, 0, data.length);

// Run P1 and P2
const p1Trades = runAll('P1 (first half)', data, 0, midIdx);
const p2Trades = runAll('P2 (second half)', data, midIdx);

// Combined summary
console.log('\n=== CROSS-PERIOD VALIDATION ===');
console.log(`Full: n=${allTrades.length}`);
console.log(`P1: n=${p1Trades.length}`);
console.log(`P2: n=${p2Trades.length}`);
if (p1Trades.length > 2 && p2Trades.length > 2) {
  const p1m = p1Trades.reduce((a,b)=>a+b.return,0)/p1Trades.length;
  const p2m = p2Trades.reduce((a,b)=>a+b.return,0)/p2Trades.length;
  console.log(`P1 mean: ${(p1m*100).toFixed(2)}% | P2 mean: ${(p2m*100).toFixed(2)}%`);
  console.log(`Both positive: ${p1m>0 && p2m>0 ? 'YES' : 'NO — FALSIFIED'}`);
}
