import React, { useState } from 'react';
import { Layers, ListChecks, History, FileText, PieChart, X, ExternalLink, Edit3 } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext.jsx';
import { useTrading } from '../../context/TradingContext.jsx';

export default function BottomPanel() {
  const [activeTab, setActiveTab] = useState('positions');
  const { portfolio, openOrders, orderHistory, tradeHistory, cancelOrder, closePosition, updatePositionTpSl } = usePortfolio();
  const { setSelectedSymbol } = useTrading();

  // State for Edit TP/SL Modal
  const [editingPos, setEditingPos] = useState(null);
  const [editTp, setEditTp] = useState('');
  const [editSl, setEditSl] = useState('');
  const [savingTpSl, setSavingTpSl] = useState(false);

  const openEditModal = (pos) => {
    setEditingPos(pos);
    setEditTp(pos.takeProfit ? String(pos.takeProfit) : '');
    setEditSl(pos.stopLoss ? String(pos.stopLoss) : '');
  };

  const closeEditModal = () => {
    setEditingPos(null);
    setEditTp('');
    setEditSl('');
  };

  const handleSaveTpSl = async () => {
    if (!editingPos) return;
    setSavingTpSl(true);
    try {
      const parsedTp = editTp ? parseFloat(editTp) : null;
      const parsedSl = editSl ? parseFloat(editSl) : null;
      await updatePositionTpSl(editingPos.id, {
        takeProfit: parsedTp && parsedTp > 0 ? parsedTp : null,
        stopLoss: parsedSl && parsedSl > 0 ? parsedSl : null
      });
      closeEditModal();
    } catch (err) {
      console.error('Failed to update TP/SL:', err);
    } finally {
      setSavingTpSl(false);
    }
  };

  // Helper for quick percentage chips in the modal
  const applyQuickTp = (pct) => {
    if (!editingPos) return;
    const entry = editingPos.entryPrice;
    const isLong = editingPos.side === 'LONG';
    const targetPrice = isLong ? entry * (1 + pct / 100) : entry * (1 - pct / 100);
    setEditTp(targetPrice.toFixed(2));
  };

  const applyQuickSl = (pct) => {
    if (!editingPos) return;
    const entry = editingPos.entryPrice;
    const isLong = editingPos.side === 'LONG';
    const targetPrice = isLong ? entry * (1 - pct / 100) : entry * (1 + pct / 100);
    setEditSl(targetPrice.toFixed(2));
  };

  const positionsCount = portfolio.positions?.length || 0;
  const openOrdersCount = openOrders?.length || 0;

  return (
    <div className="flex flex-col h-full bg-dark-800 border-t border-dark-700 font-mono text-xs select-none relative">
      {/* Tabs Header */}
      <div className="h-9 px-3 border-b border-dark-700 flex items-center justify-between bg-dark-800">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('positions')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-colors ${
              activeTab === 'positions'
                ? 'bg-dark-700 text-white font-semibold border border-dark-600'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Positions</span>
            {positionsCount > 0 && (
              <span className="bg-brand-accent/20 text-brand-accent text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {positionsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('openOrders')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-colors ${
              activeTab === 'openOrders'
                ? 'bg-dark-700 text-white font-semibold border border-dark-600'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>Open Orders</span>
            {openOrdersCount > 0 && (
              <span className="bg-brand-gold/20 text-brand-gold text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {openOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('orderHistory')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-colors ${
              activeTab === 'orderHistory'
                ? 'bg-dark-700 text-white font-semibold border border-dark-600'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Order History</span>
          </button>

          <button
            onClick={() => setActiveTab('tradeHistory')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-colors ${
              activeTab === 'tradeHistory'
                ? 'bg-dark-700 text-white font-semibold border border-dark-600'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Trade History</span>
          </button>

          <button
            onClick={() => setActiveTab('assets')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-colors ${
              activeTab === 'assets'
                ? 'bg-dark-700 text-white font-semibold border border-dark-600'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Assets</span>
          </button>
        </div>

        {/* Unrealized PnL summary indicator */}
        <div className="flex items-center space-x-3 text-[11px]">
          <span className="text-slate-400">Total Unrealized PnL:</span>
          <span className={`font-bold ${portfolio.totalUnrealizedPnl >= 0 ? 'text-trade-green' : 'text-trade-red'}`}>
            {portfolio.totalUnrealizedPnl >= 0 ? '+' : ''}${portfolio.totalUnrealizedPnl.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-auto p-2">
        {/* 1. POSITIONS */}
        {activeTab === 'positions' && (
          <div className="w-full">
            {positionsCount === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-slate-500 space-y-1">
                <span>No open positions</span>
                <span className="text-[11px] text-slate-600">Submit an order to open a position</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-700 text-slate-400 text-[11px]">
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Side</th>
                    <th className="py-2 px-3">Size</th>
                    <th className="py-2 px-3">Entry Price</th>
                    <th className="py-2 px-3">Mark Price</th>
                    <th className="py-2 px-3">Liq. Price</th>
                    <th className="py-2 px-3">Margin</th>
                    <th className="py-2 px-3">Unrealized PnL (ROE)</th>
                    <th className="py-2 px-3">TP / SL</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-750">
                  {portfolio.positions.map(pos => {
                    const isLong = pos.side === 'LONG';
                    const isProfitable = (pos.unrealizedPnl || 0) >= 0;
                    return (
                      <tr key={pos.id} className="hover:bg-dark-750 transition-colors">
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => setSelectedSymbol(pos.symbol)}
                            className="font-bold text-white hover:text-trade-green transition-colors flex items-center space-x-1"
                          >
                            <span>{pos.symbol}</span>
                            <span className="text-[10px] text-slate-500 font-normal">{pos.leverage}x</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isLong ? 'bg-trade-green/10 text-trade-green' : 'bg-trade-red/10 text-trade-red'
                            }`}
                          >
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-200">{pos.quantity}</td>
                        <td className="py-2.5 px-3 text-slate-300">${pos.entryPrice}</td>
                        <td className="py-2.5 px-3 text-slate-300">${pos.markPrice || pos.entryPrice}</td>
                        <td className="py-2.5 px-3 text-brand-gold">
                          ${pos.liquidationPrice > 0 ? pos.liquidationPrice : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">${pos.margin}</td>
                        <td className="py-2.5 px-3">
                          <span className={`font-semibold ${isProfitable ? 'text-trade-green' : 'text-trade-red'}`}>
                            {isProfitable ? '+' : ''}${pos.unrealizedPnl} ({isProfitable ? '+' : ''}{pos.pnlPercent}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2">
                            <div className="flex flex-col text-[10px] leading-tight font-mono">
                              <span className={pos.takeProfit ? 'text-trade-green font-semibold' : 'text-slate-500'}>
                                TP: {pos.takeProfit ? `$${pos.takeProfit}` : '--'}
                              </span>
                              <span className={pos.stopLoss ? 'text-trade-red font-semibold' : 'text-slate-500'}>
                                SL: {pos.stopLoss ? `$${pos.stopLoss}` : '--'}
                              </span>
                            </div>
                            <button
                              onClick={() => openEditModal(pos)}
                              className="p-1 rounded bg-dark-700 hover:bg-dark-600 text-slate-300 hover:text-white transition-colors"
                              title="Edit Take Profit & Stop Loss"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => closePosition(pos.id, pos.symbol)}
                            className="px-2.5 py-1 rounded bg-dark-700 hover:bg-trade-red hover:text-white text-slate-300 text-[11px] transition-colors"
                          >
                            Market Close
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 2. OPEN ORDERS */}
        {activeTab === 'openOrders' && (
          <div className="w-full">
            {openOrdersCount === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-slate-500 space-y-1">
                <span>No open orders</span>
                <span className="text-[11px] text-slate-600">Resting limit orders will appear here</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-700 text-slate-400 text-[11px]">
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Side</th>
                    <th className="py-2 px-3">Price</th>
                    <th className="py-2 px-3">Quantity</th>
                    <th className="py-2 px-3">TP / SL</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-750">
                  {openOrders.map(order => (
                    <tr key={order.id} className="hover:bg-dark-750 transition-colors">
                      <td className="py-2 px-3 text-slate-400 text-[11px]">
                        {new Date(order.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-semibold text-white">{order.symbol}</td>
                      <td className="py-2 px-3 text-slate-300">{order.type}</td>
                      <td className="py-2 px-3">
                        <span className={`font-semibold ${order.side === 'BUY' ? 'text-trade-green' : 'text-trade-red'}`}>
                          {order.side}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-200">${order.price}</td>
                      <td className="py-2 px-3 text-slate-200">{order.quantity}</td>
                      <td className="py-2 px-3 text-[10px] text-slate-400">
                        <span className={order.takeProfit ? 'text-trade-green font-medium' : 'text-slate-500'}>
                          {order.takeProfit ? `$${order.takeProfit}` : '--'}
                        </span>
                        <span className="mx-1 text-slate-600">/</span>
                        <span className={order.stopLoss ? 'text-trade-red font-medium' : 'text-slate-500'}>
                          {order.stopLoss ? `$${order.stopLoss}` : '--'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-brand-gold/10 text-brand-gold">
                          {order.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => cancelOrder(order.id)}
                          className="px-2.5 py-1 rounded bg-dark-700 hover:bg-dark-600 text-trade-red text-[11px] transition-colors"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 3. ORDER HISTORY */}
        {activeTab === 'orderHistory' && (
          <div className="w-full">
            {orderHistory.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-500">
                No past order history
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-700 text-slate-400 text-[11px]">
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Side</th>
                    <th className="py-2 px-3">Price</th>
                    <th className="py-2 px-3">Quantity</th>
                    <th className="py-2 px-3">Fee</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-750">
                  {orderHistory.map(order => (
                    <tr key={order.id} className="hover:bg-dark-750 transition-colors">
                      <td className="py-2 px-3 text-slate-400 text-[11px]">
                        {new Date(order.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-semibold text-white">{order.symbol}</td>
                      <td className="py-2 px-3 text-slate-300">{order.type}</td>
                      <td className="py-2 px-3">
                        <span className={`font-semibold ${order.side === 'BUY' ? 'text-trade-green' : 'text-trade-red'}`}>
                          {order.side}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-200">${order.price}</td>
                      <td className="py-2 px-3 text-slate-200">{order.quantity}</td>
                      <td className="py-2 px-3 text-slate-400">${order.fee || 0}</td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            order.status === 'FILLED'
                              ? 'bg-trade-green/10 text-trade-green'
                              : 'bg-dark-700 text-slate-400'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 4. TRADE HISTORY */}
        {activeTab === 'tradeHistory' && (
          <div className="w-full">
            {tradeHistory.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-500">
                No closed trades yet
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-700 text-slate-400 text-[11px]">
                    <th className="py-2 px-3">Closed Time</th>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Side</th>
                    <th className="py-2 px-3">Size</th>
                    <th className="py-2 px-3">Entry Price</th>
                    <th className="py-2 px-3">Close Price</th>
                    <th className="py-2 px-3">Trigger / Reason</th>
                    <th className="py-2 px-3 text-right">Realized PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-750">
                  {tradeHistory.map(trade => {
                    const isProfit = (trade.realizedPnl || 0) >= 0;
                    const reason = trade.reason || 'MANUAL';
                    let reasonBadge = (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-dark-700 text-slate-400 font-medium">
                        Manual Close
                      </span>
                    );
                    if (reason === 'TAKE_PROFIT') {
                      reasonBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                          🎯 Take Profit
                        </span>
                      );
                    } else if (reason === 'STOP_LOSS') {
                      reasonBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                          🛡️ Stop Loss
                        </span>
                      );
                    } else if (reason === 'LIQUIDATION') {
                      reasonBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                          ⚠️ Liquidation
                        </span>
                      );
                    }

                    return (
                      <tr key={trade.id} className="hover:bg-dark-750 transition-colors">
                        <td className="py-2 px-3 text-slate-400 text-[11px]">
                          {new Date(trade.closedAt).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 font-semibold text-white">{trade.symbol}</td>
                        <td className="py-2 px-3">
                          <span className={trade.side === 'LONG' ? 'text-trade-green' : 'text-trade-red'}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300">{trade.quantity}</td>
                        <td className="py-2 px-3 text-slate-300">${trade.entryPrice}</td>
                        <td className="py-2 px-3 text-slate-300">${trade.closePrice}</td>
                        <td className="py-2 px-3">{reasonBadge}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-bold ${isProfit ? 'text-trade-green' : 'text-trade-red'}`}>
                            {isProfit ? '+' : ''}${trade.realizedPnl}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 5. ASSETS / WALLETS */}
        {activeTab === 'assets' && (
          <div className="w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-dark-700 text-slate-400 text-[11px]">
                  <th className="py-2 px-3">Asset</th>
                  <th className="py-2 px-3">Total Balance</th>
                  <th className="py-2 px-3">In Margin</th>
                  <th className="py-2 px-3 text-right">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-750">
                {Object.entries(portfolio.balances || {}).map(([coin, bal]) => (
                  <tr key={coin} className="hover:bg-dark-750 transition-colors">
                    <td className="py-2 px-3 font-bold text-white">{coin}</td>
                    <td className="py-2 px-3 text-slate-200">
                      {Number(bal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {coin === 'USDT' ? `$${portfolio.totalMarginUsed}` : '0.00'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200 font-semibold">
                      {coin === 'USDT' ? `$${portfolio.availableMargin}` : Number(bal).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit TP / SL Position Modal */}
      {editingPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-dark-850 border border-dark-600 rounded-lg shadow-2xl w-full max-w-md overflow-hidden font-mono text-xs">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-dark-800 border-b border-dark-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm">Set TP / SL</span>
                <span className="text-slate-300 font-semibold">{editingPos.symbol}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    editingPos.side === 'LONG' ? 'bg-trade-green/20 text-trade-green' : 'bg-trade-red/20 text-trade-red'
                  }`}
                >
                  {editingPos.side} {editingPos.leverage}x
                </span>
              </div>
              <button
                onClick={closeEditModal}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-dark-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Position Summary Info */}
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2 bg-dark-900 p-2.5 rounded border border-dark-700 text-[11px]">
                <div>
                  <div className="text-slate-400">Entry Price</div>
                  <div className="font-bold text-white">${editingPos.entryPrice}</div>
                </div>
                <div>
                  <div className="text-slate-400">Mark Price</div>
                  <div className="font-bold text-slate-200">${editingPos.markPrice || editingPos.entryPrice}</div>
                </div>
                <div>
                  <div className="text-slate-400">Size</div>
                  <div className="font-bold text-slate-200">{editingPos.quantity}</div>
                </div>
              </div>

              {/* Take Profit Setting */}
              <div className="space-y-1.5 bg-dark-900/60 p-3 rounded border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-bold flex items-center space-x-1">
                    <span>🎯 Take Profit Price</span>
                  </span>
                  <div className="flex items-center space-x-1">
                    {[5, 10, 25].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => applyQuickTp(pct)}
                        className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-semibold transition-colors"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 68000"
                    value={editTp}
                    onChange={e => setEditTp(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-700 focus:border-emerald-500 rounded px-3 py-1.5 text-white text-xs outline-none"
                  />
                  <span className="absolute right-3 top-1.5 text-slate-500 text-[11px]">USDT</span>
                </div>
                {editTp && parseFloat(editTp) > 0 && (
                  <div className="text-[11px] text-slate-400 flex justify-between pt-0.5">
                    <span>Estimated Profit:</span>
                    <span className="text-emerald-400 font-bold">
                      +$
                      {(
                        editingPos.side === 'LONG'
                          ? (parseFloat(editTp) - editingPos.entryPrice) * editingPos.quantity
                          : (editingPos.entryPrice - parseFloat(editTp)) * editingPos.quantity
                      ).toFixed(2)}{' '}
                      USDT
                    </span>
                  </div>
                )}
              </div>

              {/* Stop Loss Setting */}
              <div className="space-y-1.5 bg-dark-900/60 p-3 rounded border border-rose-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-rose-400 font-bold flex items-center space-x-1">
                    <span>🛡️ Stop Loss Price</span>
                  </span>
                  <div className="flex items-center space-x-1">
                    {[2, 5, 10].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => applyQuickSl(pct)}
                        className="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 text-[10px] font-semibold transition-colors"
                      >
                        -{pct}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 64000"
                    value={editSl}
                    onChange={e => setEditSl(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-700 focus:border-rose-500 rounded px-3 py-1.5 text-white text-xs outline-none"
                  />
                  <span className="absolute right-3 top-1.5 text-slate-500 text-[11px]">USDT</span>
                </div>
                {editSl && parseFloat(editSl) > 0 && (
                  <div className="text-[11px] text-slate-400 flex justify-between pt-0.5">
                    <span>Estimated Loss:</span>
                    <span className="text-rose-400 font-bold">
                      -$
                      {Math.abs(
                        editingPos.side === 'LONG'
                          ? (editingPos.entryPrice - parseFloat(editSl)) * editingPos.quantity
                          : (parseFloat(editSl) - editingPos.entryPrice) * editingPos.quantity
                      ).toFixed(2)}{' '}
                      USDT
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-dark-800 border-t border-dark-700 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEditTp('');
                  setEditSl('');
                }}
                className="px-3 py-1.5 rounded bg-dark-700 hover:bg-dark-600 text-slate-400 hover:text-white transition-colors"
              >
                Clear Levels
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-3 py-1.5 rounded bg-dark-700 hover:bg-dark-600 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingTpSl}
                  onClick={handleSaveTpSl}
                  className="px-4 py-1.5 rounded bg-brand-accent hover:bg-blue-600 font-bold text-white transition-colors disabled:opacity-50"
                >
                  {savingTpSl ? 'Saving...' : 'Confirm TP/SL'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
