import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { deriveLivePortfolio } from '../utils/deriveLivePortfolio.js';
import { api } from '../services/api.js';
import { useTrading } from './TradingContext.jsx';

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const { tickers, markets } = useTrading();

  const [portfolioSnapshot, setPortfolioSnapshot] = useState({
    balances: { USDT: 10000, USD: 10000 },
    equity: 10000,
    cashBalance: 10000,
    availableMargin: 10000,
    totalMarginUsed: 0,
    totalUnrealizedPnl: 0,
    marginLevel: 999.9,
    positions: []
  });

  const portfolio = useMemo(
    () => deriveLivePortfolio(portfolioSnapshot, tickers, markets),
    [portfolioSnapshot, tickers, markets]
  );

  const [openOrders, setOpenOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const refreshPortfolio = useCallback(async () => {
    try {
      const data = await api.getPortfolio();
      setPortfolioSnapshot(data);
    } catch (err) {
      console.error('Failed to refresh portfolio:', err);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    try {
      const [orders, history, trades] = await Promise.all([
        api.getOpenOrders(),
        api.getOrderHistory(50),
        api.getTradeHistory(50)
      ]);
      setOpenOrders(orders);
      setOrderHistory(history);
      setTradeHistory(trades);
    } catch (err) {
      console.error('Failed to refresh orders:', err);
    }
  }, []);

  useEffect(() => {
    refreshPortfolio();
    refreshOrders();
  }, [refreshPortfolio, refreshOrders]);

  const placeOrder = async (orderPayload) => {
    setLoading(true);
    try {
      const order = await api.placeOrder(orderPayload);
      if (order.status === 'FILLED') {
        addToast(`Order FILLED: ${order.side} ${order.quantity} ${order.symbol} @ $${order.price}`, 'success');
      } else {
        addToast(`Limit order PLACED: ${order.side} ${order.quantity} ${order.symbol} @ $${order.price}`, 'info');
      }
      await Promise.all([refreshPortfolio(), refreshOrders()]);
      return order;
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      await api.cancelOrder(orderId);
      addToast(`Order #${orderId.substring(0, 8)} cancelled`, 'info');
      await Promise.all([refreshPortfolio(), refreshOrders()]);
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  const closePosition = async (positionId, symbol) => {
    try {
      const closed = await api.closePosition(positionId, symbol);
      const pnlSign = closed.realizedPnl >= 0 ? '+' : '';
      addToast(`Position closed: Realized PnL: ${pnlSign}$${closed.realizedPnl}`, closed.realizedPnl >= 0 ? 'success' : 'warning');
      await Promise.all([refreshPortfolio(), refreshOrders()]);
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  const updatePositionTpSl = async (positionId, { takeProfit, stopLoss }) => {
    try {
      const updated = await api.updatePositionTpSl(positionId, { takeProfit, stopLoss });
      addToast(`Updated TP/SL on ${updated.symbol} position`, 'info');
      await refreshPortfolio();
      return updated;
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  const claimFaucet = async (amount = 10000) => {
    try {
      await api.claimFaucet(amount);
      addToast(`+$${amount.toLocaleString()} demo funds added to your wallet!`, 'success');
      await refreshPortfolio();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const resetPortfolio = async () => {
    try {
      await api.resetPortfolio();
      addToast('Portfolio reset to default $10,000 USDT testnet funds.', 'info');
      await Promise.all([refreshPortfolio(), refreshOrders()]);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <PortfolioContext.Provider
      value={{
        portfolio,
        openOrders,
        orderHistory,
        tradeHistory,
        loading,
        toasts,
        placeOrder,
        cancelOrder,
        closePosition,
        updatePositionTpSl,
        claimFaucet,
        resetPortfolio,
        refreshPortfolio
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
