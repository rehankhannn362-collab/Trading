import 'dotenv/config';
import http from 'http';
import { app } from './app.js';
import { simulator } from './engine/marketSimulator.js';
import { wsService } from './services/websocketService.js';

const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize WebSocket Service
wsService.initialize(server);

// Start Market Simulator
simulator.start();

// Start HTTP server
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Apex Trading Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`🌐 REST API base: http://localhost:${PORT}/api`);
  console.log(`===============================================`);
});

const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  simulator.stop();
  wsService.close();
  server.close(() => {
    console.log('HTTP and WebSocket servers closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
