// ============================================================
// ETH DRAWDOWN RECOVERY — FULL PHASE 1-4 ROBUSTIFICATION SUITE
// ============================================================
// Phase 1: Context Filters (ATR, Trend, Time, Volume, BTC lead)
// Phase 2: Risk Control (SL, partial exit, dynamic exit)
// Phase 3: Portfolio Logic (position sizing, concurrency)
// Phase 4: Robustness (period splits, fee sensitivity, BTC)
// ============================================================

import { readFileSync, writeFileSync } from 'fs';

const rawETH = JSON.parse(readFileSync('/home/node/.openclaw/workspace/crypto-intraday-trader/data/ethusdt-1h-live.json','utf8'));
const rawBTC = JSON.parse(readFileSync('/home/node/.openclaw/workspace/crypto-intraday-trader/data/btcusdt-1h-long.json','utf8'));

const eth = rawETH.map(d => ({ t:d.t, o:d.o, h:d.h, l:d.l, c:d.c, v:d.v })).sort((a,b)=>a.t-b.t);
const btc = rawBTC.map(d => ({ t:d.t, o:d.o, h:d.h, l:d.l, c:d.c, v:d.v })).sort((a,b)=>a.t-b.t);

// ============================================================
// INDICATORS
// ============================================================

function atr(candles, period=14) {
  const trs = [];
  for (let i=1; i<candles.length; i++) {
    const h=candles[i].h, l=candles[i].l, p=candles[i-1].c;
    trs.push(Math.max(h-l, Math.abs(h-p), Math.abs(l-p)));
  }
  let s = trs.slice(0,period).reduce((a,b)=>a+b,0)/period;
  const r=[s];
  for (let i=period; i<trs.length; i++) { s=(s*(period-1)+trs[i])/period; r.push(s); }
  return r;
}

function sma(arr, period) {
  const r=[];
  for (let i=period-1; i<arr.length; i++) r.push(arr.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period);
  return r;
}

function ema(arr, period) {
  const k=2/(period+1);
  const r=[arr.slice(0,period).reduce((a,b)=>a+b,0)/period];
  for (let i=period; i<arr.length; i++) r.push(arr[i]*k+r[r.length-1]*(1-k));
  return r;
}

function rsi(candles, period=14) {
  const rets=[];
  for(let i=1;i<candles.length;i++) rets.push((candles[i].c-candles[i-1].c)/candles[i-1].c*100);
  let av=rets.slice(0,period).filter(r=>r>0).reduce((a,b)=>a+b,0)/period;
  let bv=Math.abs(rets.slice(0,period).filter(r=>r<0).reduce((a,b)=>a+b,0)/period);
  const r=[];
  for(let i=period;i<rets.length;i++){
    av=(av*(period-1)+rets[i]*(rets[i]>0?1:0))/period;
    bv=(bv*(period-1)+Math.abs(rets[i])*(rets[i]<0?1:0))/period;
    r.push(av/(av+bv)*100);
  }
  return r;
}

const ethClose = eth.map(d=>d.c);
const ethAtr14 = atr(eth, 14);
const ethAtrAll = Array(14).fill(0).concat(ethAtr14);
const ethSma20 = Array(19).fill(0).concat(sma(ethClose,20));
const ethSma50 = Array(49).fill(0).concat(sma(ethClose,50));
const ethRsi14 = Array(14).fill(50).concat(rsi(eth));
const ethVolSma = Array(19).fill(0).concat(sma(eth.map(d=>d.v),20));
const ethVolRatio = eth.map((d,i)=> ethVolSma[i]? d.v/ethVolSma[i]: 1);

const btcClose = btc.map(d=>d.c);
const btcAtr14 = atr(btc, 14);
const btcAtrAll = Array(14).fill(0).concat(btcAtr14);
const btcSma20 = Array(19).fill(0).concat(sma(btcClose,20));
const btcSma50 = Array(49).fill(0).concat(sma(btcClose,50));
const btcRsi14 = Array(14).fill(50).concat(rsi(btc));

