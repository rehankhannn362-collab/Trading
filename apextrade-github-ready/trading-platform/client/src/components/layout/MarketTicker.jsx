import React from 'react';
import { ChevronDown, ArrowUpRight, ArrowDownRight, Clock, BarChart2 } from 'lucide-react';
import { useTrading } from '../../context/TradingContext.jsx';

export default function MarketTicker({ onOpenWatchlist }) {
  const { selectedSymbol, activeMarket, activeTicker, priceDirection } = useTrading();

  const isPositive = activeTicker.change24hPercent >= 0;

  return (
    <div className="h-12 bg-dark-800 border-b border-dark-700 flex items-center px-4 overflow-x-auto no-scrollbar justify-between text-xs font-mono select-none">
      {/* Pair Selector Button & Main Price */}
      <div className="flex items-center space-x-5">
        <button
          onClick={onOpenWatchlist}
          className="flex items-center space-x-2 py-1 px-2.5 rounded bg-dark-750 hover:bg-dark-700 border border-dark-700 transition-colors group"
        >
          <div className="flex flex-col text-left">
            <span className="font-bold text-sm text-white group-hover:text-trade-green transition-colors">
              {selectedSymbol}
            </span>
            <span className="text-[10px] text-slate-400 capitalize">
              {activeMarket.category} · Perpetual
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
        </button>

        {/* Current Mark Price */}
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400">Mark Price</span>
          <div className="flex items-center space-x-1.5">
            <span
              className={`text-base font-bold transition-colors ${
                priceDirection === 'up'
                  ? 'text-trade-green'
                  : priceDirection === 'down'
                  ? 'text-trade-red'
                  : isPositive
                  ? 'text-trade-green'
                  : 'text-trade-red'
              }`}
            >
              ${Number(activeTicker?.price || activeMarket?.basePrice || 0).toLocaleString(undefined, {
                minimumFractionDigits: activeMarket?.pricePrecision || 2,
                maximumFractionDigits: activeMarket?.pricePrecision || 2
              })}
            </span>
            {isPositive ? (
              <ArrowUpRight className="w-4 h-4 text-trade-green" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-trade-red" />
            )}
          </div>
        </div>

        {/* 24h Change */}
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400">24h Change</span>
          <span className={`font-semibold ${isPositive ? 'text-trade-green' : 'text-trade-red'}`}>
            {isPositive ? '+' : ''}{Number(activeTicker?.change24hPercent || 0)}%
            <span className="text-slate-400 font-normal ml-1 text-[11px]">
              ({isPositive ? '+' : ''}${Number(activeTicker?.change24h || 0)})
            </span>
          </span>
        </div>

        {/* 24h High */}
        <div className="hidden md:flex flex-col">
          <span className="text-[10px] text-slate-400">24h High</span>
          <span className="text-slate-200">
            ${Number(activeTicker?.high24h || activeMarket?.basePrice || 0).toLocaleString(undefined, {
              minimumFractionDigits: activeMarket?.pricePrecision || 2
            })}
          </span>
        </div>

        {/* 24h Low */}
        <div className="hidden md:flex flex-col">
          <span className="text-[10px] text-slate-400">24h Low</span>
          <span className="text-slate-200">
            ${Number(activeTicker?.low24h || activeMarket?.basePrice || 0).toLocaleString(undefined, {
              minimumFractionDigits: activeMarket?.pricePrecision || 2
            })}
          </span>
        </div>

        {/* 24h Volume */}
        <div className="hidden lg:flex flex-col">
          <span className="text-[10px] text-slate-400">24h Volume ({activeMarket?.quoteAsset || 'USDT'})</span>
          <span className="text-slate-200">
            ${Number(activeTicker?.volume24h || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Funding & Index */}
      <div className="hidden xl:flex items-center space-x-6 text-slate-400 text-[11px]">
        <div className="flex items-center space-x-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Funding / Countdown:</span>
          <span className="text-trade-green font-medium">0.0100%</span>
          <span className="text-slate-300">03:44:12</span>
        </div>
      </div>
    </div>
  );
}
