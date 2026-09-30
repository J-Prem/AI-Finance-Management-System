import mlProxyService from '../services/mlProxyService.js';
import cacheService, { cacheKeys } from '../services/cacheService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import Transaction from '../models/Transaction.js';

/**
 * Categorize transaction
 */
export const categorizeTransaction = asyncHandler(async (req, res) => {
  const { description, amount, merchant, date, currentCategory } = req.body;

  const result = await mlProxyService.categorizeTransaction({
    description,
    amount,
    merchant,
    date,
    previousCategory: currentCategory,
  });

  res.json({
    success: true,
    data: { categorization: result },
  });
});

/**
 * Detect anomalies
 */
export const detectAnomalies = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({
    userId: req.user._id,
  }).lean();

  const result = await mlProxyService.detectAnomalies(
    req.user._id.toString(),
    transactions
  );

  // Update transactions with anomaly info
  if (result.anomalies && result.anomalies.length > 0) {
    for (const anomaly of result.anomalies) {
      await Transaction.findByIdAndUpdate(anomaly.transactionId, {
        isAnomaly: true,
        anomalyScore: anomaly.score,
      });
    }
  }

  res.json({
    success: true,
    data: { anomalies: result.anomalies },
  });
});

/**
 * Get spending predictions
 */
export const getSpendingPredictions = asyncHandler(async (req, res) => {
  const { months = 3 } = req.query;

  const result = await mlProxyService.getSpendingPredictions(
    req.user._id.toString(),
    parseInt(months)
  );

  res.json({
    success: true,
    data: { predictions: result },
  });
});

/**
 * Get spending personality
 */
export const getSpendingPersonality = asyncHandler(async (req, res) => {
  const cacheKey = cacheKeys.spendingPersonality(req.user._id);
  let personality = await cacheService.get(cacheKey);

  if (!personality) {
    personality = await mlProxyService.getSpendingPersonality(
      req.user._id.toString()
    );
    await cacheService.set(cacheKey, personality, 7200);
  }

  res.json({
    success: true,
    data: { personality },
  });
});

/**
 * Get financial health score
 */
export const getFinancialHealth = asyncHandler(async (req, res) => {
  const cacheKey = cacheKeys.financialHealth(req.user._id);
  let health = await cacheService.get(cacheKey);

  if (!health) {
    health = await mlProxyService.getFinancialHealth(req.user._id.toString());
    await cacheService.set(cacheKey, health, 3600);
  }

  res.json({
    success: true,
    data: { health },
  });
});

/**
 * Get spending DNA
 */
export const getSpendingDNA = asyncHandler(async (req, res) => {
  const cacheKey = `ml:dna:${req.user._id}`;
  let dna = await cacheService.get(cacheKey);

  if (!dna) {
    dna = await mlProxyService.getSpendingDNA(req.user._id.toString());
    await cacheService.set(cacheKey, dna, 7200);
  }

  res.json({
    success: true,
    data: { dna },
  });
});

/**
 * Run what-if simulation
 */
export const runWhatIfSimulation = asyncHandler(async (req, res) => {
  const { scenario } = req.body;

  const result = await mlProxyService.whatIfSimulation(
    req.user._id.toString(),
    scenario
  );

  res.json({
    success: true,
    data: { simulation: result },
  });
});

/**
 * Detect recurring transactions
 */
export const detectRecurringTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({
    userId: req.user._id,
  }).lean();

  const result = await mlProxyService.detectRecurringTransactions(
    req.user._id.toString(),
    transactions
  );

  // Update transactions with recurring info
  if (result.recurring && result.recurring.length > 0) {
    for (const recurring of result.recurring) {
      await Transaction.findByIdAndUpdate(recurring.transactionId, {
        isRecurring: true,
        recurringPattern: recurring.pattern,
      });
    }
  }

  res.json({
    success: true,
    data: { recurring: result.recurring },
  });
});

/**
 * Get behavioral patterns
 */
export const getBehavioralPatterns = asyncHandler(async (req, res) => {
  const cacheKey = `ml:patterns:${req.user._id}`;
  let patterns = await cacheService.get(cacheKey);

  if (!patterns) {
    patterns = await mlProxyService.getBehavioralPatterns(
      req.user._id.toString()
    );
    await cacheService.set(cacheKey, patterns, 3600);
  }

  res.json({
    success: true,
    data: { patterns },
  });
});

/**
 * Get saving opportunities
 */
export const getSavingOpportunities = asyncHandler(async (req, res) => {
  const result = await mlProxyService.getSavingOpportunities(
    req.user._id.toString()
  );

  res.json({
    success: true,
    data: { opportunities: result.opportunities },
  });
});

/**
 * Detect subscriptions
 */
export const detectSubscriptions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({
    userId: req.user._id,
  }).lean();

  const result = await mlProxyService.detectSubscriptions(
    req.user._id.toString(),
    transactions
  );

  res.json({
    success: true,
    data: { subscriptions: result.subscriptions },
  });
});

/**
 * Get merchant insights
 */
export const getMerchantInsights = asyncHandler(async (req, res) => {
  const { merchant } = req.params;

  const result = await mlProxyService.getMerchantInsights(
    req.user._id.toString(),
    merchant
  );

  res.json({
    success: true,
    data: { insights: result.insights },
  });
});

/**
 * Optimize budgets
 */
export const optimizeBudgets = asyncHandler(async (req, res) => {
  const { Budget } = await import('../models/Budget.js');
  const budgets = await Budget.find({ userId: req.user._id });

  const result = await mlProxyService.optimizeBudgets(
    req.user._id.toString(),
    budgets
  );

  res.json({
    success: true,
    data: { optimized: result.optimized, recommendations: result.recommendations },
  });
});

/**
 * Clear ML cache
 */
export const clearCache = asyncHandler(async (req, res) => {
  await mlProxyService.clearUserCache(req.user._id.toString());

  res.json({
    success: true,
    message: 'ML cache cleared',
  });
});

/**
 * Health check
 */
export const healthCheck = asyncHandler(async (req, res) => {
  const health = await mlProxyService.healthCheck();

  res.json({
    success: true,
    data: { health },
  });
});
