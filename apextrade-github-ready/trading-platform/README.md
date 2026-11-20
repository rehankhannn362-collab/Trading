# ApexTrade — Simulated Trading Platform Starter Template

A full-stack **simulated trading platform starter** built with **Node.js, Express, WebSockets, React, Tailwind CSS, and TradingView Lightweight Charts**. It includes a live market simulator, demo wallet, order entry, simulated matching, portfolio tracking, and a trading terminal.

> **Important:** ApexTrade is a software template and educational/demo environment. It does not connect to a regulated broker, route orders to an exchange, or execute real-money trades. Market prices and liquidity are simulated. It is not investment advice or a production brokerage system.

---

## 🌟 Key Features

- **TradingView Candlestick Charting**: Integrated with TradingView's official `lightweight-charts`, featuring real-time candle updates, dynamic volume bars, 20-period Simple Moving Average (SMA), crosshairs, and multi-timeframe toggles (`1m`, `5m`, `15m`, `1h`, `1D`).
- **Level-2 Order Book Engine**: High-frequency order book tracking 20+ depth levels with animated volume distribution bars, dynamic market spread calculation, and clickable price pre-filling.
- **Stochastic Market Simulator**: Real-time Geometric Brownian motion price simulation producing authentic micro-volatility, realistic trade volume, and historical candle seeding.
- **Order Matching & Execution**:
  - **Market Orders**: Instant fill against top-of-book with slippage simulation and position generation.
  - **Limit Orders**: Rest on the order book and auto-execute when market prices cross the limit threshold.
  - **Leverage & Margin**: Configurable leverage (1x spot to 50x perpetual margin) with automatic liquidation price calculation.
- **Multi-Channel WebSockets**: Low-latency binary/JSON streaming for tickers, depth diffs, live trade tape, bar closes, and user execution fills.
- **Portfolio & Risk Management**: Live calculation of Unrealized PnL, Equity, Used Margin, Free Margin, and Margin Level.
- **Testnet Faucet**: 1-click testnet funding to claim $10,000 USDT demo tokens or reset account state.

---

## 📁 Repository Structure

```
trading-platform/
├── package.json                   # Root monorepo orchestration (runs client & server together)
├── README.md                      # Complete system documentation & API reference
├── .gitignore
│
├── server/                        # Backend Service (Node.js + Express + WS)
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── config/
│   │   │   └── markets.js         # Supported asset pairs (Crypto, Stocks, Forex), fees, lot sizes
│   │   ├── engine/
│   │   │   ├── marketSimulator.js # Brownian motion tick generator & historical candle builder
│   │   │   ├── orderBook.js       # Level 2 orderbook ladder & user order aggregation
│   │   │   └── matchingEngine.js  # Limit/Market matching, trigger checks, executions
│   │   ├── services/
│   │   │   ├── portfolioService.js# Wallet balances, margin requirements, liquidation pricing
│   │   │   └── websocketService.js# Multi-channel WS broadcasting & subscriptions
│   │   ├── controllers/
│   │   │   ├── marketController.js
│   │   │   ├── orderController.js
│   │   │   └── portfolioController.js
│   │   ├── routes/
│   │   │   └── api.js             # Express REST router
│   │   └── server.js              # Server entrypoint (Port 5000)
│   └── tests/
│       └── engine.test.js         # Built-in unit test suite for matching engine
│
└── client/                        # Frontend Terminal (React 19 + Vite + Tailwind)
    ├── package.json
    ├── vite.config.js             # Vite dev server with reverse proxy for API & WS
    ├── tailwind.config.js         # Custom institutional dark terminal theme
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── context/
        │   ├── TradingContext.jsx   # Global ticker stream, active pair, orderbook state
        │   └── PortfolioContext.jsx # Balances, open positions, active orders, notifications
        ├── services/
        │   └── api.js               # Centralized REST client
        ├── components/
        │   ├── layout/
        │   │   ├── Header.jsx       # Terminal header, faucet button, connection indicator
        │   │   └── MarketTicker.jsx # 24h market stats (High, Low, Vol, Change %, Funding)
        │   ├── chart/
        │   │   ├── TradingChart.jsx # TradingView Lightweight Charts Candlestick canvas
        │   │   └── TimeframeBar.jsx # Timeframes (1m-1D) & indicators (SMA, Volume)
        │   ├── orderbook/
        │   │   ├── OrderBook.jsx    # Animated L2 depth ladder with mid spread
        │   │   └── RecentTrades.jsx # Live tape stream of recent executions
        │   ├── trading/
        │   │   └── OrderForm.jsx    # Limit/Market, Buy/Sell, Leverage slider, margin preview
        │   ├── portfolio/
        │   │   └── BottomPanel.jsx  # Positions table, Open Orders, Order History, Wallets
        │   ├── watchlist/
        │   │   └── WatchlistModal.jsx # Searchable market selector (Crypto, Stocks, Forex)
        │   └── common/
        │       └── ToastContainer.jsx # Floating execution alerts & notifications
        ├── App.jsx
        ├── index.css
        └── main.jsx
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20.19+ or v22.12+ (recommended for current Vite tooling)
- **npm**: v9.0.0 or higher

### 1. Installation

Install all root, backend, and frontend dependencies in one command:

```bash
# From trading-platform root directory
npm run install:all
```

Or install separately:

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Running the Platform

Run both the backend server and frontend client concurrently:

```bash
npm run dev
```

- **Frontend Terminal**: [http://localhost:5173](http://localhost:5173)
- **Backend REST API**: [http://localhost:5000/api](http://localhost:5000/api)
- **WebSocket Feed**: `ws://localhost:5000/ws`

