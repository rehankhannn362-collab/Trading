import { MARKETS, TIMEFRAMES } from '../config/markets.js';

/**
 * Market Simulation Engine
 * Generates realistic Brownian motion price movements, manages historical OHLCV bars,
 * and produces real-time market ticks and simulated trades.
 */
export class MarketSimulator {
  constructor() {
    this.markets = new Map();
    this.tickSubscribers = new Set();
    this.candleSubscribers = new Set();
    this.tradeSubscribers = new Set();
    this.intervalId = null;

    this.initialize();
  }

  initialize() {
    const now = Date.now();

    for (const m of MARKETS) {
      // Seed 24h stats
      const open24h = m.basePrice * (1 + (Math.random() * 0.04 - 0.02));
      const high24h = Math.max(open24h, m.basePrice) * (1 + Math.random() * 0.025);
      const low24h = Math.min(open24h, m.basePrice) * (1 - Math.random() * 0.025);
      const volume24h = (m.basePrice < 10 ? 5000000 : m.basePrice < 1000 ? 500000 : 25000) * (0.8 + Math.random() * 0.4);

      const state = {
        config: m,
        price: m.basePrice,
        open24h,
        high24h,
        low24h,
        volume24h,
        tradesCount24h: Math.floor(5000 + Math.random() * 15000),
        recentTrades: [],
        candles: {} // timeframe -> array of candle objects
      };

      // Generate realistic past candles for each timeframe anchored to current price
      for (const [tf, duration] of Object.entries(TIMEFRAMES)) {
        state.candles[tf] = this.generateHistoricalCandles(m, tf, duration, now, state.price);
      }

      // Generate seed recent trades
      for (let i = 0; i < 25; i++) {
        const side = Math.random() > 0.48 ? 'BUY' : 'SELL';
        const priceOffset = (Math.random() - 0.5) * m.basePrice * 0.001;
        const price = Number((m.basePrice + priceOffset).toFixed(m.pricePrecision));
        const amount = Number((Math.random() * (m.minQuantity * 15) + m.minQuantity).toFixed(m.quantityPrecision));
        state.recentTrades.unshift({
          id: `seed_${i}_${Date.now()}`,
          symbol: m.symbol,
          side,
          price,
          amount,
          time: now - (25 - i) * 1200
        });
      }

      this.markets.set(m.symbol, state);
    }
  }

  generateHistoricalCandles(market, tf, durationMs, now, anchorPrice = market.basePrice) {
    const candlesCount = 200;
    const candles = [];
    let barClose = anchorPrice;

    for (let i = 0; i < candlesCount; i++) {
      const timeMs = Math.floor((now - i * durationMs) / durationMs) * durationMs;
      const timeSeconds = Math.floor(timeMs / 1000);
      const tfVolatility = market.volatility * Math.sqrt(durationMs / 60000);

      // Bar price change (Brownian motion backwards)
      const shock = (Math.random() + Math.random() + Math.random() - 1.5) / 1.0;
      const change = barClose * tfVolatility * shock * 0.35;

      const openVal = Number(Math.max(market.basePrice * 0.5, barClose - change).toFixed(market.pricePrecision));
      const closeVal = Number(barClose.toFixed(market.pricePrecision));

      const wickHigh = Math.random() * barClose * tfVolatility * 0.25;
      const wickLow = Math.random() * barClose * tfVolatility * 0.25;
      const highVal = Number((Math.max(openVal, closeVal) + wickHigh).toFixed(market.pricePrecision));
      const lowVal = Number(Math.max(market.basePrice * 0.5, Math.min(openVal, closeVal) - wickLow).toFixed(market.pricePrecision));
      const volume = Number(((market.basePrice < 100 ? 5000 : 50) * (0.5 + Math.random() * 1.5)).toFixed(market.quantityPrecision));

      candles.unshift({
        time: timeSeconds,
        open: openVal,
        high: highVal,
        low: lowVal,
        close: closeVal,
        volume
      });

      // The open of this bar becomes the close of the preceding historical bar
      barClose = openVal;
    }

    return candles;
  }

