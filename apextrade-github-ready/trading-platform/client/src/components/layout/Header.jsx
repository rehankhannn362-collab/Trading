import React, { useState } from 'react';
import { Activity, Wallet, RefreshCw, Zap, TrendingUp, ShieldCheck } from 'lucide-react';
import { useTrading } from '../../context/TradingContext.jsx';
import { usePortfolio } from '../../context/PortfolioContext.jsx';

export default function Header({ onOpenWatchlist }) {
  const { wsStatus, tickers, setSelectedSymbol } = useTrading();
  const { portfolio, claimFaucet, resetPortfolio } = usePortfolio();
  const [faucetLoading, setFaucetLoading] = useState(false);

  const handleFaucet = async () => {
    setFaucetLoading(true);
    await claimFaucet(10000);
    setFaucetLoading(false);
  };

  const topPairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'NVDA/USD'];

  return (
    <header className="h-14 bg-dark-800 border-b border-dark-700 flex items-center justify-between px-4 text-xs select-none">
      {/* Brand & Market Selector */}
      <div className="flex items-center space-x-4">
        <div 
          onClick={onOpenWatchlist}
          className="flex items-center space-x-2 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-trade-green to-brand-accent flex items-center justify-center shadow-lg shadow-trade-green/10">
            <TrendingUp className="w-5 h-5 text-dark-900 font-black stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm tracking-wider text-white group-hover:text-trade-green transition-colors">
                APEX<span className="text-trade-green">TRADE</span>
              </span>
              <span className="bg-dark-700 text-slate-400 text-[10px] px-1.5 py-0.5 rounded font-mono font-medium">
                PRO
              </span>
            </div>
          </div>
        </div>

        {/* Quick Market Marquee */}
        <div className="hidden lg:flex items-center space-x-2 pl-4 border-l border-dark-700">
          {topPairs.map(sym => {
            const t = tickers[sym];
            if (!t) return null;
            const isPos = t.change24hPercent >= 0;
            return (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-dark-750 hover:bg-dark-700 border border-dark-700 transition-all font-mono"
              >
                <span className="text-slate-300 font-medium">{sym.split('/')[0]}</span>
                <span className="text-white">${t.price.toLocaleString()}</span>
                <span className={`text-[10px] ${isPos ? 'text-trade-green' : 'text-trade-red'}`}>
                  {isPos ? '+' : ''}{t.change24hPercent}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right User Bar */}
      <div className="flex items-center space-x-3">
        {/* Network / WS Indicator */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-dark-750 border border-dark-700">
          <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-trade-green animate-pulse' : 'bg-trade-red'}`} />
          <span className="text-slate-400 capitalize hidden sm:inline">{wsStatus}</span>
        </div>

        {/* Account Equity Badge */}
        <div className="flex items-center space-x-2 px-3 py-1 bg-dark-750 border border-dark-700 rounded font-mono">
          <Wallet className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400">Equity</span>
            <span className="font-semibold text-white">
              ${portfolio.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Faucet Claim Button */}
        <button
          onClick={handleFaucet}
          disabled={faucetLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-trade-green/10 hover:bg-trade-green/20 text-trade-green border border-trade-green/30 font-medium transition-all active:scale-95"
          title="Deposit $10,000 USDT Testnet Funds"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">Faucet +$10k</span>
        </button>

        {/* Reset Testnet Button */}
        <button
          onClick={resetPortfolio}
          className="p-1.5 rounded bg-dark-750 hover:bg-dark-700 text-slate-400 hover:text-white border border-dark-700 transition-colors"
          title="Reset Testnet Account"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
