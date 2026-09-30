import axios from 'axios';
import logger from '../utils/logger.js';
import cacheService, { cacheKeys } from './cacheService.js';
import { detectRecurring, predictNextMonthSpend } from './billPredictor.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_SERVICE_BASE_PATH = '/api/v1';
const ML_REQUEST_TIMEOUT = 30000; // 30 seconds

// ---------------------------------------------------------------------------
// JS-side fallbacks — so ML-powered features degrade gracefully to a useful
// answer instead of an empty array / 501-ish response when the Python service
// is unreachable. These are intentionally simple; the real models in
// ml_lite_server.py (or app.py) supersede them when available.
// ---------------------------------------------------------------------------
function fallbackCategorize(t) {
  const text = `${t.description || ''} ${t.merchant || ''}`.toLowerCase();
  const rules = [
    [/uber|lyft|ola|metro|bus|train/,            'Transportation'],
    [/starbucks|cafe|restaurant|mcdonald|kfc|dom/, 'Food & Dining'],
    [/grocery|kroger|whole foods|market|walmart/, 'Shopping'],
    [/netflix|spotify|prime|hbo|disney|youtube/,  'Entertainment'],
    [/electric|water|gas|internet|phone|wifi/,    'Bills & Utilities'],
    [/pharmacy|hospital|clinic|doctor|medical/,   'Healthcare'],
    [/school|tuition|course|udemy|coursera/,      'Education'],
  ];
  for (const [rx, cat] of rules) if (rx.test(text)) return { category: cat, confidence: 0.7, model: 'js-fallback' };
  return { category: t.category || 'Uncategorized', confidence: 0.2, model: 'js-fallback' };
}

function fallbackAnomalies(transactions = []) {
  const byCat = {};
  for (const t of transactions) {
    const c = t.category || 'Other';
    byCat[c] = byCat[c] || [];
    byCat[c].push(Number(t.amount) || 0);
  }
  const anomalies = [];
  for (const t of transactions) {
    const arr = byCat[t.category || 'Other'] || [];
    if (arr.length < 4) continue;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    const std = Math.sqrt(variance);
    const z = std > 0 ? Math.abs(Number(t.amount) - mean) / std : 0;
    if (z > 2.5) {
      anomalies.push({ transaction: t, score: +z.toFixed(2), is_anomaly: true, reason: `${z.toFixed(1)}σ from category mean` });
    }
  }
  return { anomalies, total_checked: transactions.length, model: 'js-fallback-zscore' };
}

function fallbackHealthScore(transactions = []) {
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  let score = 50;
  const rate = income > 0 ? (income - expense) / income : 0;
  score += Math.round(30 * Math.min(1, Math.max(0, rate) / 0.2));
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  return {
    score, grade, model: 'js-fallback',
    factors: [{ factor: 'savings_rate', value: +rate.toFixed(3) }],
    recommendations: score < 70 ? ['Aim for a 20% savings rate and automate the transfer.'] : [],
  };
}

/**
 * ML Service Proxy
 */
