import test from 'node:test';
import assert from 'node:assert/strict';
import { PortfolioService } from '../src/services/portfolioService.js';
import { MatchingEngine } from '../src/engine/matchingEngine.js';

test('separate account services keep balances, positions, and order histories isolated', () => {
  const portfolioA = new PortfolioService();
  const portfolioB = new PortfolioService();
  const engineA = new MatchingEngine({ portfolioService: portfolioA });
  const engineB = new MatchingEngine({ portfolioService: portfolioB });

  const startingBalanceA = portfolioA.getBalances().USDT;
  const startingBalanceB = portfolioB.getBalances().USDT;

  const orderA = engineA.placeOrder({
    symbol: 'BTC/USDT',
    side: 'BUY',
    type: 'MARKET',
    quantity: 0.1,
    leverage: 10,
    currentMarketPrice: 65000
  });

  assert.equal(orderA.status, 'FILLED');
  assert.equal(portfolioA.positions.length, 1);
  assert.equal(portfolioB.positions.length, 0);
  assert.ok(portfolioA.getBalances().USDT < startingBalanceA);
  assert.equal(portfolioB.getBalances().USDT, startingBalanceB);
  assert.equal(engineA.getOrderHistory().length, 1);
  assert.equal(engineB.getOrderHistory().length, 0);
});

test('one account cannot cancel another account\'s open order', () => {
  const portfolioA = new PortfolioService();
  const portfolioB = new PortfolioService();
  const engineA = new MatchingEngine({ portfolioService: portfolioA });
  const engineB = new MatchingEngine({ portfolioService: portfolioB });

  const orderA = engineA.placeOrder({
    symbol: 'SOL/USDT',
    side: 'BUY',
    type: 'LIMIT',
    price: 100,
    quantity: 1,
    leverage: 1,
    currentMarketPrice: 160
  });

  assert.equal(orderA.status, 'OPEN');
  assert.equal(engineA.getOpenOrders().length, 1);
  assert.equal(engineB.getOpenOrders().length, 0);
  assert.throws(() => engineB.cancelOrder(orderA.id), /not found/);
  assert.equal(engineA.getOpenOrders().length, 1);
  assert.equal(engineA.cancelOrder(orderA.id).status, 'CANCELLED');
});
