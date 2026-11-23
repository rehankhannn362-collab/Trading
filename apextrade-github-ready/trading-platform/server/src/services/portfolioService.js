import { getMarket } from '../config/markets.js';

/**
 * Portfolio and Risk Management Service.
 * Balances are held in their quote currencies. USD and USDT are displayed as
 * separate balances; the combined equity figure treats USDT as a 1:1 USD
 * simulation peg and is not a live FX conversion.
 */
export class PortfolioService {
  constructor() {
    this.resetBalances();
    this.positions = [];
    this.closedTrades = [];
  }

  resetBalances() {
    this.balances = {
      USDT: 10000.00,
      USD: 10000.00,
      BTC: 0.15,
      ETH: 2.0,
      SOL: 15.0
    };
  }

  getBalances() {
    return { ...this.balances };
  }

  getMarginUsed(quoteAsset, excludedPositionId = null) {
    return this.positions.reduce((total, pos) => {
      if (pos.id === excludedPositionId) return total;
      return getMarket(pos.symbol)?.quoteAsset === quoteAsset ? total + pos.margin : total;
    }, 0);
  }

  getPortfolio(currentPrices = {}) {
    let totalUnrealizedPnl = 0;
    let totalMarginUsed = 0;
    const unrealizedPnlByCurrency = {};
    const marginUsedByCurrency = {};

    const enrichedPositions = this.positions.map(pos => {
      const market = getMarket(pos.symbol);
      const quoteAsset = market?.quoteAsset || 'USDT';
      const markPrice = Number(currentPrices[pos.symbol]) > 0 ? Number(currentPrices[pos.symbol]) : pos.entryPrice;
      const pnl = pos.side === 'LONG'
        ? (markPrice - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - markPrice) * pos.quantity;

      const pnlPercent = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;
      totalUnrealizedPnl += pnl;
      totalMarginUsed += pos.margin;
      unrealizedPnlByCurrency[quoteAsset] = (unrealizedPnlByCurrency[quoteAsset] || 0) + pnl;
      marginUsedByCurrency[quoteAsset] = (marginUsedByCurrency[quoteAsset] || 0) + pos.margin;

      return {
        ...pos,
        markPrice,
        unrealizedPnl: Number(pnl.toFixed(2)),
        pnlPercent: Number(pnlPercent.toFixed(2))
      };
    });

    const quoteCurrencies = new Set([
      ...Object.keys(unrealizedPnlByCurrency),
      ...Object.keys(marginUsedByCurrency),
      'USD',
      'USDT'
    ]);
    const assetValueByCurrency = {};
    for (const [asset, quantity] of Object.entries(this.balances)) {
      if (['USD', 'USDT'].includes(asset) || Number(quantity) <= 0) continue;
      const assetMarket = getMarket(`${asset}/USDT`) || getMarket(`${asset}/USD`);
      if (!assetMarket) continue;
      const markPrice = Number(currentPrices[assetMarket.symbol]) > 0
        ? Number(currentPrices[assetMarket.symbol]) : assetMarket.basePrice;
      assetValueByCurrency[assetMarket.quoteAsset] =
        (assetValueByCurrency[assetMarket.quoteAsset] || 0) + Number(quantity) * markPrice;
    }
    for (const currency of Object.keys(assetValueByCurrency)) quoteCurrencies.add(currency);

    const equityByCurrency = {};
    const availableMarginByCurrency = {};
    let cashBalance = 0;
    let equity = 0;
    let availableMargin = 0;
    let totalAssetValue = 0;

    for (const currency of quoteCurrencies) {
      const cash = Number(this.balances[currency] || 0);
      const pnl = Number(unrealizedPnlByCurrency[currency] || 0);
      const assetValue = Number(assetValueByCurrency[currency] || 0);
      const margin = Number(marginUsedByCurrency[currency] || 0);
      const currencyEquity = Number((cash + pnl + assetValue).toFixed(2));
      totalAssetValue += assetValue;
      const currencyAvailable = Number((cash - margin).toFixed(2));

      equityByCurrency[currency] = currencyEquity;
      availableMarginByCurrency[currency] = currencyAvailable;
      cashBalance += cash;
      equity += currencyEquity;
      availableMargin += currencyAvailable;
    }

    const marginLevel = totalMarginUsed > 0 ? Number(((equity / totalMarginUsed) * 100).toFixed(2)) : 999.9;

    return {
      balances: this.getBalances(),
      equity: Number(equity.toFixed(2)),
      equityByCurrency,
      totalAssetValue: Number(totalAssetValue.toFixed(2)),
      assetValueByCurrency: Object.fromEntries(
        Object.entries(assetValueByCurrency).map(([currency, amount]) => [currency, Number(amount.toFixed(2))])
      ),
      cashBalance: Number(cashBalance.toFixed(2)),
      availableMargin: Number(availableMargin.toFixed(2)),
      availableMarginByCurrency,
      totalMarginUsed: Number(totalMarginUsed.toFixed(2)),
      marginUsedByCurrency: Object.fromEntries(
        Object.entries(marginUsedByCurrency).map(([currency, amount]) => [currency, Number(amount.toFixed(2))])
      ),
      totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(2)),
      unrealizedPnlByCurrency: Object.fromEntries(
        Object.entries(unrealizedPnlByCurrency).map(([currency, amount]) => [currency, Number(amount.toFixed(2))])
      ),
      marginLevel,
      positions: enrichedPositions
    };
  }

  calculateLiquidationPrice(side, entryPrice, leverage, maintenanceMarginRate = 0.01) {
    if (leverage <= 1) return 0;
    if (side === 'LONG') {
      return entryPrice * (1 - (1 / leverage) + maintenanceMarginRate);
    }
    return entryPrice * (1 + (1 / leverage) - maintenanceMarginRate);
  }

  openPosition({
    symbol,
    side,
    entryPrice,
    quantity,
    leverage = 1,
    takeProfit = null,
    stopLoss = null,
    entryFee = 0
  }) {
    const market = getMarket(symbol);
    if (!market) throw new Error(`Market ${symbol} not found`);
    if (!['LONG', 'SHORT'].includes(side)) throw new Error('Position side must be LONG or SHORT');

    const price = Number(entryPrice);
    const rawQuantity = Number(quantity);
    const lev = Number(leverage);
    const fee = Number(entryFee);

    if (!Number.isFinite(price) || price <= 0) throw new Error('Entry price must be a finite number greater than zero');
    if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) throw new Error('Quantity must be a finite number greater than zero');
    if (!Number.isInteger(lev) || lev < 1 || lev > market.maxLeverage) {
      throw new Error(`Leverage must be a whole number between 1x and ${market.maxLeverage}x`);
    }
    if (!Number.isFinite(fee) || fee < 0) throw new Error('Entry fee must be a finite non-negative number');

    const qty = Number(rawQuantity.toFixed(market.quantityPrecision));
    if (qty < market.minQuantity) throw new Error(`Minimum order quantity for ${symbol} is ${market.minQuantity}`);

    const quote = market.quoteAsset;
    const notionalValue = price * qty;
    const marginRequired = notionalValue / lev;
    const tpVal = takeProfit !== null && takeProfit !== undefined && takeProfit !== ''
      ? Number(Number(takeProfit).toFixed(market.pricePrecision)) : null;
    const slVal = stopLoss !== null && stopLoss !== undefined && stopLoss !== ''
      ? Number(Number(stopLoss).toFixed(market.pricePrecision)) : null;

    const existingIndex = this.positions.findIndex(p => p.symbol === symbol);
    const existing = existingIndex >= 0 ? this.positions[existingIndex] : null;
    const quoteBalance = Number(this.balances[quote] || 0);

    if (existing && existing.side === side) {
      const availableBefore = quoteBalance - this.getMarginUsed(quote);
      if (availableBefore < marginRequired + fee) {
        throw new Error(`Insufficient ${quote} available margin. Required: ${(marginRequired + fee).toFixed(2)}, Available: ${availableBefore.toFixed(2)}`);
      }

      const totalQty = existing.quantity + qty;
      const totalCost = (existing.entryPrice * existing.quantity) + (price * qty);
      existing.entryPrice = Number((totalCost / totalQty).toFixed(market.pricePrecision));
      existing.quantity = Number(totalQty.toFixed(market.quantityPrecision));
      existing.margin = Number((existing.margin + marginRequired).toFixed(2));
      existing.leverage = Number(((existing.entryPrice * existing.quantity) / existing.margin).toFixed(4));
      existing.entryFees = Number(((existing.entryFees || 0) + fee).toFixed(8));
      this.balances[quote] = Number((quoteBalance - fee).toFixed(8));
      existing.liquidationPrice = Number(
        this.calculateLiquidationPrice(side, existing.entryPrice, existing.leverage).toFixed(market.pricePrecision)
      );
      if (tpVal !== null) existing.takeProfit = tpVal;
      if (slVal !== null) existing.stopLoss = slVal;
      return existing;
    }

    if (existing && existing.side !== side) {
      const closeQty = Math.min(existing.quantity, qty);
      const remainingOrderQty = Number((qty - closeQty).toFixed(market.quantityPrecision));
      const existingEntryFee = Number(existing.entryFees || 0);
      const allocatedEntryFee = existing.quantity > 0
        ? existingEntryFee * (closeQty / existing.quantity) : 0;
      const closingFee = fee * (closeQty / qty);
      const grossPnl = (existing.side === 'LONG'
        ? price - existing.entryPrice
        : existing.entryPrice - price) * closeQty;
      const balanceAfterClose = quoteBalance + grossPnl - closingFee;

      if (remainingOrderQty > 0) {
        const remainingFee = fee - closingFee;
        const remainingMargin = (price * remainingOrderQty) / lev;
        const otherMarginUsed = this.getMarginUsed(quote, existing.id);
        if (balanceAfterClose - otherMarginUsed < remainingMargin + remainingFee) {
          throw new Error(`Insufficient ${quote} available margin to reverse the remaining position`);
        }
      }

      this.balances[quote] = Number(balanceAfterClose.toFixed(8));
      const netRealizedPnl = grossPnl - allocatedEntryFee - closingFee;
      this.recordClosedTrade({
        symbol,
        side: existing.side,
        entryPrice: existing.entryPrice,
        closePrice: Number(price.toFixed(market.pricePrecision)),
        quantity: closeQty,
        grossPnl: Number(grossPnl.toFixed(2)),
        entryFee: Number(allocatedEntryFee.toFixed(8)),
        exitFee: Number(closingFee.toFixed(8)),
        fees: Number((allocatedEntryFee + closingFee).toFixed(8)),
        realizedPnl: Number(netRealizedPnl.toFixed(2)),
        reason: remainingOrderQty > 0 ? 'FLIP_CLOSE' : closeQty < existing.quantity ? 'PARTIAL_CLOSE' : 'OPPOSITE_ORDER_CLOSE'
      });

      if (closeQty >= existing.quantity) {
        this.positions.splice(existingIndex, 1);
      } else {
        const remainingPositionQty = Number((existing.quantity - closeQty).toFixed(market.quantityPrecision));
        existing.quantity = remainingPositionQty;
        existing.margin = Number((existing.margin * (remainingPositionQty / (remainingPositionQty + closeQty))).toFixed(2));
        existing.entryFees = Number((existingEntryFee - allocatedEntryFee).toFixed(8));
      }

      if (remainingOrderQty > 0) {
        return this.openPosition({
          symbol,
          side,
          entryPrice: price,
          quantity: remainingOrderQty,
          leverage: lev,
          takeProfit: tpVal,
          stopLoss: slVal,
          entryFee: fee - closingFee
        });
      }
      return closeQty < qty ? existing : null;
    }

    const availableBefore = quoteBalance - this.getMarginUsed(quote);
    if (availableBefore < marginRequired + fee) {
      throw new Error(`Insufficient ${quote} available margin. Required: ${(marginRequired + fee).toFixed(2)}, Available: ${availableBefore.toFixed(2)}`);
    }

    const position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol,
      side,
      entryPrice: Number(price.toFixed(market.pricePrecision)),
      quantity: qty,
      leverage: lev,
      margin: Number(marginRequired.toFixed(2)),
      entryFees: Number(fee.toFixed(8)),
      liquidationPrice: Number(this.calculateLiquidationPrice(side, price, lev).toFixed(market.pricePrecision)),
      takeProfit: tpVal,
      stopLoss: slVal,
      openedAt: Date.now()
    };

    this.balances[quote] = Number((quoteBalance - fee).toFixed(8));
    this.positions.push(position);
    return position;
  }

  updatePositionTpSl(positionId, { takeProfit, stopLoss }) {
    const pos = this.positions.find(p => p.id === positionId);
    if (!pos) throw new Error(`Position ${positionId} not found`);

    const market = getMarket(pos.symbol);
    const precision = market?.pricePrecision || 2;

    pos.takeProfit = takeProfit !== undefined && takeProfit !== null && takeProfit !== '' && Number.isFinite(Number(takeProfit)) && Number(takeProfit) > 0
      ? Number(Number(takeProfit).toFixed(precision)) : null;
    pos.stopLoss = stopLoss !== undefined && stopLoss !== null && stopLoss !== '' && Number.isFinite(Number(stopLoss)) && Number(stopLoss) > 0
      ? Number(Number(stopLoss).toFixed(precision)) : null;
    return pos;
  }

  checkTpSl(symbol, currentPrice) {
    const triggered = [];
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
        triggered.push({ reason: triggerReason, position: pos, fillPrice, pnl: closed.realizedPnl });
      }
    }
    return triggered;
  }

  closePosition(positionId, currentPrice, reason = 'MANUAL') {
    const index = this.positions.findIndex(p => p.id === positionId);
    if (index === -1) throw new Error(`Position ${positionId} not found`);

    const pos = this.positions[index];
    const market = getMarket(pos.symbol) || { quoteAsset: 'USDT', pricePrecision: 2, takerFee: 0.0005 };
    const closePrice = currentPrice === null || currentPrice === undefined
      ? pos.entryPrice : Number(currentPrice);
    if (!Number.isFinite(closePrice) || closePrice <= 0) throw new Error('Close price must be a finite number greater than zero');

    const grossPnl = pos.side === 'LONG'
      ? (closePrice - pos.entryPrice) * pos.quantity
      : (pos.entryPrice - closePrice) * pos.quantity;
    const entryFee = Number(pos.entryFees || 0);
    const exitFee = closePrice * pos.quantity * (market.takerFee || 0);
    const quote = market.quoteAsset;
    this.balances[quote] = Number(((this.balances[quote] || 0) + grossPnl - exitFee).toFixed(8));
    this.positions.splice(index, 1);

    return this.recordClosedTrade({
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      closePrice: Number(closePrice.toFixed(market.pricePrecision)),
      quantity: pos.quantity,
      grossPnl: Number(grossPnl.toFixed(2)),
      entryFee: Number(entryFee.toFixed(8)),
      exitFee: Number(exitFee.toFixed(8)),
      fees: Number((entryFee + exitFee).toFixed(8)),
      realizedPnl: Number((grossPnl - entryFee - exitFee).toFixed(2)),
      reason
    });
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
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(0, Math.min(500, Math.floor(Number(limit)))) : 50;
    return this.closedTrades.slice(0, safeLimit);
  }

  claimFaucet(amount = 10000) {
    const credit = Number(amount);
    if (!Number.isFinite(credit) || credit <= 0 || credit > 10000) {
      throw new Error('Demo faucet amount must be between 0 and 10,000');
    }
    this.balances.USDT = Number(((this.balances.USDT || 0) + credit).toFixed(2));
    this.balances.USD = Number(((this.balances.USD || 0) + credit).toFixed(2));
    return this.getBalances();
  }

  resetAll() {
    this.resetBalances();
    this.positions = [];
    this.closedTrades = [];
    return this.getPortfolio();
  }
}

export const portfolioService = new PortfolioService();