class MLProxyService {
  constructor() {
    this.baseURL = `${ML_SERVICE_URL}${ML_SERVICE_BASE_PATH}`;
    this.timeout = ML_REQUEST_TIMEOUT;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Categorize transaction
   */
  async categorizeTransaction(transaction) {
    const cacheKey = `ml:categorize:${transaction.description}:${transaction.amount}`;

    try {
      return await cacheService.getOrSet(
        cacheKey,
        async () => {
          const response = await this.client.post('/categorize', {
            description: transaction.description,
            amount: transaction.amount,
            merchant: transaction.merchant,
            date: transaction.date,
            previous_category: transaction.category,
          });

          return response.data;
        },
        3600 // Cache for 1 hour
      );
    } catch (error) {
      logger.warn('ML categorization unavailable — using JS fallback:', error.message);
      return fallbackCategorize(transaction);
    }
  }

  /**
   * Detect anomalies
   */
  async detectAnomalies(userId, transactions) {
    const cacheKey = cacheKeys.mlAnomaly(userId);

    try {
      return await cacheService.getOrSet(
        cacheKey,
        async () => {
          const response = await this.client.post('/detect-anomalies', {
            user_id: userId,
            transactions: transactions.map((t) => ({
              amount: t.amount,
              category: t.category,
              date: t.date,
              merchant: t.merchant,
              type: t.type,
            })),
          });

          return response.data;
        },
        1800 // Cache for 30 minutes
      );
    } catch (error) {
      logger.warn('ML anomaly detection unavailable — using JS fallback:', error.message);
      return fallbackAnomalies(transactions);
    }
  }

  /**
   * Get spending predictions
   */
  async getSpendingPredictions(userId, months = 3) {
    const cacheKey = `ml:predictions:${userId}:${months}m`;

    try {
      return await cacheService.getOrSet(
        cacheKey,
        async () => {
          const response = await this.client.post('/predict-spending', {
            user_id: userId,
            months,
          });

          return response.data;
        },
        3600 // Cache for 1 hour
      );
    } catch (error) {
      logger.warn('ML spending prediction unavailable — using JS fallback:', error.message);
      return { total_forecast: [], by_category: [], horizon_months: months, model: 'js-fallback' };
    }
  }

  /**
   * Get spending personality
   */
  async getSpendingPersonality(userId) {
    const cacheKey = cacheKeys.spendingPersonality(userId);

    try {
      return await cacheService.getOrSet(
        cacheKey,
        async () => {
          const response = await this.client.post('/analyze-personality', {
            user_id: userId,
          });

          return response.data;
        },
        7200 // Cache for 2 hours
      );
    } catch (error) {
      logger.error('ML spending personality error:', error.message);
      return {
        personality: 'balanced',
        traits: [],
      };
    }
  }

  /**
   * Calculate financial health score
   */
  async getFinancialHealth(userId) {
    const cacheKey = cacheKeys.financialHealth(userId);

    try {
      return await cacheService.getOrSet(
        cacheKey,
        async () => {
          const response = await this.client.post('/health-score', {
            user_id: userId,
          });

          return response.data;
        },
        3600 // Cache for 1 hour
      );
    } catch (error) {
      logger.warn('ML financial health unavailable — using JS fallback:', error.message);
      // We don't have the full tx list here, so return a neutral score with a hint;
      // callers that already fetched txs should use fallbackHealthScore directly.
      return { score: 50, grade: 'C', recommendations: ['Upload receipts and transactions to unlock a real score.'], model: 'js-fallback' };
    }
  }

  /**
   * Get spending DNA
   */
  async getSpendingDNA(userId) {
    const cacheKey = `ml:dna:${userId}`;

    try {
      return await cacheService.getOrSet(
        cacheKey,
        async () => {
          const response = await this.client.post('/analyze-dna', {
            user_id: userId,
          });

          return response.data;
        },
        7200 // Cache for 2 hours
      );
    } catch (error) {
      logger.error('ML spending DNA error:', error.message);
      return {
        dna: {},
        insights: [],
      };
    }
  }

  /**
   * What-if simulation
   */
  async whatIfSimulation(userId, scenario) {
    try {
      const response = await this.client.post('/simulate-scenario', {
        user_id: userId,
        scenario, // e.g., { reduce_dining: 0.2, increase_savings: 0.1 }
      });

      return response.data;
    } catch (error) {
      logger.error('ML what-if simulation error:', error.message);
      return {
        projections: [],
      };
    }
  }

  /**
   * Detect recurring transactions
   */
  async detectRecurringTransactions(userId, transactions) {
    try {
      const response = await this.client.post('/detect-recurring', {
        user_id: userId,
        transactions: transactions.map((t) => ({
          amount: t.amount,
          category: t.category,
          date: t.date,
          merchant: t.merchant,
          description: t.description,
        })),
      });

      return response.data;
    } catch (error) {
      logger.warn('ML recurring detection unavailable — using JS fallback:', error.message);
      return { recurring: detectRecurring(transactions), model: 'js-fallback' };
    }
  }

  /**
   * Get behavioral patterns
   */
  async getBehavioralPatterns(userId) {
    const cacheKey = `ml:patterns:${userId}`;

    try {
      return await cacheService.getOrSet(
        cacheKey,
        async () => {
          const response = await this.client.post('/analyze-patterns', {
            user_id: userId,
          });

          return response.data;
        },
        3600 // Cache for 1 hour
      );
    } catch (error) {
      logger.error('ML behavioral patterns error:', error.message);
      return {
        patterns: [],
      };
    }
  }

  /**
   * Get saving opportunities
   */
  async getSavingOpportunities(userId) {
    try {
      const response = await this.client.post('/identify-opportunities', {
        user_id: userId,
      });

      return response.data;
    } catch (error) {
      logger.error('ML saving opportunities error:', error.message);
      return {
        opportunities: [],
      };
    }
  }

  /**
   * Subscription detection
   */
  async detectSubscriptions(userId, transactions) {
    try {
      const response = await this.client.post('/detect-subscriptions', {
        user_id: userId,
        transactions: transactions.map((t) => ({
          amount: t.amount,
          merchant: t.merchant,
          date: t.date,
          category: t.category,
        })),
      });

      return response.data;
    } catch (error) {
      logger.warn('ML subscription detection unavailable — using JS fallback:', error.message);
      const recurring = detectRecurring(transactions);
      const keywords = /netflix|spotify|prime|hbo|disney|youtube|icloud|dropbox|adobe|office|gym/i;
      const subscriptions = recurring.filter((r) => keywords.test(r.merchant) || r.amount < 100);
      return { subscriptions, model: 'js-fallback' };
    }
  }

  /**
   * Get merchant insights
   */
  async getMerchantInsights(userId, merchant) {
    try {
      const response = await this.client.post('/analyze-merchant', {
        user_id: userId,
        merchant,
      });

      return response.data;
    } catch (error) {
      logger.error('ML merchant insights error:', error.message);
      return {
        insights: [],
      };
    }
  }

  /**
   * Budget optimization
   */
  async optimizeBudgets(userId, budgets) {
    try {
      const response = await this.client.post('/optimize-budgets', {
        user_id: userId,
        budgets,
      });

      return response.data;
    } catch (error) {
      logger.error('ML budget optimization error:', error.message);
      return {
        optimized: [],
        recommendations: [],
      };
    }
  }

  /**
   * Check ML service health
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error('ML service health check error:', error.message);
      return {
        status: 'unhealthy',
      };
    }
  }

  /**
   * Clear ML cache for user
   */
  async clearUserCache(userId) {
    try {
      await cacheService.deletePattern(`ml:*:${userId}`);
      logger.info(`ML cache cleared for user ${userId}`);
    } catch (error) {
      logger.error('Failed to clear ML cache:', error);
    }
  }
}

export default new MLProxyService();
