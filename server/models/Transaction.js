import mongoose from 'mongoose';
import { TRANSACTION_CATEGORIES, PAYMENT_METHODS, CURRENCY_CODES } from '../config/constants.js';

const transactionSchema = new mongoose.Schema(
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
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
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
    subcategory: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: [true, 'Type is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'credit_card',
    },
    merchant: {
      type: String,
      trim: true,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    currency: {
      type: String,
      enum: CURRENCY_CODES,
      default: 'USD',
    },
    // ML-based categorization
    aiCategory: {
      category: String,
      subcategory: String,
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0,
      },
    },
    // Anomaly detection
    isAnomaly: {
      type: Boolean,
      default: false,
    },
    anomalyScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    // Recurring transaction
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringPattern: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
      default: null,
    },
    recurringEndDate: {
      type: Date,
      default: null,
    },
    // Location data
    location: {
      city: String,
      state: String,
      country: String,
      latitude: Number,
      longitude: Number,
    },
    // Receipt/attachment
    attachments: {
      type: [String],
      default: [],
    },
    // Invoice/receipt data
    invoiceNumber: String,
    receiptUrl: String,
    // Additional metadata
    metadata: {
      originalCurrency: String,
      exchangeRate: Number,
      notes: String,
      budgetId: mongoose.Schema.Types.ObjectId,
      externalTransactionId: String,
      receiptId: mongoose.Schema.Types.ObjectId,
      provider: String,
      model: String,
      items: [mongoose.Schema.Types.Mixed],
      tax: Number,
      subtotal: Number,
      confidence: Number,
      quality: Number,
      source: {
        type: String,
        enum: ['manual', 'csv_import', 'api', 'bank_sync', 'subscription', 'receipt-ocr'],
        default: 'manual',
      },
    },
    // Reconciliation
    isReconciled: {
      type: Boolean,
      default: false,
    },
    reconciliationDate: Date,
    // Status for pending/pending confirmation transactions
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'confirmed',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, merchant: 1 });
transactionSchema.index({ date: 1 });
transactionSchema.index({ isAnomaly: 1 });
transactionSchema.index({ teamId: 1 });
transactionSchema.index({ 'metadata.source': 1 });
transactionSchema.index({ userId: 1, createdAt: -1 });

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function () {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency,
  }).format(this.amount);
});

// Pre-save middleware
transactionSchema.pre('save', async function (next) {
  // Ensure date is set to beginning of day if not already
  if (this.isNew) {
    this.date.setHours(0, 0, 0, 0);
  }
  next();
});

// Method to mark as anomaly
transactionSchema.methods.markAsAnomaly = function (score = 0.8) {
  this.isAnomaly = true;
  this.anomalyScore = score;
  return this;
};

// Method to set AI categorization
transactionSchema.methods.setAICategory = function (category, subcategory, confidence) {
  this.aiCategory = {
    category,
    subcategory,
    confidence: Math.min(Math.max(confidence, 0), 1),
  };
  return this;
};

// Method to apply AI categorization
transactionSchema.methods.applyAICategory = function () {
  if (this.aiCategory && this.aiCategory.confidence > 0.7) {
    this.category = this.aiCategory.category;
    this.subcategory = this.aiCategory.subcategory;
  }
  return this;
};

// Statics for common queries
transactionSchema.statics.findByDateRange = function (userId, startDate, endDate) {
  return this.find({
    userId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  }).sort({ date: -1 });
};

transactionSchema.statics.findByCategory = function (userId, category) {
  return this.find({ userId, category });
};

transactionSchema.statics.findAnomalies = function (userId) {
  return this.find({ userId, isAnomaly: true }).sort({ anomalyScore: -1 });
};

transactionSchema.statics.findRecurring = function (userId) {
  return this.find({ userId, isRecurring: true });
};

// Aggregate spending by category
transactionSchema.statics.aggregateByCategory = async function (userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId,
        date: { $gte: startDate, $lte: endDate },
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
};

export default mongoose.model('Transaction', transactionSchema);
