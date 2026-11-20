import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api.js';

const TradingContext = createContext(null);

export function TradingProvider({ children }) {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('1m');
  const [markets, setMarkets] = useState([]);
  const [tickers, setTickers] = useState({});
  const [candles, setCandles] = useState([]);
  const [currentBar, setCurrentBar] = useState(null);
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [], spread: 0, spreadPercent: 0 });
  const [recentTrades, setRecentTrades] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [priceDirection, setPriceDirection] = useState(null);
  const [orderPrefillPrice, setOrderPrefillPrice] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const prevPriceRef = useRef(null);
  const selectedSymbolRef = useRef(selectedSymbol);
  const timeframeRef = useRef(timeframe);
  const prevSubRef = useRef({ symbol: selectedSymbol, timeframe });

  // Active market details
  const activeMarket = markets.find(m => m.symbol === selectedSymbol) || {
    symbol: selectedSymbol,
    pricePrecision: 2,
    quantityPrecision: 4,
    baseAsset: selectedSymbol.split('/')[0] || 'BTC',
    quoteAsset: selectedSymbol.split('/')[1] || 'USDT',
    minQuantity: 0.001,
    maxLeverage: 50
  };

  const activeTicker = tickers[selectedSymbol] || {
    price: activeMarket.basePrice || 65000,
    change24h: 0,
    change24hPercent: 0,
    high24h: 65000,
    low24h: 65000,
    volume24h: 0
  };

  // 1. Fetch initial markets
  useEffect(() => {
    api.getMarkets()
      .then(data => {
        setMarkets(data);
        const map = {};
        data.forEach(m => {
          map[m.symbol] = {
            price: m.price,
            change24h: m.change24h,
            change24hPercent: m.change24hPercent,
            high24h: m.high24h,
            low24h: m.low24h,
            volume24h: m.volume24h
          };
        });
        setTickers(map);
      })
      .catch(err => console.error('Failed to load markets:', err));
  }, []);

  // 2. Fetch candles and recent trades when symbol or timeframe changes
  useEffect(() => {
    let isCancelled = false;

    // Load initial candles
    api.getCandles(selectedSymbol, timeframe, 200)
      .then(data => {
        if (!isCancelled) {
          setCandles(data);
          if (data.length > 0) {
            setCurrentBar(data[data.length - 1]);
          }
        }
      })
      .catch(err => console.error('Failed to load candles:', err));

    // Load order book snapshot
    api.getOrderBook(selectedSymbol, 20)
      .then(data => {
        if (!isCancelled) setOrderBook(data);
      })
      .catch(err => console.error('Failed to load orderbook:', err));

    // Load recent trades
    api.getRecentTrades(selectedSymbol, 30)
      .then(data => {
        if (!isCancelled) setRecentTrades(data);
      })
      .catch(err => console.error('Failed to load recent trades:', err));

    // Update subscriptions on active WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const prev = prevSubRef.current;
      if (prev.symbol !== selectedSymbol || prev.timeframe !== timeframe) {
        // Unsubscribe old
        wsRef.current.send(JSON.stringify({ action: 'unsubscribe', channel: `depth:${prev.symbol}` }));
        wsRef.current.send(JSON.stringify({ action: 'unsubscribe', channel: `trades:${prev.symbol}` }));
        wsRef.current.send(JSON.stringify({ action: 'unsubscribe', channel: `candles:${prev.symbol}:${prev.timeframe}` }));
        
        // Subscribe new
        wsRef.current.send(JSON.stringify({ action: 'subscribe', channel: `depth:${selectedSymbol}` }));
        wsRef.current.send(JSON.stringify({ action: 'subscribe', channel: `trades:${selectedSymbol}` }));
        wsRef.current.send(JSON.stringify({ action: 'subscribe', channel: `candles:${selectedSymbol}:${timeframe}` }));

        prevSubRef.current = { symbol: selectedSymbol, timeframe };
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedSymbol, timeframe]);

  // Keep refs up to date for WebSocket event listener
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  // 3. Connect & manage WebSocket (Persistent single connection)
  const connectWs = useCallback(() => {
    let wsUrl;
    if (import.meta.env.VITE_WS_URL) {
      wsUrl = import.meta.env.VITE_WS_URL;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      wsUrl = `ws://${window.location.hostname}:5000/ws`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws`;
    }

    setWsStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      const curSym = selectedSymbolRef.current;
      const curTf = timeframeRef.current;
      prevSubRef.current = { symbol: curSym, timeframe: curTf };

      // Subscribe to active channels
      ws.send(JSON.stringify({ action: 'subscribe', channel: 'tickers' }));
      ws.send(JSON.stringify({ action: 'subscribe', channel: `depth:${curSym}` }));
      ws.send(JSON.stringify({ action: 'subscribe', channel: `trades:${curSym}` }));
      ws.send(JSON.stringify({ action: 'subscribe', channel: `candles:${curSym}:${curTf}` }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const curSym = selectedSymbolRef.current;
        const curTf = timeframeRef.current;

        if (msg.type === 'tick') {
          setTickers(prev => ({
            ...prev,
            [msg.symbol]: msg.data
          }));

          if (msg.symbol === curSym) {
            const newPrice = msg.data.price;
            if (prevPriceRef.current !== null && newPrice !== prevPriceRef.current) {
              setPriceDirection(newPrice > prevPriceRef.current ? 'up' : 'down');
            }
            prevPriceRef.current = newPrice;
          }
        } else if (msg.type === 'snapshot:tickers') {
          const map = {};
          msg.data.forEach(t => { map[t.symbol] = t; });
          setTickers(map);
        } else if (msg.type === 'depth' && msg.symbol === curSym) {
          setOrderBook(msg.data);
        } else if (msg.type === 'trade' && msg.symbol === curSym) {
          setRecentTrades(prev => [msg.data, ...prev.slice(0, 49)]);
        } else if (msg.type === 'candle' && msg.symbol === curSym && msg.timeframe === curTf) {
          if (msg.data && typeof msg.data.time === 'number') {
            setCurrentBar(msg.data);
          }
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket encountered error, reconnecting...', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  return (
    <TradingContext.Provider
      value={{
        selectedSymbol,
        setSelectedSymbol,
        timeframe,
        setTimeframe,
        markets,
        activeMarket,
        tickers,
        activeTicker,
        candles,
        currentBar,
        orderBook,
        recentTrades,
        wsStatus,
        priceDirection,
        orderPrefillPrice,
        setOrderPrefillPrice
      }}
    >
      {children}
    </TradingContext.Provider>
  );
}

export function useTrading() {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
}