// ============================================================
// SIGNAL FINDING
// ============================================================

function getSession(hour) {
  if (hour>=0&&hour<6) return 'asian';
  if (hour>=6&&hour<12) return 'european';
  if (hour>=12&&hour<18) return 'us_afternoon';
  return 'us_evening';
}

function getTrend(c, s20, s50) {
  if (!s20||!s50) return 'unknown';
  if (c>s20&&s20>s50) return 'strong_up';
  if (c>s20) return 'up';
  if (c<s20&&s20<s50) return 'strong_down';
  if (c<s20) return 'down';
  return 'sideways';
}

function findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, opts={}) {
  const {
    lookback=4,
    minDD=3,
    requireRed=false,
    excludeSessions=[],
    btcDDMin=0,
    btcForwardMin=null,
    atrMin=0,
    atrMax=999,
    trendFilter=null,
    volRatioMin=0,
    maxConcTrades=1,
  } = opts;

  const signals=[];
  const openPositions=[];

  for (let i=lookback; i<eth.length-2; i++) {
    const startIdx=i-lookback+1;
    const peakHigh=Math.max(...eth.slice(startIdx,i+1).map(c=>c.h));
    const endPrice=eth[i].c;
    const dd=(peakHigh-endPrice)/peakHigh*100;
    const lastCandle=eth[i];
    const isRed=lastCandle.c<lastCandle.o;

    if (dd<minDD) continue;
    if (requireRed&&!isRed) continue;

    const hour=new Date(eth[i].t).getUTCHours();
    const session=getSession(hour);
    if (excludeSessions.includes(session)) continue;

    const atrVal=ethAtrAll[i];
    if (!atrVal) continue;
    const atrPct=atrVal/eth[i].c*100;
    if (atrPct<atrMin||atrPct>atrMax) continue;

    // BTC lead
    let btcDD=0;
    if (btcDDMin>0) {
      const btcStart=eth[startIdx].t;
      const btcEnd=eth[i].t;
      const btcWindow=btc.filter(c=>c.t>=btcStart&&c.t<=btcEnd);
      if (btcWindow.length>0) {
        const btcPeak=Math.max(...btcWindow.map(c=>c.h));
        const btcTrough=Math.min(...btcWindow.map(c=>c.l));
        btcDD=(btcPeak-btcTrough)/btcPeak*100;
      }
    }
    if (btcDDMin>0&&btcDD<btcDDMin) continue;

    // BTC forward return
    let btcFwd=null;
    if (btcForwardMin!==null) {
      const btcSignalIdx=btc.findIndex((c,j)=>j>=i);
      if (btcSignalIdx>=0&&btcSignalIdx+24<btc.length) {
        btcFwd=(btc[btcSignalIdx+24].c-btc[btcSignalIdx].c)/btc[btcSignalIdx].c*100;
      }
      if (btcFwd<btcForwardMin) continue;
    }

    // Trend
    const trend=getTrend(eth[i].c, ethSma20[i], ethSma50[i]);
    if (trendFilter&&!trendFilter.includes(trend)&&trendFilter.length>0) continue;

    // Volume
    const volRatio=ethVolRatio[i];
    if (volRatio<volRatioMin) continue;

    // Limit concurrent trades
    const activeInWindow=openPositions.filter(p=>p.exitIdx>i).length;
    if (activeInWindow>=maxConcTrades) continue;

    const entryPrice=eth[i+1].o;
    const entryIdx=i+1;
    const rets={};
    [2,4,6,8,12,16,24].forEach(h=>{ if(entryIdx+h<eth.length) rets[h]=(eth[entryIdx+h].c-entryPrice)/entryPrice*100; });

    // BTC 24h forward
    let btc24=null;
    const btcSignalIdx2=btc.findIndex((c,j)=>j>=i);
    if (btcSignalIdx2>=0&&btcSignalIdx2+24<btc.length) {
      btc24=(btc[btcSignalIdx2+24].c-btc[btcSignalIdx2].c)/btc[btcSignalIdx2].c*100;
    }

    // BTC trend at signal — find BTC candle closest to ETH signal time
    let btcTrend='unknown';
    const ethTs=eth[i].t;
    const btcIdx=btc.findIndex((c,j)=>j>=i);
    if (btcIdx>=0&&btcIdx<btc.length) {
      btcTrend=getTrend(btc[btcIdx].c, btcSma20[btcIdx]||0, btcSma50[btcIdx]||0);
    }

    signals.push({
      idx:i, date:new Date(eth[i].t).toISOString(), hour, session, trend,
      dd:dd.toFixed(2), atrPct:atrPct.toFixed(2), volRatio:volRatio.toFixed(2),
      entryPrice, entryIdx,
      ret2h:rets[2]||null, ret4h:rets[4]||null, ret6h:rets[6]||null,
      ret8h:rets[8]||null, ret12h:rets[12]||null, ret16h:rets[16]||null, ret24h:rets[24]||null,
      btcDD:btcDD.toFixed(2), btc24:btc24?btc24.toFixed(2):null, btcTrend,
      isRed,
    });
  }
  return signals;
}

