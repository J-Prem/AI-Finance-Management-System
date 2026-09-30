import { classifyPersonality } from '../services/personalityClassifier.js';
import Transaction from '../models/Transaction.js';
import Investment from '../models/Investment.js';
import Receipt from '../models/Receipt.js';
import PersonalityResult from '../models/PersonalityResult.js';

export async function analyze(req, res) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const manualOverride = req.body?.manualOverride || req.query?.override;
    const income = Number(req.body?.income) || null;

    const [txs, investments, receipts] = await Promise.all([
      Transaction.find({ userId: req.user._id }).lean(),
      Investment.find({ userId: req.user._id }).lean(),
      Receipt.find({ userId: req.user._id }).lean(),
    ]);

    if (!txs.length && !receipts.length) {
      return res.status(400).json({
        success: false,
        message: 'Not enough data yet. Add transactions or upload a receipt first.',
      });
    }

    // Normalize investments to {qty, lastPrice}
    const normInv = investments.map((i) => ({
      qty: i.quantity || i.qty || 0,
      lastPrice: i.currentPrice || i.lastPrice || i.averageCost || 0,
    }));

    const result = classifyPersonality({
      transactions: txs,
      investments: normInv,
      receipts,
      income,
      manualOverride,
    });

    await PersonalityResult.create({
      userId: req.user._id,
      label: result.label,
      scores: result.scores,
      ranked: result.ranked,
      features: result.features,
      narrative: result.narrative,
      insights: result.insights,
      manualOverride: result.manualOverride,
    });

    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function history(req, res) {
  try {
    const list = await PersonalityResult.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function latest(req, res) {
  try {
    const doc = await PersonalityResult.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export default { analyze, history, latest };
