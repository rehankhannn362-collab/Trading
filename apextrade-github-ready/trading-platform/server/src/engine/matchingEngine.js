import { getMarket } from '../config/markets.js';
import { orderBookManager } from './orderBook.js';
import { portfolioService } from '../services/portfolioService.js';

/**
 * Order Matching and Execution Engine
 * Handles Market orders with realistic slippage, resting Limit orders on the L2 book,
 * automatic trigger executions upon price movement, and fee calculations.
 */
export class MatchingEngine {
  constructor() {
    this.openOrders = new Map(); // orderId -> order
    this.orderHistory = [];      // Array of past executed / cancelled orders
    this.fillListeners = new Set();
  }

  placeOrder({ symbol, side, type, price, quantity, leverage = 1, takeProfit = null, stopLoss = null, currentMarketPrice }) {
    const market = getMarket(symbol);
    if (!market) throw new Error(`Invalid symbol: ${symbol}`);

    if (!['BUY', 'SELL'].includes(side)) {
      throw new Error(`Invalid side: ${side}. Must be BUY or SELL`);
    }

    if (!['MARKET', 'LIMIT'].includes(type)) {
      throw new Error(`Invalid order type: ${type}. Must be MARKET or LIMIT`);
    }

    const rawQuantity = Number(quantity);
    if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) throw new Error('Quantity must be a finite number greater than zero');
    const qty = Number(rawQuantity.toFixed(market.quantityPrecision));
    if (qty < market.minQuantity) throw new Error(`Minimum order quantity for ${symbol} is ${market.minQuantity}`);
    const lev = leverage === undefined ? 1 : Number(leverage);
    if (!Number.isInteger(lev) || lev < 1 || lev > market.maxLeverage) {
      throw new Error(`Leverage must be a whole number between 1x and ${market.maxLeverage}x`);
    }
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const tpVal = takeProfit ? Number(Number(takeProfit).toFixed(market.pricePrecision)) : null;
    const slVal = stopLoss ? Number(Number(stopLoss).toFixed(market.pricePrecision)) : null;

    if (type === 'MARKET') {
      // Execute immediately against market mark price with slippage
      const basePrice = Number(currentMarketPrice) > 0 ? Number(currentMarketPrice) : market.basePrice;
      const slippageRate = (side === 'BUY' ? 1 : -1) * 0.0002;
      const fillPrice = Number((basePrice * (1 + slippageRate)).toFixed(market.pricePrecision));
      const fee = Number((fillPrice * qty * market.takerFee).toFixed(8));

      // Open position in portfolio service
      const positionSide = side === 'BUY' ? 'LONG' : 'SHORT';
      const position = portfolioService.openPosition({
        symbol,
        side: positionSide,
        entryPrice: fillPrice,
        quantity: qty,
        leverage: lev,
        takeProfit: tpVal,
        entryFee: fee,
        stopLoss: slVal
      });

      const executedOrder = {
        id: orderId,
        symbol,
        side,
        type: 'MARKET',
        price: fillPrice,
        quantity: qty,
        filled: qty,
        status: 'FILLED',
        leverage: lev,
        fee,
        feeAsset: market.quoteAsset,
        takeProfit: tpVal,
        stopLoss: slVal,
        createdAt: now,
        executedAt: now
      };

      this.orderHistory.unshift(executedOrder);
      this.notifyFill(executedOrder, position);

      return executedOrder;
    }

