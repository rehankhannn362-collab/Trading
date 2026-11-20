import { Router } from 'express';
import { marketController } from '../controllers/marketController.js';
import { orderController } from '../controllers/orderController.js';
import { portfolioController } from '../controllers/portfolioController.js';

const router = Router();

// Market Routes
router.get('/markets', marketController.getMarkets);
router.get('/markets/:symbol/ticker', marketController.getTicker);
router.get('/markets/:symbol/candles', marketController.getCandles);
router.get('/markets/:symbol/orderbook', marketController.getOrderBook);
router.get('/markets/:symbol/trades', marketController.getRecentTrades);

// Order Routes
router.post('/orders', orderController.placeOrder);
router.delete('/orders/:id', orderController.cancelOrder);
router.get('/orders', orderController.getOpenOrders);
router.get('/orders/history', orderController.getOrderHistory);

// Portfolio & Wallet Routes
router.get('/portfolio', portfolioController.getPortfolio);
router.post('/positions/:id/close', portfolioController.closePosition);
router.post('/positions/:id/tpsl', portfolioController.updatePositionTpSl);
router.post('/wallet/faucet', portfolioController.claimFaucet);
router.post('/wallet/reset', portfolioController.resetAll);
router.get('/portfolio/trades', portfolioController.getTradeHistory);

export default router;
