import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    plan: {
      type: String,
      enum: ['FREE', 'PRO', 'ENTERPRISE'],
      default: 'FREE',
    },
    stripeCustomerId: {
      type: String,
      sparse: true,
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'past_due', 'cancelled', 'trialing'],
      default: 'inactive',
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    cancelledAt: Date,
    trial: {
      enabled: {
        type: Boolean,
        default: false,
      },
      startDate: Date,
      endDate: Date,
    },
    usage: {
      apiCalls: {
        current: {
          type: Number,
          default: 0,
        },
        limit: Number,
        resetDate: Date,
      },
      transactions: {
        current: {
          type: Number,
          default: 0,
        },
        limit: Number,
        resetDate: Date,
      },
      mlPredictions: {
        current: {
          type: Number,
          default: 0,
        },
        limit: Number,
        resetDate: Date,
      },
    },
    paymentMethod: {
      id: String,
      brand: String,
      last4: String,
      expMonth: Number,
      expYear: Number,
    },
    billingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    invoices: [
      {
        stripeInvoiceId: String,
        amount: Number,
        currency: String,
        status: String,
        invoiceDate: Date,
        dueDate: Date,
        pdfUrl: String,
        description: String,
      },
    ],
    autoRenew: {
      type: Boolean,
      default: true,
    },
    nextBillingDate: Date,
    priorPlanHistory: [
      {
        plan: String,
        startDate: Date,
        endDate: Date,
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
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ stripeCustomerId: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });
subscriptionSchema.index({ status: 1 });

// Virtual for days remaining
subscriptionSchema.virtual('daysRemaining').get(function () {
  if (!this.currentPeriodEnd) return null;
  const now = new Date();
  const end = new Date(this.currentPeriodEnd);
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
});

// Virtual for is active
subscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && (!this.cancelledAt || new Date() < new Date(this.cancelledAt));
});

// Virtual for is trial
subscriptionSchema.virtual('isTrial').get(function () {
  return this.trial.enabled && new Date() < new Date(this.trial.endDate);
});

// Method to activate subscription
subscriptionSchema.methods.activate = function (stripeSubscriptionId, plan, currentPeriodStart, currentPeriodEnd) {
  this.status = 'active';
  this.plan = plan;
  this.stripeSubscriptionId = stripeSubscriptionId;
  this.currentPeriodStart = new Date(currentPeriodStart);
  this.currentPeriodEnd = new Date(currentPeriodEnd);
  this.cancelledAt = null;
  this.cancelAtPeriodEnd = false;
  this.nextBillingDate = new Date(currentPeriodEnd);
  return this;
};

// Method to cancel subscription
subscriptionSchema.methods.cancel = function (immediately = false) {
  if (immediately) {
    this.status = 'cancelled';
    this.cancelledAt = new Date();
  } else {
    this.cancelAtPeriodEnd = true;
  }
  return this;
};

// Method to update payment method
subscriptionSchema.methods.updatePaymentMethod = function (paymentMethodData) {
  this.paymentMethod = {
    id: paymentMethodData.id,
    brand: paymentMethodData.brand,
    last4: paymentMethodData.last4,
    expMonth: paymentMethodData.exp_month,
    expYear: paymentMethodData.exp_year,
  };
  return this;
};

// Method to add invoice
subscriptionSchema.methods.addInvoice = function (invoiceData) {
  this.invoices.push({
    stripeInvoiceId: invoiceData.id,
    amount: invoiceData.amount_paid,
    currency: invoiceData.currency,
    status: invoiceData.status,
    invoiceDate: new Date(invoiceData.created * 1000),
    dueDate: invoiceData.due_date ? new Date(invoiceData.due_date * 1000) : null,
    pdfUrl: invoiceData.pdf,
    description: invoiceData.description,
  });
  return this;
};

// Method to check usage limits
subscriptionSchema.methods.checkApiCallLimit = function () {
  if (!this.usage.apiCalls.limit) return true; // unlimited
  return this.usage.apiCalls.current < this.usage.apiCalls.limit;
};

subscriptionSchema.methods.checkTransactionLimit = function () {
  if (!this.usage.transactions.limit) return true; // unlimited
  return this.usage.transactions.current < this.usage.transactions.limit;
};

subscriptionSchema.methods.checkMlPredictionLimit = function () {
  if (!this.usage.mlPredictions.limit) return true; // unlimited
  return this.usage.mlPredictions.current < this.usage.mlPredictions.limit;
};

// Method to increment usage
subscriptionSchema.methods.incrementApiCalls = function (count = 1) {
  this.usage.apiCalls.current += count;
  return this;
};

subscriptionSchema.methods.incrementTransactions = function (count = 1) {
  this.usage.transactions.current += count;
  return this;
};

subscriptionSchema.methods.incrementMlPredictions = function (count = 1) {
  this.usage.mlPredictions.current += count;
  return this;
};

// Method to reset usage counters (monthly)
subscriptionSchema.methods.resetUsageCounters = function () {
  this.usage.apiCalls.current = 0;
  this.usage.apiCalls.resetDate = new Date();

  this.usage.transactions.current = 0;
  this.usage.transactions.resetDate = new Date();

  this.usage.mlPredictions.current = 0;
  this.usage.mlPredictions.resetDate = new Date();

  return this;
};

// Method to upgrade plan
subscriptionSchema.methods.upgradePlan = function (newPlan, newLimits) {
  // Store prior plan history
  this.priorPlanHistory.push({
    plan: this.plan,
    startDate: this.currentPeriodStart,
    endDate: new Date(),
  });

  this.plan = newPlan;
  this.usage.apiCalls.limit = newLimits.apiCallsPerDay;
  this.usage.transactions.limit = newLimits.transactionsPerMonth;
  this.usage.mlPredictions.limit = newLimits.mlPredictionsPerMonth;

  return this;
};

// Statics
subscriptionSchema.statics.findByUser = function (userId) {
  return this.findOne({ userId });
};

subscriptionSchema.statics.findActiveSubscriptions = function () {
  return this.find({ status: 'active' });
};

subscriptionSchema.statics.findExpiredTrials = function () {
  return this.find({
    'trial.enabled': true,
    'trial.endDate': { $lt: new Date() },
  });
};

export default mongoose.model('Subscription', subscriptionSchema);
