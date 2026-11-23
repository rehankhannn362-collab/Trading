import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { simulator } from './engine/marketSimulator.js';
import { wsService } from './services/websocketService.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map(origin => origin.trim()).filter(Boolean);

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api', apiRouter);

// Authentication is now available, but trading REST and WebSocket traffic are
// still connected to the demo account until the next account-scoping steps.
// Do not expose this demo trading API as a production financial service.

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

wsService.initialize(server);
simulator.start();

server.listen(PORT, () => {
  console.log('===============================================');
  console.log(`🚀 Apex Trading Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`🌐 REST API base: http://localhost:${PORT}/api`);
  console.log('===============================================');
});

const gracefulShutdown = () => {
  console.log('\nShutting down gracefully...');
  simulator.stop();
  server.close(() => {
    console.log('HTTP and WebSocket servers closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
