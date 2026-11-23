import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountRegistry } from '../src/services/accountRegistry.js';
import { PortfolioService } from '../src/services/portfolioService.js';
import { MatchingEngine } from '../src/engine/matchingEngine.js';
import { OrderBookManager } from '../src/engine/orderBook.js';

function createRegistry() {
  const defaultPortfolio = new PortfolioService();
  const orderBook = new OrderBookManager();
  return new AccountRegistry({
    defaultAccountId: 'demo-test',
    defaultPortfolio,
    defaultEngine: new MatchingEngine({ portfolioService: defaultPortfolio, orderBook }),
    orderBook
  });
}

test('registry keeps the existing default demo account available', () => {
  const defaultPortfolio = new PortfolioService();
  const defaultEngine = new MatchingEngine({ portfolioService: defaultPortfolio });
  const registry = new AccountRegistry({
    defaultAccountId: 'demo',
    defaultPortfolio,
    defaultEngine
  });

  const account = registry.requireAccount('demo');
  assert.equal(account.id, 'demo');
  assert.equal(account.portfolioService, defaultPortfolio);
  assert.equal(account.matchingEngine, defaultEngine);
  assert.deepEqual(registry.listAccountIds(), ['demo']);
});

test('registry creates uniquely identified accounts with independent services', () => {
  const registry = createRegistry();
  const first = registry.createAccount({ id: 'user-a' });
  const second = registry.createAccount({ id: 'user-b' });

  assert.notEqual(first.id, second.id);
  assert.notEqual(first.portfolioService, second.portfolioService);
  assert.notEqual(first.matchingEngine, second.matchingEngine);
  assert.equal(registry.getAccount('user-a'), first);
  assert.equal(registry.getAccount('user-b'), second);
  assert.equal(registry.hasAccount('user-a'), true);
  assert.equal(registry.hasAccount('missing'), false);
});

test('registry generates unique IDs when callers do not provide one', () => {
  const registry = createRegistry();
  const first = registry.createAccount();
  const second = registry.createAccount();

  assert.ok(first.id);
  assert.ok(second.id);
  assert.notEqual(first.id, second.id);
});

test('registry rejects duplicate and invalid account IDs', () => {
  const registry = createRegistry();
  registry.createAccount({ id: 'user-a' });

  assert.throws(() => registry.createAccount({ id: 'user-a' }), /already exists/);
  assert.throws(() => registry.createAccount({ id: '' }), /Account ID/);
  assert.throws(() => registry.createAccount({ id: 'x'.repeat(129) }), /Account ID/);
});

test('accounts created by the registry cannot access each other\'s portfolio or orders', () => {
  const registry = createRegistry();
  const first = registry.createAccount({ id: 'user-a' });
  const second = registry.createAccount({ id: 'user-b' });

  const startingBalance = second.portfolioService.getBalances().USDT;
  const order = first.matchingEngine.placeOrder({
    symbol: 'BTC/USDT',
    side: 'BUY',
    type: 'MARKET',
    quantity: 0.1,
    leverage: 10,
    currentMarketPrice: 65000
  });

  assert.equal(order.status, 'FILLED');
  assert.equal(first.portfolioService.positions.length, 1);
  assert.equal(second.portfolioService.positions.length, 0);
  assert.ok(first.portfolioService.getBalances().USDT < 10000);
  assert.equal(second.portfolioService.getBalances().USDT, startingBalance);
  assert.equal(first.matchingEngine.getOrderHistory().length, 1);
  assert.equal(second.matchingEngine.getOrderHistory().length, 0);

  const restingOrder = first.matchingEngine.placeOrder({
    symbol: 'SOL/USDT',
    side: 'BUY',
    type: 'LIMIT',
    price: 100,
    quantity: 1,
    leverage: 1,
    currentMarketPrice: 160
  });

  assert.equal(restingOrder.status, 'OPEN');
  assert.throws(() => second.matchingEngine.cancelOrder(restingOrder.id), /not found/);
  assert.equal(first.matchingEngine.getOpenOrders().some(item => item.id === restingOrder.id), true);
});

test('requireAccount fails closed for unknown account IDs', () => {
  const registry = createRegistry();
  assert.equal(registry.getAccount('unknown'), undefined);
  assert.throws(() => registry.requireAccount('unknown'), /not found/);
});
