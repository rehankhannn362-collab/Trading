# ApexTrade — Seller Checklist

## Included
- React/Vite trading terminal UI
- Express REST API and WebSocket streams
- Simulated crypto, stock and forex market prices
- Demo order matching, limit orders, positions and portfolio calculations
- Demo faucet and account reset
- Backend test suite

## Before publishing on Gumroad
- [ ] Run npm run install:all from this directory.
- [ ] Run npm test and npm run build.
- [ ] Start the app with npm run dev and manually test main user flows.
- [ ] Confirm no local .env files, credentials, API keys or personal data are in the ZIP.
- [ ] Include README and this checklist in the download.
- [ ] Verify all included images, fonts, icons and other assets may be redistributed.
- [ ] Describe it as a simulated trading platform starter, not a real-money exchange or brokerage.

## Known scope limitations
This version uses one shared in-memory demo account. It has no user authentication, multi-user isolation, database persistence, real exchange connectivity, licensed real-time market data, payment processing or regulatory controls. Do not deploy it as a public financial service or use it to handle customer funds.
