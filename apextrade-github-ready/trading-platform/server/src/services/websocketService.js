import { WebSocketServer, WebSocket } from 'ws';
import { simulator } from '../engine/marketSimulator.js';
import { orderBookManager } from '../engine/orderBook.js';
import { matchingEngine } from '../engine/matchingEngine.js';
import { portfolioService } from './portfolioService.js';

/**
 * WebSocket Real-Time Broadcasting Service
 * Manages subscriptions for market tickers, L2 depth orderbook,
 * live trade tape, candle updates, and private execution fills.
 */
export class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // ws -> Set(channels)
  }

  initialize(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      this.clients.set(ws, new Set(['tickers', 'portfolio']));

      // Send initial welcome message and full ticker snapshot
      ws.send(JSON.stringify({
        type: 'snapshot:tickers',
        data: simulator.getAllTickers()
      }));

      // Send initial portfolio state
      const currentPrices = {};
      for (const t of simulator.getAllTickers()) {
        currentPrices[t.symbol] = t.price;
      }
      ws.send(JSON.stringify({
        type: 'snapshot:portfolio',
        data: portfolioService.getPortfolio(currentPrices)
      }));

      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());
          this.handleClientMessage(ws, parsed);
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('WebSocket client error:', err);
        this.clients.delete(ws);
      });
    });

    // Wire up Market Simulator events
    simulator.subscribeTicks((symbol, ticker, trade) => {
      orderBookManager.setMarkPrice(symbol, ticker.price);

      // Check resting limit orders trigger
      const fills = matchingEngine.checkTriggers(symbol, ticker.price);
      if (fills.length > 0) {
        this.broadcastPortfolioUpdate();
      }

      // Check Take Profit and Stop Loss triggers
      const tpSlTriggers = portfolioService.checkTpSl(symbol, ticker.price);
      if (tpSlTriggers.length > 0) {
        this.broadcastPortfolioUpdate();
        for (const trig of tpSlTriggers) {
          this.broadcastToChannel('portfolio', {
            type: 'position:closed',
            reason: trig.reason,
            symbol,
            fillPrice: trig.fillPrice,
            pnl: trig.pnl
          });
        }
      }

      // Broadcast ticker
      this.broadcastToChannel('tickers', {
        type: 'tick',
        symbol,
        data: ticker
      });

      // Broadcast order book snapshot
      const depthChannel = `depth:${symbol}`;
      if (this.hasChannelSubscribers(depthChannel)) {
        const bookSnapshot = orderBookManager.getSnapshot(symbol);
        this.broadcastToChannel(depthChannel, {
          type: 'depth',
          symbol,
          data: bookSnapshot
        });
      }
    });

    simulator.subscribeTrades((symbol, trade) => {
      const channel = `trades:${symbol}`;
      if (this.hasChannelSubscribers(channel)) {
        this.broadcastToChannel(channel, {
          type: 'trade',
          symbol,
          data: trade
        });
      }
    });

    simulator.subscribeCandles((symbol, timeframe, candle, isClosed) => {
      const channel = `candles:${symbol}:${timeframe}`;
      if (this.hasChannelSubscribers(channel)) {
        this.broadcastToChannel(channel, {
          type: 'candle',
          symbol,
          timeframe,
          isClosed,
          data: candle
        });
      }
    });

    // Wire up order fill notifications
    matchingEngine.onFill((order, position) => {
      this.broadcastPortfolioUpdate();
      this.broadcastToChannel('portfolio', {
        type: 'order:filled',
        order,
        position
      });
    });
  }

  handleClientMessage(ws, message) {
    const { action, channel, symbol, timeframe } = message;
    const clientSubs = this.clients.get(ws);
    if (!clientSubs) return;

    if (action === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      return;
    }

    if (action === 'subscribe') {
      const ch = channel || (symbol && timeframe ? `candles:${symbol}:${timeframe}` : symbol ? `depth:${symbol}` : 'tickers');
      clientSubs.add(ch);

      // Send initial snapshot for the subscribed channel
      if (ch.startsWith('depth:')) {
        const sym = ch.split(':')[1];
        ws.send(JSON.stringify({
          type: 'depth',
          symbol: sym,
          data: orderBookManager.getSnapshot(sym)
        }));
      } else if (ch.startsWith('trades:')) {
        const sym = ch.split(':')[1];
        ws.send(JSON.stringify({
          type: 'snapshot:trades',
          symbol: sym,
          data: simulator.getRecentTrades(sym)
        }));
      } else if (ch.startsWith('candles:')) {
        const [, sym, tf] = ch.split(':');
        ws.send(JSON.stringify({
          type: 'snapshot:candles',
          symbol: sym,
          timeframe: tf,
          data: simulator.getCandles(sym, tf)
        }));
      }
      return;
    }

    if (action === 'unsubscribe') {
      const ch = channel;
      if (ch) {
        clientSubs.delete(ch);
      }
      return;
    }
  }

  hasChannelSubscribers(channel) {
    for (const subs of this.clients.values()) {
      if (subs.has(channel)) return true;
    }
    return false;
  }

  broadcastToChannel(channel, payload) {
    const msg = JSON.stringify(payload);
    for (const [ws, subs] of this.clients.entries()) {
      if (subs.has(channel) && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  broadcastPortfolioUpdate() {
    const currentPrices = {};
    for (const t of simulator.getAllTickers()) {
      currentPrices[t.symbol] = t.price;
    }
    const portfolio = portfolioService.getPortfolio(currentPrices);
    const openOrders = matchingEngine.getOpenOrders();

    this.broadcastToChannel('portfolio', {
      type: 'portfolio:updated',
      data: {
        portfolio,
        openOrders
      }
    });
  }
}

export const wsService = new WebSocketService();
