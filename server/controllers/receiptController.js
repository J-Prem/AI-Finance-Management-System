/**
 * Receipt upload + parsing + conversion to a transaction — persists to MongoDB.
 *
 * Endpoints:
 *   POST   /api/receipts/upload            — parse & persist (image or text)
 *   GET    /api/receipts                   — list recent 100 for user
 *   GET    /api/receipts/:id               — fetch one
 *   DELETE /api/receipts/:id               — delete receipt + linked transaction
 *   PATCH  /api/receipts/:id/category      — manual category override (re-runs analytics)
 *   POST   /api/receipts/:id/retag         — attach tags / notes
 *   GET    /api/receipts/stats             — aggregate: top merchants, totals by category
 */
import { parseReceipt } from '../services/receiptParser.js';
import { classifyPersonality } from '../services/personalityClassifier.js';
import Receipt from '../models/Receipt.js';
import Transaction from '../models/Transaction.js';
import Investment from '../models/Investment.js';
import PersonalityResult from '../models/PersonalityResult.js';
import { TRANSACTION_CATEGORIES } from '../config/constants.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

// Absolute-ish root for persisted originals — created lazily on first upload.
const STORAGE_ROOT = process.env.RECEIPT_STORAGE_DIR
  ? path.resolve(process.env.RECEIPT_STORAGE_DIR)
  : path.resolve(process.cwd(), 'storage', 'receipts');

// Cap the MongoDB-embedded thumbnail to ~200 KB so receipts don't bloat the DB.
const THUMB_MAX_BYTES = 200 * 1024;

async function persistReceiptImage(userId, imageBase64, mimeType) {
  if (!imageBase64) return { thumbnailDataUrl: null, storagePath: null, imageBytes: 0, imageMime: null };
  const raw = imageBase64.replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  const imageBytes = buf.byteLength;
  const mime = mimeType || 'image/jpeg';

  // Best-effort full-res persistence — never fail the upload if FS write doesn't work.
  let storagePath = null;
  try {
    const dir = path.join(STORAGE_ROOT, String(userId));
    await fs.mkdir(dir, { recursive: true });
    const ext = (mime.split('/')[1] || 'jpg').split(';')[0];
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const full = path.join(dir, filename);
    await fs.writeFile(full, buf);
    storagePath = path.relative(process.cwd(), full);
  } catch (e) {
    logger.warn('[receipt] full-res persist skipped:', e.message);
  }

  // Thumbnail = same bytes if small, else just a truncated data URL so listings show *something*.
  // (We avoid pulling in sharp to keep the install light; the browser handles the preview.)
  const thumbBuf = buf.byteLength <= THUMB_MAX_BYTES ? buf : buf.subarray(0, THUMB_MAX_BYTES);
  const thumbnailDataUrl = `data:${mime};base64,${thumbBuf.toString('base64')}`;

  return { thumbnailDataUrl, storagePath, imageBytes, imageMime: mime };
}

// Map parser categories to the Transaction model enum
const CATEGORY_MAP = {
  Groceries: 'Food & Dining',
  Dining: 'Food & Dining',
  Transport: 'Transportation',
  Utilities: 'Bills & Utilities',
  Entertainment: 'Entertainment',
  Shopping: 'Shopping',
  Healthcare: 'Healthcare',
  Subscriptions: 'Bills & Utilities',
  Travel: 'Travel',
  Education: 'Education',
  Other: 'Uncategorized',
};

function mapCategory(cat) {
  if (TRANSACTION_CATEGORIES.includes(cat)) return cat;
  return CATEGORY_MAP[cat] || 'Uncategorized';
}

function mapPaymentMethod(method = '') {
  const m = String(method).toLowerCase();
  if (m.includes('cash')) return 'cash';
  if (m.includes('upi') || m.includes('bank') || m.includes('transfer')) return 'bank_transfer';
  if (m.includes('debit')) return 'debit_card';
  if (m.includes('paypal')) return 'paypal';
  if (m.includes('apple')) return 'apple_pay';
  if (m.includes('google')) return 'google_pay';
  if (m.includes('check') || m.includes('cheque')) return 'check';
  return 'credit_card';
}

