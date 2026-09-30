import { chat as llmChat, availableProviders, providerDiagnostics } from '../services/llmService.js';
import Transaction from '../models/Transaction.js';
import Bill from '../models/Bill.js';
import Investment from '../models/Investment.js';
import ChatHistory from '../models/ChatHistory.js';
import { predictNextMonthSpend, upcomingBillCalendar } from '../services/billPredictor.js';
import { classifyPersonality } from '../services/personalityClassifier.js';

async function buildContext(userId) {
  const [txs, bills, investments] = await Promise.all([
    Transaction.find({ userId }).lean(),
    Bill.find({ userId }).lean(),
    Investment.find({ userId }).lean(),
  ]);
  const now = Date.now();
  const monthSpend = txs
    .filter((t) => t.type === 'expense' && now - new Date(t.date).getTime() < 30 * 86400000)
    .reduce((a, t) => a + t.amount, 0);
  const income = txs
    .filter((t) => t.type === 'income' && now - new Date(t.date).getTime() < 30 * 86400000)
    .reduce((a, t) => a + t.amount, 0);
  const byCat = {};
  for (const t of txs) {
    if (t.type === 'expense') byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  }
  const topCategory = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0];
  const normInv = investments.map((i) => ({
    qty: i.quantity || 0,
    lastPrice: i.currentPrice || i.averageCost || 0,
  }));
  const personality = txs.length
    ? classifyPersonality({ transactions: txs, investments: normInv, income }).label
    : 'Unknown';
  const upcomingBills = upcomingBillCalendar(
    bills.map((b) => ({ name: b.name, amount: b.amount, dueDay: new Date(b.dueDate).getDate() })),
  );
  return {
    monthSpend,
    income,
    topCategory,
    personality,
    upcomingBills,
    forecast: predictNextMonthSpend(txs),
  };
}

export async function chat(req, res) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const { messages, provider } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ success: false, message: 'messages[] required' });
    }
    const context = await buildContext(req.user._id);
    const result = await llmChat({ messages, preferredProvider: provider, context });

    await ChatHistory.create({
      userId: req.user._id,
      messages,
      reply: result.text,
      provider: result.provider,
      model: result.model,
      fallbacks: result.fallbacks || [],
    });

    res.json({
      success: true,
      data: {
        reply: result.text,
        provider: result.provider,
        model: result.model,
        fallbacks: result.fallbacks || [],
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function providers(_req, res) {
  res.json({ success: true, data: availableProviders() });
}

export async function diagnostics(_req, res) {
  try {
    res.json({ success: true, data: await providerDiagnostics() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function history(req, res) {
  try {
    const list = await ChatHistory.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export default { chat, providers, diagnostics, history };