### 3. Running Unit Tests

Run the backend matching engine test suite:

```bash
npm test
```

---

## 📡 REST API Reference

### Markets
- `GET /api/markets` — List all supported trading pairs with 24h ticker summary.
- `GET /api/markets/:symbol/ticker` — Fetch single ticker (24h high/low/volume/change).
- `GET /api/markets/:symbol/candles?timeframe=1m&limit=200` — Fetch historical OHLCV candle bars.
- `GET /api/markets/:symbol/orderbook?depth=20` — Fetch current Level-2 order book snapshot.
- `GET /api/markets/:symbol/trades?limit=30` — Fetch recent executed trade history.

### Orders
- `POST /api/orders` — Place a new Market or Limit order.
  ```json
  {
    "symbol": "BTC/USDT",
    "side": "BUY",
    "type": "LIMIT",
    "price": 64500.00,
    "quantity": 0.25,
    "leverage": 10
  }
  ```
- `DELETE /api/orders/:id` — Cancel a pending limit order.
- `GET /api/orders?symbol=BTC/USDT` — List active open orders.
- `GET /api/orders/history?limit=50` — List past filled / cancelled orders.

### Portfolio & Wallet
- `GET /api/portfolio` — Fetch user account equity, cash balances, and open positions.
- `POST /api/positions/:id/close` — Market close an active position and realize PnL.
- `POST /api/wallet/faucet` — Claim demo testnet funds (`{"amount": 10000}`).
- `POST /api/wallet/reset` — Reset portfolio to initial $10,000 USDT default.
- `GET /api/portfolio/trades` — Audit trail of closed trades and realized profits/losses.

---

## 🔌 WebSocket Specification

The WebSocket endpoint is available at `/ws`.

### Subscribe to Channels
Send JSON to subscribe to real-time streams:
```json
{
  "action": "subscribe",
  "channel": "depth:BTC/USDT"
}
```

Available channels:
- `tickers`: All market price ticks and 24h statistics.
- `depth:<symbol>`: Level 2 orderbook depth snapshots.
- `trades:<symbol>`: Real-time public trade prints.
- `candles:<symbol>:<timeframe>`: Streaming OHLCV candle bar updates.
- `portfolio`: Private order fills and balance updates.

---

## 🔐 Security, Scope & Production Checklist

This version runs as a **single shared demo account** with in-memory state. It is suitable for local demos, learning, evaluation, and as a starter codebase—not for public multi-user hosting or real customer funds.

Before turning it into a public service, implement and independently test:
1. User registration, secure password hashing, verified sessions/JWT rotation, logout and account recovery.
2. Per-user isolation for balances, orders, positions, trade history and WebSocket subscriptions.
3. Persistent storage with migrations, backups, transaction boundaries and audit logs.
4. Server-side authorization on every REST and WebSocket action; never trust client-supplied user IDs.
5. Rate limits, abuse controls, secure headers, secrets management, HTTPS/WSS and appropriate CSRF protections.
6. Broker/exchange integration, reconciliation, idempotent order submission, licensed market data, monitoring and incident response—only where legally permitted.
7. Jurisdiction-specific legal, financial-services, privacy and consumer-protection review before offering real trading.

The demo faucet is capped at $10,000 per request, but this is not a substitute for authentication or abuse protection. Do not deploy the current shared demo API as a public financial service.

## ⚙️ Extending the Platform

1. **Adding New Pairs**: Add entries to `server/src/config/markets.js` specifying `symbol`, `baseAsset`, `quoteAsset`, `pricePrecision`, `quantityPrecision`, and `volatility`.
2. **Connecting Real Data**: Replace `marketSimulator.js` with an external WebSocket feed (e.g., Binance, Coinbase, Polygon.io, or CCXT).
3. **Database Persistence**: Replace `in-memory` arrays in `server/src/services/portfolioService.js` with SQLite, PostgreSQL, MongoDB, or Prisma.

---

## 📦 Gumroad Product Notes

This is a starter template. Buyers should receive the source code, setup instructions, and a clear list of included demo features and limitations. Do not market it as a live broker, exchange, production-ready fintech system, or source of real market prices. Confirm that every included asset may be redistributed under its applicable license before selling.

## 📄 License
MIT License. Free to use, adapt, and build upon.
