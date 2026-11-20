import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingEngine } from '../src/engine/matchingEngine.js';
import { orderBookManager } from '../src/engine/orderBook.js';
import { portfolioService } from '../src/services/portfolioService.js';

test('Trading Engine Suite', async (t) => {
  portfolioService.resetAll();

  await t.test('places and fills a MARKET BUY order immediately', () => {
    const order = matchingEngine.placeOrder({
      symbol: 'BTC/USDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 0.1,
      leverage: 10,
      currentMarketPrice: 65000.00
    });

    assert.equal(order.status, 'FILLED');
    assert.equal(order.symbol, 'BTC/USDT');
    assert.equal(order.side, 'BUY');
    assert.equal(order.quantity, 0.1);
    assert.ok(order.price > 0);

    const portfolio = portfolioService.getPortfolio({ 'BTC/USDT': 65000 });
    const pos = portfolio.positions.find(p => p.symbol === 'BTC/USDT');
    assert.ok(pos, 'Position should exist');
    assert.equal(pos.side, 'LONG');
    assert.equal(pos.quantity, 0.1);
  });

  await t.test('places a resting LIMIT BUY order below market price', () => {
    const order = matchingEngine.placeOrder({
      symbol: 'ETH/USDT',
      side: 'BUY',
      type: 'LIMIT',
      price: 3470.00,
      quantity: 1.0,
      leverage: 5,
      currentMarketPrice: 3480.00
    });

    assert.equal(order.status, 'OPEN');
    assert.equal(order.price, 3470.00);

    const openOrders = matchingEngine.getOpenOrders('ETH/USDT');
    assert.equal(openOrders.length, 1);
    assert.equal(openOrders[0].id, order.id);

    // Verify it reflects in the orderbook snapshot
    const snapshot = orderBookManager.getSnapshot('ETH/USDT', 50);
    const bidPrices = snapshot.bids.map(b => b[0]);
    assert.ok(bidPrices.includes(3470.00), 'Resting limit bid should be visible in orderbook');
  });

  await t.test('triggers and fills resting LIMIT order when price moves', () => {
    // When market drops to 3465, the 3470 limit buy should fill!
    const fills = matchingEngine.checkTriggers('ETH/USDT', 3465.00);
    assert.equal(fills.length, 1);
    assert.equal(fills[0].status, 'FILLED');
    assert.equal(fills[0].price, 3465.00); // Better execution than the 3470 limit.

    const openOrders = matchingEngine.getOpenOrders('ETH/USDT');
    assert.equal(openOrders.length, 0, 'Limit order should no longer be open');
  });

  await t.test('cancels an open LIMIT order', () => {
    const order = matchingEngine.placeOrder({
      symbol: 'SOL/USDT',
      side: 'SELL',
      type: 'LIMIT',
      price: 250.00,
      quantity: 5.0,
      leverage: 2,
      currentMarketPrice: 160.00
    });

    assert.equal(order.status, 'OPEN');
    const cancelled = matchingEngine.cancelOrder(order.id);
    assert.equal(cancelled.status, 'CANCELLED');

    const openOrders = matchingEngine.getOpenOrders('SOL/USDT');
    assert.equal(openOrders.length, 0);
  });

  await t.test('closes an open position and realizes PnL', () => {
    const portfolioBefore = portfolioService.getPortfolio({ 'BTC/USDT': 66000 });
    const btcPos = portfolioBefore.positions.find(p => p.symbol === 'BTC/USDT');
    assert.ok(btcPos, 'BTC position should be open');

    const closed = portfolioService.closePosition(btcPos.id, 66000.00);
    assert.equal(closed.symbol, 'BTC/USDT');
    assert.ok(closed.realizedPnl > 0, 'Long BTC closed at higher price should have positive PnL');

    const portfolioAfter = portfolioService.getPortfolio();
    const posAfter = portfolioAfter.positions.find(p => p.symbol === 'BTC/USDT');
    assert.equal(posAfter, undefined, 'Position should be cleared');
  });

  await t.test('automatically triggers Take Profit when price reaches target', () => {
    // Open a long position with TP at 68,000
    portfolioService.openPosition({
      symbol: 'BTC/USDT',
      side: 'LONG',
      entryPrice: 65000,
      quantity: 0.1,
      leverage: 10,
      takeProfit: 68000,
      stopLoss: 63000
    });

    // Price moves to 67,000 (not triggered yet)
    let triggers = portfolioService.checkTpSl('BTC/USDT', 67000);
    assert.equal(triggers.length, 0);

    // Price reaches 68,050 (TP triggered!)
    triggers = portfolioService.checkTpSl('BTC/USDT', 68050);
    assert.equal(triggers.length, 1);
    assert.equal(triggers[0].reason, 'TAKE_PROFIT');
    assert.ok(triggers[0].pnl > 0, 'TP PnL should be positive');

    const pos = portfolioService.positions.find(p => p.symbol === 'BTC/USDT');
    assert.equal(pos, undefined, 'Position should be closed after TP');
  });

  await t.test('automatically triggers Stop Loss when price drops below stop', () => {
    // Open a long position with SL at 3,300
    portfolioService.openPosition({
      symbol: 'ETH/USDT',
      side: 'LONG',
      entryPrice: 3500,
      quantity: 1.0,
      leverage: 5,
      takeProfit: 4000,
      stopLoss: 3300
    });

    // Price drops to 3,290 (SL triggered!)
    const triggers = portfolioService.checkTpSl('ETH/USDT', 3290);
    assert.equal(triggers.length, 1);
    assert.equal(triggers[0].reason, 'STOP_LOSS');
    assert.ok(triggers[0].pnl < 0, 'SL PnL should be negative');

    const pos = portfolioService.positions.find(p => p.symbol === 'ETH/USDT');
    assert.equal(pos, undefined, 'Position should be closed after SL');
  });
  await t.test('marketable LIMIT orders receive the current market price', () => {
    portfolioService.resetAll();
    matchingEngine.resetAll();
    const order = matchingEngine.placeOrder({
      symbol: 'AAPL/USD', side: 'BUY', type: 'LIMIT',
      price: 240, quantity: 1, leverage: 1, currentMarketPrice: 230
    });
    assert.equal(order.status, 'FILLED');
    assert.equal(order.price, 230);
    assert.equal(order.filled, 1);
  });

  await t.test('partial close realizes PnL using the existing LONG side', () => {
    portfolioService.resetAll();
    const long = portfolioService.openPosition({
      symbol: 'BTC/USDT', side: 'LONG', entryPrice: 60000, quantity: 1, leverage: 10
    });
    const remainder = portfolioService.openPosition({
      symbol: 'BTC/USDT', side: 'SHORT', entryPrice: 65000, quantity: 0.4, leverage: 10
    });
    assert.equal(remainder.id, long.id);
    assert.equal(remainder.side, 'LONG');
    assert.equal(remainder.quantity, 0.6);
    assert.equal(portfolioService.getClosedTrades(1)[0].realizedPnl, 2000);
  });

  await t.test('demo faucet rejects negative, non-finite and excessive credits', () => {
    portfolioService.resetAll();
    assert.throws(() => portfolioService.claimFaucet(-100));
    assert.throws(() => portfolioService.claimFaucet(Infinity));
    assert.throws(() => portfolioService.claimFaucet(10001));
  });

  await t.test('reset clears outstanding limit orders from the matching engine', () => {
    portfolioService.resetAll();
    matchingEngine.resetAll();
    const order = matchingEngine.placeOrder({
      symbol: 'SOL/USDT', side: 'BUY', type: 'LIMIT',
      price: 100, quantity: 1, leverage: 1, currentMarketPrice: 160
    });
    assert.equal(order.status, 'OPEN');
    matchingEngine.resetAll();
    assert.equal(matchingEngine.getOpenOrders().length, 0);
  });

});
