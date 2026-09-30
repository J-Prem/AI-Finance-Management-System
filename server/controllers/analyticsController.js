import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import mlProxyService from '../services/mlProxyService.js';
import cacheService, { cacheKeys } from '../services/cacheService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Get spending trends
 */
export const getSpendingTrends = asyncHandler(async (req, res) => {
  const { period = 'monthly', months = 12 } = req.query;

  const cacheKey = cacheKeys.spendingTrend(req.user._id, period);
  let trends = await cacheService.get(cacheKey);

  if (!trends) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

    const transactions = await Transaction.find({
      userId: req.user._id,
      type: 'expense',
      date: { $gte: startDate, $lte: now },
    });

    trends = {};

    transactions.forEach((t) => {
      let key;
      const date = new Date(t.date);

      if (period === 'monthly') {
        key = date.toISOString().slice(0, 7); // YYYY-MM
      } else if (period === 'weekly') {
        const week = Math.ceil((date.getDate() + 6) / 7);
        key = `${date.getFullYear()}-W${week}`;
      } else if (period === 'daily') {
        key = date.toISOString().slice(0, 10); // YYYY-MM-DD
      }

      trends[key] = (trends[key] || 0) + t.amount;
    });

    await cacheService.set(cacheKey, trends, 3600);
  }

  res.json({
    success: true,
    data: { trends },
  });
});

/**
 * Get category breakdown
 */
export const getCategoryBreakdown = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const cacheKey = cacheKeys.categoryBreakdown(
    req.user._id,
    `${startDate}-${endDate}`
  );
  let breakdown = await cacheService.get(cacheKey);

  if (!breakdown) {
    const query = {
      userId: req.user._id,
      type: 'expense',
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    breakdown = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$category',
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    breakdown = breakdown.map((item) => ({
      category: item._id,
      amount: item.amount,
      count: item.count,
    }));

    await cacheService.set(cacheKey, breakdown, 3600);
  }

  res.json({
    success: true,
    data: { breakdown },
  });
});

/**
 * Get monthly comparison
 */
export const getMonthlyComparison = asyncHandler(async (req, res) => {
  const cacheKey = cacheKeys.monthlyComparison(req.user._id);
  let comparison = await cacheService.get(cacheKey);

  if (!comparison) {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentMonthTransactions = await Transaction.find({
      userId: req.user._id,
      type: 'expense',
      date: { $gte: currentMonth },
    });

    const previousMonthTransactions = await Transaction.find({
      userId: req.user._id,
      type: 'expense',
      date: {
        $gte: previousMonth,
        $lt: currentMonth,
      },
    });

    const currentTotal = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const previousTotal = previousMonthTransactions.reduce((sum, t) => sum + t.amount, 0);

    comparison = {
      currentMonth: {
        total: currentTotal,
        count: currentMonthTransactions.length,
        date: currentMonth.toISOString(),
      },
      previousMonth: {
        total: previousTotal,
        count: previousMonthTransactions.length,
        date: previousMonth.toISOString(),
      },
      change: currentTotal - previousTotal,
      changePercent:
        previousTotal > 0
          ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
          : 0,
    };

    await cacheService.set(cacheKey, comparison, 1800);
  }

  res.json({
    success: true,
    data: { comparison },
  });
});

/**
 * Get income vs expense
 */
export const getIncomeVsExpense = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const query = { userId: req.user._id };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const transactions = await Transaction.find(query);

  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const savings = income - expense;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  res.json({
    success: true,
    data: {
      incomeVsExpense: {
        income,
        expense,
        savings,
        savingsRate,
        ratio: expense > 0 ? Math.round((income / expense) * 100) / 100 : 0,
      },
    },
  });
});

/**
 * Get dashboard stats
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyTransactions = await Transaction.find({
    userId: req.user._id,
    date: { $gte: currentMonth },
  });

  const totalIncome = monthlyTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = monthlyTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const budgets = await Budget.find({
    userId: req.user._id,
    isActive: true,
  });

  const budgetStatus = budgets.map((b) => ({
    id: b._id,
    name: b.name,
    spent: b.spent,
    budget: b.amount,
    percentSpent: b.percentSpent,
  }));

  res.json({
    success: true,
    data: {
      stats: {
        thisMonth: {
          income: totalIncome,
          expense: totalExpense,
          savings: totalIncome - totalExpense,
          transactionCount: monthlyTransactions.length,
        },
        budgets: {
          total: budgets.length,
          active: budgets.filter((b) => b.isActive).length,
          exceeded: budgets.filter((b) => b.percentSpent >= 100).length,
          status: budgetStatus,
        },
      },
    },
  });
});

/**
 * Get savings rate analysis
 */
