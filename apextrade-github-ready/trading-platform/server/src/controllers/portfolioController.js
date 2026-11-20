import { portfolioService } from '../services/portfolioService.js';
import { matchingEngine } from '../engine/matchingEngine.js';
import { simulator } from '../engine/marketSimulator.js';

export const portfolioController = {
  getPortfolio: (req, res) => {
    try {
      const currentPrices = {};
      for (const t of simulator.getAllTickers()) {
        currentPrices[t.symbol] = t.price;
      }
      const portfolio = portfolioService.getPortfolio(currentPrices);
      res.json({ success: true, data: portfolio });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  closePosition: (req, res) => {
    try {
      const { id } = req.params;
      const { symbol } = req.body;
      const ticker = symbol ? simulator.getTicker(symbol) : null;
      const currentPrice = ticker ? ticker.price : null;

      const closed = portfolioService.closePosition(id, currentPrice);
      res.json({ success: true, data: closed });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },

  updatePositionTpSl: (req, res) => {
    try {
      const { id } = req.params;
      const { takeProfit, stopLoss } = req.body;
      const updated = portfolioService.updatePositionTpSl(id, { takeProfit, stopLoss });
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },

  claimFaucet: (req, res) => {
    try {
      const { amount = 10000 } = req.body || {};
      const balances = portfolioService.claimFaucet(Number(amount));
      res.json({ success: true, data: balances, message: `Successfully deposited $${amount} USDT testnet funds.` });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getTradeHistory: (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const trades = portfolioService.getClosedTrades(Number(limit));
      res.json({ success: true, data: trades });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  resetAll: (req, res) => {
    try {
      matchingEngine.resetAll();
      const portfolio = portfolioService.resetAll();
      res.json({ success: true, data: portfolio, message: 'Portfolio has been reset to defaults.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
};
