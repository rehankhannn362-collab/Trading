const API_BASE = '/api';

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }
  return data.data;
}

function safeSymbol(sym) {
  if (!sym) return '';
  return encodeURIComponent(sym.replace(/\//g, '-'));
}

export const api = {
  // Markets
  getMarkets: () => fetchJson(`${API_BASE}/markets`),
  getTicker: (symbol) => fetchJson(`${API_BASE}/markets/${safeSymbol(symbol)}/ticker`),
  getCandles: (symbol, timeframe = '1m', limit = 200) =>
    fetchJson(`${API_BASE}/markets/${safeSymbol(symbol)}/candles?timeframe=${timeframe}&limit=${limit}`),
  getOrderBook: (symbol, depth = 20) =>
    fetchJson(`${API_BASE}/markets/${safeSymbol(symbol)}/orderbook?depth=${depth}`),
  getRecentTrades: (symbol, limit = 30) =>
    fetchJson(`${API_BASE}/markets/${safeSymbol(symbol)}/trades?limit=${limit}`),

  // Orders
  placeOrder: (orderPayload) =>
    fetchJson(`${API_BASE}/orders`, {
      method: 'POST',
      body: JSON.stringify(orderPayload)
    }),
  cancelOrder: (orderId) =>
    fetchJson(`${API_BASE}/orders/${orderId}`, {
      method: 'DELETE'
    }),
  getOpenOrders: (symbol) =>
    fetchJson(`${API_BASE}/orders${symbol ? `?symbol=${safeSymbol(symbol)}` : ''}`),
  getOrderHistory: (limit = 50) =>
    fetchJson(`${API_BASE}/orders/history?limit=${limit}`),

  // Portfolio
  getPortfolio: () => fetchJson(`${API_BASE}/portfolio`),
  closePosition: (positionId, symbol) =>
    fetchJson(`${API_BASE}/positions/${positionId}/close`, {
      method: 'POST',
      body: JSON.stringify({ symbol })
    }),
  updatePositionTpSl: (positionId, { takeProfit, stopLoss }) =>
    fetchJson(`${API_BASE}/positions/${positionId}/tpsl`, {
      method: 'POST',
      body: JSON.stringify({ takeProfit, stopLoss })
    }),
  claimFaucet: (amount = 10000) =>
    fetchJson(`${API_BASE}/wallet/faucet`, {
      method: 'POST',
      body: JSON.stringify({ amount })
    }),
  resetPortfolio: () =>
    fetchJson(`${API_BASE}/wallet/reset`, {
      method: 'POST'
    }),
  getTradeHistory: (limit = 50) =>
    fetchJson(`${API_BASE}/portfolio/trades?limit=${limit}`)
};
