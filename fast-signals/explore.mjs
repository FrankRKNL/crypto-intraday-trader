/**
 * Fast-Payoff Event Discovery
 * Focus: Event-driven signals, NOT trend-following.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseDir = join(__dirname, '..');

const btc15 = JSON.parse(readFileSync(join(baseDir, 'data', 'btcusdt-15m-extended.json'), 'utf8'));
const btc1h = JSON.parse(readFileSync(join(baseDir, 'data', 'btcusdt-1h-long.json'), 'utf8'));

console.log('BTC 15m:', btc15.length, 'candles,', (btc15.length/96).toFixed(0), 'days');
console.log('BTC 1H:', btc1h.length, 'candles,', (btc1h.length/24).toFixed(0), 'days');

// ============================================================
// TEST 1: Large Candle Follow-through (15m)
// ============================================================
console.log('\n=== TEST 1: Large Candle Follow-through (15m) ===');
const bodies15 = btc15.map(c => Math.abs(c.c - c.o) / c.o * 100);
const sorted15 = [...bodies15].sort((a, b) => a - b);
const p95_15 = sorted15[Math.floor(sorted15.length * 0.95)];
console.log('95th percentile 15m body:', p95_15.toFixed(3) + '%');

const largeResults = [];
for (let i = 5; i < btc15.length - 4; i++) {
  if (bodies15[i] < p95_15) continue;
  const dir = btc15[i].c > btc15[i].o ? 1 : -1;
  const entry = btc15[i].c;
  const moves = [];
  for (let h = 1; h <= 4; h++) {
    if (i + h >= btc15.length) break;
    const ret = dir === 1 ? (btc15[i+h].c - entry)/entry*100 : (entry - btc15[i+h].c)/entry*100;
    moves.push(ret);
  }
  largeResults.push({ dir, moves });
}

for (const h of [1,2,4]) {
  const rets = largeResults.map(r => r.moves[h-1]).filter(r => r !== undefined);
  if (rets.length === 0) continue;
  const avg = rets.reduce((a,b) => a+b,0)/rets.length;
  const pos = rets.filter(r => r > 0).length;
  const avgWin = rets.filter(r => r > 0).reduce((a,b) => a+b,0) / pos;
  const avgLoss = rets.filter(r => r <= 0).reduce((a,b) => a+b,0) / (rets.length - pos);
  console.log(`After large 15m candle (${h}h): avg=${avg.toFixed(3)}%, win%=${(pos/rets.length*100).toFixed(0)}%, n=${rets.length}, avgWin=${avgWin.toFixed(2)}%, avgLoss=${avgLoss.toFixed(2)}%`);
}

// ============================================================
// TEST 2: Consecutive 3 Same-Direction Candles (15m)
// ============================================================
console.log('\n=== TEST 2: Consecutive 3 Same-Direction Candles (15m) ===');
const streakResults = [];
for (let i = 3; i < btc15.length - 4; i++) {
  const d1 = btc15[i-3].c > btc15[i-3].o ? 1 : -1;
  const d2 = btc15[i-2].c > btc15[i-2].o ? 1 : -1;
  const d3 = btc15[i-1].c > btc15[i-1].o ? 1 : -1;
  if (d1 !== d2 || d2 !== d3) continue;
  const dir = d1;
  const entry = btc15[i].c;
  const moves = [];
  for (let h = 1; h <= 4; h++) {
    if (i + h >= btc15.length) break;
    const ret = dir === 1 ? (btc15[i+h].c - entry)/entry*100 : (entry - btc15[i+h].c)/entry*100;
    moves.push(ret);
  }
  streakResults.push({ dir, moves });
}

for (const h of [1,2,4]) {
  const rets = streakResults.map(r => r.moves[h-1]).filter(r => r !== undefined);
  if (rets.length === 0) continue;
  const avg = rets.reduce((a,b) => a+b,0)/rets.length;
  const pos = rets.filter(r => r > 0).length;
  console.log(`After 3-streak (${h}h): avg=${avg.toFixed(3)}%, win%=${(pos/rets.length*100).toFixed(0)}%, n=${rets.length}`);
}

// ============================================================
// TEST 3: Gap from Previous 15m Candle
// ============================================================
console.log('\n=== TEST 3: Intraday Gap (>0.2%) ===');
const gapResults = [];
for (let i = 1; i < btc15.length - 4; i++) {
  const gap = (btc15[i].o - btc15[i-1].c) / btc15[i-1].c * 100;
  if (Math.abs(gap) < 0.2) continue;
  const dir = gap > 0 ? 1 : -1;
  const entry = btc15[i].o;
  const moves = [];
  for (let h = 1; h <= 4; h++) {
    if (i + h >= btc15.length) break;
    const ret = dir === 1 ? (btc15[i+h].c - entry)/entry*100 : (entry - btc15[i+h].c)/entry*100;
    moves.push(ret);
  }
  gapResults.push({ gap, dir, moves });
}

for (const h of [1,2,4]) {
  const rets = gapResults.map(r => r.moves[h-1]).filter(r => r !== undefined);
  if (rets.length === 0) continue;
  const avg = rets.reduce((a,b) => a+b,0)/rets.length;
  const pos = rets.filter(r => r > 0).length;
  console.log(`After gap (${h}h): avg=${avg.toFixed(3)}%, win%=${(pos/rets.length*100).toFixed(0)}%, n=${rets.length}`);
}

// ============================================================
// TEST 4: Large 1H Candle -> 15m Follow-through
// ============================================================
console.log('\n=== TEST 4: Large 1H Candle -> 15m Entries ===');
const bodies1h = btc1h.map(c => Math.abs(c.c - c.o) / c.o * 100);
const sorted1h = [...bodies1h].sort((a, b) => a - b);
const p90_1h = sorted1h[Math.floor(sorted1h.length * 0.90)];
console.log('90th percentile 1H body:', p90_1h.toFixed(3) + '%');

// Map 1H candle to 15m candles
const h1Results = [];
for (let i = 5; i < btc1h.length - 4; i++) {
  if (bodies1h[i] < p90_1h) continue;
  const dir = btc1h[i].c > btc1h[i].o ? 1 : -1;
  
  // Find corresponding 15m candles for this 1H period
  const hStart = btc1h[i].t;
  const hEnd = btc1h[i+1] ? btc1h[i+1].t : hStart + 3600*1000;
  
  // Enter at first 15m candle that closes in the direction
  for (let j = 0; j < btc15.length - 4; j++) {
    if (btc15[j].t < hStart || btc15[j].t >= hEnd) continue;
    if (btc15[j].c > btc15[j].o && dir === 1 || btc15[j].c < btc15[j].o && dir === -1) {
      // Entry at this 15m candle close
      const entry = btc15[j].c;
      const moves = [];
      for (let h = 1; h <= 4; h++) {
        if (j + h >= btc15.length) break;
        const ret = dir === 1 ? (btc15[j+h].c - entry)/entry*100 : (entry - btc15[j+h].c)/entry*100;
        moves.push(ret);
      }
      h1Results.push({ dir, moves });
      break;
    }
  }
}

for (const h of [1,2,4]) {
  const rets = h1Results.map(r => r.moves[h-1]).filter(r => r !== undefined);
  if (rets.length === 0) continue;
  const avg = rets.reduce((a,b) => a+b,0)/rets.length;
  const pos = rets.filter(r => r > 0).length;
  console.log(`After large 1H (${h}h): avg=${avg.toFixed(3)}%, win%=${(pos/rets.length*100).toFixed(0)}%, n=${rets.length}`);
}

console.log('\n=== DONE ===');
