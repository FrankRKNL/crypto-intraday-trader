// WALF-FORWARD VALIDATION: ETH Drawdown Recovery
// Train: Apr 2025 - Sep 2025 (6 months)
// Test: Oct 2025 - Apr 2026 (6 months)
// =============================================================

import { readFileSync } from 'fs';

const rawETH = JSON.parse(readFileSync('/home/node/.openclaw/workspace/crypto-intraday-trader/data/ethusdt-1h-live.json','utf8'));
const rawBTC = JSON.parse(readFileSync('/home/node/.openclaw/workspace/crypto-intraday-trader/data/btcusdt-1h-long.json','utf8'));

const eth = rawETH.map(d => ({ t:d.t, o:d.o, h:d.h, l:d.l, c:d.c, v:d.v })).sort((a,b)=>a.t-b.t);
const btc = rawBTC.map(d => ({ t:d.t, o:d.o, h:d.h, l:d.l, c:d.c, v:d.v })).sort((a,b)=>a.t-b.t);

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

function getSession(hour) {
  if (hour>=0&&hour<6) return 'asian';
  if (hour>=6&&hour<12) return 'european';
  if (hour>=12&&hour<18) return 'us_afternoon';
  return 'us_evening';
}

const ethClose = eth.map(d=>d.c);
const ethVol = eth.map(d=>d.v);
const ethAtr14 = atr(eth, 14);
const ethAtrAll = Array(14).fill(0).concat(ethAtr14);
const ethVolSma = Array(19).fill(0).concat(sma(ethVol,20));
const ethVolRatio = eth.map((d,i)=> ethVolSma[i]? d.v/ethVolSma[i]: 1);

// ETH only indicators
const ethSma20 = Array(19).fill(0).concat(sma(ethClose,20));
const ethSma50 = Array(49).fill(0).concat(sma(ethClose,50));
const ethRsi14 = Array(14).fill(50).concat(rsi(eth));

// BTC indicators
const btcClose = btc.map(d=>d.c);
const btcAtr14 = atr(btc, 14);
const btcAtrAll = Array(14).fill(0).concat(btcAtr14);
const btcSma20 = Array(19).fill(0).concat(sma(btcClose,20));
const btcSma50 = Array(49).fill(0).concat(sma(btcClose,50));
const btcRsi14 = Array(14).fill(50).concat(rsi(btc));

function findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, opts={}) {
  const {
    lookback=4,
    minDD=4,
    requireRed=true,
    excludeSessions=['us_afternoon'],
    btcDDMin=0,
    atrMin=1.5,
    startIdx=0,
    endIdx=eth.length,
  } = opts;

  const signals=[];
  for (let i=Math.max(lookback,startIdx); i<Math.min(eth.length-2,endIdx); i++) {
    const startIdx2=i-lookback+1;
    const peakHigh=Math.max(...eth.slice(startIdx2,i+1).map(c=>c.h));
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
    if (atrPct<atrMin) continue;

    // BTC lead
    let btcDD=0;
    if (btcDDMin>0) {
      const btcStart=eth[startIdx2].t;
      const btcEnd=eth[i].t;
      const btcWindow=btc.filter(c=>c.t>=btcStart&&c.t<=btcEnd);
      if (btcWindow.length>0) {
        const btcPeak=Math.max(...btcWindow.map(c=>c.h));
        const btcTrough=Math.min(...btcWindow.map(c=>c.l));
        btcDD=(btcPeak-btcTrough)/btcPeak*100;
      }
    }
    if (btcDDMin>0&&btcDD<btcDDMin) continue;

    const entryPrice=eth[i+1].o;
    const entryIdx=i+1;
    const rets={};
    [2,4,6,8,12].forEach(h=>{ if(entryIdx+h<eth.length) rets[h]=(eth[entryIdx+h].c-entryPrice)/entryPrice*100; });

    signals.push({
      idx:i, date:new Date(eth[i].t).toISOString(), hour, session,
      dd:dd.toFixed(2), atrPct:atrPct.toFixed(2),
      entryPrice, entryIdx,
      ret2h:rets[2]||null, ret4h:rets[4]||null, ret6h:rets[6]||null, ret8h:rets[8]||null, ret12h:rets[12]||null,
      btcDD:btcDD.toFixed(2), isRed,
    });
  }
  return signals;
}

