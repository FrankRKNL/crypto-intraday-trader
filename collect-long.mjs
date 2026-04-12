import { writeFileSync } from 'fs';
import { join } from 'path';

async function getKlines(url) {
  const res = await globalThis.fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function collectLonger() {
  console.log('Collecting 1 year of BTC 1H data...');
  
  const endTime = Date.now();
  const startTime = endTime - (400 * 24 * 60 * 60 * 1000); // 400 days
  
  let allCandles = [];
  let currentStart = startTime;
  
  for (let batch = 0; batch < 8; batch++) {
    console.log('Fetching batch', batch + 1, '...');
    const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1000&startTime=' + currentStart;
    const data = await getKlines(url);
    
    if (!Array.isArray(data) || data.length === 0) break;
    
    for (const k of data) {
      allCandles.push({
        t: parseInt(k[0]),
        o: parseFloat(k[1]),
        h: parseFloat(k[2]),
        l: parseFloat(k[3]),
        c: parseFloat(k[4]),
        v: parseFloat(k[5])
      });
    }
    
    currentStart = data[data.length - 1][0] + 1;
    console.log('  Got', data.length, 'candles, next start:', new Date(currentStart).toISOString());
    if (data.length < 1000) break;
  }
  
  // Deduplicate
  const deduped = allCandles.filter((c, i, arr) => i === 0 || c.t !== arr[i-1].t);
  deduped.sort((a, b) => a.t - b.t);
  
  console.log('\nTotal candles:', deduped.length, '=', (deduped.length/24).toFixed(0), 'days');
  console.log('Range:', new Date(deduped[0].t).toISOString(), 'to', new Date(deduped[deduped.length-1].t).toISOString());
  
  writeFileSync(join('./data', 'btcusdt-1h-long.json'), JSON.stringify(deduped));
  console.log('Saved.');
}

collectLonger().catch(e => { console.error(e); process.exit(1); });
