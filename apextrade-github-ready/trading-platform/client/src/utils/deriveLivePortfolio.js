export function deriveLivePortfolio(portfolio, tickers = {}, markets = []) {
  const balances = portfolio?.balances || {};
  const positions = (portfolio?.positions || []).map(position => {
    const market = markets.find(item => item.symbol === position.symbol);
    const quoteAsset = market?.quoteAsset || position.symbol.split('/')[1] || 'USDT';
    const ticker = tickers[position.symbol];
    const markPrice = Number(ticker?.price) > 0
      ? Number(ticker.price)
      : Number(position.markPrice) > 0 ? Number(position.markPrice) : Number(position.entryPrice);
    const grossPnl = position.side === 'LONG'
      ? (markPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - markPrice) * position.quantity;
    const pnlPercent = position.margin > 0 ? (grossPnl / position.margin) * 100 : 0;

    return {
      ...position,
      quoteAsset,
      markPrice,
      unrealizedPnl: Number(grossPnl.toFixed(2)),
      pnlPercent: Number(pnlPercent.toFixed(2))
    };
  });

  const unrealizedPnlByCurrency = {};
  const marginUsedByCurrency = {};
  let totalUnrealizedPnl = 0;
  let totalMarginUsed = 0;

  for (const position of positions) {
    const currency = position.quoteAsset;
    unrealizedPnlByCurrency[currency] = (unrealizedPnlByCurrency[currency] || 0) + position.unrealizedPnl;
    marginUsedByCurrency[currency] = (marginUsedByCurrency[currency] || 0) + Number(position.margin || 0);
    totalUnrealizedPnl += position.unrealizedPnl;
    totalMarginUsed += Number(position.margin || 0);
  }

  const assetValueByCurrency = {};
  for (const [asset, rawQuantity] of Object.entries(balances)) {
    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || asset === 'USD' || asset === 'USDT') continue;

    const market = markets.find(item => item.baseAsset === asset && item.quoteAsset === 'USDT')
      || markets.find(item => item.baseAsset === asset && item.quoteAsset === 'USD');
    if (!market) continue;

    const ticker = tickers[market.symbol];
    const markPrice = Number(ticker?.price) > 0 ? Number(ticker.price) : Number(market.basePrice || 0);
    assetValueByCurrency[market.quoteAsset] =
      (assetValueByCurrency[market.quoteAsset] || 0) + quantity * markPrice;
  }

  const currencies = new Set([
    'USD',
    'USDT',
    ...Object.keys(unrealizedPnlByCurrency),
    ...Object.keys(marginUsedByCurrency),
    ...Object.keys(assetValueByCurrency),
    ...Object.keys(portfolio?.equityByCurrency || {})
  ]);
  const equityByCurrency = {};
  const availableMarginByCurrency = {};
  let cashBalance = 0;
  let equity = 0;
  let availableMargin = 0;
  let totalAssetValue = 0;

  for (const currency of currencies) {
    const cash = Number(balances[currency] || 0);
    const pnl = Number(unrealizedPnlByCurrency[currency] || 0);
    const assetValue = Number(assetValueByCurrency[currency] || 0);
    const margin = Number(marginUsedByCurrency[currency] || 0);
    const currencyEquity = cash + pnl + assetValue;
    const currencyAvailable = cash - margin;

    equityByCurrency[currency] = Number(currencyEquity.toFixed(2));
    availableMarginByCurrency[currency] = Number(currencyAvailable.toFixed(2));
    cashBalance += cash;
    equity += currencyEquity;
    availableMargin += currencyAvailable;
    totalAssetValue += assetValue;
  }

  return {
    ...portfolio,
    positions,
    equity: Number(equity.toFixed(2)),
    equityByCurrency,
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
    totalAssetValue: Number(totalAssetValue.toFixed(2)),
    assetValueByCurrency: Object.fromEntries(
      Object.entries(assetValueByCurrency).map(([currency, amount]) => [currency, Number(amount.toFixed(2))])
    ),
    marginLevel: totalMarginUsed > 0 ? Number(((equity / totalMarginUsed) * 100).toFixed(2)) : 999.9
  };
}
