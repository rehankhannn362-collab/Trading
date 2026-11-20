import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useTrading } from '../../context/TradingContext.jsx';
import { usePortfolio } from '../../context/PortfolioContext.jsx';
import TimeframeBar from './TimeframeBar.jsx';

/**
 * Ensures a candle bar strictly satisfies Lightweight Charts validation invariants:
 * - time is a valid integer unix timestamp (seconds)
 * - high >= max(open, close)
 * - low <= min(open, close)
 * - open, high, low, close are finite numbers
 */
function sanitizeBar(bar, precision = 2) {
  if (!bar || typeof bar.time !== 'number' || isNaN(bar.time)) return null;
  const open = Number(Number(bar.open).toFixed(precision));
  const close = Number(Number(bar.close).toFixed(precision));
  const rawHigh = Number(Number(bar.high).toFixed(precision));
  const rawLow = Number(Number(bar.low).toFixed(precision));

  if (isNaN(open) || isNaN(close) || open <= 0 || close <= 0) return null;

  const high = Math.max(open, close, isNaN(rawHigh) ? open : rawHigh);
  const low = Math.min(open, close, isNaN(rawLow) ? open : rawLow);
  if (high <= 0 || low <= 0) return null;
  const volume = Number(bar.volume) || 0;

  return {
    time: bar.time,
    open,
    high,
    low,
    close,
    volume
  };
}

