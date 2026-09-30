/**
 * Global search — runs a case-insensitive regex across the user's
 * transactions, receipts, bills and budgets, returning up to 5 hits each.
 * Designed for the navbar Cmd+K search experience.
 */
import Transaction from '../models/Transaction.js';
import Receipt from '../models/Receipt.js';
import Bill from '../models/Bill.js';
import Budget from '../models/Budget.js';

export async function globalSearch(req, res) {
  try {
    const { q = '', limit = 5 } = req.query || {};
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!q || q.length < 1) {
      return res.json({ success: true, data: { query: q, results: [] } });
    }
    const lim = Math.min(20, Number(limit) || 5);
    const rx = new RegExp(q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    const userId = req.user._id;

    const [txs, receipts, bills, budgets] = await Promise.all([
      Transaction.find({ userId, $or: [
        { description: rx }, { category: rx }, { 'metadata.source': rx },
      ] }).sort({ date: -1 }).limit(lim).lean(),
      Receipt.find({ userId, $or: [
        { merchant: rx }, { category: rx },
      ] }).sort({ createdAt: -1 }).limit(lim).lean(),
      Bill.find({ userId, name: rx }).sort({ nextDueDate: 1 }).limit(lim).lean(),
      Budget.find({ userId, category: rx }).limit(lim).lean(),
    ]);

    const results = [
      ...txs.map((t) => ({
        id: t._id,
        kind: 'transaction',
        title: t.description || t.category,
        subtitle: `${t.category} · ${new Date(t.date).toLocaleDateString()}`,
        amount: t.amount,
        currency: t.currency || 'USD',
        path: '/transactions',
      })),
      ...receipts.map((r) => ({
        id: r._id,
        kind: 'receipt',
        title: r.merchant,
        subtitle: `${r.category} · ${r.date || new Date(r.createdAt).toLocaleDateString()} · ${r.provider}`,
        amount: r.total,
        currency: r.currency || 'USD',
        path: '/receipts',
      })),
      ...bills.map((b) => ({
        id: b._id,
        kind: 'bill',
        title: b.name,
        subtitle: `Due ${b.nextDueDate ? new Date(b.nextDueDate).toLocaleDateString() : '—'}`,
        amount: b.amount,
        currency: b.currency || 'USD',
        path: '/bills',
      })),
      ...budgets.map((b) => ({
        id: b._id,
        kind: 'budget',
        title: b.category,
        subtitle: `Limit ${b.limit} · Spent ${b.spent || 0}`,
        amount: b.limit,
        currency: b.currency || 'USD',
        path: '/budgets',
      })),
    ];

    res.json({
      success: true,
      data: {
        query: q,
        counts: { transactions: txs.length, receipts: receipts.length, bills: bills.length, budgets: budgets.length },
        results,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export default { globalSearch };