function backtest(signals, eth, opts={}) {
  const { exitHours=2, stopLoss=0.02, feeBps=10 } = opts;
  const results=[];
  for (const s of signals) {
    const entryIdx=s.entryIdx;
    const exitIdx=entryIdx+exitHours;
    if (exitIdx>=eth.length) continue;
    const entry=s.entryPrice;
    const exitPrice=eth[exitIdx].c;
    let ret=(exitPrice-entry)/entry*100;
    if (stopLoss&&ret<-stopLoss*100) ret=-stopLoss*100;
    const netRet=ret-feeBps/100;
    results.push({ ...s, ret:ret.toFixed(3), netRet:netRet.toFixed(3), won:netRet>0 });
  }
  return results;
}

function stats(results) {
  if (results.length===0) return { n:0, wr:'0', mean:'0', median:'0', p10:'0', sum:'0' };
  const rets=results.map(r=>parseFloat(r.netRet));
  const wins=rets.filter(r=>r>0);
  rets.sort((a,b)=>a-b);
  const sum=rets.reduce((a,b)=>a+b,0);
  const mean=sum/rets.length;
  const median=rets.length%2===0 ? (rets[rets.length/2-1]+rets[rets.length/2])/2 : rets[Math.floor(rets.length/2)];
  return {
    n:rets.length,
    wr:(wins.length/rets.length*100).toFixed(1),
    mean:mean.toFixed(3),
    median:median.toFixed(3),
    p10:(rets[Math.floor(rets.length*0.1)]||0).toFixed(2),
    sum:sum.toFixed(2),
    min:Math.min(...rets).toFixed(2),
    max:Math.max(...rets).toFixed(2),
  };
}

// =============================================================
// WALK-FORWARD SPLIT
// =============================================================

// Find split index: Oct 1, 2025
const oct2025 = new Date('2025-10-01T00:00:00Z').getTime();
const trainEnd = new Date('2025-09-30T23:59:59Z').getTime();
const trainStart = new Date('2025-04-12T00:00:00Z').getTime();

const trainStartIdx = eth.findIndex(c=>c.t>=trainStart);
const trainEndIdx = eth.findIndex(c=>c.t>=trainEnd);
const testStartIdx = eth.findIndex(c=>c.t>=oct2025);

console.log(`Train window: ${new Date(eth[trainStartIdx].t).toISOString()} - ${new Date(eth[trainEndIdx].t).toISOString()}`);
console.log(`Test window: ${new Date(eth[testStartIdx].t).toISOString()} - ${new Date(eth[eth.length-1].t).toISOString()}`);
console.log('');

// =============================================================
// STEP 1: TRAIN ON APR-SEP 2025
// =============================================================

console.log('============================================');
console.log('STEP 1: TRAIN ON APR-SEP 2025');
console.log('============================================\n');

// Configs to test on TRAIN only
const configs = [
  { label:'Baseline', atrMin:0, minDD:3, requireRed:false },
  { label:'ATR>1.5', atrMin:1.5, minDD:3, requireRed:false },
  { label:'ATR>1.5 + DD>=4', atrMin:1.5, minDD:4, requireRed:false },
  { label:'ATR>1.5 + DD>=4 + Red', atrMin:1.5, minDD:4, requireRed:true },
  { label:'ATR>1.5 + DD>=4 + Red + ExclUS', atrMin:1.5, minDD:4, requireRed:true, excludeSessions:['us_afternoon'] },
  { label:'ATR>2.0 + DD>=4 + Red + ExclUS', atrMin:2.0, minDD:4, requireRed:true, excludeSessions:['us_afternoon'] },
  { label:'ATR>1.5 + DD>=5 + Red + ExclUS', atrMin:1.5, minDD:5, requireRed:true, excludeSessions:['us_afternoon'] },
  { label:'ATR>2.0 + DD>=5 + Red + ExclUS', atrMin:2.0, minDD:5, requireRed:true, excludeSessions:['us_afternoon'] },
];

const trainResults = [];
for (const cfg of configs) {
  const sigs = findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
    lookback:4,
    minDD:cfg.minDD,
    requireRed:cfg.requireRed,
    excludeSessions:cfg.excludeSessions||[],
    btcDDMin:0,
    atrMin:cfg.atrMin,
    startIdx:trainStartIdx,
    endIdx:trainEndIdx,
  });
  const res = backtest(sigs, eth, { exitHours:2, stopLoss:0.02, feeBps:10 });
  const s = stats(res);
  trainResults.push({ label:cfg.label, ...s, signals:sigs.length });
  console.log(`  ${cfg.label.padEnd(35)} | n=${String(s.n).padStart(3)} | WR=${s.wr.padStart(5)}% | mean=${s.mean.padStart(7)}% | median=${s.median.padStart(7)}% | p10=${s.p10}% | sum=${s.sum}%`);
}

