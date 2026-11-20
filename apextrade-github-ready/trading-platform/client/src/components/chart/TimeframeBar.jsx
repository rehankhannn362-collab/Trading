import React from 'react';
import { BarChart2, Eye, EyeOff } from 'lucide-react';
import { useTrading } from '../../context/TradingContext.jsx';

export default function TimeframeBar({ showVolume, setShowVolume, showSMA, setShowSMA, onScrollToRealtime }) {
  const { timeframe, setTimeframe } = useTrading();

  const intervals = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '1D', value: '1D' }
  ];

  return (
    <div className="h-9 bg-dark-800 border-b border-dark-700 flex items-center justify-between px-3 text-xs select-none">
      <div className="flex items-center space-x-1">
        <span className="text-slate-400 font-mono text-[11px] mr-2 flex items-center">
          <BarChart2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
          Time:
        </span>
        {intervals.map(item => (
          <button
            key={item.value}
            onClick={() => setTimeframe(item.value)}
            className={`px-2 py-0.5 rounded font-mono text-xs transition-colors ${
              timeframe === item.value
                ? 'bg-dark-600 text-trade-green font-semibold border border-dark-500'
                : 'text-slate-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Indicator & Live Toggles */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onScrollToRealtime}
          className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono text-trade-green bg-trade-green/10 border border-trade-green/30 hover:bg-trade-green/20 transition-colors"
          title="Scroll to current real-time market position"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-trade-green animate-pulse" />
          <span>Live</span>
        </button>

        <button
          onClick={() => setShowVolume(prev => !prev)}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
            showVolume
              ? 'text-brand-accent bg-brand-accent/10 border border-brand-accent/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {showVolume ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>VOL</span>
        </button>

        <button
          onClick={() => setShowSMA(prev => !prev)}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
            showSMA
              ? 'text-brand-purple bg-brand-purple/10 border border-brand-purple/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {showSMA ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>SMA (20)</span>
        </button>
      </div>
    </div>
  );
}
