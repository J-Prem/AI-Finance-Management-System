import mongoose from 'mongoose';

const billSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    name: {
      type: String,
      required: [true, 'Bill name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF'],
      default: 'INR',
    },
    category: {
      type: String,
      enum: [
        'Bills & Utilities',
        'Transportation',
        'Subscriptions',
        'Healthcare',
        'Education',
        'Entertainment',
        'Home',
        'Other',
      ],
      required: [true, 'Category is required'],
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
      required: [true, 'Frequency is required'],
    },
    dueDate: {
      type: Number, // Day of month (1-31) or day of week
      required: [true, 'Due date is required'],
    },
    nextDueDate: {
      type: Date,
      required: [true, 'Next due date is required'],
    },
    lastPaidDate: {
      type: Date,
      default: null,
    },
    merchant: {
      type: String,
      default: null,
    },
    remindDaysBefore: {
      type: Number,
      default: 3,
      min: 0,
      max: 30,
    },
    autopay: {
      enabled: {
        type: Boolean,
        default: false,
      },
      method: {
        type: String,
        enum: ['bank_transfer', 'card', 'upi', 'other'],
        default: null,
      },
      accountId: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    // Payment history
    paymentHistory: [
      {
        date: Date,
        amount: Number,
        method: String,
        status: {
          type: String,
          enum: ['success', 'failed', 'pending'],
          default: 'success',
        },
        reference: String,
      },
    ],
    // Linked account/subscription
    linkedTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    linkedSubscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
    },
    // Alerts
    alertsSent: [
      {
        type: {
          type: String,
          enum: ['due_soon', 'overdue', 'paid'],
        },
        sentAt: Date,
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
billSchema.index({ userId: 1, isActive: 1 });
billSchema.index({ userId: 1, nextDueDate: 1 });
billSchema.index({ userId: 1, category: 1 });
billSchema.index({ nextDueDate: 1 });

// Virtual for formatted amount
billSchema.virtual('formattedAmount').get(function () {
  return `${this.currency} ${this.amount.toFixed(2)}`;
});

// Virtual for days until due
billSchema.virtual('daysUntilDue').get(function () {
  const now = new Date();
  const diff = this.nextDueDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for is overdue
billSchema.virtual('isOverdue').get(function () {
  return this.daysUntilDue < 0;
});

// Pre-save middleware
//
// Only derive `nextDueDate` when the caller hasn't supplied one.
// Previously every save (including the initial create) overwrote the
// user's chosen due date with "today + N", which broke quarterly /
// yearly bills (a user picking 15-Aug for a quarterly bill ended up
// stored as 3 months from creation, day clamped to 28). Now we respect
// the explicit value when present, only filling it in if missing.
billSchema.pre('save', async function (next) {
  const needsCompute =
    !this.nextDueDate ||
    (this.isModified('frequency') && !this.isModified('nextDueDate')) ||
    (this.isModified('dueDate') && !this.isModified('nextDueDate'));
  if (needsCompute) {
    this.nextDueDate = this._calculateNextDueDate();
  }
  next();
});

// Days-in-month helper. Avoids the old `Math.min(dueDate, 28)` which
// forced every month into a 28-day window, breaking 31-day months
// (Jan, Mar, May, etc.) and 30-day months (Apr, Jun, etc.).
function daysInMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

// Build a Date for `year/monthIdx/day`, clamping the day to the actual
// month length so 31-Feb wraps to 28-Feb instead of rolling into March.
function safeDate(year, monthIdx, day) {
  const last = daysInMonth(year, monthIdx);
  const d = Math.max(1, Math.min(Number(day) || 1, last));
  return new Date(year, monthIdx, d);
}

// Method to calculate next due date.
//
// `advance` is true when called after a payment: we step exactly one
// period forward from the previous nextDueDate so missed cycles are
// still tracked. When `advance` is false (initial creation, frequency
// edits) we instead pick the first dueDate-day occurrence on/after
// today, which is what the user expects when they configure a bill.
//
// Day-of-month bills (monthly/quarterly/yearly) are anchored to
// `this.dueDate` and clamped to the actual length of each month, so a
// "31st" bill lands on Feb 28/29, Apr 30, etc.
billSchema.methods._calculateNextDueDate = function (advance = false) {
  const now = new Date();
  const prior = this.nextDueDate ? new Date(this.nextDueDate) : null;

  switch (this.frequency) {
    case 'daily': {
      const base = advance && prior ? prior : now;
      const d = new Date(base);
      d.setDate(d.getDate() + 1);
      return d;
    }
    case 'weekly':
    case 'biweekly': {
      const step = this.frequency === 'weekly' ? 7 : 14;
      if (advance && prior) {
        const d = new Date(prior); d.setDate(d.getDate() + step); return d;
      }
      if (prior && prior > now) return prior;
      const d = new Date(now); d.setDate(d.getDate() + step); return d;
    }
    case 'monthly': {
      if (advance && prior) {
        return safeDate(prior.getFullYear(), prior.getMonth() + 1, this.dueDate);
      }
      let y = now.getFullYear(), m = now.getMonth();
      let candidate = safeDate(y, m, this.dueDate);
      if (candidate <= now) candidate = safeDate(y, m + 1, this.dueDate);
      return candidate;
    }
    case 'quarterly': {
      // 3-month cadence anchored to the bill's day-of-month.
      if (advance && prior) {
        return safeDate(prior.getFullYear(), prior.getMonth() + 3, this.dueDate);
      }
      const baseMonth = prior ? prior.getMonth() : now.getMonth();
      let y = now.getFullYear(), m = baseMonth;
      let candidate = safeDate(y, m, this.dueDate);
      while (candidate <= now) {
        m += 3;
        candidate = safeDate(y, m, this.dueDate);
      }
      return candidate;
    }
    case 'yearly': {
      if (advance && prior) {
        return safeDate(prior.getFullYear() + 1, prior.getMonth(), this.dueDate);
      }
      const baseMonth = prior ? prior.getMonth() : now.getMonth();
      let y = now.getFullYear();
      let candidate = safeDate(y, baseMonth, this.dueDate);
      while (candidate <= now) {
        y += 1;
        candidate = safeDate(y, baseMonth, this.dueDate);
      }
      return candidate;
    }
    default:
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
};

// Method to mark as paid — advances nextDueDate by exactly one period
// from the previous nextDueDate (so a missed cycle is still tracked
// correctly), instead of pinning it to "now".
billSchema.methods.markAsPaid = function (paymentMethod = 'other') {
  const paidAt = new Date();
  this.lastPaidDate = paidAt;
  this.paymentHistory.push({
    date: paidAt,
    amount: this.amount,
    method: paymentMethod,
    status: 'success',
  });

  // Step one period forward from the previous nextDueDate so missed
  // cycles are tracked correctly (`advance: true`).
  this.nextDueDate = this._calculateNextDueDate(true);

  return this;
};

// Method to add alert
billSchema.methods.addAlert = function (alertType) {
  this.alertsSent.push({
    type: alertType,
    sentAt: new Date(),
  });
  return this;
};

// Method to check if alert already sent
billSchema.methods.hasAlertBeenSent = function (alertType) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return this.alertsSent.some(
    (alert) =>
      alert.type === alertType &&
      alert.sentAt.getTime() >= today.getTime()
  );
};

// Statics
billSchema.statics.findUpcoming = function (userId, daysAhead = 7) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    userId,
    isActive: true,
    nextDueDate: {
      $gte: now,
      $lte: futureDate,
    },
  }).sort({ nextDueDate: 1 });
};

billSchema.statics.findOverdue = function (userId) {
  return this.find({
    userId,
    isActive: true,
    nextDueDate: {
      $lt: new Date(),
    },
  }).sort({ nextDueDate: 1 });
};

billSchema.statics.findByCategory = function (userId, category) {
  return this.find({ userId, category, isActive: true });
};

billSchema.statics.getTotalMonthlyCost = async function (userId) {
  const bills = await this.find({ userId, isActive: true });

  let totalMonthly = 0;
  for (const bill of bills) {
    switch (bill.frequency) {
      case 'daily':
        totalMonthly += bill.amount * 30;
        break;
      case 'weekly':
        totalMonthly += bill.amount * 4.33;
        break;
      case 'biweekly':
        totalMonthly += bill.amount * 2.17;
        break;
      case 'monthly':
        totalMonthly += bill.amount;
        break;
      case 'quarterly':
        totalMonthly += bill.amount / 3;
        break;
      case 'yearly':
        totalMonthly += bill.amount / 12;
        break;
    }
  }

  return Math.round(totalMonthly * 100) / 100;
};

export default mongoose.model('Bill', billSchema);
