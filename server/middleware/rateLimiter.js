import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedis } from '../config/redis.js';
import { API_RATE_LIMITS, ERROR_MESSAGES } from '../config/constants.js';
import logger from '../utils/logger.js';

/**
 * Global rate limiter
 *
 * Designed for a SPA that issues dozens of API calls per page load.
 * - Authenticated users: 2,000 req / 15 min (per-user key) — tier limiter refines further.
 * - Unauthenticated IPs: 300 req / 15 min (dev-safe; hardened via env for prod).
 * - Skips health checks, swagger, static webhooks, socket handshake probes.
 */
const GLOBAL_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);
const GLOBAL_MAX_AUTH = parseInt(process.env.RATE_LIMIT_MAX_AUTH || '2000', 10);
const GLOBAL_MAX_ANON = parseInt(process.env.RATE_LIMIT_MAX_ANON || '300', 10);

const SKIP_PATHS = [
  '/health',
  '/health/detailed',
  '/api/docs',
  '/api/webhooks',
  '/favicon.ico',
];

export const globalRateLimiter = rateLimit({
  windowMs: GLOBAL_WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
  // Per-user key when authenticated — prevents multi-user office networks from sharing a bucket.
  keyGenerator: (req) => {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ') && auth.length > 20) {
      return `auth:${auth.slice(7, 27)}`; // hash prefix — good enough for bucketing
    }
    return `ip:${req.ip}`;
  },
  max: (req) => {
    const auth = req.headers.authorization || '';
    return auth.startsWith('Bearer ') ? GLOBAL_MAX_AUTH : GLOBAL_MAX_ANON;
  },
  skip: (req) => SKIP_PATHS.some((p) => req.path === p || req.path.startsWith(`${p}/`)),
  handler: (req, res) => {
    logger.warn(`Global rate limit exceeded: ${req.method} ${req.path} (${req.ip})`);
    res.set('Retry-After', '60');
    res.status(429).json({
      success: false,
      message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
      retryAfterSeconds: 60,
      hint: 'If you are a logged-in user, tier limits apply at /api/subscriptions/usage.',
    });
  },
});

/**
 * Subscription-based rate limiter
 */