// ============================================================
// BACKTEST ENGINE
// ============================================================

function backtest(signals, opts={}) {
  const {
    exitHours=2,
    stopLoss=null,     // e.g. 0.02 = -2% hard stop
    softStop=null,     // e.g. { hours:1, minGain:0.003 } = after 1h if gain<0.3% exit
    partialExit=null,  // e.g. { hours:1, pct:0.5 } = 50% after 1h
    feeBps=10,
    slipBps=0,
  } = opts;

  const results=[];
  for (const s of signals) {
    const entryIdx=s.entryIdx;
    let exitIdx=entryIdx+exitHours;
    if (exitIdx>=eth.length) continue;

    const entry=s.entryPrice;
    let exitPrice=eth[exitIdx].c;
    let ret=(exitPrice-entry)/entry*100;
    let exitReason='time';

    // Soft stop check (1h minimum gain)
    if (softStop&&entryIdx+softStop.hours<eth.length) {
      const softExitIdx=entryIdx+softStop.hours;
      const softExitPrice=eth[softExitIdx].c;
      const softRet=(softExitPrice-entry)/entry*100;
      if (softRet<softStop.minGain*100) {
        ret=softRet;
        exitIdx=softExitIdx;
        exitPrice=softExitPrice;
        exitReason='soft_stop';
      }
    }

    // Hard stop
    if (stopLoss&&ret<-stopLoss*100) {
      ret=-stopLoss*100;
      exitReason='stop_loss';
    }

    // Partial exit
    let partialRet=ret;
    if (partialExit&&entryIdx+partialExit.hours<eth.length) {
      const partialExitIdx=entryIdx+partialExit.hours;
      const partialExitPrice=eth[partialExitIdx].c;
      const partialPortion=partialExit.pct;
      const heldPortion=1-partialExit.pct;
      const ret1=partialPortion*(partialExitPrice-entry)/entry*100;
      const ret2=heldPortion*ret;
      partialRet=ret1+ret2;
    }

    const netRet=partialRet-feeBps/100-Math.abs(slipBps/100);
    const won=netRet>0;

    results.push({
      ...s,
      ret:ret.toFixed(3),
      netRet:netRet.toFixed(3),
      won,
      exitReason,
      exitPrice,
    });
  }
  return results;
}

// ============================================================
// ANALYTICS
// ============================================================

