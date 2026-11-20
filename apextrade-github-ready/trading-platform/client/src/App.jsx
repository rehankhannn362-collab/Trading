import React, { useState } from 'react';
import Header from './components/layout/Header.jsx';
import MarketTicker from './components/layout/MarketTicker.jsx';
import TradingChart from './components/chart/TradingChart.jsx';
import OrderBook from './components/orderbook/OrderBook.jsx';
import RecentTrades from './components/orderbook/RecentTrades.jsx';
import OrderForm from './components/trading/OrderForm.jsx';
import BottomPanel from './components/portfolio/BottomPanel.jsx';
import WatchlistModal from './components/watchlist/WatchlistModal.jsx';
import ToastContainer from './components/common/ToastContainer.jsx';

export default function App() {
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState('book'); // 'book' | 'trades'

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-dark-900 text-slate-100 font-sans">
      {/* 1. Header Navigation Bar */}
      <Header onOpenWatchlist={() => setIsWatchlistOpen(true)} />

      {/* 2. Market 24h Stats Ticker Bar */}
      <MarketTicker onOpenWatchlist={() => setIsWatchlistOpen(true)} />

      {/* 3. Main Workspace Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Center Area: Chart (top 60%) + Bottom Panel (bottom 40%) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Candlestick & Volume Chart */}
          <div className="h-[60%] min-h-[300px]">
            <TradingChart />
          </div>

          {/* Positions, Open Orders, and Trade History */}
          <div className="h-[40%] min-h-[200px]">
            <BottomPanel />
          </div>
        </div>

        {/* Middle-Right Area: Order Book & Recent Trades */}
        <div className="w-72 xl:w-80 flex flex-col border-r border-dark-700 bg-dark-800 flex-shrink-0">
          {/* Orderbook / Trades Toggle Tabs for Compact Screens */}
          <div className="h-9 px-2 border-b border-dark-700 flex items-center space-x-1 bg-dark-800">
            <button
              onClick={() => setRightPanelTab('book')}
              className={`flex-1 py-1 text-center rounded text-[11px] font-mono transition-colors ${
                rightPanelTab === 'book'
                  ? 'bg-dark-700 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Order Book
            </button>
            <button
              onClick={() => setRightPanelTab('trades')}
              className={`flex-1 py-1 text-center rounded text-[11px] font-mono transition-colors ${
                rightPanelTab === 'trades'
                  ? 'bg-dark-700 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Recent Trades
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightPanelTab === 'book' ? <OrderBook /> : <RecentTrades />}
          </div>
        </div>

        {/* Far-Right Area: Interactive Order Entry Form */}
        <div className="w-80 lg:w-84 xl:w-92 flex-shrink-0 bg-dark-800 border-l border-dark-700">
          <OrderForm />
        </div>
      </div>

      {/* Watchlist Quick Switcher Modal */}
      <WatchlistModal
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
      />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
