import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket from 'ws';
import { app } from '../src/app.js';
import { WebSocketService } from '../src/services/websocketService.js';
import { matchingEngine } from '../src/engine/matchingEngine.js';
import { portfolioService } from '../src/services/portfolioService.js';

function waitForMessage(ws, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('Timed out waiting for WebSocket message'));
    }, timeoutMs);
    const onMessage = raw => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (!predicate(message)) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(message);
    };
    ws.on('message', onMessage);
  });
}

test('WebSocket sends initial snapshots and supports channel subscriptions and ping', async () => {
  matchingEngine.resetAll();
  portfolioService.resetAll();

  const server = http.createServer(app);
  const service = new WebSocketService();
  service.initialize(server);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
  try {
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });

    const tickerSnapshot = await waitForMessage(ws, msg => msg.type === 'snapshot:tickers');
    assert.ok(Array.isArray(tickerSnapshot.data));
    assert.ok(tickerSnapshot.data.some(ticker => ticker.symbol === 'BTC/USDT'));

    const portfolioSnapshot = await waitForMessage(ws, msg => msg.type === 'snapshot:portfolio');
    assert.ok(Array.isArray(portfolioSnapshot.data.positions));

    ws.send(JSON.stringify({ action: 'subscribe', channel: 'depth:BTC/USDT' }));
    const depth = await waitForMessage(ws, msg => msg.type === 'depth' && msg.symbol === 'BTC/USDT');
    assert.ok(Array.isArray(depth.data.bids));
    assert.ok(Array.isArray(depth.data.asks));

    ws.send(JSON.stringify({ action: 'ping' }));
    const pong = await waitForMessage(ws, msg => msg.type === 'pong');
    assert.equal(typeof pong.timestamp, 'number');

    ws.send('{invalid json');
    const error = await waitForMessage(ws, msg => msg.type === 'error');
    assert.equal(error.message, 'Invalid JSON payload');

    ws.send(JSON.stringify({ action: 'unsubscribe', channel: 'depth:BTC/USDT' }));
    assert.equal(service.clients.get(ws).has('depth:BTC/USDT'), false);
  } finally {
    ws.terminate();
    service.close();
    await new Promise(resolve => server.close(resolve));
    matchingEngine.resetAll();
    portfolioService.resetAll();
  }
});
