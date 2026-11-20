import { getMarket } from '../config/markets.js';

/**
 * Portfolio and Risk Management Service
 * Manages user multi-currency wallet balances, open perpetual/margin positions,
 * real-time margin requirements, liquidation pricing, and PnL calculation.
 */
export class PortfolioService {
  constructor() {
    this.balances = {
      USDT: 10000.00,
      USD: 10000.00,
      BTC: 0.15,
      ETH: 2.0,
      SOL: 15.0
    };

    this.positions = []; // Array of open positions
    this.closedTrades = []; // History of realized trades
  }

  getBalances() {
    return { ...this.balances };
  }

  getPortfolio(currentPrices = {}) {
    let totalUnrealizedPnl = 0;
    let totalMarginUsed = 0;

    const enrichedPositions = this.positions.map(pos => {
      const markPrice = currentPrices[pos.symbol] || pos.entryPrice;
      let pnl = 0;

      if (pos.side === 'LONG') {
        pnl = (markPrice - pos.entryPrice) * pos.quantity;
      } else {
        pnl = (pos.entryPrice - markPrice) * pos.quantity;
      }

      const pnlPercent = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;
      totalUnrealizedPnl += pnl;
      totalMarginUsed += pos.margin;

      return {
        ...pos,
        markPrice,
        unrealizedPnl: Number(pnl.toFixed(2)),
        pnlPercent: Number(pnlPercent.toFixed(2))
      };
    });

    const quoteCurrency = 'USDT';
    const cashBalance = this.balances[quoteCurrency] || 0;
    const equity = Number((cashBalance + totalUnrealizedPnl).toFixed(2));
    const availableMargin = Number(Math.max(0, cashBalance - totalMarginUsed).toFixed(2));
    const marginLevel = totalMarginUsed > 0 ? Number(((equity / totalMarginUsed) * 100).toFixed(2)) : 999.9;

    return {
      balances: this.balances,
      equity,
      cashBalance,
      availableMargin,
      totalMarginUsed: Number(totalMarginUsed.toFixed(2)),
      totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(2)),
      marginLevel,
      positions: enrichedPositions
    };
  }

  calculateLiquidationPrice(side, entryPrice, leverage, maintenanceMarginRate = 0.01) {
    if (leverage <= 1) return 0;
    // Liquidation price formula for margin/futures
    if (side === 'LONG') {
      return entryPrice * (1 - (1 / leverage) + maintenanceMarginRate);
    } else {
      return entryPrice * (1 + (1 / leverage) - maintenanceMarginRate);
    }
  }

  openPosition({ symbol, side, entryPrice, quantity, leverage = 1, takeProfit = null, stopLoss = null }) {
    const market = getMarket(symbol);
    if (!market) throw new Error(`Market ${symbol} not found`);

    const notionalValue = entryPrice * quantity;
    const marginRequired = notionalValue / leverage;
    const quote = market.quoteAsset;

    if ((this.balances[quote] || 0) < marginRequired) {
      throw new Error(`Insufficient ${quote} balance. Required: $${marginRequired.toFixed(2)}, Available: $${(this.balances[quote] || 0).toFixed(2)}`);
    }

    const tpVal = takeProfit ? Number(Number(takeProfit).toFixed(market.pricePrecision)) : null;
    const slVal = stopLoss ? Number(Number(stopLoss).toFixed(market.pricePrecision)) : null;

    // Check if there is an existing opposite position or same position
    const existingIndex = this.positions.findIndex(p => p.symbol === symbol);

    if (existingIndex >= 0) {
      const existing = this.positions[existingIndex];
      if (existing.side === side) {
        // Average in
        const totalQty = existing.quantity + quantity;
        const totalCost = (existing.entryPrice * existing.quantity) + (entryPrice * quantity);
        const avgPrice = totalCost / totalQty;
        const newMargin = existing.margin + marginRequired;

        existing.entryPrice = Number(avgPrice.toFixed(market.pricePrecision));
        existing.quantity = Number(totalQty.toFixed(market.quantityPrecision));
        existing.margin = Number(newMargin.toFixed(2));
        existing.liquidationPrice = Number(this.calculateLiquidationPrice(side, existing.entryPrice, leverage).toFixed(market.pricePrecision));
        if (tpVal !== null) existing.takeProfit = tpVal;
        if (slVal !== null) existing.stopLoss = slVal;

        return existing;
      } else {
        // Closing or flipping opposite position
        if (existing.quantity > quantity) {
          // Partial close
          const remainingQty = existing.quantity - quantity;
          const closedPnl = (side === 'BUY' ? (existing.entryPrice - entryPrice) : (entryPrice - existing.entryPrice)) * quantity;
          
          this.balances[quote] += closedPnl;
          existing.quantity = Number(remainingQty.toFixed(market.quantityPrecision));
          existing.margin = Number(((existing.entryPrice * remainingQty) / existing.leverage).toFixed(2));
          
          this.recordClosedTrade({
            symbol,
            side: existing.side,
            entryPrice: existing.entryPrice,
            closePrice: entryPrice,
            quantity,
            realizedPnl: closedPnl,
            reason: 'PARTIAL_CLOSE'
          });
          return existing;
        } else {
          // Fully close existing and open opposite remainder if any
          this.closePosition(existing.id, entryPrice, 'FLIP_CLOSE');
          const remainderQty = quantity - existing.quantity;
          if (remainderQty > 0) {
            return this.openPosition({ symbol, side, entryPrice, quantity: remainderQty, leverage, takeProfit: tpVal, stopLoss: slVal });
          }
          return null;
        }
      }
    }

    const liqPrice = this.calculateLiquidationPrice(side, entryPrice, leverage);
    const position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol,
      side,
      entryPrice: Number(entryPrice.toFixed(market.pricePrecision)),
      quantity: Number(quantity.toFixed(market.quantityPrecision)),
      leverage,
      margin: Number(marginRequired.toFixed(2)),
      liquidationPrice: Number(liqPrice.toFixed(market.pricePrecision)),
      takeProfit: tpVal,
      stopLoss: slVal,
      openedAt: Date.now()
    };

    this.positions.push(position);
    return position;
  }

  updatePositionTpSl(positionId, { takeProfit, stopLoss }) {
    const pos = this.positions.find(p => p.id === positionId);
    if (!pos) throw new Error(`Position ${positionId} not found`);

    const market = getMarket(pos.symbol);
    const precision = market?.pricePrecision || 2;

    pos.takeProfit = takeProfit !== undefined && takeProfit !== null && !isNaN(takeProfit) && Number(takeProfit) > 0
      ? Number(Number(takeProfit).toFixed(precision))
      : null;

    pos.stopLoss = stopLoss !== undefined && stopLoss !== null && !isNaN(stopLoss) && Number(stopLoss) > 0
      ? Number(Number(stopLoss).toFixed(precision))
      : null;

    return pos;
  }

  checkTpSl(symbol, currentPrice) {
    const triggered = [];
    // Iterate over a copy to allow splicing inside closePosition
    for (const pos of [...this.positions]) {
      if (pos.symbol !== symbol) continue;

      let triggerReason = null;
      let fillPrice = currentPrice;

      if (pos.side === 'LONG') {
        if (pos.takeProfit && currentPrice >= pos.takeProfit) {
          triggerReason = 'TAKE_PROFIT';
          fillPrice = pos.takeProfit;
        } else if (pos.stopLoss && currentPrice <= pos.stopLoss) {
          triggerReason = 'STOP_LOSS';
          fillPrice = pos.stopLoss;
        }
      } else if (pos.side === 'SHORT') {
        if (pos.takeProfit && currentPrice <= pos.takeProfit) {
          triggerReason = 'TAKE_PROFIT';
          fillPrice = pos.takeProfit;
        } else if (pos.stopLoss && currentPrice >= pos.stopLoss) {
          triggerReason = 'STOP_LOSS';
          fillPrice = pos.stopLoss;
        }
      }

      if (triggerReason) {
        const closed = this.closePosition(pos.id, fillPrice, triggerReason);
        triggered.push({
          reason: triggerReason,
          position: pos,
          fillPrice,
          pnl: closed.realizedPnl
        });
      }
    }
    return triggered;
  }

  closePosition(positionId, currentPrice, reason = 'MANUAL') {
    const index = this.positions.findIndex(p => p.id === positionId);
    if (index === -1) {
      throw new Error(`Position ${positionId} not found`);
    }

    const pos = this.positions[index];
    const market = getMarket(pos.symbol) || { quoteAsset: 'USDT', pricePrecision: 2 };
    const closePrice = currentPrice || pos.entryPrice;

    let pnl = 0;
    if (pos.side === 'LONG') {
      pnl = (closePrice - pos.entryPrice) * pos.quantity;
    } else {
      pnl = (pos.entryPrice - closePrice) * pos.quantity;
    }

    const quote = market.quoteAsset;
    this.balances[quote] = Number(((this.balances[quote] || 0) + pnl).toFixed(2));

    this.positions.splice(index, 1);

    const closedRecord = this.recordClosedTrade({
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      closePrice: Number(closePrice.toFixed(market.pricePrecision)),
      quantity: pos.quantity,
      realizedPnl: Number(pnl.toFixed(2)),
      reason
    });

    return closedRecord;
  }

  recordClosedTrade(trade) {
    const record = {
      id: `ct_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...trade,
      closedAt: Date.now()
    };
    this.closedTrades.unshift(record);
    return record;
  }

  getClosedTrades(limit = 50) {
    return this.closedTrades.slice(0, limit);
  }

  claimFaucet(amount = 10000) {
    this.balances.USDT = (this.balances.USDT || 0) + amount;
    this.balances.USD = (this.balances.USD || 0) + amount;
    return this.balances;
  }

  resetAll() {
    this.balances = {
      USDT: 10000.00,
      USD: 10000.00,
      BTC: 0.15,
      ETH: 2.0,
      SOL: 15.0
    };
    this.positions = [];
    this.closedTrades = [];
    return this.getPortfolio();
  }
}

export const portfolioService = new PortfolioService();
