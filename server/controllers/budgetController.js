import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

// Compute the period start for a budget (weekly/monthly/quarterly/yearly).
// If the budget has an explicit startDate we anchor to the most recent period
// boundary relative to that; otherwise we fall back to the current period.
function periodStart(period, anchor = new Date()) {
  const d = new Date(anchor);
  const now = new Date();
  switch (period) {
    case 'weekly': {
      // Start of the current ISO week (Monday).
      const day = now.getDay() || 7;
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(now.getDate() - (day - 1));
      return start;
    }
    case 'quarterly': {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1);
    }
    case 'yearly':
      return new Date(now.getFullYear(), 0, 1);
    case 'monthly':
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

// Compute live spent for one or many budgets by aggregating Transaction
// amounts for the owning user + category within the current period. This
// keeps budgets accurate even when the Budget.spent column drifts (e.g. a
// budget created after transactions already exist, or a failed post-save
// hook). The result is an array of { id, spent }.
async function computeLiveSpent(userId, budgets) {
  if (!budgets?.length) return new Map();

  // One aggregation per unique (category, period) pair.
  const uniq = new Map();
  budgets.forEach((b) => {
    const key = `${b.category}::${b.period || 'monthly'}`;
    if (!uniq.has(key)) uniq.set(key, { category: b.category, period: b.period || 'monthly' });
  });

  const totals = new Map(); // key -> amount
  await Promise.all(
    Array.from(uniq.values()).map(async ({ category, period }) => {
      const gte = periodStart(period);
      const agg = await Transaction.aggregate([
        {
          $match: {
            userId,
            category,
            type: 'expense',
            date: { $gte: gte },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      totals.set(`${category}::${period}`, agg[0]?.total || 0);
    })
  );

  const out = new Map();
  budgets.forEach((b) => {
    const key = `${b.category}::${b.period || 'monthly'}`;
    out.set(String(b._id), totals.get(key) || 0);
  });
  return out;
}

/**
 * Create budget
 */
export const createBudget = asyncHandler(async (req, res) => {
  const { name, category, amount, period, startDate, alerts } = req.body;

  const budget = await Budget.create({
    userId: req.user._id,
    teamId: req.user.teamId || null,
    name,
    category,
    amount,
    period,
    startDate: new Date(startDate),
    alerts: alerts || {
      enabled: true,
      thresholds: [
        { percentage: 50, notifyVia: ['email', 'in_app'] },
        { percentage: 80, notifyVia: ['email', 'in_app'] },
        { percentage: 100, notifyVia: ['email', 'in_app'] },
      ],
    },
  });

  res.status(201).json({
    success: true,
    message: 'Budget created successfully',
    data: { budget },
  });
});

/**
 * Get all budgets
 */
export const getBudgets = asyncHandler(async (req, res) => {
  const budgets = await Budget.find({
    userId: req.user._id,
    isActive: true,
  }).sort({ createdAt: -1 });

  // Merge live-computed spent (from Transactions) so the UI always shows the
  // true current-period total even if the running counter drifted.
  const live = await computeLiveSpent(req.user._id, budgets);
  const enriched = budgets.map((b) => {
    const obj = b.toObject({ virtuals: true });
    const liveSpent = live.get(String(b._id));
    if (typeof liveSpent === 'number') {
      obj.spent = liveSpent;
      obj.remaining = Math.max(0, (obj.amount || 0) - liveSpent);
      obj.percentSpent = obj.amount ? Math.round((liveSpent / obj.amount) * 100) : 0;
      obj.status =
        obj.percentSpent >= 100 ? 'exceeded'
        : obj.percentSpent >= 80 ? 'warning'
        : obj.percentSpent >= 50 ? 'on_track'
        : 'under_target';
    }
    return obj;
  });

  res.json({
    success: true,
    data: { budgets: enriched },
  });
});

/**
 * Get single budget
 */
export const getBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!budget) {
    return res.status(404).json({
      success: false,
      message: 'Budget not found',
    });
  }

  res.json({
    success: true,
    data: { budget },
  });
});

/**
 * Update budget
 */
export const updateBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!budget) {
    return res.status(404).json({
      success: false,
      message: 'Budget not found',
    });
  }

  Object.assign(budget, req.body);
  await budget.save();

  res.json({
    success: true,
    message: 'Budget updated successfully',
    data: { budget },
  });
});