async function createPersonalitySnapshot(userId) {
  const [transactions, investments, receipts] = await Promise.all([
    Transaction.find({ userId }).lean(),
    Investment.find({ userId }).lean(),
    Receipt.find({ userId }).lean(),
  ]);
  if (!transactions.length && !receipts.length) return null;
  const normInv = investments.map((i) => ({
    qty: i.quantity || i.qty || 0,
    lastPrice: i.currentPrice || i.lastPrice || i.averageCost || 0,
  }));
  const result = classifyPersonality({
    transactions,
    investments: normInv,
    receipts,
  });
  return PersonalityResult.create({
    userId,
    label: result.label,
    scores: result.scores,
    ranked: result.ranked,
    features: result.features,
    narrative: result.narrative,
    insights: result.insights,
    manualOverride: false,
  });
}

export async function uploadReceipt(req, res) {
  try {
    const { imageBase64, mimeType, text } = req.body || {};
    if (!imageBase64 && !text) {
      return res.status(400).json({ success: false, message: 'Provide imageBase64 or text' });
    }
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const parsed = await parseReceipt({ imageBase64, mimeType, text });
    const mappedCategory = mapCategory(parsed.category);

    // Persist a transaction so downstream features (analytics, personality) see it
    const tx = await Transaction.create({
      userId: req.user._id,
      amount: Number(parsed.total) || 0,
      description: `Receipt: ${parsed.merchant}`,
      category: mappedCategory,
      type: 'expense',
      date: parsed.date ? new Date(parsed.date) : new Date(),
      paymentMethod: mapPaymentMethod(parsed.paymentMethod),
      merchant: parsed.merchant,
      currency: parsed.currency || 'USD',
      metadata: {
        source: 'receipt-ocr',
        provider: parsed.provider,
        model: parsed.model,
        items: parsed.items,
        tax: parsed.tax,
        subtotal: parsed.subtotal,
        confidence: parsed.confidence,
        quality: parsed.quality,
      },
    });

    // Persist the image so listings and re-visits keep a visual preview.
    const imageMeta = await persistReceiptImage(req.user._id, imageBase64, mimeType);

    const receipt = await Receipt.create({
      userId: req.user._id,
      merchant: parsed.merchant,
      date: parsed.date,
      total: parsed.total,
      currency: parsed.currency,
      items: parsed.items,
      category: mappedCategory,
      categorySource: parsed.categorySource,
      categoryScore: parsed.categoryScore,
      confidence: parsed.confidence,
      provider: parsed.provider,
      model: parsed.model,
      quality: parsed.quality,
      dims: parsed.dims,
      imageProcessing: parsed.imageProcessing,
      tax: parsed.tax,
      subtotal: parsed.subtotal,
      paymentMethod: parsed.paymentMethod,
      raw: text?.slice(0, 4000) || null,
      rawText: parsed.rawText?.slice(0, 8000) || null,
      transactionId: tx._id,
      errors: parsed.errors,
      imageMime: imageMeta.imageMime,
      thumbnailDataUrl: imageMeta.thumbnailDataUrl,
      storagePath: imageMeta.storagePath,
      imageBytes: imageMeta.imageBytes,
    });
    tx.metadata = { ...(tx.metadata?.toObject?.() || tx.metadata || {}), receiptId: receipt._id };
    await tx.save();

    let personality = null;
    try {
      personality = await createPersonalitySnapshot(req.user._id);
      if (personality?._id) {
        receipt.personalitySnapshotId = personality._id;
        await receipt.save();
      }
    } catch (snapshotError) {
      logger.warn('[receipt] personality snapshot skipped', snapshotError.message);
    }

    const io = req.app?.get?.('io');
    if (io) {
      io.to(`user:${req.user._id}`).emit('receipt:processed', receipt);
      io.to(`user:${req.user._id}`).emit('transaction:new', tx);
      if (personality) io.to(`user:${req.user._id}`).emit('personality:updated', personality);
    }

    res.json({ success: true, data: { receipt, transaction: tx, personality, parsed } });
  } catch (e) {
    logger.error('[receipt] upload failed', e);
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function listReceipts(req, res) {
  try {
    const { limit = 100, category, merchant, from, to, withThumbs } = req.query || {};
    const q = { userId: req.user._id };
    if (category) q.category = category;
    if (merchant) q.merchant = new RegExp(merchant, 'i');
    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to) q.createdAt.$lte = new Date(to);
    }
    // By default strip the embedded thumbnail from list responses — it's big.
    // The UI can opt in with ?withThumbs=true or fetch per-receipt for the image.
    const projection = withThumbs === 'true' ? null : { thumbnailDataUrl: 0, rawText: 0, raw: 0 };
    const list = await Receipt.find(q, projection)
      .sort({ createdAt: -1 })
      .limit(Math.min(500, Number(limit) || 100));
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

/**
 * Stream the stored receipt image. Falls back to the embedded thumbnail when the
 * on-disk original is missing (e.g. container restart without volume).
 */
export async function getReceiptImage(req, res) {
  try {
    const r = await Receipt.findOne({ _id: req.params.id, userId: req.user._id });
    if (!r) return res.status(404).json({ success: false, message: 'Not found' });
    if (r.storagePath) {
      try {
        const abs = path.resolve(process.cwd(), r.storagePath);
        const buf = await fs.readFile(abs);
        res.set('Content-Type', r.imageMime || 'image/jpeg');
        res.set('Cache-Control', 'private, max-age=86400');
        return res.send(buf);
      } catch (e) { /* fall through to thumbnail */ }
    }
    if (r.thumbnailDataUrl) {
      const match = /^data:([^;]+);base64,(.*)$/.exec(r.thumbnailDataUrl);
      if (match) {
        res.set('Content-Type', match[1]);
        return res.send(Buffer.from(match[2], 'base64'));
      }
    }
    res.status(404).json({ success: false, message: 'No image stored for this receipt' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function getReceipt(req, res) {
  try {
    const r = await Receipt.findOne({ _id: req.params.id, userId: req.user._id });
    if (!r) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: r });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function deleteReceipt(req, res) {
  try {
    const r = await Receipt.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (r?.transactionId) {
      await Transaction.deleteOne({ _id: r.transactionId, userId: req.user._id });
    }
    // Best-effort unlink of the on-disk original.
    if (r?.storagePath) {
      try { await fs.unlink(path.resolve(process.cwd(), r.storagePath)); }
      catch (e) { logger.warn('[receipt] unlink failed', e.message); }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function overrideCategory(req, res) {
  try {
    const { category } = req.body || {};
    if (!category) return res.status(400).json({ success: false, message: 'category required' });
    const mapped = mapCategory(category);
    const r = await Receipt.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { category: mapped, categorySource: 'manual', categoryScore: 1 },
      { new: true }
    );
    if (!r) return res.status(404).json({ success: false, message: 'Not found' });
    if (r.transactionId) {
      await Transaction.updateOne(
        { _id: r.transactionId, userId: req.user._id },
        { category: mapped }
      );
    }
    res.json({ success: true, data: r });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function retag(req, res) {
  try {
    const { tags = [], notes } = req.body || {};
    const update = {};
    if (Array.isArray(tags)) update.tags = tags.slice(0, 16).map(String);
    if (typeof notes === 'string') update.notes = notes.slice(0, 1000);
    const r = await Receipt.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id }, update, { new: true }
    );
    if (!r) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: r });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function stats(req, res) {
  try {
    const userId = req.user._id;
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const receipts = await Receipt.find({ userId, createdAt: { $gte: since } }).lean();
    const byCategory = {};
    const byMerchant = {};
    let total = 0;
    for (const r of receipts) {
      total += Number(r.total) || 0;
      byCategory[r.category] = (byCategory[r.category] || 0) + (Number(r.total) || 0);
      byMerchant[r.merchant] = (byMerchant[r.merchant] || 0) + (Number(r.total) || 0);
    }
    const topMerchants = Object.entries(byMerchant)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([merchant, amount]) => ({ merchant, amount }));
    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount }));
    res.json({
      success: true,
      data: { count: receipts.length, total, topMerchants, topCategories, windowDays: 90 },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export default {
  uploadReceipt, listReceipts, getReceipt, getReceiptImage, deleteReceipt,
  overrideCategory, retag, stats,
};