export default function TradingChart() {
  const { candles, currentBar, activeMarket, selectedSymbol, timeframe } = useTrading();
  const { portfolio, openOrders } = usePortfolio();

  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const smaSeriesRef = useRef(null);
  const lastBarTimeRef = useRef(0);
  const historicalBarsRef = useRef([]);
  const priceLinesRef = useRef([]);

  const [showVolume, setShowVolume] = useState(true);
  const [showSMA, setShowSMA] = useState(true);

  // Initialize chart instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d111a' },
        textColor: '#848e9c',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace'
      },
      grid: {
        vertLines: { color: '#141a27' },
        horzLines: { color: '#141a27' }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#32405d',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1c2436'
        },
        horzLine: {
          color: '#32405d',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1c2436'
        }
      },
      rightPriceScale: {
        borderColor: '#1e2638',
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.22
        }
      },
      timeScale: {
        borderColor: '#1e2638',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 9,
        shiftVisibleRangeOnNewBar: true
      }
    });

    // Candlestick series
    const initialPrecision = Number.isInteger(activeMarket?.pricePrecision)
      ? activeMarket.pricePrecision
      : 2;
    const priceFormat = {
      type: 'price',
      precision: initialPrecision,
      minMove: 1 / (10 ** initialPrecision)
    };

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderVisible: false,
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
      priceFormat
    });

    // Volume histogram series:
    // IMPORTANT: priceScaleId: '' isolates volume on an overlay scale with NO axis.
    // This prevents volume values (e.g. 43.77) from squashing the candlestick price scale!
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      priceLineVisible: false,
      lastValueVisible: false
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
    });

    // SMA Line series
    const smaSeries = chart.addLineSeries({
      color: '#8b5cf6',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat
    });

    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    smaSeriesRef.current = smaSeries;

    // Handle responsive container resize
    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    handleResize();

    return () => {
      resizeObserver.disconnect();
      try {
        chart.remove();
      } catch (err) {
        // ignore unmount errors
      }
      chartInstanceRef.current = null;
    };
  }, []);

  // Keep the visible price scale precise when switching between markets.
  // Forex pairs commonly need 5 decimal places, while crypto may use fewer or more.
  useEffect(() => {
    const precision = Number.isInteger(activeMarket?.pricePrecision)
      ? activeMarket.pricePrecision
      : 2;
    const priceFormat = {
      type: 'price',
      precision,
      minMove: 1 / (10 ** precision)
    };

    candleSeriesRef.current?.applyOptions({ priceFormat });
    smaSeriesRef.current?.applyOptions({ priceFormat });
    chartInstanceRef.current?.applyOptions({
      rightPriceScale: { visible: true, borderColor: '#1e2638' }
    });
  }, [activeMarket?.pricePrecision, selectedSymbol]);

  // Update chart data whenever candles list changes (symbol or timeframe switch)
  useEffect(() => {
    if (!candleSeriesRef.current || !candles || candles.length === 0) return;

    try {
      const precision = activeMarket?.pricePrecision || 2;
      const seenTimes = new Set();
      const cleanCandles = [];

      for (const raw of candles) {
        const bar = sanitizeBar(raw, precision);
        if (bar && !seenTimes.has(bar.time)) {
          seenTimes.add(bar.time);
          cleanCandles.push(bar);
        }
      }

      // Strictly sort ascending by time
      cleanCandles.sort((a, b) => a.time - b.time);

      if (cleanCandles.length === 0) return;

      historicalBarsRef.current = cleanCandles;
      lastBarTimeRef.current = cleanCandles[cleanCandles.length - 1].time;

      candleSeriesRef.current.setData(cleanCandles);

      if (volumeSeriesRef.current) {
        const volumeData = cleanCandles.map(c => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(14, 203, 129, 0.35)' : 'rgba(246, 70, 93, 0.35)'
        }));
        volumeSeriesRef.current.setData(volumeData);
      }

      if (smaSeriesRef.current) {
        const period = 20;
        const smaData = [];
        for (let i = period - 1; i < cleanCandles.length; i++) {
          let sum = 0;
          for (let j = 0; j < period; j++) {
            sum += cleanCandles[i - j].close;
          }
          smaData.push({
            time: cleanCandles[i].time,
            value: Number((sum / period).toFixed(precision))
          });
        }
        smaSeriesRef.current.setData(smaData);
      }

      if (chartInstanceRef.current) {
        chartInstanceRef.current.timeScale().scrollToRealTime();
      }
    } catch (err) {
      console.warn('Error setting chart data:', err);
    }
  }, [candles, activeMarket, selectedSymbol, timeframe]);

  // Update ongoing live candle bar in real time without flickering or asserting
  useEffect(() => {
    if (!currentBar || !candleSeriesRef.current) return;

    const precision = activeMarket?.pricePrecision || 2;
    const bar = sanitizeBar(currentBar, precision);
    if (!bar) return;

    // Reject updates with timestamps strictly earlier than the chart's last bar
    if (lastBarTimeRef.current && bar.time < lastBarTimeRef.current) {
      return;
    }

    try {
      candleSeriesRef.current.update(bar);

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update({
          time: bar.time,
          value: bar.volume,
          color: bar.close >= bar.open ? 'rgba(14, 203, 129, 0.35)' : 'rgba(246, 70, 93, 0.35)'
        });
      }

      // Keep lastBarTime updated
      if (bar.time >= lastBarTimeRef.current) {
        lastBarTimeRef.current = bar.time;
      }
    } catch (err) {
      console.warn('Live candle update skipped:', err);
    }
  }, [currentBar, activeMarket]);

  const [overlayBadges, setOverlayBadges] = useState([]);
  const { cancelOrder, closePosition } = usePortfolio();

  // Recompute pixel coordinates for interactive on-chart badges
  const updateCoordinates = useCallback(() => {
    if (!candleSeriesRef.current || !chartContainerRef.current) return;
    const containerHeight = chartContainerRef.current.clientHeight;

    const items = [];

    // Positions for the active market
    const marketPositions = (portfolio?.positions || []).filter(p => p.symbol === selectedSymbol);
    for (const pos of marketPositions) {
      if (typeof pos.entryPrice === 'number') {
        const entryY = candleSeriesRef.current.priceToCoordinate(pos.entryPrice);
        const isLong = pos.side === 'LONG';
        const pnlSign = (pos.unrealizedPnl || 0) >= 0 ? '+' : '';
        const pnlText = `${pnlSign}$${pos.unrealizedPnl || 0} (${pnlSign}${pos.pnlPercent || 0}%)`;

        if (entryY !== null && entryY >= 0 && entryY <= containerHeight) {
          items.push({
            key: `pos-${pos.id}`,
            type: 'POSITION',
            positionId: pos.id,
            symbol: pos.symbol,
            side: pos.side,
            quantity: pos.quantity,
            price: pos.entryPrice,
            pnlText,
            isLong,
            y: entryY
          });
        }
      }

      if (pos.takeProfit && typeof pos.takeProfit === 'number') {
        const tpY = candleSeriesRef.current.priceToCoordinate(pos.takeProfit);
        if (tpY !== null && tpY >= 0 && tpY <= containerHeight) {
          const diff = pos.takeProfit - pos.entryPrice;
          const estPnl = pos.side === 'LONG' ? diff * pos.quantity : -diff * pos.quantity;
          items.push({
            key: `pos-tp-${pos.id}`,
            type: 'TP',
            positionId: pos.id,
            symbol: pos.symbol,
            price: pos.takeProfit,
            estPnl: estPnl.toFixed(2),
            y: tpY
          });
        }
      }

      if (pos.stopLoss && typeof pos.stopLoss === 'number') {
        const slY = candleSeriesRef.current.priceToCoordinate(pos.stopLoss);
        if (slY !== null && slY >= 0 && slY <= containerHeight) {
          const diff = pos.stopLoss - pos.entryPrice;
          const estPnl = pos.side === 'LONG' ? diff * pos.quantity : -diff * pos.quantity;
          items.push({
            key: `pos-sl-${pos.id}`,
            type: 'SL',
            positionId: pos.id,
            symbol: pos.symbol,
            price: pos.stopLoss,
            estPnl: estPnl.toFixed(2),
            y: slY
          });
        }
      }
    }

    // Open orders for the active market
    const marketOrders = (openOrders || []).filter(
      o => o.symbol === selectedSymbol && o.status === 'OPEN' && typeof o.price === 'number'
    );
    for (const ord of marketOrders) {
      const ordY = candleSeriesRef.current.priceToCoordinate(ord.price);
      const isBuy = ord.side === 'BUY';
      if (ordY !== null && ordY >= 0 && ordY <= containerHeight) {
        items.push({
          key: `ord-${ord.id}`,
          type: 'ORDER',
          orderId: ord.id,
          side: ord.side,
          quantity: ord.quantity,
          price: ord.price,
          isBuy,
          y: ordY
        });
      }

      if (ord.takeProfit && typeof ord.takeProfit === 'number') {
        const ordTpY = candleSeriesRef.current.priceToCoordinate(ord.takeProfit);
        if (ordTpY !== null && ordTpY >= 0 && ordTpY <= containerHeight) {
          items.push({
            key: `ord-tp-${ord.id}`,
            type: 'ORDER_TP',
            price: ord.takeProfit,
            side: ord.side,
            y: ordTpY
          });
        }
      }

      if (ord.stopLoss && typeof ord.stopLoss === 'number') {
        const ordSlY = candleSeriesRef.current.priceToCoordinate(ord.stopLoss);
        if (ordSlY !== null && ordSlY >= 0 && ordSlY <= containerHeight) {
          items.push({
            key: `ord-sl-${ord.id}`,
            type: 'ORDER_SL',
            price: ord.stopLoss,
            side: ord.side,
            y: ordSlY
          });
        }
      }
    }

    setOverlayBadges(items);
  }, [portfolio?.positions, openOrders, selectedSymbol]);

  // Subscribe chart visible range updates to sync on-chart badge coordinates
  useEffect(() => {
    if (!chartInstanceRef.current) return;
    const timeScale = chartInstanceRef.current.timeScale();
    const handleRangeChange = () => {
      updateCoordinates();
    };
    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    return () => {
      try {
        timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      } catch (e) {
        // cleanup
      }
    };
  }, [updateCoordinates]);

  // TradingView-Style Order and Position Price Lines on the Chart
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // 1. Clear existing price lines
    priceLinesRef.current.forEach(line => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (err) {
        // Line might already be cleaned up
      }
    });
    priceLinesRef.current = [];

    // 2. Draw lines for resting open limit orders on this market
    if (openOrders && openOrders.length > 0) {
      const marketOrders = openOrders.filter(
        o => o.symbol === selectedSymbol && o.status === 'OPEN' && typeof o.price === 'number'
      );

      for (const ord of marketOrders) {
        const isBuy = ord.side === 'BUY';
        const color = isBuy ? '#0ecb81' : '#f6465d';
        try {
          const line = candleSeriesRef.current.createPriceLine({
            price: ord.price,
            color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `LIMIT ${ord.side} ${ord.quantity}`,
            axisLabelColor: color,
            axisLabelTextColor: isBuy ? '#0b0e14' : '#ffffff'
          });
          priceLinesRef.current.push(line);

          // Order TP line
          if (ord.takeProfit && ord.takeProfit > 0) {
            const tpLine = candleSeriesRef.current.createPriceLine({
              price: ord.takeProfit,
              color: '#10b981',
              lineWidth: 1,
              lineStyle: LineStyle.ShortDash,
              axisLabelVisible: true,
              title: `ORDER TP: $${ord.takeProfit}`,
              axisLabelColor: '#10b981',
              axisLabelTextColor: '#ffffff'
            });
            priceLinesRef.current.push(tpLine);
          }

          // Order SL line
          if (ord.stopLoss && ord.stopLoss > 0) {
            const slLine = candleSeriesRef.current.createPriceLine({
              price: ord.stopLoss,
              color: '#f43f5e',
              lineWidth: 1,
              lineStyle: LineStyle.ShortDash,
              axisLabelVisible: true,
              title: `ORDER SL: $${ord.stopLoss}`,
              axisLabelColor: '#f43f5e',
              axisLabelTextColor: '#ffffff'
            });
            priceLinesRef.current.push(slLine);
          }
        } catch (err) {
          console.warn('Failed to create order price line:', err);
        }
      }
    }

    // 3. Draw lines for open positions (Entry price, TP, SL, and Liquidation price) on this market
    if (portfolio?.positions && portfolio.positions.length > 0) {
      const marketPositions = portfolio.positions.filter(
        p => p.symbol === selectedSymbol && typeof p.entryPrice === 'number'
      );

      for (const pos of marketPositions) {
        const isLong = pos.side === 'LONG';
        const posColor = isLong ? '#0ecb81' : '#f6465d';
        const pnlSign = (pos.unrealizedPnl || 0) >= 0 ? '+' : '';
        const pnlText = `${pnlSign}$${pos.unrealizedPnl || 0} (${pnlSign}${pos.pnlPercent || 0}%)`;

        try {
          // Entry price solid line with live PnL badge
          const entryLine = candleSeriesRef.current.createPriceLine({
            price: pos.entryPrice,
            color: posColor,
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `${pos.side} ${pos.quantity} | PnL: ${pnlText}`,
            axisLabelColor: posColor,
            axisLabelTextColor: isLong ? '#0b0e14' : '#ffffff'
          });
          priceLinesRef.current.push(entryLine);

          // Take Profit Line (Emerald Dashed)
          if (pos.takeProfit && pos.takeProfit > 0) {
            const tpLine = candleSeriesRef.current.createPriceLine({
              price: pos.takeProfit,
              color: '#10b981',
              lineWidth: 1.5,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `TP @ $${pos.takeProfit}`,
              axisLabelColor: '#10b981',
              axisLabelTextColor: '#ffffff'
            });
            priceLinesRef.current.push(tpLine);
          }

          // Stop Loss Line (Rose Dashed)
          if (pos.stopLoss && pos.stopLoss > 0) {
            const slLine = candleSeriesRef.current.createPriceLine({
              price: pos.stopLoss,
              color: '#f43f5e',
              lineWidth: 1.5,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: `SL @ $${pos.stopLoss}`,
              axisLabelColor: '#f43f5e',
              axisLabelTextColor: '#ffffff'
            });
            priceLinesRef.current.push(slLine);
          }

          // Liquidation price dashed gold line
          if (pos.liquidationPrice && pos.liquidationPrice > 0) {
            const liqLine = candleSeriesRef.current.createPriceLine({
              price: pos.liquidationPrice,
              color: '#f59e0b',
              lineWidth: 1,
              lineStyle: LineStyle.LargeDashed,
              axisLabelVisible: true,
              title: `LIQ @ $${pos.liquidationPrice}`,
              axisLabelColor: '#f59e0b',
              axisLabelTextColor: '#0b0e14'
            });
            priceLinesRef.current.push(liqLine);
          }
        } catch (err) {
          console.warn('Failed to create position price line:', err);
        }
      }
    }

    // Update coordinates immediately after price lines update
    updateCoordinates();
  }, [openOrders, portfolio?.positions, selectedSymbol, updateCoordinates]);

  // Toggle indicators visibility
  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({ visible: showVolume });
    }
  }, [showVolume]);

  useEffect(() => {
    if (smaSeriesRef.current) {
      smaSeriesRef.current.applyOptions({ visible: showSMA });
    }
  }, [showSMA]);

  // Handler for scrolling to live current location
  const handleScrollToRealtime = useCallback(() => {
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.timeScale().scrollToRealTime();
        updateCoordinates();
      } catch (err) {
        console.warn('Failed to scroll to real-time:', err);
      }
    }
  }, [updateCoordinates]);

  return (
    <div className="flex flex-col h-full bg-dark-900 border-r border-dark-700">
      <TimeframeBar
        showVolume={showVolume}
        setShowVolume={setShowVolume}
        showSMA={showSMA}
        setShowSMA={setShowSMA}
        onScrollToRealtime={handleScrollToRealtime}
      />
      <div className="flex-1 w-full min-h-[350px] relative overflow-hidden" ref={chartContainerRef}>
        {/* TradingView-Style Interactive Badges Overlay */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {overlayBadges.map(b => {
            if (b.type === 'POSITION') {
              return (
                <div
                  key={b.key}
                  className={`absolute left-3 flex items-center shadow-lg rounded border text-[11px] font-mono select-none pointer-events-auto backdrop-blur-sm transition-all duration-75 ${
                    b.isLong
                      ? 'bg-dark-900/90 border-trade-green/80 text-trade-green'
                      : 'bg-dark-900/90 border-trade-red/80 text-trade-red'
                  }`}
                  style={{ top: `${b.y}px`, transform: 'translateY(-50%)' }}
                >
                  <div className="px-2 py-0.5 font-bold flex items-center space-x-1.5 border-r border-dark-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    <span>{b.side} {b.quantity}</span>
                    <span className="text-slate-300">@ ${b.price}</span>
                  </div>
                  <div className="px-2 py-0.5 font-semibold text-slate-200">
                    PnL: <span className={b.isLong ? 'text-trade-green' : 'text-trade-red'}>{b.pnlText}</span>
                  </div>
                  <button
                    onClick={() => closePosition(b.positionId, b.symbol)}
                    className="px-2 py-0.5 bg-dark-750 hover:bg-trade-red hover:text-white text-slate-300 text-[10px] font-bold rounded-r transition-colors flex items-center space-x-0.5 border-l border-dark-700"
                    title="Close Position at Market"
                  >
                    <span>✕ Close</span>
                  </button>
                </div>
              );
            }

            if (b.type === 'ORDER') {
              return (
                <div
                  key={b.key}
                  className={`absolute left-3 flex items-center shadow-lg rounded border text-[11px] font-mono select-none pointer-events-auto backdrop-blur-sm transition-all duration-75 ${
                    b.isBuy
                      ? 'bg-dark-900/90 border-trade-green/70 text-trade-green'
                      : 'bg-dark-900/90 border-trade-red/70 text-trade-red'
                  }`}
                  style={{ top: `${b.y}px`, transform: 'translateY(-50%)' }}
                >
                  <div className="px-2 py-0.5 font-bold flex items-center space-x-1.5 border-r border-dark-700">
                    <span className="text-[9px] uppercase px-1 rounded bg-dark-700 text-slate-300">LIMIT</span>
                    <span>{b.side} {b.quantity}</span>
                    <span className="text-slate-300">@ ${b.price}</span>
                  </div>
                  <button
                    onClick={() => cancelOrder(b.orderId)}
                    className="px-2 py-0.5 bg-dark-750 hover:bg-trade-red hover:text-white text-slate-300 text-[10px] font-bold rounded-r transition-colors flex items-center space-x-0.5"
                    title="Cancel Limit Order"
                  >
                    <span>✕ Cancel</span>
                  </button>
                </div>
              );
            }

            if (b.type === 'TP') {
              return (
                <div
                  key={b.key}
                  className="absolute left-3 flex items-center shadow-lg rounded border border-emerald-500/80 bg-dark-900/90 text-emerald-400 text-[10px] font-mono select-none pointer-events-auto backdrop-blur-sm"
                  style={{ top: `${b.y}px`, transform: 'translateY(-50%)' }}
                >
                  <div className="px-2 py-0.5 font-bold flex items-center space-x-1">
                    <span>🎯 TP @ ${b.price}</span>
                    <span className="text-slate-400 font-normal">Est: +${b.estPnl}</span>
                  </div>
                </div>
              );
            }

            if (b.type === 'SL') {
              return (
                <div
                  key={b.key}
                  className="absolute left-3 flex items-center shadow-lg rounded border border-rose-500/80 bg-dark-900/90 text-rose-400 text-[10px] font-mono select-none pointer-events-auto backdrop-blur-sm"
                  style={{ top: `${b.y}px`, transform: 'translateY(-50%)' }}
                >
                  <div className="px-2 py-0.5 font-bold flex items-center space-x-1">
                    <span>🛡️ SL @ ${b.price}</span>
                    <span className="text-slate-400 font-normal">Est: ${b.estPnl}</span>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
