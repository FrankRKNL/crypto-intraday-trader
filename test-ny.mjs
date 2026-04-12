import { readFileSync } from 'fs';

// Test NY open strategy on 31 days of data
const btc = JSON.parse(readFileSync('./data/btcusdt-60d.json', 'utf8'));
const eth = JSON.parse(readFileSync('./data/ethusdt-60d.json', 'utf8'));

console.log('BTC:', btc.length, 'candles,', (btc.length/96).toFixed(0), 'days');
console.log('ETH:', eth.length, 'candles,', (eth.length/96).toFixed(0), 'days');

function testNYOpen(candles, label) {
  const trades = [];
  
  for (let i = 1; i < candles.length - 1; i++) {
    const hour = new Date(candles[i].t).getUTCHours();
    if (hour < 14 || hour > 15) continue;
    
    const entry = candles[i].c;
    let exitPrice = candles[i].c;
    
    for (let j = i + 1; j < Math.min(i + 9, candles.length); j++) {
      const jHour = new Date(candles[j].t).getUTCHours();
      exitPrice = candles[j].c;
      if (jHour >= 17 || j - i >= 8) break;
    }
    
    const ret = (exitPrice - entry) / entry * 100 - 0.15;
    trades.push(ret);
  }
  
  const total = trades.reduce((a, t) => a + t, 0);
  const wins = trades.filter(t => t > 0).length;
  
  // Random baseline
  const randomReturns = [];
  for (let i = 50; i < candles.length - 8; i += 20) {
    const entry = candles[i].c;
    let exitPrice = candles[i].c;
    for (let j = i + 1; j < Math.min(i + 8, candles.length); j++) {
      exitPrice = candles[j].c;
    }
    randomReturns.push((exitPrice - entry) / entry * 100 - 0.15);
  }
  const randomTotal = randomReturns.reduce((a, t) => a + t, 0);
  
  console.log(label);
  console.log('  NY-Open:', trades.length, 'trades | WR:', (wins/trades.length*100).toFixed(1) + '% | Total:', total.toFixed(2) + '% | Avg:', (total/trades.length).toFixed(3) + '%');
  console.log('  Random: ', randomReturns.length, 'trades | Total:', randomTotal.toFixed(2) + '% | Avg:', (randomTotal/randomReturns.length).toFixed(3) + '%');
  
  return { n: trades.length, wr: wins/trades.length*100, pnl: total, avg: total/trades.length };
}

testNYOpen(btc, 'BTC');
testNYOpen(eth, 'ETH');
