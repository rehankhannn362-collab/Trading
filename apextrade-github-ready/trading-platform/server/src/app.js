import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';

export function createApp() {
  const app = express();
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

  // This server currently exposes one shared in-memory DEMO account.
  // Do not expose it publicly before adding authentication and per-user isolation.
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
  });

  return app;
}

export const app = createApp();
