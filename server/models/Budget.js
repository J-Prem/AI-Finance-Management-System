import mongoose from 'mongoose';
import { TRANSACTION_CATEGORIES, BUDGET_PERIODS } from '../config/constants.js';

const budgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Budget name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: TRANSACTION_CATEGORIES,
      required: [true, 'Category is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Budget amount is required'],
      min: [0, 'Amount must be positive'],
    },
    currency: {
      type: String,
      default: 'USD',
    },
    period: {
      type: String,
      enum: BUDGET_PERIODS,
      required: [true, 'Period is required'],
    },
    // Tracking spending
    spent: {
      type: Number,
      default: 0,
    },
    spentByMonth: [
      {
        month: Date,
        amount: Number,
      },
    ],
    // Alerts and thresholds
    alerts: {
      enabled: {
        type: Boolean,
        default: true,
      },
      thresholds: [
        {
          percentage: {
            type: Number,
            min: 0,
            max: 100,
          },
          notifyVia: {
            type: [String],
            enum: ['email', 'push', 'sms', 'in_app'],
            default: ['email', 'in_app'],
          },
        },
      ],
      alertsSent: [
        {
          threshold: Number,
          sentAt: Date,
        },
      ],
    },
    // Recurring budget
    isRecurring: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    // Color for UI
    color: {
      type: String,
      default: '#3B82F6',
    },
    // Goals and rollover
    rolloverUnused: {
      type: Boolean,
      default: false,
    },
    carryForwardAmount: {
      type: Number,
      default: 0,
    },
    // Shared with team members
    isShared: {
      type: Boolean,
      default: false,
    },
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
budgetSchema.index({ userId: 1, category: 1 });
budgetSchema.index({ userId: 1, isActive: 1 });
budgetSchema.index({ teamId: 1 });
budgetSchema.index({ startDate: 1, endDate: 1 });

// Virtual for remaining amount
budgetSchema.virtual('remaining').get(function () {
  return Math.max(0, this.amount - this.spent);
});

// Virtual for percentage spent
budgetSchema.virtual('percentSpent').get(function () {
  if (this.amount === 0) return 0;
  return Math.round((this.spent / this.amount) * 100);
});

// Virtual for status
budgetSchema.virtual('status').get(function () {
  const percent = this.percentSpent;
  if (percent >= 100) return 'exceeded';
  if (percent >= 80) return 'warning';
  if (percent >= 50) return 'on_track';
  return 'under_target';
});

// Method to add spending
budgetSchema.methods.addSpending = function (amount) {
  this.spent += amount;
  return this;
};

// Method to check if threshold exceeded
budgetSchema.methods.checkThresholds = function () {
  if (!this.alerts.enabled) return [];

  const exceededThresholds = [];
  const percent = this.percentSpent;

  for (const threshold of this.alerts.thresholds) {
    if (percent >= threshold.percentage) {
      // Check if already alerted for this threshold
      const alreadyAlerted = this.alerts.alertsSent.some(
        (a) => a.threshold === threshold.percentage &&
               a.sentAt > new Date(Date.now() - 24 * 60 * 60 * 1000) // within last 24 hours
      );

      if (!alreadyAlerted) {
        exceededThresholds.push({
          threshold: threshold.percentage,
          notifyVia: threshold.notifyVia,
          currentPercentage: percent,
        });

        // Record alert
        this.alerts.alertsSent.push({
          threshold: threshold.percentage,
          sentAt: new Date(),
        });
      }
    }
  }

  return exceededThresholds;
};

// Method to reset spending (for recurring budgets)
budgetSchema.methods.resetSpending = function () {
  if (this.rolloverUnused) {
    this.carryForwardAmount = Math.max(0, this.amount - this.spent);
    this.amount = this.carryForwardAmount + this.amount;
  }

  this.spentByMonth.push({
    month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    amount: this.spent,
  });

  this.spent = 0;
  this.alerts.alertsSent = [];

  return this;
};

// Method to add alert threshold
budgetSchema.methods.addAlertThreshold = function (percentage, notifyVia = ['email', 'in_app']) {
  if (!Array.isArray(notifyVia)) {
    notifyVia = [notifyVia];
  }

  const exists = this.alerts.thresholds.find((t) => t.percentage === percentage);
  if (!exists) {
    this.alerts.thresholds.push({ percentage, notifyVia });
  }

  return this;
};

// Method to share with user
budgetSchema.methods.shareWith = function (userId) {
  if (!this.sharedWith.includes(userId)) {
    this.sharedWith.push(userId);
    this.isShared = true;
  }
  return this;
};

// Method to unshare with user
budgetSchema.methods.unshareWith = function (userId) {
  this.sharedWith = this.sharedWith.filter((id) => !id.equals(userId));
  this.isShared = this.sharedWith.length > 0;
  return this;
};

// Statics
budgetSchema.statics.findActiveByUser = function (userId) {
  return this.find({ userId, isActive: true });
};

budgetSchema.statics.findByCategory = function (userId, category) {
  return this.find({ userId, category, isActive: true });
};

budgetSchema.statics.findExceededBudgets = function (userId) {
  return this.find({ userId, isActive: true }).lean().then((budgets) => {
    return budgets.filter((b) => {
      const percent = (b.spent / b.amount) * 100;
      return percent >= 100;
    });
  });
};

export default mongoose.model('Budget', budgetSchema);