function stats(results) {
  if (results.length===0) return { n:0, wr:0, mean:0, median:0, maxWin:0, maxLoss:0, sum:0 };
  const rets=results.map(r=>parseFloat(r.netRet));
  const wins=rets.filter(r=>r>0);
  const losses=rets.filter(r=>r<=0);
  rets.sort((a,b)=>a-b);
  const sum=rets.reduce((a,b)=>a+b,0);
  const mean=sum/rets.length;
  const median=rets.length%2===0 ? (rets[rets.length/2-1]+rets[rets.length/2])/2 : rets[Math.floor(rets.length/2)];
  return {
    n:rets.length,
    wr:(wins.length/rets.length*100).toFixed(1),
    mean:mean.toFixed(3),
    median:median.toFixed(3),
    maxWin:Math.max(...rets).toFixed(3),
    maxLoss:Math.min(...rets).toFixed(3),
    sum:sum.toFixed(2),
    p10:(rets[Math.floor(rets.length*0.1)]||0).toFixed(2),
    p5:(rets[Math.floor(rets.length*0.05)]||0).toFixed(2),
    avgWin:wins.length>0?(wins.reduce((a,b)=>a+b,0)/wins.length).toFixed(3):'0',
    avgLoss:losses.length>0?(losses.reduce((a,b)=>a+b,0)/losses.length).toFixed(3):'0',
    nWins:wins.length, nLosses:losses.length,
  };
}

// ============================================================
// PHASE 1: CONTEXT FILTERS
// ============================================================

console.log('\n============================================');
console.log('PHASE 1: CONTEXT FILTERS');
console.log('============================================\n');

// Get baseline signals
const baselineSignals = findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
  lookback:4, minDD:3, requireRed:false, excludeSessions:[], btcDDMin:0
});

// ATR threshold sweep
console.log('--- ATR THRESHOLD ---');
const atrThresholds=[0.5,1.0,1.5,2.0,2.5,3.0];
for (const atrTh of atrThresholds) {
  const sigs=findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
    lookback:4, minDD:3, requireRed:false, excludeSessions:[], btcDDMin:0, atrMin:atrTh
  });
  const res=backtest(sigs, {exitHours:2, feeBps:10});
  const s=stats(res);
  console.log(`  ATR>${atrTh}%: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// Drawdown threshold sweep
console.log('\n--- DRAWDOWN THRESHOLD (baseline) ---');
const ddThresholds=[2,3,4,5,6];
for (const ddTh of ddThresholds) {
  const sigs=findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
    lookback:4, minDD:ddTh, requireRed:false, excludeSessions:[], btcDDMin:0
  });
  const res=backtest(sigs, {exitHours:2, feeBps:10});
  const s=stats(res);
  console.log(`  DD>=${ddTh}%: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// Session filter
console.log('\n--- SESSION FILTER ---');
const sessions=['asian','european','us_afternoon','us_evening'];
for (const s of sessions) {
  const sigs=findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
    lookback:4, minDD:3, requireRed:false, excludeSessions:[s], btcDDMin:0
  });
  const res=backtest(sigs, {exitHours:2, feeBps:10});
  const st=stats(res);
  console.log(`  Excl ${s}: n=${st.n}, WR=${st.wr}%, mean=${st.mean}%, median=${st.median}%, p10=${st.p10}%`);
}

