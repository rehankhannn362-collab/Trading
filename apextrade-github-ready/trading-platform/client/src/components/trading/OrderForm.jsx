import React, { useState, useEffect } from 'react';
import { Shield, Info, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useTrading } from '../../context/TradingContext.jsx';
import { usePortfolio } from '../../context/PortfolioContext.jsx';

export default function OrderForm() {
  const { selectedSymbol, activeMarket, activeTicker, orderPrefillPrice, setOrderPrefillPrice } = useTrading();
  const { portfolio, placeOrder, loading } = usePortfolio();

  const [side, setSide] = useState('BUY'); // 'BUY' | 'SELL'
  const [orderType, setOrderType] = useState('LIMIT'); // 'LIMIT' | 'MARKET'
  const [leverage, setLeverage] = useState(10);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [enableTpSl, setEnableTpSl] = useState(false);
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');

  // When orderPrefillPrice is clicked from OrderBook, update price
  useEffect(() => {
    if (orderPrefillPrice !== null) {
      setPrice(orderPrefillPrice.toString());
      setOrderPrefillPrice(null);
    }
  }, [orderPrefillPrice, setOrderPrefillPrice]);

  // Set default price to active mark price if empty
  useEffect(() => {
    if (!price && activeTicker?.price) {
      setPrice(activeTicker.price.toString());
    }
  }, [activeTicker?.price, price]);

  // Order Calculations
  const numericPrice = orderType === 'MARKET' ? (activeTicker?.price || activeMarket.basePrice) : Number(price) || 0;
  const numericQty = Number(quantity) || 0;
  const orderValue = numericPrice * numericQty;
  const marginRequired = leverage > 0 ? orderValue / leverage : orderValue;
  const feeRate = orderType === 'MARKET' ? activeMarket.takerFee : activeMarket.makerFee;
  const estimatedFee = orderValue * feeRate;

  // Estimated Liquidation Price
  const estimatedLiqPrice = (() => {
    if (numericPrice <= 0 || numericQty <= 0 || leverage <= 1) return null;
    const maintenance = 0.01;
    if (side === 'BUY') {
      return numericPrice * (1 - (1 / leverage) + maintenance);
    } else {
      return numericPrice * (1 + (1 / leverage) - maintenance);
    }
  })();

  const isBuy = side === 'BUY';

  // TP/SL Calculations
  const numTp = Number(takeProfit) || null;
  const numSl = Number(stopLoss) || null;

  const estimatedTpPnl = (() => {
    if (!numTp || numericQty <= 0 || numericPrice <= 0) return null;
    const diff = isBuy ? (numTp - numericPrice) : (numericPrice - numTp);
    return Number((diff * numericQty).toFixed(2));
  })();

  const estimatedSlPnl = (() => {
    if (!numSl || numericQty <= 0 || numericPrice <= 0) return null;
    const diff = isBuy ? (numSl - numericPrice) : (numericPrice - numSl);
    return Number((diff * numericQty).toFixed(2));
  })();

  const handleQuickTp = (percent) => {
    if (numericPrice <= 0) return;
    const mult = isBuy ? (1 + percent / 100) : (1 - percent / 100);
    setTakeProfit((numericPrice * mult).toFixed(activeMarket.pricePrecision));
  };

  const handleQuickSl = (percent) => {
    if (numericPrice <= 0) return;
    const mult = isBuy ? (1 - percent / 100) : (1 + percent / 100);
    setStopLoss((numericPrice * mult).toFixed(activeMarket.pricePrecision));
  };

  const handlePercentageClick = (percent) => {
    if (numericPrice <= 0) return;
    const available = portfolio.availableMargin || 0;
    const targetMargin = available * (percent / 100);
    const targetValue = targetMargin * leverage;
    const calculatedQty = targetValue / numericPrice;
    setQuantity(calculatedQty.toFixed(activeMarket.quantityPrecision));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (numericQty < activeMarket.minQuantity) {
      alert(`Minimum quantity is ${activeMarket.minQuantity} ${activeMarket.baseAsset}`);
      return;
    }

    try {
      await placeOrder({
        symbol: selectedSymbol,
        side,
        type: orderType,
        price: numericPrice,
        quantity: numericQty,
        leverage,
        takeProfit: enableTpSl && numTp ? numTp : null,
        stopLoss: enableTpSl && numSl ? numSl : null
      });
      // Clear fields
      setQuantity('');
      if (enableTpSl) {
        setTakeProfit('');
        setStopLoss('');
      }
    } catch (err) {
      // Toast handles error display
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark-800 text-xs font-mono select-none overflow-y-auto no-scrollbar">
      {/* Buy / Sell Tabs */}
      <div className="grid grid-cols-2 p-2 gap-2 border-b border-dark-700">
        <button
          type="button"
          onClick={() => setSide('BUY')}
          className={`py-2 rounded font-bold transition-all text-xs flex items-center justify-center space-x-1.5 ${
            isBuy
              ? 'bg-trade-green text-dark-900 shadow-md shadow-trade-green/20'
              : 'bg-dark-750 text-slate-400 hover:text-white'
          }`}
        >
          <ArrowUpCircle className="w-4 h-4" />
          <span>Buy / Long</span>
        </button>
        <button
          type="button"
          onClick={() => setSide('SELL')}
          className={`py-2 rounded font-bold transition-all text-xs flex items-center justify-center space-x-1.5 ${
            !isBuy
              ? 'bg-trade-red text-white shadow-md shadow-trade-red/20'
              : 'bg-dark-750 text-slate-400 hover:text-white'
          }`}
        >
          <ArrowDownCircle className="w-4 h-4" />
          <span>Sell / Short</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-3 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Order Type & Leverage Pills */}
          <div className="flex items-center justify-between">
            <div className="flex rounded bg-dark-750 p-0.5 border border-dark-700">
              <button
                type="button"
                onClick={() => setOrderType('LIMIT')}
                className={`px-3 py-1 rounded text-[11px] transition-colors ${
                  orderType === 'LIMIT'
                    ? 'bg-dark-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Limit
              </button>
              <button
                type="button"
                onClick={() => setOrderType('MARKET')}
                className={`px-3 py-1 rounded text-[11px] transition-colors ${
                  orderType === 'MARKET'
                    ? 'bg-dark-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Market
              </button>
            </div>

            {/* Leverage Dropdown */}
            <div className="flex items-center space-x-1">
              <span className="text-[10px] text-slate-500">Lev:</span>
              <select
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="bg-dark-750 text-brand-gold border border-dark-700 rounded px-2 py-1 text-[11px] font-bold focus:outline-none focus:border-brand-gold"
              >
                <option value={1}>1x Spot</option>
                <option value={2}>2x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
                <option value={20}>20x</option>
                <option value={50}>50x</option>
              </select>
            </div>
          </div>

          {/* Price Input (if Limit) */}
          {orderType === 'LIMIT' ? (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Order Price</span>
                <span className="text-slate-500">{activeMarket.quoteAsset}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-dark-750 border border-dark-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-brand-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setPrice(activeTicker.price.toString())}
                  className="absolute right-2 top-1.5 px-2 py-0.5 rounded bg-dark-600 hover:bg-dark-500 text-slate-300 text-[10px]"
                >
                  Mid
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded bg-dark-750/70 border border-dark-700 text-[11px] text-slate-400 flex items-center space-x-2">
              <Info className="w-4 h-4 text-brand-accent flex-shrink-0" />
              <span>Executes immediately at the best available market price.</span>
            </div>
          )}

          {/* Quantity Input */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Quantity</span>
              <span className="text-slate-500">{activeMarket.baseAsset}</span>
            </div>
            <input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Min: ${activeMarket.minQuantity}`}
              required
              className="w-full bg-dark-750 border border-dark-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          {/* Margin Percentage Slider / Buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {[25, 50, 75, 100].map(pct => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentageClick(pct)}
                className="py-1 rounded bg-dark-750 hover:bg-dark-700 text-slate-300 border border-dark-700 text-[10px] font-medium transition-colors"
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* TP / SL Toggle and Section */}
          <div className="pt-2 border-t border-dark-750 space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableTpSl}
                onChange={(e) => setEnableTpSl(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-dark-700 border-dark-600 text-brand-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-[11px] font-semibold text-slate-300">Take Profit / Stop Loss (TP / SL)</span>
            </label>

            {enableTpSl && (
              <div className="p-2.5 rounded bg-dark-750/70 border border-dark-700 space-y-2.5">
                {/* Take Profit */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-trade-green font-medium">Take Profit (TP)</span>
                    {estimatedTpPnl !== null && (
                      <span className="text-trade-green font-semibold">
                        Est. +${estimatedTpPnl}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-1.5">
                    <input
                      type="number"
                      step="any"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      placeholder={`Target ${activeMarket.quoteAsset}`}
                      className="flex-1 bg-dark-800 border border-dark-700 rounded px-2 py-1 text-white text-[11px] font-mono focus:outline-none focus:border-trade-green transition-colors"
                    />
                    {[5, 10, 25].map(pct => (
                      <button
                        key={`tp_${pct}`}
                        type="button"
                        onClick={() => handleQuickTp(pct)}
                        className="px-1.5 py-1 text-[9px] rounded bg-dark-700 hover:bg-trade-green/20 text-slate-300 hover:text-trade-green border border-dark-650 transition-colors"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stop Loss */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-trade-red font-medium">Stop Loss (SL)</span>
                    {estimatedSlPnl !== null && (
                      <span className="text-trade-red font-semibold">
                        Est. ${estimatedSlPnl}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-1.5">
                    <input
                      type="number"
                      step="any"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder={`Stop ${activeMarket.quoteAsset}`}
                      className="flex-1 bg-dark-800 border border-dark-700 rounded px-2 py-1 text-white text-[11px] font-mono focus:outline-none focus:border-trade-red transition-colors"
                    />
                    {[2, 5, 10].map(pct => (
                      <button
                        key={`sl_${pct}`}
                        type="button"
                        onClick={() => handleQuickSl(pct)}
                        className="px-1.5 py-1 text-[9px] rounded bg-dark-700 hover:bg-trade-red/20 text-slate-300 hover:text-trade-red border border-dark-650 transition-colors"
                      >
                        -{pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Available Margin */}
          <div className="flex justify-between text-[11px] pt-1 border-t border-dark-750 text-slate-400">
            <span>Available Margin:</span>
            <span className="text-white font-semibold">
              ${(portfolio.availableMargin || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
            </span>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-dark-750/50 rounded p-2.5 space-y-1.5 text-[11px] text-slate-400 border border-dark-700">
            <div className="flex justify-between">
              <span>Order Value:</span>
              <span className="text-slate-200">${orderValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Margin Required ({leverage}x):</span>
              <span className="text-slate-200 font-semibold">${marginRequired.toFixed(2)}</span>
            </div>
            {estimatedLiqPrice && (
              <div className="flex justify-between text-brand-gold">
                <span>Est. Liq. Price:</span>
                <span>${estimatedLiqPrice.toFixed(activeMarket.pricePrecision)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Est. Fee ({orderType}):</span>
              <span>${estimatedFee.toFixed(4)}</span>
            </div>
          </div>
        </div>

        {/* Submit Order Button */}
        <button
          type="submit"
          disabled={loading || numericQty <= 0}
          className={`w-full py-2.5 rounded font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
            isBuy
              ? 'bg-trade-green hover:bg-trade-green-dark text-dark-900 shadow-trade-green/10'
              : 'bg-trade-red hover:bg-trade-red-dark text-white shadow-trade-red/10'
          }`}
        >
          {loading ? 'Processing...' : `${isBuy ? 'Buy / Long' : 'Sell / Short'} ${activeMarket.baseAsset}`}
        </button>
      </form>
    </div>
  );
}