export const getSavingsRateAnalysis = asyncHandler(async (req, res) => {
  const { period = 'monthly' } = req.query;

  const now = new Date();
  let startDate;

  if (period === 'monthly') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  } else if (period === 'quarterly') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 8, 1);
  } else {
    startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  }

  const transactions = await Transaction.find({
    userId: req.user._id,
    date: { $gte: startDate, $lte: now },
  });

  const analysis = {};

  transactions.forEach((t) => {
    let key;
    const date = new Date(t.date);

    if (period === 'monthly') {
      key = date.toISOString().slice(0, 7);
    } else if (period === 'quarterly') {
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      key = `${date.getFullYear()}-Q${quarter}`;
    } else {
      key = date.getFullYear().toString();
    }

    if (!analysis[key]) {
      analysis[key] = { income: 0, expense: 0 };
    }

    if (t.type === 'income') {
      analysis[key].income += t.amount;
    } else {
      analysis[key].expense += t.amount;
    }
  });

  const rates = Object.entries(analysis).map(([period, data]) => ({
    period,
    income: data.income,
    expense: data.expense,
    savingsRate: data.income > 0 ? Math.round((data.income - data.expense) / data.income * 100) : 0,
  }));

  res.json({
    success: true,
    data: { savingsRate: rates },
  });
});

/**
 * Get anomalies
 */
export const getAnomalies = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({
    userId: req.user._id,
    isAnomaly: true,
  }).sort({ anomalyScore: -1 });

  res.json({
    success: true,
    data: { anomalies: transactions },
  });
});

/**
 * Get AI insights
 *
 * Tries the ML service first; on failure (or empty payloads) falls back to
 * a deterministic projection derived from the user's own 30/90-day spend.
 * The Analytics page Predictive Forecast and Insights tabs depend on this
 * always returning something usable — never an `error` blob.
 */
export const getAIInsights = asyncHandler(async (req, res) => {
  const now = new Date();
  const ninetyAgo = new Date(now); ninetyAgo.setDate(now.getDate() - 90);
  const thirtyAgo = new Date(now); thirtyAgo.setDate(now.getDate() - 30);

  const transactions = await Transaction.find({
    userId: req.user._id,
    date: { $gte: ninetyAgo },
  }).lean();

  // Build a category-aware fallback projection.
  const expenses30 = transactions.filter(
    (t) => t.type === 'expense' && new Date(t.date) >= thirtyAgo
  );
  const total30 = expenses30.reduce((s, t) => s + (t.amount || 0), 0);
  const projected30 = Math.round(total30);
  const breakdownMap = expenses30.reduce((acc, t) => {
    const k = t.category || 'Other';
    acc[k] = (acc[k] || 0) + (t.amount || 0);
    return acc;
  }, {});
  const breakdown = Object.entries(breakdownMap)
    .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const fallback = {
    predictions: {
      total: projected30,
      breakdown,
      description:
        projected30 > 0
          ? `Projected ~${projected30} over the next 30 days based on your trailing 30-day spend.`
          : 'Need more transactions to build a forecast.',
    },
    personality: null,
    health: null,
    patterns: [],
    opportunities: [],
    source: 'derived',
  };

  try {
    const [
      predictions,
      personality,
      health,
      patterns,
      opportunities,
    ] = await Promise.all([
      mlProxyService.getSpendingPredictions(req.user._id.toString()).catch(() => null),
      mlProxyService.getSpendingPersonality(req.user._id.toString()).catch(() => null),
      mlProxyService.getFinancialHealth(req.user._id.toString()).catch(() => null),
      mlProxyService.getBehavioralPatterns(req.user._id.toString()).catch(() => null),
      mlProxyService.getSavingOpportunities(req.user._id.toString()).catch(() => null),
    ]);

    res.json({
      success: true,
      data: {
        insights: {
          predictions: predictions || fallback.predictions,
          personality: personality || fallback.personality,
          health: health || fallback.health,
          patterns: patterns || fallback.patterns,
          opportunities: opportunities || fallback.opportunities,
          source: predictions ? 'ml' : 'derived',
        },
      },
    });
  } catch (error) {
    res.json({
      success: true,
      data: { insights: fallback },
    });
  }
});

