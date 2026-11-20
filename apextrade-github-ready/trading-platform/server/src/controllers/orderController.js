import { matchingEngine } from '../engine/matchingEngine.js';
import { simulator } from '../engine/marketSimulator.js';

export const orderController = {
  placeOrder: (req, res) => {
    try {
      const { symbol, side, type, price, quantity, leverage, takeProfit, stopLoss } = req.body;
      const ticker = simulator.getTicker(symbol);
      const currentMarketPrice = ticker ? ticker.price : null;

      const order = matchingEngine.placeOrder({
        symbol,
        side,
        type,
        price,
        quantity,
        leverage,
        takeProfit,
        stopLoss,
        currentMarketPrice
      });

      res.status(201).json({ success: true, data: order });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },

  cancelOrder: (req, res) => {
    try {
      const { id } = req.params;
      const cancelled = matchingEngine.cancelOrder(id);
      res.json({ success: true, data: cancelled });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  },

  getOpenOrders: (req, res) => {
    try {
      const { symbol } = req.query;
      const decodedSymbol = symbol ? decodeURIComponent(symbol) : null;
      const orders = matchingEngine.getOpenOrders(decodedSymbol);
      res.json({ success: true, data: orders });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  getOrderHistory: (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const history = matchingEngine.getOrderHistory(Number(limit));
      res.json({ success: true, data: history });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
};
