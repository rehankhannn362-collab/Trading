import React, { useState, useMemo } from 'react';
import { Search, X, TrendingUp, TrendingDown, Star } from 'lucide-react';
import { useTrading } from '../../context/TradingContext.jsx';

export default function WatchlistModal({ isOpen, onClose }) {
  const { markets, tickers, selectedSymbol, setSelectedSymbol } = useTrading();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filteredMarkets = useMemo(() => {
    return markets.filter(m => {
      const matchesSearch =
        m.symbol.toLowerCase().includes(search.toLowerCase()) ||
        m.name.toLowerCase().includes(search.toLowerCase());
      const matchesCat = category === 'all' || m.category === category;
      return matchesSearch && matchesCat;
    });
  }, [markets, search, category]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-mono select-none">
      <div className="w-full max-w-xl bg-dark-800 border border-dark-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-base">Select Market</span>
            <span className="text-slate-500 text-xs font-normal">({filteredMarkets.length} pairs)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded bg-dark-750 hover:bg-dark-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="p-3 border-b border-dark-700 space-y-3 bg-dark-750/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coin, stock, symbol..."
              className="w-full bg-dark-750 border border-dark-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-accent transition-colors"
              autoFocus
            />
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            {['all', 'crypto', 'stocks', 'forex'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1 rounded-md capitalize transition-colors ${
                  category === cat
                    ? 'bg-brand-accent text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Markets Table */}
        <div className="flex-1 overflow-y-auto divide-y divide-dark-750">
          {filteredMarkets.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No trading pairs match your search.
            </div>
          ) : (
            filteredMarkets.map(market => {
              const ticker = tickers[market.symbol] || {};
              const isPositive = (ticker.change24hPercent || 0) >= 0;
              const isSelected = market.symbol === selectedSymbol;

              return (
                <div
                  key={market.symbol}
                  onClick={() => {
                    setSelectedSymbol(market.symbol);
                    onClose();
                  }}
                  className={`p-3 flex items-center justify-between cursor-pointer hover:bg-dark-700 transition-colors ${
                    isSelected ? 'bg-dark-700/60 border-l-2 border-brand-accent' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-dark-750 flex items-center justify-center font-bold text-slate-200 text-xs border border-dark-700">
                      {market.baseAsset.substring(0, 3)}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-xs">{market.symbol}</span>
                        <span className="text-[10px] uppercase px-1 py-0.2 rounded bg-dark-750 text-slate-400 border border-dark-700">
                          {market.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">{market.name}</span>
                    </div>
                  </div>

                  <div className="flex flex-col text-right">
                    <span className="font-semibold text-white text-xs">
                      ${(ticker.price ?? market.basePrice).toLocaleString(undefined, {
                        minimumFractionDigits: market.pricePrecision
                      })}
                    </span>
                    <span
                      className={`text-[11px] font-medium flex items-center justify-end space-x-0.5 ${
                        isPositive ? 'text-trade-green' : 'text-trade-red'
                      }`}
                    >
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>
                        {isPositive ? '+' : ''}{ticker.change24hPercent ?? 0}%
                      </span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