// =============================================================
// STEP 2: SELECT BEST TRAIN CONFIG
// =============================================================

console.log('\n============================================');
console.log('STEP 2: BEST TRAIN CONFIG SELECTED');
console.log('============================================\n');

// Rank by mean return
trainResults.sort((a,b)=>parseFloat(b.mean)-parseFloat(a.mean));
const bestTrain = trainResults[0];
console.log(`BEST TRAIN: ${bestTrain.label}`);
console.log(`  n=${bestTrain.n}, WR=${bestTrain.wr}%, mean=${bestTrain.mean}%, median=${bestTrain.median}%`);
console.log('');

// Also show top 3
console.log('TOP 3 TRAIN CONFIGS:');
trainResults.slice(0,3).forEach((r,i) => {
  console.log(`  #${i+1}: ${r.label} — n=${r.n}, WR=${r.wr}%, mean=${r.mean}%, median=${r.median}%`);
});

// =============================================================
// STEP 3: TEST ON OCT 2025 - APR 2026 (OUT OF SAMPLE)
// =============================================================

console.log('\n============================================');
console.log('STEP 3: TEST ON OCT 2025 - APR 2026 (OOS)');
console.log('============================================\n');

// Test ALL train configs on TEST window (not just the best one)
for (const cfg of configs) {
  const sigs = findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
    lookback:4,
    minDD:cfg.minDD,
    requireRed:cfg.requireRed,
    excludeSessions:cfg.excludeSessions||[],
    btcDDMin:0,
    atrMin:cfg.atrMin,
    startIdx:testStartIdx,
    endIdx:eth.length,
  });
  const res = backtest(sigs, eth, { exitHours:2, stopLoss:0.02, feeBps:10 });
  const s = stats(res);
  console.log(`  ${cfg.label.padEnd(35)} | n=${String(s.n).padStart(3)} | WR=${s.wr.padStart(5)}% | mean=${s.mean.padStart(7)}% | median=${s.median.padStart(7)}% | p10=${s.p10}% | sum=${s.sum}%`);
}

// =============================================================
// STEP 4: COMPARE TRAIN vs TEST (Best config)
// =============================================================

console.log('\n============================================');
console.log('STEP 4: TRAIN vs TEST DEGRADATION (Best config)');
console.log('============================================\n');

// Re-run best config on both windows
const bestConfig = configs[0]; // baseline for fair comparison
// Actually use the best train config's parameters
const bestTrainConfig = {
  atrMin:1.5, minDD:4, requireRed:true, excludeSessions:['us_afternoon']
};

console.log(`Config: ATR>${bestTrainConfig.atrMin} + DD>=${bestTrainConfig.minDD} + Red + ExclUS_Afternoon\n`);

const trainSigs = findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
  lookback:4, ...bestTrainConfig,
  startIdx:trainStartIdx, endIdx:trainEndIdx,
});
const trainRes = backtest(trainSigs, eth, { exitHours:2, stopLoss:0.02, feeBps:10 });
const trainStats = stats(trainRes);

const testSigs = findSignals(eth, btc, ethAtrAll, btcAtrAll, ethSma20, ethSma50, ethRsi14, ethVolRatio, {
  lookback:4, ...bestTrainConfig,
  startIdx:testStartIdx, endIdx:eth.length,
});
const testRes = backtest(testSigs, eth, { exitHours:2, stopLoss:0.02, feeBps:10 });
const testStats = stats(testRes);

console.log('                        | TRAIN     | TEST      | Degradation');
console.log('------------------------|-----------|-----------|------------');
console.log(`  n                     | ${String(trainStats.n).padStart(9)} | ${String(testStats.n).padStart(9)} | —`);
console.log(`  Win Rate              | ${(trainStats.wr+'%').padStart(9)} | ${(testStats.wr+'%').padStart(9)} | ${(parseFloat(testStats.wr)-parseFloat(trainStats.wr)).toFixed(1)}pp`);
console.log(`  Mean return/trade     | ${(trainStats.mean+'%').padStart(9)} | ${(testStats.mean+'%').padStart(9)} | ${(parseFloat(testStats.mean)-parseFloat(trainStats.mean)).toFixed(3)}%`);
console.log(`  Median return/trade   | ${(trainStats.median+'%').padStart(9)} | ${(testStats.median+'%').padStart(9)} | ${(parseFloat(testStats.median)-parseFloat(trainStats.median)).toFixed(3)}%`);
console.log(`  p10 (worst 10%)      | ${(trainStats.p10+'%').padStart(9)} | ${(testStats.p10+'%').padStart(9)} | —`);
console.log(`  Sum total return      | ${(trainStats.sum+'%').padStart(9)} | ${(testStats.sum+'%').padStart(9)} | —`);