    // LIMIT Order handling
    const rawLimitPrice = Number(price);
    if (!Number.isFinite(rawLimitPrice) || rawLimitPrice <= 0) {
      throw new Error('Valid limit price is required for LIMIT orders');
    }
    const limitPrice = Number(rawLimitPrice.toFixed(market.pricePrecision));
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      throw new Error('Valid limit price is required for LIMIT orders');
    }

    const currentPrice = Number(currentMarketPrice) > 0 ? Number(currentMarketPrice) : market.basePrice;
    const isImmediatelyMarketable =
      (side === 'BUY' && limitPrice >= currentPrice) ||
      (side === 'SELL' && limitPrice <= currentPrice);

    if (isImmediatelyMarketable) {
      // Immediate taker fill at current market price or better
      // Marketable limits receive the current market price (price improvement).
      const fillPrice = currentPrice;
      const fee = Number((fillPrice * qty * market.takerFee).toFixed(8));
      const positionSide = side === 'BUY' ? 'LONG' : 'SHORT';

      const position = portfolioService.openPosition({
        symbol,
        side: positionSide,
        entryPrice: fillPrice,
        quantity: qty,
        leverage: lev,
        takeProfit: tpVal,
        stopLoss: slVal,
        entryFee: fee
      });

      const executedOrder = {
        id: orderId,
        symbol,
        side,
        type: 'LIMIT',
        price: fillPrice,
        quantity: qty,
        filled: qty,
        status: 'FILLED',
        leverage: lev,
        fee,
        feeAsset: market.quoteAsset,
        takeProfit: tpVal,
        stopLoss: slVal,
        createdAt: now,
        executedAt: now
      };

      this.orderHistory.unshift(executedOrder);
      this.notifyFill(executedOrder, position);

      return executedOrder;
    }

    // Resting limit order on the book
    const restingOrder = {
      id: orderId,
      symbol,
      side,
      type: 'LIMIT',
      price: limitPrice,
      quantity: qty,
      filled: 0,
      status: 'OPEN',
      leverage: lev,
      takeProfit: tpVal,
      stopLoss: slVal,
      createdAt: now
    };

    this.openOrders.set(orderId, restingOrder);
    orderBookManager.addUserOrder(restingOrder);

    return restingOrder;
  }

  cancelOrder(orderId) {
    const order = this.openOrders.get(orderId);
    if (!order) {
      throw new Error(`Open order ${orderId} not found`);
    }

    order.status = 'CANCELLED';
    order.cancelledAt = Date.now();

    this.openOrders.delete(orderId);
    orderBookManager.removeUserOrder(orderId);
    this.orderHistory.unshift(order);

    return order;
  }

  checkTriggers(symbol, currentPrice) {
    const executedFills = [];

    for (const [orderId, order] of this.openOrders.entries()) {
      if (order.symbol !== symbol) continue;

      let matched = false;
      if (order.side === 'BUY' && currentPrice <= order.price) {
        matched = true;
      } else if (order.side === 'SELL' && currentPrice >= order.price) {
        matched = true;
      }

      if (matched) {
        const market = getMarket(symbol);
        // Resting limits execute at the triggering market price, not the limit price.
        const fillPrice = Number(currentPrice);
        const fee = Number((fillPrice * order.quantity * (market?.makerFee || 0.0002)).toFixed(8));
        const positionSide = order.side === 'BUY' ? 'LONG' : 'SHORT';

        const position = portfolioService.openPosition({
          symbol: order.symbol,
          side: positionSide,
          entryPrice: fillPrice,
          quantity: order.quantity,
          leverage: order.leverage,
          takeProfit: order.takeProfit,
          entryFee: fee,
          stopLoss: order.stopLoss
        });

        order.status = 'FILLED';
        order.filled = order.quantity;
        order.executedAt = Date.now();
        order.fee = fee;
        order.feeAsset = market?.quoteAsset || 'USDT';

        this.openOrders.delete(orderId);
        orderBookManager.removeUserOrder(orderId);
        order.limitPrice = order.price;
        order.price = fillPrice;
        this.orderHistory.unshift(order);

        this.notifyFill(order, position);
        executedFills.push(order);
      }
    }

    return executedFills;
  }

  cancelAllOrders() {
    const cancelled = [];
    for (const orderId of [...this.openOrders.keys()]) cancelled.push(this.cancelOrder(orderId));
    return cancelled;
  }

  resetAll() {
    this.cancelAllOrders();
    this.orderHistory = [];
  }

  getOpenOrders(symbol = null) {
    const orders = Array.from(this.openOrders.values());
    if (symbol) {
      return orders.filter(o => o.symbol === symbol);
    }
    return orders;
  }

  getOrderHistory(limit = 50) {
    return this.orderHistory.slice(0, limit);
  }

  onFill(callback) {
    this.fillListeners.add(callback);
    return () => this.fillListeners.delete(callback);
  }

  notifyFill(order, position) {
    for (const listener of this.fillListeners) {
      try {
        listener(order, position);
      } catch (err) {
        console.error('Error notifying fill listener:', err);
      }
    }
  }
}

export const matchingEngine = new MatchingEngine();