export const subscriptionRateLimiter = rateLimit({
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  },
  skip: (req) => !req.user,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for user ${req.user._id}`);
    res.status(429).json({
      success: false,
      message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
      retryAfter: req.rateLimit?.resetTime,
    });
  },
});

// In-memory fallback buckets for tier rate limits when Redis isn't available.
const memoryBuckets = new Map();
function memIncr(key, ttlSec) {
  const now = Date.now();
  const entry = memoryBuckets.get(key);
  if (!entry || entry.expiresAt <= now) {
    memoryBuckets.set(key, { count: 1, expiresAt: now + ttlSec * 1000 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

/**
 * Create tier-based rate limiter
 */
export const createTierBasedRateLimiter = () => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next();
      }

      // Default to FREE if the user record doesn't have a tier set.
      const tierName = req.user.subscriptionTier || 'Free';
      const tierLimits = API_RATE_LIMITS[tierName] || API_RATE_LIMITS.Free;
      if (!tierLimits) {
        return next(); // fail open — never block due to config issues
      }

      let redis = null;
      try { redis = getRedis(); } catch { redis = null; }
      const userId = req.user._id.toString();
      const now = Date.now();
      const minute = Math.floor(now / 60000);
      const hour = Math.floor(now / 3600000);
      const day = Math.floor(now / 86400000);

      const minuteKey = `ratelimit:${userId}:minute:${minute}`;
      const hourKey = `ratelimit:${userId}:hour:${hour}`;
      const dayKey = `ratelimit:${userId}:day:${day}`;

      // Check minute limit
      let minuteCount;
      if (redis?.incr) {
        minuteCount = await redis.incr(minuteKey);
        if (minuteCount === 1) await redis.expire(minuteKey, 60);
      } else {
        minuteCount = memIncr(minuteKey, 60);
      }

      if (tierLimits.requestsPerMinute && minuteCount > tierLimits.requestsPerMinute) {
        logger.warn(
          `Minute rate limit exceeded for user ${userId}: ${minuteCount}/${tierLimits.requestsPerMinute}`
        );
        return res.status(429).json({
          success: false,
          message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          limit: tierLimits.requestsPerMinute,
          current: minuteCount,
          resetIn: '1 minute',
        });
      }

      // Check hour limit
      let hourCount;
      if (redis?.incr) {
        hourCount = await redis.incr(hourKey);
        if (hourCount === 1) await redis.expire(hourKey, 3600);
      } else {
        hourCount = memIncr(hourKey, 3600);
      }

      if (tierLimits.requestsPerHour && hourCount > tierLimits.requestsPerHour) {
        logger.warn(
          `Hour rate limit exceeded for user ${userId}: ${hourCount}/${tierLimits.requestsPerHour}`
        );
        return res.status(429).json({
          success: false,
          message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          limit: tierLimits.requestsPerHour,
          current: hourCount,
          resetIn: '1 hour',
        });
      }

      // Check day limit
      let dayCount;
      if (redis?.incr) {
        dayCount = await redis.incr(dayKey);
        if (dayCount === 1) await redis.expire(dayKey, 86400);
      } else {
        dayCount = memIncr(dayKey, 86400);
      }

      if (tierLimits.requestsPerDay && dayCount > tierLimits.requestsPerDay) {
        logger.warn(
          `Day rate limit exceeded for user ${userId}: ${dayCount}/${tierLimits.requestsPerDay}`
        );
        return res.status(429).json({
          success: false,
          message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          limit: tierLimits.requestsPerDay,
          current: dayCount,
          resetIn: '24 hours',
        });
      }

      // Set headers
      res.set({
        'X-RateLimit-Limit-Minute': tierLimits.requestsPerMinute || 'unlimited',
        'X-RateLimit-Remaining-Minute': Math.max(0, (tierLimits.requestsPerMinute || Infinity) - minuteCount),
        'X-RateLimit-Limit-Hour': tierLimits.requestsPerHour || 'unlimited',
        'X-RateLimit-Remaining-Hour': Math.max(0, (tierLimits.requestsPerHour || Infinity) - hourCount),
        'X-RateLimit-Limit-Day': tierLimits.requestsPerDay || 'unlimited',
        'X-RateLimit-Remaining-Day': Math.max(0, (tierLimits.requestsPerDay || Infinity) - dayCount),
      });

      next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      next();
    }
  };
};

/**
 * API key-specific rate limiter
 */
export const apiKeyRateLimiter = async (req, res, next) => {
  try {
    if (!req.apiKey) {
      return next();
    }

    const redis = getRedis();
    const keyId = req.apiKey._id.toString();
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    const day = Math.floor(now / 86400000);

    const minuteKey = `apikey:${keyId}:minute:${minute}`;
    const hourKey = `apikey:${keyId}:hour:${hour}`;
    const dayKey = `apikey:${keyId}:day:${day}`;

    // Check minute limit
    const minuteCount = await redis.incr(minuteKey);
    if (minuteCount === 1) {
      await redis.expire(minuteKey, 60);
    }

    if (req.apiKey.rateLimit.requestsPerMinute &&
        minuteCount > req.apiKey.rateLimit.requestsPerMinute) {
      return res.status(429).json({
        success: false,
        message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        limit: req.apiKey.rateLimit.requestsPerMinute,
      });
    }

    // Check hour limit
    const hourCount = await redis.incr(hourKey);
    if (hourCount === 1) {
      await redis.expire(hourKey, 3600);
    }

    if (req.apiKey.rateLimit.requestsPerHour &&
        hourCount > req.apiKey.rateLimit.requestsPerHour) {
      return res.status(429).json({
        success: false,
        message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        limit: req.apiKey.rateLimit.requestsPerHour,
      });
    }

    // Check day limit
    const dayCount = await redis.incr(dayKey);
    if (dayCount === 1) {
      await redis.expire(dayKey, 86400);
    }

    if (req.apiKey.rateLimit.requestsPerDay &&
        dayCount > req.apiKey.rateLimit.requestsPerDay) {
      return res.status(429).json({
        success: false,
        message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        limit: req.apiKey.rateLimit.requestsPerDay,
      });
    }

    res.set({
      'X-RateLimit-Remaining': Math.max(
        0,
        (req.apiKey.rateLimit.requestsPerMinute || Infinity) - minuteCount
      ),
    });

    next();
  } catch (error) {
    logger.error('API key rate limiter error:', error);
    next();
  }
};

/**
 * Login attempt rate limiter (stricter)
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  skipSuccessfulRequests: true, // don't count successful requests
  message: 'Too many login attempts, please try again later',
});

/**
 * Password reset rate limiter
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each email to 3 requests per hour
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.body.email || req.ip,
  message: 'Too many password reset requests, please try again later',
});

/**
 * Registration rate limiter
 */
export const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 registrations per hour
  message: 'Too many accounts created from this IP, please try again later',
});