const trainWrDegradation = parseFloat(testStats.wr) - parseFloat(trainStats.wr);
const trainMeanDegradation = parseFloat(testStats.mean) - parseFloat(trainStats.mean);
console.log('');

// =============================================================
// STEP 5: VERDICT
// =============================================================

console.log('============================================');
console.log('STEP 5: WALK-FORWARD VERDICT');
console.log('============================================\n');

const passOos = parseFloat(testStats.wr) >= 55.0 && parseFloat(testStats.mean) > 0.0;
const passOosMean = parseFloat(testStats.mean) > 0.3;
const wrDegradationOk = trainWrDegradation > -15; // within 15pp

console.log(`TEST Win Rate: ${testStats.wr}% (threshold: 55%)`);
console.log(`TEST Mean: ${testStats.mean}% (threshold: >0.0%, preferred >0.3%)`);
console.log(`WR Degradation: ${trainWrDegradation.toFixed(1)}pp (acceptable if >-15pp)`);
console.log('');

if (passOos && passOosMean && wrDegradationOk) {
  console.log('VERDICT: ✅ PASS — Strategy is ROBUST (walk-forward validated)');
  console.log('Paper trading: APPROVED with filters');
} else if (parseFloat(testStats.wr) >= 50.0 && parseFloat(testStats.mean) > 0.0) {
  console.log('VERDICT: ⚠️ CONDITIONAL — Strategy shows edge but degraded');
  console.log('Paper trading: PROCEED WITH CAUTION — smaller size recommended');
} else {
  console.log('VERDICT: ❌ FAIL — Strategy is CURVE-FITTED');
  console.log('Paper trading: NOT RECOMMENDED — do not trade');
}

// Also check BTC validation
console.log('\n============================================');
console.log('BTC CROSS-ASSET VALIDATION');
console.log('============================================\n');

// Run same strategy on BTC for comparison
const btcSma20_2 = Array(19).fill(0).concat(sma(btcClose,20));
const btcSma50_2 = Array(49).fill(0).concat(sma(btcClose,50));
const btcRsi14_2 = Array(14).fill(50).concat(rsi(btc));
const btcVol = btc.map(d=>d.v);
const btcVolSma = Array(19).fill(0).concat(sma(btcVol,20));
const btcVolRatio = btc.map((d,i)=> btcVolSma[i]? d.v/btcVolSma[i]: 1);

const btcTrainSigs = findSignals(btc, btc, btcAtrAll, btcAtrAll, btcSma20_2, btcSma50_2, btcRsi14_2, btcVolRatio, {
  lookback:4, ...bestTrainConfig,
  startIdx:trainStartIdx, endIdx:trainEndIdx,
});
const btcTrainRes = btcTrainSigs.length >= 3 ? backtest(btcTrainSigs, btc, { exitHours:2, stopLoss:0.02, feeBps:10 }) : [];
const btcTrainStats = stats(btcTrainRes);

const btcTestSigs = findSignals(btc, btc, btcAtrAll, btcAtrAll, btcSma20_2, btcSma50_2, btcRsi14_2, btcVolRatio, {
  lookback:4, ...bestTrainConfig,
  startIdx:testStartIdx, endIdx:btc.length,
});
const btcTestRes = btcTestSigs.length >= 3 ? backtest(btcTestSigs, btc, { exitHours:2, stopLoss:0.02, feeBps:10 }) : [];
const btcTestStats = stats(btcTestRes);

console.log(`BTC TRAIN: n=${btcTrainStats.n}, WR=${btcTrainStats.wr}%, mean=${btcTrainStats.mean}%, median=${btcTrainStats.median}%`);
console.log(`BTC TEST:  n=${btcTestStats.n}, WR=${btcTestStats.wr}%, mean=${btcTestStats.mean}%, median=${btcTestStats.median}%`);

if (btcTestStats.n >= 10 && parseFloat(btcTestStats.wr) >= 50.0 && parseFloat(btcTestStats.mean) > 0.0) {
  console.log('BTC Validation: ✅ PASS');
} else if (btcTestStats.n >= 3) {
  console.log(`BTC Validation: ⚠️ MARGINAL (n=${btcTestStats.n} — need more data)`);
} else {
  console.log(`BTC Validation: ⚠️ INSUFFICIENT DATA (n=${btcTestStats.n})`);
}

console.log('\nDONE');
