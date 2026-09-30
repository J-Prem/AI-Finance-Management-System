import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import mlProxyService from '../services/mlProxyService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { incrementTransactionCount } from '../middleware/usageTracker.js';
import logger from '../utils/logger.js';

/**
 * Create transaction
 */
export const createTransaction = asyncHandler(async (req, res) => {
  const { amount, category, type, date, description, paymentMethod, merchant, currency, tags } = req.body;

  const transaction = await Transaction.create({
    userId: req.user._id,
    teamId: req.user.teamId || null,
    amount,
    category,
    type,
    date: date ? new Date(date) : new Date(),
    description: description || '',
    paymentMethod: paymentMethod || 'credit_card',
    merchant: merchant || null,
    currency: currency || 'USD',
    tags: tags || [],
  });

  // Try to get AI categorization
  try {
    const aiCategorization = await mlProxyService.categorizeTransaction({
      description,
      amount,
      merchant,
      date,
      category,
    });

    if (aiCategorization && aiCategorization.confidence > 0.7) {
      transaction.setAICategory(
        aiCategorization.category,
        aiCategorization.subcategory,
        aiCategorization.confidence
      );
    }
  } catch (error) {
    logger.warn('AI categorization failed:', error.message);
  }

  await transaction.save();

  // Increment transaction count
  await incrementTransactionCount(req.user._id);

  // Update budget if applicable
  const budget = await Budget.findOne({
    userId: req.user._id,
    category,
    isActive: true,
  });

  if (budget && type === 'expense') {
    budget.addSpending(amount);
    const thresholds = budget.checkThresholds();
    await budget.save();

    if (thresholds.length > 0) {
      // TODO: Send budget alert notifications
    }
  }

  res.status(201).json({
    success: true,
    message: 'Transaction created successfully',
    data: {
      transaction,
    },
  });
});

/**
 * Get all transactions
 */
export const getTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, category, type, startDate, endDate, sortBy = 'date', order = 'desc', search } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const query = { userId: req.user._id };

  if (category) {
    query.category = category;
  }

  if (type) {
    query.type = type;
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate);
    }
    if (endDate) {
      query.date.$lte = new Date(endDate);
    }
  }

  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { merchant: { $regex: search, $options: 'i' } },
    ];
  }

  const sortOrder = order === 'asc' ? 1 : -1;
  const sortObj = { [sortBy]: sortOrder };

  const total = await Transaction.countDocuments(query);
  const transactions = await Transaction.find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
});

/**
 * Get single transaction
 */
export const getTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    });
  }

  res.json({
    success: true,
    data: {
      transaction,
    },
  });
});

/**
 * Update transaction
 */
export const updateTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    });
  }

  // Update fields
  Object.assign(transaction, req.body);
  await transaction.save();

  res.json({
    success: true,
    message: 'Transaction updated successfully',
    data: {
      transaction,
    },
  });
});

/**
 * Delete transaction
 */
export const deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    });
  }

  // Update budget
  if (transaction.type === 'expense') {
    const budget = await Budget.findOne({
      userId: req.user._id,
      category: transaction.category,
    });

    if (budget) {
      budget.spent = Math.max(0, budget.spent - transaction.amount);
      await budget.save();
    }
  }

  await Transaction.deleteOne({ _id: transaction._id });

  res.json({
    success: true,
    message: 'Transaction deleted successfully',
  });
});

/**
 * Get spending summary
 */
export const getSpendingSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const query = { userId: req.user._id };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate);
    }
    if (endDate) {
      query.date.$lte = new Date(endDate);
    }
  }

  const transactions = await Transaction.find(query);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const net = totalIncome - totalExpense;

  const byCategory = {};
  transactions.forEach((t) => {
    if (!byCategory[t.category]) {
      byCategory[t.category] = 0;
    }
    byCategory[t.category] += t.amount;
  });

  res.json({
    success: true,
    data: {
      summary: {
        totalIncome,
        totalExpense,
        net,
        savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
        transactionCount: transactions.length,
        byCategory,
      },
    },
  });
});

/**
 * Get category breakdown
 */
export const getCategoryBreakdown = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const query = {
    userId: req.user._id,
    type: 'expense',
  };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate);
    }
    if (endDate) {
      query.date.$lte = new Date(endDate);
    }
  }

  const breakdown = await Transaction.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        percentage: { $sum: '$amount' },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const totalSpent = breakdown.reduce((sum, cat) => sum + cat.total, 0);

  const result = breakdown.map((cat) => ({
    category: cat._id,
    total: cat.total,
    count: cat.count,
    percentage: totalSpent > 0 ? (cat.total / totalSpent) * 100 : 0,
  }));

  res.json({
    success: true,
    data: {
      breakdown: result,
      total: totalSpent,
    },
  });
});

/**
 * Bulk import transactions
 */
export const bulkImportTransactions = asyncHandler(async (req, res) => {
  const { transactions } = req.body;

  const created = [];
  const errors = [];

  for (let i = 0; i < transactions.length; i++) {
    try {
      const t = transactions[i];
      const transaction = await Transaction.create({
        userId: req.user._id,
        teamId: req.user.teamId || null,
        amount: t.amount,
        category: t.category,
        type: t.type,
        date: new Date(t.date),
        description: t.description || '',
        paymentMethod: t.paymentMethod || 'credit_card',
        merchant: t.merchant || null,
        currency: t.currency || 'USD',
        metadata: {
          source: 'csv_import',
        },
      });

      created.push(transaction._id);
    } catch (error) {
      errors.push({
        row: i + 1,
        error: error.message,
      });
    }
  }

  // Increment transaction count
  if (created.length > 0) {
    await incrementTransactionCount(req.user._id, created.length);
  }

  res.status(201).json({
    success: true,
    message: `${created.length} transactions imported successfully`,
    data: {
      imported: created.length,
      errors: errors.length,
      errorDetails: errors,
    },
  });
});

/**
 * Export transactions
 */
export const exportTransactions = asyncHandler(async (req, res) => {
  const { format = 'csv', startDate, endDate, category } = req.query;

  const query = { userId: req.user._id };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate);
    }
    if (endDate) {
      query.date.$lte = new Date(endDate);
    }
  }

  if (category) {
    query.category = category;
  }

  const transactions = await Transaction.find(query).sort({ date: -1 });

  if (format === 'json') {
    return res.json({
      success: true,
      data: transactions,
    });
  }

  if (format === 'csv') {
    const csv = transactionsToCsv(transactions);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    return res.send(csv);
  }

  res.status(400).json({
    success: false,
    message: 'Unsupported export format',
  });
});

/**
 * Convert transactions to CSV
 */
function transactionsToCsv(transactions) {
  const headers = [
    'Date',
    'Description',
    'Category',
    'Type',
    'Amount',
    'Merchant',
    'Payment Method',
  ];

  const rows = transactions.map((t) => [
    new Date(t.date).toLocaleDateString(),
    t.description,
    t.category,
    t.type,
    t.amount,
    t.merchant || '',
    t.paymentMethod,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell))
        .join(',')
    ),
  ].join('\n');

  return csv;
}
