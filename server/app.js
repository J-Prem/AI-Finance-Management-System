import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Server as SocketIOServer } from 'socket.io';
import logger from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalRateLimiter, createTierBasedRateLimiter } from './middleware/rateLimiter.js';
import { randomUUID } from 'crypto';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import budgetRoutes from './routes/budgets.js';
import analyticsRoutes from './routes/analytics.js';
import subscriptionRoutes from './routes/subscriptions.js';
import teamRoutes from './routes/teams.js';
import adminRoutes from './routes/admin.js';
import apiKeyRoutes from './routes/apiKeys.js';
import notificationRoutes from './routes/notifications.js';
import mlRoutes from './routes/ml.js';
import webhookRoutes from './routes/webhooks.js';
import externalRoutes from './routes/external.js';
import reportRoutes from './routes/reports.js';
import investmentRoutes from './routes/investments.js';
import billRoutes from './routes/bills.js';
import auditRoutes from './routes/audit.js';
import receiptRoutes from './routes/receipts.js';
import personalityRoutes from './routes/personality.js';
import llmRoutes from './routes/llm.js';
import monitoringRoutes from './routes/monitoring.js';
import searchRoutes from './routes/search.js';
import { auditLog } from './middleware/auditLog.js';

const app = express();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Finance Management API',
      version: '1.0.0',
      description: 'Complete API for AI-powered finance management SaaS',
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
    },
    security: [{ bearerAuth: [], apiKeyAuth: [] }],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : '*',
  credentials: true,
}));
app.use(compression());
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms'));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request-ID middleware — attaches req.id for audit logs and cross-service correlation.
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Global rate limiter
app.use(globalRateLimiter);

// Tier-based rate limiter — applied to expensive routes below.
const tierLimiter = createTierBasedRateLimiter();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Detailed health check — reports the status of every upstream dependency.
app.get('/health/detailed', async (req, res) => {
  const startedAt = Date.now();
  const checks = {};

  // MongoDB
  try {
    const mongoose = (await import('mongoose')).default;
    const state = mongoose.connection?.readyState;
    const stateNames = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    checks.mongodb = { healthy: state === 1, state: stateNames[state] || 'unknown' };
  } catch (err) {
    checks.mongodb = { healthy: false, error: err.message };
  }

  // Redis
  try {
    const { getRedis } = await import('./config/redis.js');
    const client = getRedis();
    if (client?.ping) {
      const pong = await Promise.race([
        client.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ]);
      checks.redis = { healthy: pong === 'PONG', response: pong };
    } else {
      checks.redis = { healthy: false, error: 'not initialized' };
    }
  } catch (err) {
    checks.redis = { healthy: false, error: err.message };
  }

  // ML service (optional, controlled by ENABLE_ML_FEATURES)
  if (process.env.ENABLE_ML_FEATURES !== 'false') {
    try {
      const axios = (await import('axios')).default;
      const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const mlRes = await axios.get(`${mlUrl}/api/v1/health`, { timeout: 2000 });
      checks.mlService = { healthy: mlRes.status === 200, url: mlUrl };
    } catch (err) {
      checks.mlService = { healthy: false, error: err.code || err.message };
    }
  } else {
    checks.mlService = { healthy: true, disabled: true };
  }

  const allHealthy = Object.values(checks).every((c) => c.healthy);
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    responseTimeMs: Date.now() - startedAt,
    environment: process.env.NODE_ENV || 'development',
    checks,
  });
});

// Swagger docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Audit log — records every mutating /api/* request after it completes.
app.use(auditLog);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ml', tierLimiter, mlRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/receipts', tierLimiter, receiptRoutes);
app.use('/api/personality', personalityRoutes);
app.use('/api/llm', tierLimiter, llmRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/search', searchRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;

/**
 * Initialize Socket.IO for real-time updates
 */
export const initializeSocket = (server) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
  });

  // JWT middleware on every socket connection. Real mode only.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication token required'));
      const jwt = await import('jsonwebtoken').then((m) => m.default);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      logger.error(`Socket authentication error: ${error.message}`);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User ${socket.userId} connected via Socket.IO`);
    socket.join(`user:${socket.userId}`);

    socket.on('disconnect', () => {
      logger.info(`User ${socket.userId} disconnected`);
    });

    socket.on('transaction:created', (transaction) => {
      io.to(`user:${socket.userId}`).emit('transaction:new', transaction);
    });

    socket.on('budget:alert', (alert) => {
      io.to(`user:${socket.userId}`).emit('notification:budget', alert);
    });

    socket.on('anomaly:detected', (anomaly) => {
      io.to(`user:${socket.userId}`).emit('notification:anomaly', anomaly);
    });
  });

  return io;
};
