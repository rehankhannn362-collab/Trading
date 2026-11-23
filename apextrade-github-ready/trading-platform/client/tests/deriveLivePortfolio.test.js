import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLivePortfolio } from '../src/utils/deriveLivePortfolio.js';

const markets = [
  { symbol: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', basePrice: 60000 },
  { symbol: 'NVDA/USD', baseAsset: 'NVDA', quoteAsset: 'USD', basePrice: 100 }
];

test('values USD and USDT cash, base-asset holdings, and open-position PnL separately', () => {
  const result = deriveLivePortfolio({
    balances: { USDT: 5000, USD: 4000, BTC: 0.1 },
    positions: [
      { id: 'btc-long', symbol: 'BTC/USDT', side: 'LONG', entryPrice: 60000, quantity: 0.1, margin: 600 },
      { id: 'nvda-short', symbol: 'NVDA/USD', side: 'SHORT', entryPrice: 100, quantity: 2, margin: 50 }
    ]
  }, {
    'BTC/USDT': { price: 61000 },
    'NVDA/USD': { price: 95 }
  }, markets);

  assert.equal(result.positions[0].unrealizedPnl, 100);
  assert.equal(result.positions[1].unrealizedPnl, 10);
  assert.equal(result.unrealizedPnlByCurrency.USDT, 100);
  assert.equal(result.unrealizedPnlByCurrency.USD, 10);
  assert.equal(result.assetValueByCurrency.USDT, 6100);
  assert.equal(result.equityByCurrency.USDT, 11200);
  assert.equal(result.equityByCurrency.USD, 4010);
  assert.equal(result.equity, 15210);
  assert.equal(result.availableMarginByCurrency.USDT, 4400);
  assert.equal(result.availableMarginByCurrency.USD, 3950);
  assert.equal(result.availableMargin, 8350);
  assert.equal(result.totalMarginUsed, 650);
});

test('uses configured market prices when a live ticker is not available', () => {
  const result = deriveLivePortfolio({
    balances: { USDT: 1000, USD: 500, BTC: 0.01 },
    positions: []
  }, {}, markets);

  assert.equal(result.assetValueByCurrency.USDT, 600);
  assert.equal(result.equityByCurrency.USDT, 1600);
  assert.equal(result.equityByCurrency.USD, 500);
  assert.equal(result.equity, 2100);
});

test('preserves negative free margin instead of masking an under-margined account', () => {
  const result = deriveLivePortfolio({
    balances: { USDT: 100, USD: 0 },
    positions: [
      { id: 'btc-long', symbol: 'BTC/USDT', side: 'LONG', entryPrice: 60000, quantity: 0.1, margin: 150 }
    ]
  }, {}, markets);

  assert.equal(result.availableMarginByCurrency.USDT, -50);
  assert.equal(result.availableMargin, -50);
});
