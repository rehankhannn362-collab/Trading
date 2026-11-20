import { MARKETS } from '../config/markets.js';

/**
 * Level 2 Order Book Engine
 * Maintains bid and ask ladders, integrates user resting limit orders,
 * calculates market spread, and aggregates cumulative depth.
 */
export class OrderBookManager {
  constructor() {
    this.books = new Map();
    this.userOrders = new Map(); // orderId -> order
  }

  getOrCreateBook(symbol) {
    if (!this.books.has(symbol)) {
      const market = MARKETS.find(m => m.symbol === symbol) || {
        symbol,
        basePrice: 100,
        pricePrecision: 2,
        quantityPrecision: 4
      };
      this.books.set(symbol, {
        market,
        markPrice: market.basePrice,
        userBids: new Map(), // price -> array of user orders
        userAsks: new Map()
      });
    }
    return this.books.get(symbol);
  }

  setMarkPrice(symbol, price) {
    const book = this.getOrCreateBook(symbol);
    book.markPrice = price;
  }

  addUserOrder(order) {
    const book = this.getOrCreateBook(order.symbol);
    this.userOrders.set(order.id, order);

    const price = Number(order.price.toFixed(book.market.pricePrecision));
    const targetMap = order.side === 'BUY' ? book.userBids : book.userAsks;

    if (!targetMap.has(price)) {
      targetMap.set(price, []);
    }
    targetMap.get(price).push(order);
  }

  removeUserOrder(orderId) {
    const order = this.userOrders.get(orderId);
    if (!order) return;

    this.userOrders.delete(orderId);
    const book = this.books.get(order.symbol);
    if (!book) return;

    const price = Number(order.price.toFixed(book.market.pricePrecision));
    const targetMap = order.side === 'BUY' ? book.userBids : book.userAsks;

    if (targetMap.has(price)) {
      const orders = targetMap.get(price).filter(o => o.id !== orderId);
      if (orders.length === 0) {
        targetMap.delete(price);
      } else {
        targetMap.set(price, orders);
      }
    }
  }

  getSnapshot(symbol, depth = 15) {
    const book = this.getOrCreateBook(symbol);
    const m = book.market;
    const mark = Math.max(m.basePrice * 0.1, Number(book.markPrice) || m.basePrice);

    // Tick increment based on precision
    const tick = Math.pow(10, -m.pricePrecision);
    // Base spread roughly 1 to 3 ticks
    const halfSpread = tick * Math.max(1, Math.round(mark * 0.0001 / tick));

    const bidsMap = new Map();
    const asksMap = new Map();

    // Generate realistic simulated liquidity levels around current mark price
    for (let i = 1; i <= depth; i++) {
      // Bids (below mark price, strictly > 0)
      const rawBid = mark - halfSpread - (i - 1) * tick * Math.max(1, Math.round(i * 0.8));
      const bidPrice = Number(Math.max(tick, rawBid).toFixed(m.pricePrecision));
      const bidBaseSize = m.basePrice < 100 ? (100 * i) : (0.5 * (1 + i * 0.4));
      const bidNoise = 0.7 + Math.sin(i * 1.5) * 0.3;
      const bidSize = Number((bidBaseSize * bidNoise).toFixed(m.quantityPrecision));
      bidsMap.set(bidPrice, bidSize);

      // Asks (above mark price)
      const askPrice = Number((mark + halfSpread + (i - 1) * tick * Math.max(1, Math.round(i * 0.8))).toFixed(m.pricePrecision));
      const askBaseSize = m.basePrice < 100 ? (100 * i) : (0.5 * (1 + i * 0.4));
      const askNoise = 0.7 + Math.cos(i * 1.5) * 0.3;
      const askSize = Number((askBaseSize * askNoise).toFixed(m.quantityPrecision));
      asksMap.set(askPrice, askSize);
    }

    // Merge resting user orders
    for (const [price, orders] of book.userBids.entries()) {
      const totalUserQty = orders.reduce((sum, o) => sum + (o.quantity - o.filled), 0);
      bidsMap.set(price, (bidsMap.get(price) || 0) + totalUserQty);
    }
    for (const [price, orders] of book.userAsks.entries()) {
      const totalUserQty = orders.reduce((sum, o) => sum + (o.quantity - o.filled), 0);
      asksMap.set(price, (asksMap.get(price) || 0) + totalUserQty);
    }

    // Sort bids descending
    const sortedBids = Array.from(bidsMap.entries())
      .map(([price, size]) => ({ price, size: Number(size.toFixed(m.quantityPrecision)) }))
      .sort((a, b) => b.price - a.price)
      .slice(0, depth);

    // Sort asks ascending
    const sortedAsks = Array.from(asksMap.entries())
      .map(([price, size]) => ({ price, size: Number(size.toFixed(m.quantityPrecision)) }))
      .sort((a, b) => a.price - b.price)
      .slice(0, depth);

    // Calculate cumulative depth totals for visual depth bars
    let bidAccum = 0;
    const bidsWithTotal = sortedBids.map(b => {
      bidAccum += b.size;
      return [b.price, b.size, Number(bidAccum.toFixed(m.quantityPrecision))];
    });

    let askAccum = 0;
    const asksWithTotal = sortedAsks.map(a => {
      askAccum += a.size;
      return [a.price, a.size, Number(askAccum.toFixed(m.quantityPrecision))];
    });

    const bestBid = bidsWithTotal[0] ? bidsWithTotal[0][0] : mark;
    const bestAsk = asksWithTotal[0] ? asksWithTotal[0][0] : mark;
    const spread = Number((bestAsk - bestBid).toFixed(m.pricePrecision));
    const spreadPercent = Number(((spread / mark) * 100).toFixed(4));

    return {
      symbol,
      bids: bidsWithTotal,
      asks: asksWithTotal,
      bestBid,
      bestAsk,
      spread,
      spreadPercent,
      timestamp: Date.now()
    };
  }
}

export const orderBookManager = new OrderBookManager();
