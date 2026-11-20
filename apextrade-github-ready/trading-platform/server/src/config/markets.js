/**
 * Market configurations and supported asset pairs
 */
export const MARKETS = [
  {
    symbol: 'BTC/USDT',
    name: 'Bitcoin',
    category: 'crypto',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    basePrice: 65840.50,
    pricePrecision: 2,
    quantityPrecision: 4,
    minQuantity: 0.001,
    maxLeverage: 50,
    makerFee: 0.0002, // 0.02%
    takerFee: 0.0005, // 0.05%
    volatility: 0.0006,
    trend: 0.00002,
    description: 'Bitcoin perpetual spot / margin'
  },
  {
    symbol: 'ETH/USDT',
    name: 'Ethereum',
    category: 'crypto',
    baseAsset: 'ETH',
    quoteAsset: 'USDT',
    basePrice: 3480.20,
    pricePrecision: 2,
    quantityPrecision: 3,
    minQuantity: 0.01,
    maxLeverage: 50,
    makerFee: 0.0002,
    takerFee: 0.0005,
    volatility: 0.0008,
    trend: 0.00003,
    description: 'Ethereum perpetual spot / margin'
  },
  {
    symbol: 'SOL/USDT',
    name: 'Solana',
    category: 'crypto',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    basePrice: 168.75,
    pricePrecision: 2,
    quantityPrecision: 2,
    minQuantity: 0.1,
    maxLeverage: 25,
    makerFee: 0.0002,
    takerFee: 0.0005,
    volatility: 0.0012,
    trend: 0.00004,
    description: 'Solana perpetual spot / margin'
  },
  {
    symbol: 'NVDA/USD',
    name: 'NVIDIA Corp',
    category: 'stocks',
    baseAsset: 'NVDA',
    quoteAsset: 'USD',
    basePrice: 138.40,
    pricePrecision: 2,
    quantityPrecision: 2,
    minQuantity: 1,
    maxLeverage: 10,
    makerFee: 0.0001,
    takerFee: 0.0003,
    volatility: 0.0007,
    trend: 0.00003,
    description: 'NVIDIA Corporation common stock'
  },
  {
    symbol: 'AAPL/USD',
    name: 'Apple Inc',
    category: 'stocks',
    baseAsset: 'AAPL',
    quoteAsset: 'USD',
    basePrice: 232.15,
    pricePrecision: 2,
    quantityPrecision: 2,
    minQuantity: 1,
    maxLeverage: 10,
    makerFee: 0.0001,
    takerFee: 0.0003,
    volatility: 0.0004,
    trend: 0.00001,
    description: 'Apple Inc common stock'
  },
  {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    category: 'forex',
    baseAsset: 'EUR',
    quoteAsset: 'USD',
    basePrice: 1.0845,
    pricePrecision: 5,
    quantityPrecision: 1,
    minQuantity: 100,
    maxLeverage: 100,
    makerFee: 0.00005,
    takerFee: 0.0001,
    volatility: 0.0002,
    trend: 0.000005,
    description: 'EUR / USD Spot FX'
  }
];

export const TIMEFRAMES = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000
};

export function getMarket(symbol) {
  return MARKETS.find(m => m.symbol.toUpperCase() === symbol.toUpperCase());
}