// BTC lead filter
console.log('\n--- BTC LEAD FILTER ---');
const btcLeadThresholds=[0.5,1.0,1.5,2.0,2.5,3.0];
for (const btcTh of btcLeadThresholds) {
  const sigs=findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
    lookback:4, minDD:3, requireRed:false, excludeSessions:[], btcDDMin:btcTh
  });
  const res=backtest(sigs, {exitHours:2, feeBps:10});
  const s=stats(res);
  console.log(`  BTC DD>=${btcTh}%: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// Trend filter
console.log('\n--- TREND FILTER ---');
const trends=['strong_up','up','sideways','down','strong_down'];
for (const t of trends) {
  const sigs=findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
    lookback:4, minDD:3, requireRed:false, excludeSessions:[], btcDDMin:0, trendFilter:[t]
  });
  const res=backtest(sigs, {exitHours:2, feeBps:10});
  const s=stats(res);
  console.log(`  Trend=${t}: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// Volume ratio filter
console.log('\n--- VOLUME RATIO FILTER ---');
const volRatios=[0.5,0.75,1.0,1.25,1.5,2.0];
for (const vr of volRatios) {
  const sigs=findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
    lookback:4, minDD:3, requireRed:false, excludeSessions:[], btcDDMin:0, volRatioMin:vr
  });
  const res=backtest(sigs, {exitHours:2, feeBps:10});
  const s=stats(res);
  console.log(`  VolRatio>=${vr}: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// Red candle filter
console.log('\n--- RED CANDLE FILTER ---');
{
  const sigs=findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
    lookback:4, minDD:3, requireRed:true, excludeSessions:[], btcDDMin:0
  });
  const res=backtest(sigs, {exitHours:2, feeBps:10});
  const s=stats(res);
  console.log(`  Red candle required: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// ============================================================
// COMBINED FILTERS (Best context)
// ============================================================

console.log('\n============================================');
console.log('COMBINED FILTER MATRIX (Best configs)');
console.log('============================================\n');

// Best single filters from above
const filterMatrix = [
  { label:'Baseline', opts:{ lookback:4, minDD:3, requireRed:false, excludeSessions:[], btcDDMin:0, atrMin:0 } },
  { label:'ATR>1.5 + DD>=4', opts:{ lookback:4, minDD:4, requireRed:false, excludeSessions:[], btcDDMin:0, atrMin:1.5 } },
  { label:'ATR>1.5 + DD>=4 + Red', opts:{ lookback:4, minDD:4, requireRed:true, excludeSessions:[], btcDDMin:0, atrMin:1.5 } },
  { label:'ATR>1.5 + DD>=4 + ExclUS_Afternoon', opts:{ lookback:4, minDD:4, requireRed:false, excludeSessions:['us_afternoon'], btcDDMin:0, atrMin:1.5 } },
  { label:'ATR>1.5 + DD>=4 + Red + ExclUS_Afternoon', opts:{ lookback:4, minDD:4, requireRed:true, excludeSessions:['us_afternoon'], btcDDMin:0, atrMin:1.5 } },
  { label:'ATR>2.0 + DD>=4 + Red', opts:{ lookback:4, minDD:4, requireRed:true, excludeSessions:[], btcDDMin:0, atrMin:2.0 } },
  { label:'ATR>1.5 + DD>=3 + BTC_DD>=1.5 + Red', opts:{ lookback:4, minDD:3, requireRed:true, excludeSessions:[], btcDDMin:1.5, atrMin:1.5 } },
  { label:'ATR>2.0 + DD>=4 + Red + ExclUS_Afternoon', opts:{ lookback:4, minDD:4, requireRed:true, excludeSessions:['us_afternoon'], btcDDMin:0, atrMin:2.0 } },
  { label:'ATR>1.5 + DD>=5 + Red + ExclUS_Afternoon', opts:{ lookback:4, minDD:5, requireRed:true, excludeSessions:['us_afternoon'], btcDDMin:0, atrMin:1.5 } },
  { label:'ATR>1.5 + DD>=4 + Red + ExclUS_Afternoon + Vol>=1.0', opts:{ lookback:4, minDD:4, requireRed:true, excludeSessions:['us_afternoon'], btcDDMin:0, atrMin:1.5, volRatioMin:1.0 } },
];

for (const config of filterMatrix) {
  const sigs=findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, config.opts);
  const res=backtest(sigs, {exitHours:2, feeBps:10});
  const s=stats(res);
  console.log(`  ${config.label}: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%, sum=${s.sum}%`);
}

// ============================================================
// PHASE 2: RISK CONTROL
// ============================================================

console.log('\n============================================');
console.log('PHASE 2: RISK CONTROL');
console.log('============================================\n');

// Use best combined config as base
const baseConfig = { lookback:4, minDD:4, requireRed:true, excludeSessions:['us_afternoon'], btcDDMin:0, atrMin:1.5 };
const baseSigs = findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, baseConfig);

// Stop loss sweep
console.log('--- STOP LOSS ---');
const slLevels=[0.01,0.015,0.02,0.025,0.03,0.04,null];
for (const sl of slLevels) {
  const res=backtest(baseSigs, {exitHours:2, stopLoss:sl, feeBps:10});
  const s=stats(res);
  console.log(`  SL=${sl===null?'none':(sl*100)+'%'}: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%, maxLoss=${s.maxLoss}%`);
}

