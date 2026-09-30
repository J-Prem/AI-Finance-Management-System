import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import 'dotenv/config';
import http from 'http';
import app, { initializeSocket } from './app.js';
import connectDB from './config/db.js';
import { initRedis, getRedis } from './config/redis.js';
import { startLiveMetrics } from './services/liveMetrics.js';
import { bootstrapAdmin } from './scripts/bootstrap.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(app);
const io = initializeSocket(server);
app.set('io', io);

function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k] || String(process.env[k]).includes('<'));
  if (missing.length) {
    logger.error(`[startup] Missing required env vars: ${missing.join(', ')}`);
    logger.error('See SETUP_REAL.md for how to configure .env');
    process.exit(1);
  }
}

async function start() {
  try {
    // Hard requirements — real production mode, no fallback
    requireEnv(['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET']);

    logger.info('[startup] Connecting to MongoDB...');
    await connectDB();
    logger.info('[startup] MongoDB connected.');

    // Bootstrap the admin user (idempotent — reads ADMIN_EMAIL / ADMIN_PASSWORD)
    await bootstrapAdmin();

    // Redis is optional — log and continue if unavailable
    try {
      logger.info('[startup] Initializing Redis...');
      await initRedis();
    } catch (e) {
      logger.warn(`[startup] Redis unavailable (${e.message}) — continuing without cache/rate-limit.`);
    }

    startLiveMetrics(io);

    server.listen(PORT, HOST, () => {
      logger.info(`[startup] Server running on ${HOST}:${PORT}`);
      logger.info(`[startup] Env: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`[startup] LLM providers configured: ${[
        process.env.OPENAI_API_KEY && 'openai',
        process.env.ANTHROPIC_API_KEY && 'anthropic',
        process.env.GEMINI_API_KEY && 'gemini',
        process.env.HF_API_KEY && 'huggingface',
      ].filter(Boolean).join(', ') || 'none (local fallback only)'}`);
      logger.info(`[startup] API docs: http://${HOST}:${PORT}/api/docs`);
    });

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error(`[startup] Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

async function shutdown() {
  logger.info('[shutdown] Shutting down gracefully...');
  server.close(async () => {
    try {
      const redis = getRedis();
      if (redis?.quit) await redis.quit();
      logger.info('[shutdown] Server closed');
      process.exit(0);
    } catch (error) {
      logger.error(`[shutdown] Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  });
  setTimeout(() => {
    logger.error('[shutdown] Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
}

start();

export { server, io };