  start() {
    if (this.intervalId) return;

    // Simulation tick loop runs every 250ms
    this.intervalId = setInterval(() => {
      this.step();
    }, 250);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  step() {
    const now = Date.now();

    for (const [symbol, state] of this.markets.entries()) {
      const m = state.config;
      // Approximate normal distribution shock via Central Limit Theorem
      const shock = (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 1.15;

      // Stochastic Brownian motion step
      // Normalized percentage mean-reversion drift
      const priceDevPercent = (m.basePrice - state.price) / m.basePrice;
      const meanReversion = priceDevPercent * 0.002;
      const tickVolatility = m.volatility * Math.sqrt(250 / 60000);
      const rawDelta = (m.trend * (250 / 60000)) + meanReversion + (tickVolatility * shock);
      // Strictly clamp delta per tick between -0.1% and +0.1%
      const deltaPercent = Math.max(-0.001, Math.min(0.001, rawDelta));
      const oldPrice = Math.max(m.basePrice * 0.5, state.price);
      const minFloor = m.basePrice * 0.5; // Price never drops below 50% of base
      const maxCeiling = m.basePrice * 2.0; // Price never exceeds 200% of base
      const calculatedPrice = oldPrice * (1 + deltaPercent);
      const boundedPrice = Math.max(minFloor, Math.min(maxCeiling, calculatedPrice));
      const newPrice = Number(boundedPrice.toFixed(m.pricePrecision));

      state.price = newPrice;
      state.high24h = Math.max(state.high24h, newPrice);
      state.low24h = Math.min(Math.max(minFloor, state.low24h), newPrice);

      const tickVolume = Number((Math.random() * (m.minQuantity * 8) + m.minQuantity).toFixed(m.quantityPrecision));
      state.volume24h += tickVolume;
      state.tradesCount24h += 1;

      const direction = newPrice >= oldPrice ? 'up' : 'down';
      const side = direction === 'up' ? 'BUY' : 'SELL';

      // Record simulated trade
      const trade = {
        id: `t_${now}_${Math.random().toString(36).substring(2, 7)}`,
        symbol,
        side,
        price: newPrice,
        amount: tickVolume,
        time: now
      };

      state.recentTrades.unshift(trade);
      if (state.recentTrades.length > 50) {
        state.recentTrades.pop();
      }

      // Update candles for all timeframes
      for (const [tf, durationMs] of Object.entries(TIMEFRAMES)) {
        this.updateCandle(state, tf, durationMs, newPrice, tickVolume, now);
      }

      const tickerData = this.getTicker(symbol);

      // Notify tick subscribers
      for (const sub of this.tickSubscribers) {
        sub(symbol, tickerData, trade);
      }

      // Notify trade subscribers
      for (const sub of this.tradeSubscribers) {
        sub(symbol, trade);
      }
    }
  }

  updateCandle(state, tf, durationMs, price, volume, now) {
    const candles = state.candles[tf];
    if (!candles || candles.length === 0) return;

    const currentBarTimeSeconds = Math.floor(Math.floor(now / durationMs) * durationMs / 1000);
    const lastBar = candles[candles.length - 1];

    if (lastBar.time === currentBarTimeSeconds) {
      // Update ongoing bar
      const open = lastBar.open;
      const close = price;
      lastBar.high = Number(Math.max(open, close, lastBar.high, price).toFixed(state.config.pricePrecision));
      lastBar.low = Number(Math.min(open, close, lastBar.low, price).toFixed(state.config.pricePrecision));
      lastBar.close = close;
      lastBar.volume = Number((lastBar.volume + volume).toFixed(state.config.quantityPrecision));

      for (const sub of this.candleSubscribers) {
        sub(state.config.symbol, tf, { ...lastBar }, false);
      }
    } else if (currentBarTimeSeconds > lastBar.time) {
      // 1. Notify that previous bar is now closed
      for (const sub of this.candleSubscribers) {
        sub(state.config.symbol, tf, { ...lastBar }, true);
      }

      // 2. Start new ongoing bar
      const openVal = lastBar.close;
      const closeVal = price;
      const highVal = Number(Math.max(openVal, closeVal).toFixed(state.config.pricePrecision));
      const lowVal = Number(Math.min(openVal, closeVal).toFixed(state.config.pricePrecision));

      const newBar = {
        time: currentBarTimeSeconds,
        open: openVal,
        high: highVal,
        low: lowVal,
        close: closeVal,
        volume: Number(volume.toFixed(state.config.quantityPrecision))
      };

      candles.push(newBar);
      if (candles.length > 500) {
        candles.shift();
      }

      // 3. Notify of new ongoing bar
      for (const sub of this.candleSubscribers) {
        sub(state.config.symbol, tf, { ...newBar }, false);
      }
    }
  }

  getTicker(symbol) {
    const state = this.markets.get(symbol);
    if (!state) return null;

    const change24h = state.price - state.open24h;
    const change24hPercent = (change24h / state.open24h) * 100;

    return {
      symbol,
      price: state.price,
      open24h: Number(state.open24h.toFixed(state.config.pricePrecision)),
      high24h: Number(state.high24h.toFixed(state.config.pricePrecision)),
      low24h: Number(state.low24h.toFixed(state.config.pricePrecision)),
      volume24h: Number(state.volume24h.toFixed(2)),
      change24h: Number(change24h.toFixed(state.config.pricePrecision)),
      change24hPercent: Number(change24hPercent.toFixed(2)),
      tradesCount: state.tradesCount24h,
      timestamp: Date.now()
    };
  }

  getAllTickers() {
    const tickers = [];
    for (const symbol of this.markets.keys()) {
      tickers.push(this.getTicker(symbol));
    }
    return tickers;
  }

  getCandles(symbol, tf = '1m', limit = 200) {
    const state = this.markets.get(symbol);
    if (!state || !state.candles[tf]) return [];
    return state.candles[tf].slice(-limit);
  }

  getRecentTrades(symbol, limit = 30) {
    const state = this.markets.get(symbol);
    if (!state) return [];
    return state.recentTrades.slice(0, limit);
  }

  subscribeTicks(callback) {
    this.tickSubscribers.add(callback);
    return () => this.tickSubscribers.delete(callback);
  }

  subscribeCandles(callback) {
    this.candleSubscribers.add(callback);
    return () => this.candleSubscribers.delete(callback);
  }

  subscribeTrades(callback) {
    this.tradeSubscribers.add(callback);
    return () => this.tradeSubscribers.delete(callback);
  }
}

export const simulator = new MarketSimulator();
