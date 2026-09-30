import mongoose from 'mongoose';

const investmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    type: {
      type: String,
      enum: ['stock', 'mutual_fund', 'crypto', 'gold', 'fd', 'ppf', 'bond'],
      required: [true, 'Investment type is required'],
    },
    name: {
      type: String,
      required: [true, 'Investment name is required'],
      trim: true,
    },
    symbol: {
      type: String,
      required: [true, 'Symbol/Code is required'],
      trim: true,
      uppercase: true,
    },
    schemeCode: {
      type: String,
      default: null,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity must be positive'],
    },
    buyPrice: {
      type: Number,
      required: [true, 'Buy price is required'],
      min: [0, 'Buy price must be positive'],
    },
    buyDate: {
      type: Date,
      required: [true, 'Buy date is required'],
    },
    currentPrice: {
      type: Number,
      default: 0,
    },
    lastPriceUpdate: {
      type: Date,
      default: null,
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF'],
      default: 'INR',
    },
    // Calculated fields
    totalCost: {
      type: Number,
      default: 0,
    },
    currentValue: {
      type: Number,
      default: 0,
    },
    pnl: {
      type: Number,
      default: 0,
    },
    pnlPercentage: {
      type: Number,
      default: 0,
    },
    // Additional details
    notes: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    portfolio: {
      type: String,
      default: null,
    },
    broker: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sellDate: {
      type: Date,
      default: null,
    },
    sellPrice: {
      type: Number,
      default: null,
    },
    // Metadata
    externalId: String,
    source: {
      type: String,
      enum: ['manual', 'broker_api', 'import'],
      default: 'manual',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
investmentSchema.index({ userId: 1, type: 1 });
investmentSchema.index({ userId: 1, isActive: 1 });
investmentSchema.index({ userId: 1, createdAt: -1 });
investmentSchema.index({ symbol: 1 });

// Virtual for formatted values
investmentSchema.virtual('formattedCost').get(function () {
  return (this.quantity * this.buyPrice).toFixed(2);
});

investmentSchema.virtual('formattedCurrentValue').get(function () {
  return this.currentValue.toFixed(2);
});

// Pre-save middleware to calculate fields
investmentSchema.pre('save', function (next) {
  this.totalCost = this.quantity * this.buyPrice;
  this.currentValue = this.quantity * (this.currentPrice || this.buyPrice);
  this.pnl = this.currentValue - this.totalCost;
  this.pnlPercentage =
    this.totalCost > 0 ? (this.pnl / this.totalCost) * 100 : 0;
  next();
});

// Method to update price
investmentSchema.methods.updatePrice = function (newPrice) {
  this.currentPrice = newPrice;
  this.lastPriceUpdate = new Date();
  return this;
};

// Method to sell investment
investmentSchema.methods.sell = function (sellQuantity, sellPrice) {
  if (sellQuantity > this.quantity) {
    throw new Error('Cannot sell more than owned quantity');
  }
  this.quantity -= sellQuantity;
  this.sellDate = new Date();
  this.sellPrice = sellPrice;
  return this;
};

// Statics for common queries
investmentSchema.statics.findByType = function (userId, type) {
  return this.find({ userId, type, isActive: true });
};

investmentSchema.statics.findBySymbol = function (userId, symbol) {
  return this.find({ userId, symbol, isActive: true });
};

investmentSchema.statics.getPortfolioSummary = async function (userId) {
  return this.aggregate([
    { $match: { userId, isActive: true } },
    {
      $group: {
        _id: null,
        totalCost: { $sum: { $multiply: ['$quantity', '$buyPrice'] } },
        totalValue: { $sum: '$currentValue' },
        totalPnL: {
          $sum: {
            $subtract: [
              '$currentValue',
              { $multiply: ['$quantity', '$buyPrice'] },
            ],
          },
        },
        investmentCount: { $sum: 1 },
      },
    },
  ]);
};

investmentSchema.statics.getByTypeBreakdown = async function (userId) {
  return this.aggregate([
    { $match: { userId, isActive: true } },
    {
      $group: {
        _id: '$type',
        totalValue: { $sum: '$currentValue' },
        count: { $sum: 1 },
        investments: { $push: { name: '$name', value: '$currentValue' } },
      },
    },
  ]);
};

export default mongoose.model('Investment', investmentSchema);
