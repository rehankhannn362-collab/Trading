import React from 'react';
import { useTrading } from '../../context/TradingContext.jsx';

export default function RecentTrades() {
  const { recentTrades, activeMarket } = useTrading();

  return (
    <div className="flex flex-col h-full bg-dark-800 border-r border-dark-700 text-xs font-mono select-none">
      {/* Header */}
      <div className="h-9 px-3 border-b border-dark-700 flex items-center justify-between text-slate-400 font-semibold text-[11px]">
        <span>Recent Trades</span>
        <span className="text-[10px] text-slate-500 font-normal">Real-Time</span>
      </div>

      {/* Columns Header */}
      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] text-slate-500 border-b border-dark-750">
        <span>Price ({activeMarket.quoteAsset})</span>
        <span className="text-right">Size ({activeMarket.baseAsset})</span>
        <span className="text-right">Time</span>
      </div>

      {/* Trades Stream */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-1">
        {recentTrades.map((trade, idx) => {
          const isBuy = trade.side === 'BUY';
          const timeStr = new Date(trade.time).toLocaleTimeString(undefined, {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

          return (
            <div
              key={`${trade.id || idx}_${trade.time}`}
              className="grid grid-cols-3 px-3 py-0.5 hover:bg-dark-750 transition-colors"
            >
              <span className={`font-medium ${isBuy ? 'text-trade-green' : 'text-trade-red'}`}>
                {Number(trade.price).toLocaleString(undefined, {
                  minimumFractionDigits: activeMarket.pricePrecision,
                  maximumFractionDigits: activeMarket.pricePrecision
                })}
              </span>
              <span className="text-right text-slate-300 tabular-nums">
                {Number(trade.amount).toFixed(activeMarket.quantityPrecision)}
              </span>
              <span className="text-right text-slate-500 text-[10px] tabular-nums">
                {timeStr}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
