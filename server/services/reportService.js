import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

class ReportService {
  /**
   * Generate monthly spending report
   */
  async generateMonthlyReport(userId, month, year) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Get all transactions for the month
      const transactions = await Transaction.findByDateRange(
        userId,
        startDate,
        endDate
      );

      // Aggregate by category
      const categoryBreakdown = await Transaction.aggregateByCategory(
        userId,
        startDate,
        endDate
      );

      // Calculate totals
      const income = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const netSavings = income - expenses;

      // Top merchants
      const merchantSpending = {};
      transactions.forEach((t) => {
        if (t.merchant) {
          merchantSpending[t.merchant] =
            (merchantSpending[t.merchant] || 0) + t.amount;
        }
      });

      const topMerchants = Object.entries(merchantSpending)
        .map(([merchant, amount]) => ({ merchant, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      // Anomalies
      const anomalies = transactions.filter((t) => t.isAnomaly);

      const report = {
        userId,
        period: {
          month,
          year,
          startDate,
          endDate,
        },
        summary: {
          totalIncome: income,
          totalExpenses: expenses,
          netSavings,
          savingsRate: income > 0 ? ((netSavings / income) * 100).toFixed(2) : 0,
          transactionCount: transactions.length,
          anomalyCount: anomalies.length,
        },
        categoryBreakdown: categoryBreakdown.map((cat) => ({
          category: cat._id,
          amount: cat.total,
          transactionCount: cat.count,
          percentage: ((cat.total / expenses) * 100).toFixed(2),
        })),
        topMerchants,
        anomalies: anomalies.map((a) => ({
          date: a.date,
          description: a.description,
          amount: a.amount,
          category: a.category,
          anomalyScore: a.anomalyScore,
        })),
        generatedAt: new Date(),
      };

      return report;
    } catch (error) {
      logger.error(`Error generating monthly report for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate annual tax report
   */
  async generateTaxReport(userId, year) {
    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      // Get all transactions for the year
      const transactions = await Transaction.findByDateRange(
        userId,
        startDate,
        endDate
      );

      // Filter relevant categories for taxes
      const capitalGains = transactions.filter(
        (t) => t.category === 'Investment' && t.type === 'income'
      );

      const businessIncome = transactions.filter(
        (t) => t.category === 'Income' && t.subcategory === 'Business'
      );

      const taxableCharges = transactions.filter(
        (t) =>
          t.category === 'Financial Charges' &&
          t.subcategory === 'Interest'
      );

      const donations = transactions.filter(
        (t) =>
          t.category === 'Gifts & Donations' &&
          t.subcategory === 'Charity'
      );

      // Monthly breakdown for estimated tax liability
      const monthlyTotals = {};
      for (let m = 0; m < 12; m++) {
        const monthStart = new Date(year, m, 1);
        const monthEnd = new Date(year, m + 1, 0, 23, 59, 59);

        const monthTransactions = transactions.filter(
          (t) => t.date >= monthStart && t.date <= monthEnd
        );

        monthlyTotals[m + 1] = monthTransactions
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
      }

      const report = {
        userId,
        year,
        period: {
          startDate,
          endDate,
        },
        income: {
          capitalGains: capitalGains.reduce((sum, t) => sum + t.amount, 0),
          businessIncome: businessIncome.reduce((sum, t) => sum + t.amount, 0),
          totalIncome: transactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0),
        },
        deductions: {
          interestPaid: taxableCharges.reduce((sum, t) => sum + t.amount, 0),
          charityDonations: donations.reduce((sum, t) => sum + t.amount, 0),
          totalDeductions:
            taxableCharges.reduce((sum, t) => sum + t.amount, 0) +
            donations.reduce((sum, t) => sum + t.amount, 0),
        },
        monthlyBreakdown: monthlyTotals,
        estimatedTaxability: this._estimateTaxability(
          transactions,
          year
        ),
        generatedAt: new Date(),
      };

      return report;
    } catch (error) {
      logger.error(`Error generating tax report for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate budget vs actual report
   */
  async generateBudgetReport(userId) {
    try {
      const budgets = await Budget.find({ userId, isActive: true });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const budgetReport = {
        userId,
        period: {
          startDate: startOfMonth,
          endDate: endOfMonth,
        },
        budgets: [],
        totalBudgeted: 0,
        totalSpent: 0,
        overallUtilization: 0,
        summary: {
          onTrack: 0,
          warning: 0,
          exceeded: 0,
        },
      };

      for (const budget of budgets) {
        const transactions = await Transaction.find({
          userId,
          category: budget.category,
          date: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
          type: 'expense',
        });

        const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
        const utilization = (spent / budget.amount) * 100;

        let status = 'on-track';
        if (utilization >= 100) {
          status = 'exceeded';
          budgetReport.summary.exceeded++;
        } else if (utilization >= 75) {
          status = 'warning';
          budgetReport.summary.warning++;
        } else {
          budgetReport.summary.onTrack++;
        }

        budgetReport.budgets.push({
          category: budget.category,
          budgeted: budget.amount,
          spent,
          remaining: Math.max(0, budget.amount - spent),
          utilization: Math.round(utilization * 100) / 100,
          status,
          transactions: transactions.map((t) => ({
            date: t.date,
            description: t.description,
            amount: t.amount,
          })),
        });

        budgetReport.totalBudgeted += budget.amount;
        budgetReport.totalSpent += spent;
      }

      budgetReport.overallUtilization =
        Math.round(
          (budgetReport.totalSpent / budgetReport.totalBudgeted) * 100 * 100
        ) / 100;

      return budgetReport;
    } catch (error) {
      logger.error(`Error generating budget report for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate custom date range report
   */
  async generateCustomReport(userId, startDate, endDate) {
    try {
      const transactions = await Transaction.findByDateRange(
        userId,
        startDate,
        endDate
      );

      const categoryBreakdown = await Transaction.aggregate([
        {
          $match: {
            userId,
            date: {
              $gte: startDate,
              $lte: endDate,
            },
            type: 'expense',
          },
        },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]);

      const income = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        userId,
        period: {
          startDate,
          endDate,
          days: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
        },
        summary: {
          totalIncome: income,
          totalExpenses: expenses,
          netSavings: income - expenses,
          transactionCount: transactions.length,
          averageTransaction: (expenses / transactions.filter((t) => t.type === 'expense').length).toFixed(2),
        },
        categoryBreakdown,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Error generating custom report for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Estimate tax liability
   * @private
   */
  _estimateTaxability(transactions, year) {
    const incomeTransactions = transactions.filter((t) => t.type === 'income');
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Simple tax estimation (should be customized based on jurisdiction)
    let taxableIncome = totalIncome;

    // Standard deduction (example: 20% of income)
    const standardDeduction = totalIncome * 0.2;
    taxableIncome = Math.max(0, taxableIncome - standardDeduction);

    // Estimated tax (example: 20% rate)
    const estimatedTax = taxableIncome * 0.2;

    return {
      grossIncome: totalIncome,
      standardDeduction,
      taxableIncome,
      estimatedTaxRate: '20%',
      estimatedTaxLiability: Math.round(estimatedTax * 100) / 100,
      disclaimer:
        'This is an estimate. Consult with a tax professional for accurate calculations.',
    };
  }
}

export default new ReportService();
