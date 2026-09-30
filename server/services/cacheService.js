import { getRedis } from '../config/redis.js';
import logger from '../utils/logger.js';

/**
 * Cache service using Redis
 */
class CacheService {
  constructor() {
    this.defaultTTL = 3600; // 1 hour
  }

  /**
   * Get cached value
   */
  async get(key) {
    try {
      const redis = getRedis();
      const value = await redis.get(key);
      if (!value) {
        return null;
      }

      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const redis = getRedis();
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await redis.setEx(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async delete(key) {
    try {
      const redis = getRedis();
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache keys matching pattern
   */
  async deletePattern(pattern) {
    try {
      const redis = getRedis();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
      return keys.length;
    } catch (error) {
      logger.error(`Cache delete pattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      const redis = getRedis();
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async getTTL(key) {
    try {
      const redis = getRedis();
      return await redis.ttl(key);
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Extend TTL
   */
  async expire(key, ttl) {
    try {
      const redis = getRedis();
      await redis.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment counter
   */
  async increment(key, increment = 1) {
    try {
      const redis = getRedis();
      return await redis.incrBy(key, increment);
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key, decrement = 1) {
    try {
      const redis = getRedis();
      return await redis.decrBy(key, decrement);
    } catch (error) {
      logger.error(`Cache decrement error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get or set (compute if not exists)
   */
  async getOrSet(key, computeFn, ttl = this.defaultTTL) {
    try {
      let value = await this.get(key);
      if (value === null) {
        value = await computeFn();
        await this.set(key, value, ttl);
      }
      return value;
    } catch (error) {
      logger.error(`Cache getOrSet error for key ${key}:`, error);
      return await computeFn();
    }
  }

  /**
   * Clear all cache
   */
  async clear() {
    try {
      const redis = getRedis();
      await redis.flushDb();
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }
}

export default new CacheService();

/**
 * Cache key builders
 */
export const cacheKeys = {
  // User cache
  user: (userId) => `user:${userId}`,
  userSubscription: (userId) => `user:${userId}:subscription`,
  userApiKeys: (userId) => `user:${userId}:apikeys`,
  userTeams: (userId) => `user:${userId}:teams`,

  // Transaction cache
  transaction: (transactionId) => `transaction:${transactionId}`,
  userTransactions: (userId, page = 1) => `transactions:${userId}:p${page}`,
  userTransactionsByCategory: (userId, category) => `transactions:${userId}:${category}`,
  transactionsByDate: (userId, date) => `transactions:${userId}:${date}`,

  // Budget cache
  budget: (budgetId) => `budget:${budgetId}`,
  userBudgets: (userId) => `budgets:${userId}`,

  // Analytics cache
  spendingTrend: (userId, period) => `analytics:${userId}:trend:${period}`,
  categoryBreakdown: (userId, period) => `analytics:${userId}:breakdown:${period}`,
  monthlyComparison: (userId) => `analytics:${userId}:monthly`,
  savingsRate: (userId, period) => `analytics:${userId}:savings:${period}`,

  // Team cache
  team: (teamId) => `team:${teamId}`,
  teamMembers: (teamId) => `team:${teamId}:members`,
  teamAnalytics: (teamId, period) => `team:${teamId}:analytics:${period}`,

  // ML predictions cache
  mlPrediction: (userId) => `ml:prediction:${userId}`,
  mlAnomaly: (userId) => `ml:anomaly:${userId}`,
  spendingPersonality: (userId) => `ml:personality:${userId}`,
  financialHealth: (userId) => `ml:health:${userId}`,

  // Session/Auth cache
  session: (userId, sessionId) => `session:${userId}:${sessionId}`,
  refreshToken: (userId, tokenId) => `refresh:${userId}:${tokenId}`,

  // Rate limiting
  rateLimit: (userId, type) => `ratelimit:${userId}:${type}`,

  // External APIs cache
  currencyRates: (base) => `currency:rates:${base}`,
  historicalRate: (date, from, to) => `currency:historical:${date}:${from}:${to}`,
  stockQuote: (symbol) => `stock:quote:${symbol}`,
  stockHistory: (symbol, period) => `stock:history:${symbol}:${period}`,
  stockSearch: (query) => `stock:search:${query}`,
  marketSummary: (region) => `stock:summary:${region}`,
  news: (query, page) => `news:financial:${query}:p${page}`,
  newsHeadlines: (category, country) => `news:headlines:${category}:${country}`,
  marketNews: (symbol) => `news:market:${symbol}`,
  mutualFundNAV: (schemeCode) => `investment:mf:nav:${schemeCode}`,
  mutualFundSearch: (query) => `investment:mf:search:${query}`,
  cryptoPrice: (coinId) => `investment:crypto:price:${coinId}`,
  cryptoMarket: (limit) => `investment:crypto:market:${limit}`,
  metalPrices: () => 'investment:metals:prices',

  // Locks
  lock: (resource) => `lock:${resource}`,
};

/**
 * Convenience method to invalidate related cache entries
 */
export const invalidateUserCache = async (userId) => {
  const patterns = [
    `user:${userId}*`,
    `transactions:${userId}*`,
    `budgets:${userId}*`,
    `analytics:${userId}*`,
    `ml:*:${userId}*`,
  ];

  for (const pattern of patterns) {
    await CacheService.deletePattern(pattern);
  }
};

/**
 * Invalidate team cache
 */
export const invalidateTeamCache = async (teamId) => {
  const patterns = [
    `team:${teamId}*`,
  ];

  for (const pattern of patterns) {
    await CacheService.deletePattern(pattern);
  }
};
