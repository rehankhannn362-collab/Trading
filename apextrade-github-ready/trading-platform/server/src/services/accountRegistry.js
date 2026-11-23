import { randomUUID } from 'node:crypto';
import { MatchingEngine, matchingEngine as defaultMatchingEngine } from '../engine/matchingEngine.js';
import { orderBookManager as defaultOrderBook } from '../engine/orderBook.js';
import { PortfolioService, portfolioService as defaultPortfolioService } from './portfolioService.js';

function validateAccountId(id) {
  if (typeof id !== 'string' || id.trim().length === 0 || id.length > 128) {
    throw new Error('Account ID must be a non-empty string of at most 128 characters');
  }
  return id.trim();
}

/**
 * In-memory registry of isolated demo trading accounts.
 *
 * Each account owns its portfolio service and matching engine. Market data and
 * the public order book remain shared across accounts by design. This registry
 * is a process-local foundation; persistence and authenticated lookup are
 * introduced in later Phase 3 steps.
 */
export class AccountRegistry {
  constructor({
    defaultAccountId = 'demo',
    defaultPortfolio = defaultPortfolioService,
    defaultEngine = defaultMatchingEngine,
    orderBook = defaultOrderBook
  } = {}) {
    this.orderBook = orderBook;
    this.defaultAccountId = validateAccountId(defaultAccountId);
    this.accounts = new Map();

    this.accounts.set(this.defaultAccountId, {
      id: this.defaultAccountId,
      portfolioService: defaultPortfolio,
      matchingEngine: defaultEngine
    });
  }

  createAccount({ id = randomUUID() } = {}) {
    const accountId = validateAccountId(id);
    if (this.accounts.has(accountId)) {
      throw new Error(`Account ${accountId} already exists`);
    }

    const portfolioService = new PortfolioService();
    const matchingEngine = new MatchingEngine({
      portfolioService,
      orderBook: this.orderBook
    });
    const account = { id: accountId, portfolioService, matchingEngine };

    this.accounts.set(accountId, account);
    return account;
  }

  getAccount(accountId) {
    if (typeof accountId !== 'string') return undefined;
    return this.accounts.get(accountId);
  }

  requireAccount(accountId) {
    const account = this.getAccount(accountId);
    if (!account) throw new Error(`Account ${accountId ?? ''} not found`);
    return account;
  }

  hasAccount(accountId) {
    return this.accounts.has(accountId);
  }

  listAccountIds() {
    return [...this.accounts.keys()];
  }
}

export const accountRegistry = new AccountRegistry();
