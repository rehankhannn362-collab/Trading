import React, { useMemo } from 'react';
import { useTrading } from '../../context/TradingContext.jsx';

export default function OrderBook() {
  const { orderBook, activeMarket, activeTicker, setOrderPrefillPrice } = useTrading();

  // Max total for depth percentage visualization
  const maxBidTotal = useMemo(() => {
    if (!orderBook.bids || orderBook.bids.length === 0) return 1;
    return orderBook.bids[orderBook.bids.length - 1][2] || 1;
  }, [orderBook.bids]);

  const maxAskTotal = useMemo(() => {
    if (!orderBook.asks || orderBook.asks.length === 0) return 1;
    return orderBook.asks[orderBook.asks.length - 1][2] || 1;
  }, [orderBook.asks]);

  const displayedAsks = useMemo(() => {
    // Reverse asks so highest ask is at top and lowest ask (best ask) is directly above spread
    return [...(orderBook.asks || [])].slice(0, 11).reverse();
  }, [orderBook.asks]);

  const displayedBids = useMemo(() => {
    return (orderBook.bids || []).slice(0, 11);
  }, [orderBook.bids]);

  return (
    <div className="flex flex-col h-full bg-dark-800 border-r border-dark-700 text-xs font-mono select-none">
      {/* Title Header */}
      <div className="h-9 px-3 border-b border-dark-700 flex items-center justify-between text-slate-400 font-semibold text-[11px]">
        <span>Order Book</span>
        <span className="text-[10px] text-slate-500 font-normal">
          Tick: {Math.pow(10, -activeMarket.pricePrecision)}
        </span>
      </div>

      {/* Columns Header */}
      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] text-slate-500 border-b border-dark-750">
        <span>Price ({activeMarket.quoteAsset})</span>
        <span className="text-right">Size ({activeMarket.baseAsset})</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (Sells) Table */}
      <div className="flex-1 flex flex-col justify-end overflow-hidden py-1">
        {displayedAsks.map(([price, size, total], idx) => {
          const depthPercent = Math.min(100, Math.round((total / maxAskTotal) * 100));
          return (
            <div
              key={`ask_${idx}_${price}`}
              onClick={() => setOrderPrefillPrice(price)}
              className="grid grid-cols-3 px-3 py-0.5 relative group hover:bg-dark-700 cursor-pointer"
            >
              <div
                className="absolute inset-y-0 right-0 bg-trade-red/10 pointer-events-none transition-all duration-150"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="text-trade-red z-10 font-medium">
                {Number(price || 0).toLocaleString(undefined, {
                  minimumFractionDigits: activeMarket?.pricePrecision || 2,
                  maximumFractionDigits: activeMarket?.pricePrecision || 2
                })}
              </span>
              <span className="text-right text-slate-300 z-10 tabular-nums">
                {Number(size || 0).toFixed(activeMarket?.quantityPrecision || 4)}
              </span>
              <span className="text-right text-slate-500 z-10 tabular-nums">
                {Number(total || 0).toFixed(activeMarket?.quantityPrecision || 4)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mid Market Spread Bar */}
      <div className="py-1.5 px-3 bg-dark-750 border-y border-dark-700 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-bold text-white">
            ${Number(activeTicker?.price || activeMarket?.basePrice || 0).toLocaleString(undefined, {
              minimumFractionDigits: activeMarket?.pricePrecision || 2
            })}
          </span>
          <span className="text-[10px] text-slate-400">Mark</span>
        </div>
        <div className="flex items-center space-x-1 text-[10px] text-slate-400">
          <span>Spread:</span>
          <span className="text-slate-200">${orderBook.spread || 0}</span>
          <span className="text-slate-500">({orderBook.spreadPercent || 0}%)</span>
        </div>
      </div>

      {/* Bids (Buys) Table */}
      <div className="flex-1 overflow-hidden py-1">
        {displayedBids.map(([price, size, total], idx) => {
          const depthPercent = Math.min(100, Math.round(((total || 0) / maxBidTotal) * 100));
          return (
            <div
              key={`bid_${idx}_${price}`}
              onClick={() => setOrderPrefillPrice(price)}
              className="grid grid-cols-3 px-3 py-0.5 relative group hover:bg-dark-700 cursor-pointer"
            >
              <div
                className="absolute inset-y-0 right-0 bg-trade-green/10 pointer-events-none transition-all duration-150"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="text-trade-green z-10 font-medium">
                {Number(price || 0).toLocaleString(undefined, {
                  minimumFractionDigits: activeMarket?.pricePrecision || 2,
                  maximumFractionDigits: activeMarket?.pricePrecision || 2
                })}
              </span>
              <span className="text-right text-slate-300 z-10 tabular-nums">
                {Number(size || 0).toFixed(activeMarket?.quantityPrecision || 4)}
              </span>
              <span className="text-right text-slate-500 z-10 tabular-nums">
                {Number(total || 0).toFixed(activeMarket?.quantityPrecision || 4)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
