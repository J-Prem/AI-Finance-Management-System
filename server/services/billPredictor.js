/**
 * Bill predictor.
 * - Uses EWMA (exponentially-weighted moving average) over historical category
 *   spend to forecast the next month.
 * - Detects recurring subscriptions from repeated merchant amounts.
 * - Produces due-date-aware bill calendar for the next 30 days.
 */

function ewma(values, alpha = 0.4) {
  if (!values.length) return 0;
  let s = values[0];
  for (let i = 1; i < values.length; i++) s = alpha * values[i] + (1 - alpha) * s;
  return s;
}

export function predictNextMonthSpend(transactions = []) {
  const byMonthCat = {};
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const key = `${new Date(t.date).toISOString().slice(0, 7)}|${t.category}`;
    byMonthCat[key] = (byMonthCat[key] || 0) + t.amount;
  }
  const byCat = {};
  for (const [k, amt] of Object.entries(byMonthCat)) {
    const [, cat] = k.split('|');
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(amt);
  }
  const predictions = Object.entries(byCat).map(([cat, arr]) => ({
    category: cat,
    predicted: +ewma(arr).toFixed(2),
    history: arr.map((v) => +v.toFixed(2)),
    months: arr.length,
  })).sort((a, b) => b.predicted - a.predicted);
  const total = predictions.reduce((a, p) => a + p.predicted, 0);
  return { total: +total.toFixed(2), byCategory: predictions };
}

export function detectRecurring(transactions = []) {
  const byMerchant = {};
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const k = t.merchant;
    if (!byMerchant[k]) byMerchant[k] = [];
    byMerchant[k].push(t);
  }
  const recurring = [];
  for (const [merchant, arr] of Object.entries(byMerchant)) {
    if (arr.length < 3) continue;
    const amounts = arr.map((t) => t.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + (b - avg) ** 2, 0) / amounts.length;
    const stable = Math.sqrt(variance) / (avg || 1) < 0.15;
    if (stable) recurring.push({ merchant, amount: +avg.toFixed(2), count: arr.length });
  }
  return recurring.sort((a, b) => b.count - a.count);
}

export function upcomingBillCalendar(bills = [], now = new Date()) {
  const out = [];
  const month = now.getMonth();
  const year = now.getFullYear();
  for (const b of bills) {
    let due = new Date(year, month, b.dueDay);
    if (due < now) due = new Date(year, month + 1, b.dueDay);
    out.push({ ...b, nextDue: due.toISOString().slice(0, 10), daysUntil: Math.ceil((due - now) / 86400000) });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

export default { predictNextMonthSpend, detectRecurring, upcomingBillCalendar };
