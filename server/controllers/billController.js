import Bill from '../models/Bill.js';
import Receipt from '../models/Receipt.js';
import Transaction from '../models/Transaction.js';
import { detectRecurring } from '../services/billPredictor.js';
import logger from '../utils/logger.js';

// Category mapping from receipt parser → Bill model enum.
const BILL_CATEGORY_MAP = {
  'Bills & Utilities': 'Bills & Utilities',
  'Transportation': 'Transportation',
  'Healthcare': 'Healthcare',
  'Education': 'Education',
  'Entertainment': 'Entertainment',
  'Subscriptions': 'Subscriptions',
  'Home': 'Home',
  'Utilities': 'Bills & Utilities',
};
function mapBillCategory(c) {
  return BILL_CATEGORY_MAP[c] || 'Other';
}

/**
 * Create bill
 */
export const createBill = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, amount, category, frequency, dueDate } = req.body;

    if (!name || amount === undefined || !category || !frequency || dueDate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, amount, category, frequency, dueDate',
      });
    }

    const bill = await Bill.create({
      userId,
      name,
      amount: parseFloat(amount),
      category,
      frequency,
      dueDate: parseInt(dueDate),
      ...req.body,
    });

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: bill,
    });
  } catch (error) {
    logger.error('Error creating bill:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to create bill',
      error: error.message,
    });
  }
};

/**
 * Get all bills for user
 */
export const getBills = async (req, res) => {
  try {
    const userId = req.user._id;
    const { isActive = true, page = 1, limit = 20 } = req.query;

    const query = { userId, isActive: isActive === 'true' };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bills = await Bill.find(query)
      .sort({ nextDueDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Bill.countDocuments(query);

    res.json({
      success: true,
      data: bills,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching bills:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch bills',
      error: error.message,
    });
  }
};

/**
 * Get single bill
 */
export const getBill = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const bill = await Bill.findOne({
      _id: id,
      userId,
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }

    res.json({
      success: true,
      data: bill,
    });
  } catch (error) {
    logger.error('Error fetching bill:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch bill',
      error: error.message,
    });
  }
};

/**
 * Update bill
 */
export const updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const bill = await Bill.findOneAndUpdate(
      { _id: id, userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }

    res.json({
      success: true,
      message: 'Bill updated successfully',
      data: bill,
    });
  } catch (error) {
    logger.error('Error updating bill:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to update bill',
      error: error.message,
    });
  }
};

/**
 * Delete bill
 */
export const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const bill = await Bill.findOneAndUpdate(
      { _id: id, userId },
      { isActive: false },
      { new: true }
    );

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }

    res.json({
      success: true,
      message: 'Bill deleted successfully',
      data: bill,
    });
  } catch (error) {
    logger.error('Error deleting bill:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to delete bill',
      error: error.message,
    });
  }
};

/**
 * Get upcoming bills
 */
export const getUpcomingBills = async (req, res) => {
  try {
    const userId = req.user._id;
    const { daysAhead = 7 } = req.query;

    const bills = await Bill.findUpcoming(userId, parseInt(daysAhead));

    res.json({
      success: true,
      data: bills,
      count: bills.length,
    });
  } catch (error) {
    logger.error('Error fetching upcoming bills:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch upcoming bills',
      error: error.message,
    });
  }
};

/**
 * Get overdue bills
 */
export const getOverdueBills = async (req, res) => {
  try {
    const userId = req.user._id;

    const bills = await Bill.findOverdue(userId);

    res.json({
      success: true,
      data: bills,
      count: bills.length,
    });
  } catch (error) {
    logger.error('Error fetching overdue bills:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch overdue bills',
      error: error.message,
    });
  }
};

/**
 * Mark bill as paid
 */
export const markBillAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod = 'other' } = req.body;
    const userId = req.user._id;

    const bill = await Bill.findOne({
      _id: id,
      userId,
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }

    bill.markAsPaid(paymentMethod);
    await bill.save();

    res.json({
      success: true,
      message: 'Bill marked as paid',
      data: bill,
    });
  } catch (error) {
    logger.error('Error marking bill as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to mark bill as paid',
      error: error.message,
    });
  }
};

/**
 * Get bill calendar (upcoming bills grouped by date)
 */