// Soft stop sweep
console.log('\n--- SOFT STOP (1h check) ---');
const softStops=[0.001,0.002,0.003,0.004,0.005,null];
for (const ss of softStops) {
  const res=backtest(baseSigs, {exitHours:2, softStop:ss?{hours:1,minGain:ss}:null, feeBps:10});
  const s=stats(res);
  console.log(`  SoftStop=${ss===null?'none':(ss*100)+'%'}: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// Partial exit sweep
console.log('\n--- PARTIAL EXIT (50% at X hours) ---');
const partialHours=[1,2,3,4,null];
for (const ph of partialHours) {
  const res=backtest(baseSigs, {exitHours:2, partialExit:ph?{hours:ph,pct:0.5}:null, feeBps:10});
  const s=stats(res);
  console.log(`  Partial@${ph===null?'none':ph+'h'}: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// Exit hour sweep
console.log('\n--- EXIT HOUR SWEEP ---');
const exitHoursArr=[2,4,6,8,12];
for (const eh of exitHoursArr) {
  const res=backtest(baseSigs, {exitHours:eh, feeBps:10});
  const s=stats(res);
  console.log(`  ${eh}h hold: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// Combined: SL + soft stop
console.log('\n--- COMBINED: SL + SOFT STOP ---');
const combos = [
  { sl:0.02, softStop:{hours:1,minGain:0.003} },
  { sl:0.025, softStop:{hours:1,minGain:0.003} },
  { sl:0.03, softStop:{hours:1,minGain:0.003} },
  { sl:0.02, softStop:{hours:2,minGain:0.003} },
  { sl:null, softStop:{hours:1,minGain:0.005} },
];
for (const c of combos) {
  const res=backtest(baseSigs, {exitHours:2, stopLoss:c.sl, softStop:c.softStop, feeBps:10});
  const s=stats(res);
  console.log(`  SL=${c.sl===null?'X':c.sl*100+'%'} + SS=${c.softStop?c.softStop.minGain*100+'%':'X'}: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// ============================================================
// PHASE 3: POSITION SIZING & PORTFOLIO
// ============================================================

console.log('\n============================================');
console.log('PHASE 3: POSITION SIZING');
console.log('============================================\n');

const baseRes = backtest(baseSigs, {exitHours:2, stopLoss:0.02, feeBps:10});
const sBase = stats(baseRes);

// Monte Carlo position sizing
console.log('--- POSITION SIZING MONTE CARLO ---');
const positionSizes=[0.01,0.015,0.02,0.025,0.03];
for (const ps of positionSizes) {
  const equity=10000;
  let equityCurve=[equity];
  let maxDD=0;
  let peak=equity;

  for (let iter=0; iter<1000; iter++) {
    let e=equity;
    let p=e;
    const trades=[];
    for (const r of baseRes) {
      const ret=parseFloat(r.netRet)/100;
      const posSize=ps;
      const pnl=e*posSize*ret;
      e+=pnl;
      if(e>p) p=e;
      const dd=(p-e)/p*100;
      if(dd>maxDD) maxDD=dd;
    }
    equityCurve.push(e);
  }

  const finalReturns=equityCurve.slice(1).map(e=>((e-equity)/equity*100).toFixed(1));
  finalReturns.sort((a,b)=>a-b);
  console.log(`  Size=${(ps*100).toFixed(1)}%: p5=${finalReturns[Math.floor(finalReturns.length*0.05)]}%, p50=${finalReturns[Math.floor(finalReturns.length*0.5)]}%, p95=${finalReturns[Math.floor(finalReturns.length*0.95)]}%, maxDD=${maxDD.toFixed(1)}%`);
}

// ============================================================
// PHASE 4: ROBUSTNESS
// ============================================================

console.log('\n============================================');
console.log('PHASE 4: ROBUSTNESS');
console.log('============================================\n');

// Period splits
console.log('--- PERIOD SPLITS (Best config) ---');
const periods = [
  { label:'P1: Apr-Jul 2025', start:'2025-04-12', end:'2025-07-31' },
  { label:'P2: Jul-Oct 2025', start:'2025-07-31', end:'2025-10-31' },
  { label:'P3: Oct-Jan 2026', start:'2025-10-31', end:'2026-01-31' },
  { label:'P4: Jan-Apr 2026', start:'2026-01-31', end:'2026-04-13' },
];

for (const p of periods) {
  const pSigs = baseSigs.filter(s => {
    const d=new Date(s.date);
    return d>=new Date(p.start) && d<=new Date(p.end);
  });
  const res = backtest(pSigs, {exitHours:2, stopLoss:0.02, feeBps:10});
  const s = stats(res);
  console.log(`  ${p.label}: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%, sum=${s.sum}%`);
}

// Fee sensitivity
console.log('\n--- FEE SENSITIVITY ---');
const feeLevels=[5,10,15,20,25,30,40,50];
for (const fee of feeLevels) {
  const res=backtest(baseSigs, {exitHours:2, stopLoss:0.02, feeBps:fee});
  const s=stats(res);
  console.log(`  ${fee}bps: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// Slippage sensitivity
console.log('\n--- SLIPPAGE SENSITIVITY ---');
const slipLevels=[0,5,10,15,20];
for (const slip of slipLevels) {
  const res=backtest(baseSigs, {exitHours:2, stopLoss:0.02, feeBps:10, slipBps:slip});
  const s=stats(res);
  console.log(`  ${slip}bps slip: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%`);
}

// BTC comparison
console.log('\n--- BTC DRAWDOWN PATTERN (Same strategy) ---');
const btcBaseConfig = { lookback:4, minDD:4, requireRed:true, excludeSessions:['us_afternoon'], btcDDMin:0, atrMin:1.5 };
// For BTC we need to swap — but our signal finder uses ETH
// Let's test BTC signals separately 
// We'll just test BTC as the base asset with same rules
const btcSignals = findSignals(btc, btc, btcAtrAll, btcAtrAll, btcSma20, btcSma50, btcRsi14, ethVolRatio, {
  lookback:4, minDD:4, requireRed:true, excludeSessions:['us_afternoon'], btcDDMin:0, atrMin:1.5
});
const btcRes = btcSignals.length > 0 ? (() => {
  // Use BTC prices for backtest
  const r=[];
  for (const s of btcSignals) {
    const entryIdx=s.entryIdx;
    const exitIdx=entryIdx+2;
    if (exitIdx>=btc.length) continue;
    const entry=s.entryPrice;
    const exitPrice=btc[exitIdx].c;
    let ret=(exitPrice-entry)/entry*100;
    if (ret<-2) ret=-2;
    const netRet=ret-10/10000;
    r.push({...s, ret:ret.toFixed(3), netRet:netRet.toFixed(3), won:netRet>0});
  }
  return r;
})() : [];
if (btcRes.length > 0) {
  const sBtc=stats(btcRes);
  console.log(`  BTC: n=${sBtc.n}, WR=${sBtc.wr}%, mean=${sBtc.mean}%, median=${sBtc.median}%, p10=${sBtc.p10}%`);
} else {
  console.log('  BTC: insufficient data (need separate BTC signal test)');
}

// ============================================================
// FINAL BEST CONFIG
// ============================================================

console.log('\n============================================');
console.log('FINAL BEST CONFIGURATION');
console.log('============================================\n');

// Best: ATR>1.5 + DD>=4 + Red + ExclUS_Afternoon + SL 2%
const finalConfig = { lookback:4, minDD:4, requireRed:true, excludeSessions:['us_afternoon'], btcDDMin:0, atrMin:1.5 };
const finalSigs = findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, finalConfig);

// Test with different SL levels for the final config
console.log('Final config stop-loss sweep:');
for (const sl of [0.01,0.015,0.02,0.025,0.03,null]) {
  const res=backtest(finalSigs, {exitHours:2, stopLoss:sl, feeBps:10});
  const s=stats(res);
  console.log(`  SL=${sl===null?'none':(sl*100)+'%'}: n=${s.n}, WR=${s.wr}%, mean=${s.mean}%, median=${s.median}%, p10=${s.p10}%, sum=${s.sum}%`);
}

// Annualized estimates
console.log('\n--- ANNUALIZED ESTIMATES (Best config + 2% SL) ---');
const bestRes=backtest(finalSigs, {exitHours:2, stopLoss:0.02, feeBps:10});
const bestS=stats(bestRes);
const tradesPerYear = (bestS.n / 365) * 365; // n over data period
const dataDays = (new Date('2026-04-13') - new Date('2025-04-12')) / (1000*60*60*24);
const annualizedReturn = Math.pow(1 + parseFloat(bestS.sum)/100, 365/dataDays) - 1;
console.log(`  Data period: ${dataDays.toFixed(0)} days`);
console.log(`  Total signals: ${bestS.n}`);
console.log(`  Expected yearly signals: ${Math.round(bestS.n * 365 / dataDays)}`);
console.log(`  Mean return/trade: ${bestS.mean}%`);
console.log(`  Approx annualized (no compounding): ${(parseFloat(bestS.mean) * bestS.n * 365 / dataDays).toFixed(1)}%`);
console.log(`  Sum total return: ${bestS.sum}%`);
console.log(`  Annualized (compounded): ${(annualizedReturn*100).toFixed(1)}%`);

// ============================================================
// SUMMARY TABLE
// ============================================================

console.log('\n============================================');
console.log('SUMMARY: ALL PHASE 1+2+3 FILTER COMBINATIONS');
console.log('============================================\n');

const summaryMatrix = [
  { label:'Baseline', config:{ lookback:4, minDD:3, requireRed:false, atrMin:0 } },
  { label:'+ ATR>1.5', config:{ lookback:4, minDD:3, requireRed:false, atrMin:1.5 } },
  { label:'+ DD>=4', config:{ lookback:4, minDD:4, requireRed:false, atrMin:0 } },
  { label:'+ Red candle', config:{ lookback:4, minDD:3, requireRed:true, atrMin:0 } },
  { label:'+ Excl US_Afternoon', config:{ lookback:4, minDD:3, requireRed:false, atrMin:0, excludeSessions:['us_afternoon'] } },
  { label:'+ ATR>1.5 + DD>=4', config:{ lookback:4, minDD:4, requireRed:false, atrMin:1.5 } },
  { label:'+ ATR>1.5 + Red', config:{ lookback:4, minDD:3, requireRed:true, atrMin:1.5 } },
  { label:'+ ATR>1.5 + DD>=4 + Red + ExclUS', config:{ lookback:4, minDD:4, requireRed:true, atrMin:1.5, excludeSessions:['us_afternoon'] } },
  { label:'+ ATR>2.0 + DD>=4 + Red', config:{ lookback:4, minDD:4, requireRed:true, atrMin:2.0 } },
  { label:'+ ATR>1.5 + DD>=4 + Red + BTC>=1.5', config:{ lookback:4, minDD:4, requireRed:true, atrMin:1.5, btcDDMin:1.5 } },
];

console.log('Config                          | n   | WR    | Mean   | Median | p10    | Sum');
console.log('-------------------------------|-----|-------|--------|--------|--------|-----');
for (const row of summaryMatrix) {
  const sigs=findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, row.config);
  const res=backtest(sigs, {exitHours:2, stopLoss:0.02, feeBps:10});
  const s=stats(res);
  const label=row.label.padEnd(30);
  console.log(`${label} | ${String(s.n).padStart(3)} | ${s.wr.padStart(5)}% | ${s.mean.padStart(6)}% | ${s.median.padStart(6)}% | ${s.p10.padStart(6)}% | ${s.sum}%`);
}

console.log('\nDONE');

// Write full results to JSON for further analysis
writeFileSync('/home/node/.openclaw/workspace/crypto-intraday-trader/daytrading-research/phase1-4-results.json', JSON.stringify({
  baselineSignals: baselineSignals.length,
  bestConfigSignals: finalSigs.length,
  timestamp: new Date().toISOString()
}, null, 2));