/**
 * Financial health — dynamic 0-100 score derived from savings rate, budget
 * compliance, expense volatility, and recent anomaly density. No ML service
 * required; falls back cleanly when there is no data.
 */
export const getFinancialHealth = asyncHandler(async (req, res) => {
  const now = new Date();
  const ninetyDays = new Date(now);
  ninetyDays.setDate(now.getDate() - 90);
  const thirtyDays = new Date(now);
  thirtyDays.setDate(now.getDate() - 30);

  const txs90 = await Transaction.find({
    userId: req.user._id,
    date: { $gte: ninetyDays },
  }).lean();

  const income = txs90
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + (t.amount || 0), 0);
  const expense = txs90
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + (t.amount || 0), 0);

  // Savings rate (0-100)
  const savingsRate = income > 0 ? Math.max(0, Math.min(100, Math.round(((income - expense) / income) * 100))) : 0;

  // Budget compliance — % of active budgets that are <= 100% spent
  const budgets = await Budget.find({ userId: req.user._id, isActive: true });
  const compliantCount = budgets.filter((b) => (b.percentSpent || 0) < 100).length;
  const budgetScore = budgets.length ? Math.round((compliantCount / budgets.length) * 100) : 70;

  // Expense volatility — coefficient of variation across the last 90 days
  // (lower is more stable → higher score). Bucket by day.
  const byDay = new Map();
  txs90.forEach((t) => {
    if (t.type !== 'expense') return;
    const k = new Date(t.date).toISOString().slice(0, 10);
    byDay.set(k, (byDay.get(k) || 0) + (t.amount || 0));
  });
  const daily = Array.from(byDay.values());
  let volatilityScore = 60;
  if (daily.length >= 5) {
    const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
    const variance = daily.reduce((a, b) => a + (b - mean) ** 2, 0) / daily.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    // cv of 0 → 100, cv of 2 → 0
    volatilityScore = Math.max(0, Math.min(100, Math.round(100 - cv * 50)));
  }

  // Anomaly density — % of last-30-day transactions flagged as anomalies
  const recent = txs90.filter((t) => new Date(t.date) >= thirtyDays);
  const anomalies = recent.filter((t) => t.isAnomaly).length;
  const anomalyScore = recent.length ? Math.max(0, 100 - Math.round((anomalies / recent.length) * 200)) : 80;

  // Weighted composite score
  const score = Math.round(
    savingsRate * 0.35 +
      budgetScore * 0.25 +
      volatilityScore * 0.2 +
      anomalyScore * 0.2
  );

  const rating =
    score >= 85 ? 'excellent'
    : score >= 70 ? 'good'
    : score >= 55 ? 'fair'
    : score >= 35 ? 'needs_attention'
    : 'critical';

  const insights = [];
  if (savingsRate < 20) insights.push('Savings rate is below 20% — consider trimming recurring expenses.');
  if (budgets.length === 0) insights.push('No active budgets — create one to improve financial clarity.');
  if (volatilityScore < 50) insights.push('Daily spending is highly volatile — look for one-off spikes.');
  if (anomalies > 2) insights.push(`${anomalies} flagged anomal${anomalies === 1 ? 'y' : 'ies'} in the last 30 days.`);
  if (income === 0) insights.push('No income transactions in the last 90 days.');
  if (!insights.length) insights.push('Finances look stable over the last 90 days — keep it up.');

  res.json({
    success: true,
    data: {
      score,
      rating,
      components: {
        savingsRate,
        budgetScore,
        volatilityScore,
        anomalyScore,
      },
      totals: {
        income90d: income,
        expense90d: expense,
        transactions90d: txs90.length,
        activeBudgets: budgets.length,
      },
      insights,
      computedAt: new Date().toISOString(),
    },
  });
});

/**
 * Get what-if scenarios
 */
export const getWhatIfScenarios = asyncHandler(async (req, res) => {
  const { scenario } = req.body;

  try {
    const result = await mlProxyService.whatIfSimulation(
      req.user._id.toString(),
      scenario
    );

    res.json({
      success: true,
      data: { scenario: result },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to run simulation',
    });
  }
});