export const getBillCalendar = async (req, res) => {
  try {
    const userId = req.user._id;
    const { month, year } = req.query;

    const now = new Date();
    const queryMonth = month ? parseInt(month) : now.getMonth() + 1;
    const queryYear = year ? parseInt(year) : now.getFullYear();

    const startDate = new Date(queryYear, queryMonth - 1, 1);
    const endDate = new Date(queryYear, queryMonth, 0, 23, 59, 59);

    const bills = await Bill.find({
      userId,
      isActive: true,
      nextDueDate: {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({ nextDueDate: 1 });

    // Group by date
    const calendar = {};
    bills.forEach((bill) => {
      const dateKey = bill.nextDueDate.toISOString().split('T')[0];
      if (!calendar[dateKey]) {
        calendar[dateKey] = [];
      }
      calendar[dateKey].push({
        billId: bill._id,
        name: bill.name,
        amount: bill.amount,
        currency: bill.currency,
        daysUntilDue: bill.daysUntilDue,
        isOverdue: bill.isOverdue,
      });
    });

    // Calculate monthly totals
    const monthlyTotal = bills.reduce((sum, bill) => sum + bill.amount, 0);

    res.json({
      success: true,
      data: {
        month: queryMonth,
        year: queryYear,
        calendar,
        monthlyTotal,
        billCount: bills.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching bill calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch bill calendar',
      error: error.message,
    });
  }
};

/**
 * Get bill statistics
 */
export const getBillStatistics = async (req, res) => {
  try {
    const userId = req.user._id;

    const bills = await Bill.find({ userId, isActive: true });

    const totalMonthly = await Bill.getTotalMonthlyCost(userId);
    const billsByCategory = {};

    bills.forEach((bill) => {
      if (!billsByCategory[bill.category]) {
        billsByCategory[bill.category] = {
          count: 0,
          total: 0,
        };
      }
      billsByCategory[bill.category].count++;
      billsByCategory[bill.category].total += bill.amount;
    });

    const upcoming = await Bill.findUpcoming(userId, 30);
    const overdue = await Bill.findOverdue(userId);

    res.json({
      success: true,
      data: {
        totalBills: bills.length,
        estimatedMonthlyAmount: Math.round(totalMonthly * 100) / 100,
        billsByCategory,
        upcomingCount: upcoming.length,
        overdueCount: overdue.length,
        overdueTotalAmount: overdue.reduce((sum, b) => sum + b.amount, 0),
      },
    });
  } catch (error) {
    logger.error('Error fetching bill statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch bill statistics',
      error: error.message,
    });
  }
};

/**
 * Derive recurring bills from this user's receipts + transactions.
 *
 * Uses billPredictor.detectRecurring (stable amount, ≥3 repeats) but also flags
 * merchants with as few as 2 occurrences when the receipt cadence is
 * monthly-ish (28–35 day gap). Creates Bill records the user hasn't already
 * recorded (dedup by merchant + rounded amount).
 */
export const deriveBillsFromReceipts = async (req, res) => {
  try {
    const userId = req.user._id;

    const since90 = new Date(Date.now() - 90 * 86400000);
    const since180 = new Date(Date.now() - 180 * 86400000);
    const [receipts, txs, existingBills] = await Promise.all([
      Receipt.find({ userId, createdAt: { $gte: since90 } }).lean(),
      Transaction.find({ userId, type: 'expense', date: { $gte: since180 } }).lean(),
      Bill.find({ userId, isActive: true }).lean(),
    ]);

    // Merge signals from both sources — a receipt is a pseudo-transaction.
    const signals = [
      ...txs.map((t) => ({ merchant: t.merchant || 'Unknown', amount: t.amount, date: t.date, category: t.category })),
      ...receipts.map((r) => ({ merchant: r.merchant || 'Unknown', amount: r.total, date: r.date || r.createdAt, category: r.category })),
    ].filter((s) => s.merchant && s.merchant !== 'Unknown' && s.amount > 0);

    const byMerchant = {};
    for (const s of signals) {
      const k = s.merchant.toLowerCase().trim();
      if (!byMerchant[k]) byMerchant[k] = { merchant: s.merchant, occurrences: [], category: s.category };
      byMerchant[k].occurrences.push(s);
    }

    const proposals = [];
    for (const [, g] of Object.entries(byMerchant)) {
      const occ = g.occurrences.sort((a, b) => new Date(a.date) - new Date(b.date));
      if (occ.length < 2) continue;
      const amounts = occ.map((o) => Number(o.amount));
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((a, b) => a + (b - avg) ** 2, 0) / amounts.length;
      const cv = Math.sqrt(variance) / (avg || 1);
      if (cv > 0.2) continue; // too noisy — probably not a bill

      const gaps = [];
      for (let i = 1; i < occ.length; i++) {
        gaps.push((new Date(occ[i].date) - new Date(occ[i - 1].date)) / 86400000);
      }
      const medGap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 0;

      let frequency = null;
      if (medGap >= 25 && medGap <= 35) frequency = 'monthly';
      else if (medGap >= 6 && medGap <= 8) frequency = 'weekly';
      else if (medGap >= 12 && medGap <= 16) frequency = 'biweekly';
      else if (medGap >= 85 && medGap <= 95) frequency = 'quarterly';
      else if (medGap >= 360) frequency = 'yearly';
      else if (occ.length >= 3) frequency = 'monthly';

      if (!frequency) continue;

      const dup = existingBills.find((b) =>
        b.name.toLowerCase().includes(g.merchant.toLowerCase()) &&
        Math.abs(b.amount - avg) < Math.max(5, avg * 0.05)
      );
      if (dup) continue;

      const lastDate = new Date(occ[occ.length - 1].date);
      const nextDue = new Date(lastDate.getTime() + medGap * 86400000);

      proposals.push({
        userId,
        name: g.merchant,
        amount: +avg.toFixed(2),
        category: mapBillCategory(g.category),
        frequency,
        dueDate: Math.min(nextDue.getDate(), 28),
        nextDueDate: nextDue,
        merchant: g.merchant,
        autopay: { enabled: false },
        notes: `Auto-detected from ${occ.length} receipt/transactions (CV ${(cv * 100).toFixed(1)}%, every ~${Math.round(medGap)}d)`,
        metadata: { source: 'receipt-derived', confidence: +(1 - cv).toFixed(2) },
      });
    }

    const added = [];
    for (const p of proposals) {
      try {
        const { metadata, ...insertable } = p;
        const bill = await Bill.create(insertable);
        added.push({ ...bill.toObject(), metadata });
      } catch (e) {
        logger.warn('[bills] skip proposal', p.name, e.message);
      }
    }

    logger.info(`[bills] derived ${added.length} bills for user ${userId} from ${receipts.length} receipts + ${txs.length} txs`);
    res.json({
      success: true,
      data: {
        added,
        considered: Object.keys(byMerchant).length,
        sources: { receipts: receipts.length, transactions: txs.length },
      },
    });
  } catch (error) {
    logger.error('Error deriving bills from receipts:', error);
    res.status(500).json({ success: false, message: 'Unable to derive bills', error: error.message });
  }
};