/**
 * Delete budget
 */
export const deleteBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!budget) {
    return res.status(404).json({
      success: false,
      message: 'Budget not found',
    });
  }

  budget.isActive = false;
  await budget.save();

  res.json({
    success: true,
    message: 'Budget deleted successfully',
  });
});

/**
 * Get budget status
 */
export const getBudgetStatus = asyncHandler(async (req, res) => {
  const budgets = await Budget.find({
    userId: req.user._id,
    isActive: true,
  });

  const live = await computeLiveSpent(req.user._id, budgets);

  const status = budgets.map((b) => {
    const spent = live.get(String(b._id)) ?? b.spent ?? 0;
    const amount = b.amount || 0;
    const remaining = Math.max(0, amount - spent);
    const percentSpent = amount ? Math.round((spent / amount) * 100) : 0;
    const statusStr =
      percentSpent >= 100 ? 'exceeded'
      : percentSpent >= 80 ? 'warning'
      : percentSpent >= 50 ? 'on_track'
      : 'under_target';
    return {
      id: b._id,
      name: b.name,
      category: b.category,
      amount,
      spent,
      remaining,
      percentSpent,
      status: statusStr,
      period: b.period,
      startDate: b.startDate,
    };
  });

  res.json({
    success: true,
    data: { budgets: status },
  });
});

/**
 * Get budget alerts
 */
export const getBudgetAlerts = asyncHandler(async (req, res) => {
  const budgets = await Budget.find({
    userId: req.user._id,
    isActive: true,
    'alerts.enabled': true,
  });

  const alerts = [];

  budgets.forEach((b) => {
    const thresholds = b.checkThresholds();
    thresholds.forEach((t) => {
      alerts.push({
        budgetId: b._id,
        budgetName: b.name,
        category: b.category,
        threshold: t.threshold,
        currentPercentage: b.percentSpent,
        spent: b.spent,
        budget: b.amount,
        notifyVia: t.notifyVia,
      });
    });
  });

  res.json({
    success: true,
    data: { alerts },
  });
});

/**
 * Reset budget spending (for recurring budgets)
 */
export const resetBudgetSpending = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!budget) {
    return res.status(404).json({
      success: false,
      message: 'Budget not found',
    });
  }

  budget.resetSpending();
  await budget.save();

  res.json({
    success: true,
    message: 'Budget spending reset successfully',
    data: { budget },
  });
});

/**
 * Compare budget vs actual
 */
export const compareBudgetVsActual = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  const budget = await Budget.findOne({
    _id: categoryId,
    userId: req.user._id,
  });

  if (!budget) {
    return res.status(404).json({
      success: false,
      message: 'Budget not found',
    });
  }

  const comparison = {
    budgetedAmount: budget.amount,
    actualSpent: budget.spent,
    remaining: budget.remaining,
    percentSpent: budget.percentSpent,
    variance: budget.amount - budget.spent,
    variancePercent: Math.round(
      ((budget.amount - budget.spent) / budget.amount) * 100
    ),
    status: budget.status,
    period: budget.period,
  };

  res.json({
    success: true,
    data: { comparison },
  });
});

/**
 * Add budget threshold alert
 */
export const addBudgetAlert = asyncHandler(async (req, res) => {
  const { percentage, notifyVia } = req.body;

  const budget = await Budget.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!budget) {
    return res.status(404).json({
      success: false,
      message: 'Budget not found',
    });
  }

  budget.addAlertThreshold(percentage, notifyVia || ['email', 'in_app']);
  await budget.save();

  res.json({
    success: true,
    message: 'Alert threshold added successfully',
    data: { budget },
  });
});

/**
 * Share budget with team
 */
export const shareBudget = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  const budget = await Budget.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!budget) {
    return res.status(404).json({
      success: false,
      message: 'Budget not found',
    });
  }

  budget.shareWith(userId);
  await budget.save();

  res.json({
    success: true,
    message: 'Budget shared successfully',
    data: { budget },
  });
});
