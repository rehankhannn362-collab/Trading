import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { matchingEngine } from '../src/engine/matchingEngine.js';
import { portfolioService } from '../src/services/portfolioService.js';

let server;
let baseUrl;

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  matchingEngine.resetAll();
  portfolioService.resetAll();
  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json() };
}

test('health endpoint reports a running API', async () => {
  const { response, body } = await request('/health');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.timestamp, 'number');
});

test('market endpoints return market, ticker, candles, order book and trades', async () => {
  const markets = await request('/api/markets');
  assert.equal(markets.response.status, 200);
  assert.ok(markets.body.data.some(m => m.symbol === 'BTC/USDT'));

  const ticker = await request('/api/markets/BTC-USDT/ticker');
  assert.equal(ticker.response.status, 200);
  assert.equal(ticker.body.data.symbol, 'BTC/USDT');

  const candles = await request('/api/markets/BTC-USDT/candles?timeframe=1m&limit=10');
  assert.equal(candles.response.status, 200);
  assert.ok(candles.body.data.length > 0);
  assert.ok(candles.body.data.length <= 10);

  const book = await request('/api/markets/BTC-USDT/orderbook?depth=5');
  assert.equal(book.response.status, 200);
  assert.equal(book.body.data.bids.length, 5);
  assert.equal(book.body.data.asks.length, 5);

  const trades = await request('/api/markets/BTC-USDT/trades?limit=5');
  assert.equal(trades.response.status, 200);
  assert.ok(Array.isArray(trades.body.data));
  assert.ok(trades.body.data.length <= 5);
});

test('unknown market ticker returns a structured 404', async () => {
  const { response, body } = await request('/api/markets/UNKNOWN-PAIR/ticker');
  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.error, 'Market not found');
});

test('market order API fills an order and updates portfolio', async () => {
  matchingEngine.resetAll();
  portfolioService.resetAll();

  const { response, body } = await request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol: 'AAPL/USD', side: 'BUY', type: 'MARKET',
      quantity: 1, leverage: 1
    })
  });

  assert.equal(response.status, 201);
  assert.equal(body.data.status, 'FILLED');
  assert.equal(body.data.symbol, 'AAPL/USD');

  const portfolio = await request('/api/portfolio');
  assert.equal(portfolio.response.status, 200);
  assert.ok(portfolio.body.data.positions.some(p => p.symbol === 'AAPL/USD'));
});

test('invalid order is rejected and resting limit order can be cancelled', async () => {
  matchingEngine.resetAll();
  portfolioService.resetAll();

  const invalid = await request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'BTC/USDT', side: 'BUY', type: 'MARKET', quantity: -1, leverage: 1 })
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.body.success, false);

  const limit = await request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol: 'SOL/USDT', side: 'BUY', type: 'LIMIT',
      price: 1, quantity: 1, leverage: 1
    })
  });
  assert.equal(limit.response.status, 201);
  assert.equal(limit.body.data.status, 'OPEN');

  const cancelled = await request(`/api/orders/${limit.body.data.id}`, { method: 'DELETE' });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.body.data.status, 'CANCELLED');

  const openOrders = await request('/api/orders');
  assert.ok(!openOrders.body.data.some(order => order.id === limit.body.data.id));
});
