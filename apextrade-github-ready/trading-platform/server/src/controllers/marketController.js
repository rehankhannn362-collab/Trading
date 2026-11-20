import { MARKETS } from '../config/markets.js';
import { simulator } from '../engine/marketSimulator.js';
import { orderBookManager } from '../engine/orderBook.js';

function normalizeSymbol(sym) {
  if (!sym) return '';
  const decoded = decodeURIComponent(sym);
  return decoded.includes('/') ? decoded : decoded.replace(/[-_]/g, '/');
}

export const marketController = {
  getMarkets: (req, res) => {
    try {
      const tickers = simulator.getAllTickers();
      const enriched = MARKETS.map(m => {
        const t = tickers.find(tick => tick.symbol === m.symbol) || {};
        return {
          ...m,
          price: t.price ?? m.basePrice,
          change24h: t.change24h ?? 0,
          change24hPercent: t.change24hPercent ?? 0,
          high24h: t.high24h ?? m.basePrice,
          low24h: t.low24h ?? m.basePrice,
          volume24h: t.volume24h ?? 0
        };
      });
      res.json({ success: true, data: enriched });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getTicker: (req, res) => {
    try {
      const { symbol } = req.params;
      const cleanSymbol = normalizeSymbol(symbol);
      const ticker = simulator.getTicker(cleanSymbol);
      if (!ticker) {
        return res.status(404).json({ success: false, error: 'Market not found' });
      }
      res.json({ success: true, data: ticker });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getCandles: (req, res) => {
    try {
      const { symbol } = req.params;
      const { timeframe = '1m', limit = 200 } = req.query;
      const cleanSymbol = normalizeSymbol(symbol);
      const candles = simulator.getCandles(cleanSymbol, timeframe, Number(limit));
      res.json({ success: true, data: candles });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getOrderBook: (req, res) => {
    try {
      const { symbol } = req.params;
      const { depth = 20 } = req.query;
      const cleanSymbol = normalizeSymbol(symbol);
      const snapshot = orderBookManager.getSnapshot(cleanSymbol, Number(depth));
      res.json({ success: true, data: snapshot });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getRecentTrades: (req, res) => {
    try {
      const { symbol } = req.params;
      const { limit = 30 } = req.query;
      const cleanSymbol = normalizeSymbol(symbol);
      const trades = simulator.getRecentTrades(cleanSymbol, Number(limit));
      res.json({ success: true, data: trades });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
};
