/**
 * Extended data collector - fetch more historical data
 * Binance 15m klines - limit 1000 per request
 * Need to chain requests to get more data
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_DIR = new URL('.', import.meta.url).pathname;
const DATA_DIR = join(BASE_DIR, 'data');

async function fetchKlines(symbol, interval, limit, startTime = null, endTime = null) {
  let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  if (startTime) url += `&startTime=${startTime}`;
  if (endTime) url += `&endTime=${endTime}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function toCandles(raw) {
  return raw.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
    q: parseFloat(k[7])
  }));
}

async function collectAsset(symbol) {
  console.log(`\nFetching ${symbol}...`);
  
  // First batch - most recent
  const batch1 = await fetchKlines(symbol, '15m', 1000);
  const candles1 = toCandles(batch1);
  console.log(`  Batch 1: ${candles1.length} candles, ${new Date(candles1[0].t).toISOString()} to ${new Date(candles1[candles1.length-1].t).toISOString()}`);
  
  // Second batch - go back in time
  const startTime = candles1[candles1.length - 1].t - 1;
  const batch2 = await fetchKlines(symbol, '15m', 1000, null, startTime);
  const candles2 = toCandles(batch2);
  console.log(`  Batch 2: ${candles2.length} candles, ${new Date(candles2[0].t).toISOString()} to ${new Date(candles2[candles2.length-1].t).toISOString()}`);
  
  // Combine (batch2 is older, prepend)
  const all = [...candles2, ...candles1];
  console.log(`  Total: ${all.length} candles`);
  
  // Save
  const file = join(DATA_DIR, `${symbol.toLowerCase()}-15m-extended.json`);
  writeFileSync(file, JSON.stringify(all, null, 2));
  console.log(`  Saved to ${file}`);
  
  return all;
}

async function main() {
  console.log('=== Extended Data Collection ===');
  console.log('Fetching 2000 x 15m candles per asset (~20 days)');
  
  const btc = await collectAsset('BTCUSDT');
  const eth = await collectAsset('ETHUSDT');
  
  console.log('\nDone.');
  console.log(`BTC: ${btc.length} candles, ${new Date(btc[0].t).toISOString()} to ${new Date(btc[btc.length-1].t).toISOString()}`);
  console.log(`ETH: ${eth.length} candles, ${new Date(eth[0].t).toISOString()} to ${new Date(eth[eth.length-1].t).toISOString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
