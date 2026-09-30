import mongoose from 'mongoose';

const personalitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true },
    scores: { type: Map, of: Number },
    ranked: [{ label: String, score: Number }],
    features: {
      spendRatio: Number,
      impulseDensity: Number,
      investRatio: Number,
      avgMonthly: Number,
      topCategories: [{ category: String, share: Number }],
      // receipt-derived
      receiptCount: Number,
      uniqueMerchants: Number,
      merchantDiversity: Number,
      premiumShare: Number,
      lateNightShare: Number,
      weekendRatio: Number,
      avgReceipt: Number,
      avgItemsPerReceipt: Number,
      cashlessRatio: Number,
      topMerchants: [{ merchant: String, count: Number }],
    },
    narrative: String,
    insights: [{
      kind: String,
      severity: String,
      title: String,
      detail: String,
    }],
    manualOverride: { type: Boolean, default: false },
  },
  { timestamps: true }
);

personalitySchema.index({ userId: 1, createdAt: -1 });

const PersonalityResult = mongoose.models.PersonalityResult || mongoose.model('PersonalityResult', personalitySchema);
export default PersonalityResult;
