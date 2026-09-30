import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Bill from '../models/Bill.js';
import { predictNextMonthSpend, detectRecurring } from '../services/billPredictor.js';

export async function snapshot(req, res) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const [txs, bills] = await Promise.all([
      Transaction.find({ userId: req.user._id }).sort({ date: -1 }).limit(2000).lean(),
      Bill.find({ userId: req.user._id }).lean(),
    ]);
    const snap = buildSnapshot(txs, bills);
    res.json({ success: true, data: snap });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function health(req, res) {
  try {
    const dbState = mongoose.connection.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting
    res.json({
      success: true,
      status: 'ok',
      uptime: process.uptime(),
      database: dbState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date(),
    });
  } catch (e) {
    res.status(500).json({ success: false, status: 'error', message: e.message });
  }
}

export function buildSnapshot(txs, bills) {
  const now = Date.now();
  const dayMs = 86400000;
  const isExp = (t) => t.type === 'expense';
  const isInc = (t) => t.type === 'income';
  const age = (t) => now - new Date(t.date).getTime();

  const todaySpend = txs.filter((t) => isExp(t) && age(t) < dayMs).reduce((a, t) => a + t.amount, 0);
  const weekSpend = txs.filter((t) => isExp(t) && age(t) < 7 * dayMs).reduce((a, t) => a + t.amount, 0);
  const monthSpend = txs.filter((t) => isExp(t) && age(t) < 30 * dayMs).reduce((a, t) => a + t.amount, 0);
  const income = txs.filter((t) => isInc(t) && age(t) < 30 * dayMs).reduce((a, t) => a + t.amount, 0);
  const burnRate = monthSpend / 30;

  // Prior-period comparisons (deltas) so the KPI cards always animate.
  const ySpend = txs
    .filter((t) => isExp(t) && age(t) >= dayMs && age(t) < 2 * dayMs)
    .reduce((a, t) => a + t.amount, 0);
  const pwSpend = txs
    .filter((t) => isExp(t) && age(t) >= 7 * dayMs && age(t) < 14 * dayMs)
    .reduce((a, t) => a + t.amount, 0);
  const pmSpend = txs
    .filter((t) => isExp(t) && age(t) >= 30 * dayMs && age(t) < 60 * dayMs)
    .reduce((a, t) => a + t.amount, 0);
  const pmIncome = txs
    .filter((t) => isInc(t) && age(t) >= 30 * dayMs && age(t) < 60 * dayMs)
    .reduce((a, t) => a + t.amount, 0);
  const prevSavings = pmIncome > 0 ? 1 - pmSpend / pmIncome : 0;
  const curSavings = income > 0 ? 1 - monthSpend / income : 0;

  const pctDelta = (cur, prev) => {
    if (!prev) return 0;
    return +(((cur - prev) / prev) * 100).toFixed(1);
  };

  const byCat = {};
  for (const t of txs) {
    if (isExp(t) && age(t) < 30 * dayMs) {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    }
  }
  const topCategory = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const forecast = predictNextMonthSpend(txs);
  const recurring = detectRecurring(txs.map((t) => ({ ...t, merchant: t.description })));

  // Weekly heat: sum expense amount by day-of-week over last 30d.
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dow = Array(7).fill(0);
  for (const t of txs) {
    if (isExp(t) && age(t) < 30 * dayMs) {
      dow[new Date(t.date).getDay()] += t.amount;
    }
  }
  const byWeekday = DOW.map((day, i) => ({ day, amount: +dow[i].toFixed(2) }));

  // Recent transactions for live activity feed.
  const recentTransactions = txs.slice(0, 8).map((t) => ({
    id: String(t._id || t.id || ''),
    amount: +Number(t.amount || 0).toFixed(2),
    type: t.type,
    category: t.category,
    description: t.description || '',
    date: t.date,
  }));

  const alerts = [];
  if (income > 0 && monthSpend / income > 0.9) {
    alerts.push({
      severity: 'critical',
      code: 'SPEND_OVER_90',
      message: `Spending is ${((monthSpend / income) * 100).toFixed(0)}% of income this month`,
    });
  }
  const topByAmt = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  if (topByAmt && topByAmt[1] > 2000) {
    alerts.push({
      severity: 'warning',
      code: 'CATEGORY_HOT',
      message: `High spend in ${topByAmt[0]} this month`,
    });
  }
  if (forecast && forecast.predicted > monthSpend * 1.15) {
    alerts.push({
      severity: 'info',
      code: 'FORECAST_RISE',
      message: `Next-month forecast is ${((forecast.predicted / Math.max(1, monthSpend) - 1) * 100).toFixed(0)}% higher`,
    });
  }

  const monthBudget = +(monthSpend * 1.25).toFixed(2);
  const monthIncome = +income.toFixed(2);

  const byCategory = Object.entries(byCat)
    .map(([k, v]) => ({ category: k, amount: +v.toFixed(2) }))
    .sort((a, b) => b.amount - a.amount);
  const topCategories = byCategory.slice(0, 8);

  const activeBills = (bills || []).filter(
    (b) => b.status === 'pending' || b.status === 'active' || b.status === 'upcoming' || !b.status,
  ).length;
  const recurringCount = Array.isArray(recurring) ? recurring.length : 0;

  // KPI bundle — consumed by MonitoringPage (Ops Console) and DashboardPage.
  const kpi = {
    todaySpend: +todaySpend.toFixed(2),
    weekSpend: +weekSpend.toFixed(2),
    monthSpend: +monthSpend.toFixed(2),
    monthIncome,
    monthBudget,
    burnRate: +burnRate.toFixed(2),
    topCategory,
    // Decimal 0–1 so callers that multiply by 100 render correctly.
    savingsRate: +curSavings.toFixed(4),
    savingsRatePct: +(curSavings * 100).toFixed(1),
    activeBills,
    recurringCount,
    income: monthIncome,
  };

  const now2 = new Date();

  return {
    // Flat fields (back-compat)
    todaySpend: kpi.todaySpend,
    weekSpend: kpi.weekSpend,
    monthSpend: kpi.monthSpend,
    monthIncome,
    monthBudget,
    income: monthIncome,
    burnRate: kpi.burnRate,
    topCategory,
    savingsRate: kpi.savingsRatePct,
    // Nested bundle for pages expecting snap.kpi
    kpi,
    // Forecast total (Ops Console header)
    forecastTotal: +(forecast?.predicted || forecast?.forecastTotal || monthSpend * 1.05).toFixed(2),
    deltas: {
      daySpend: pctDelta(todaySpend, ySpend),
      weekSpend: pctDelta(weekSpend, pwSpend),
      monthSpend: pctDelta(monthSpend, pmSpend),
      savingsRate: +((curSavings - prevSavings) * 100).toFixed(1),
    },
    byCategory,
    topCategories,
    byWeekday,
    recentTransactions,
    forecast,
    recurring,
    alerts,
    bills: (bills || []).slice(0, 10).map((b) => ({
      id: b._id,
      name: b.name,
      amount: b.amount,
      dueDate: b.dueDate,
      status: b.status,
    })),
    ts: now2,
    timestamp: now2,
  };
}
