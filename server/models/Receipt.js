import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    merchant: { type: String, default: 'Unknown' },
    date: { type: String },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    items: [{ name: String, amount: Number, quantity: Number }],
    category: { type: String, default: 'Uncategorized' },
    categorySource: { type: String, default: 'keyword' }, // keyword | hf-zeroshot | manual
    categoryScore: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    provider: { type: String },
    model: { type: String, default: null },
    quality: { type: Number, default: 0 },
    dims: { width: Number, height: Number, format: String },
    imageProcessing: {
      originalBytes: Number,
      processedBytes: Number,
      enhanced: Boolean,
      mimeValid: Boolean,
      mimeReason: String,
    },
    tax: { type: Number, default: null },
    subtotal: { type: Number, default: null },
    paymentMethod: { type: String, default: null },
    raw: { type: String },
    rawText: { type: String },
    // Persisted image so receipts don't "fade" after a session. Stored as a
    // data URL thumbnail (capped <= ~200 KB) so MongoDB stays lean; full-res
    // copies go to /server/storage/receipts (best-effort) and thumbnailUrl is
    // what the UI displays.
    imageMime: { type: String, default: null },
    thumbnailDataUrl: { type: String, default: null },
    storagePath: { type: String, default: null }, // relative path on disk if saved
    imageBytes: { type: Number, default: 0 },
    personalitySnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalityResult' },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    errors: [{ type: String }],
    tags: [{ type: String }],
    notes: { type: String },
  },
  { timestamps: true }
);

receiptSchema.index({ userId: 1, createdAt: -1 });
receiptSchema.index({ userId: 1, merchant: 1 });
receiptSchema.index({ userId: 1, category: 1 });

const Receipt = mongoose.models.Receipt || mongoose.model('Receipt', receiptSchema);
export default Receipt;
