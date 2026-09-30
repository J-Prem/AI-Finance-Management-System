/**
 * Spender Personality Classifier.
 *
 * Combines multiple signals:
 *   1. Transaction history (cash-flow level)
 *   2. Investment holdings
 *   3. Receipt-level micro-behaviour (item variety, premium merchants,
 *      late-night / weekend spend, impulse density)
 *
 * Personalities:
 *   - Saver        : <50% income spent, surplus routinely saved
 *   - Investor     : >15% income routed to investments, low impulse buys
 *   - Balanced     : healthy ratios across categories
 *   - Spender      : >85% income spent, large shopping/dining share
 *   - Impulsive    : many small unplanned buys, high category variance
 *   - Strategic    : consolidated spend, subscription-heavy, minimal cash churn
 *
 * The classifier returns the primary label plus per-label scores so the UI
 * can draw a radar chart, together with a narrative and a structured
 * "insights" block that surfaces receipt-driven observations.
 */

const LABELS = ['Saver', 'Investor', 'Balanced', 'Spender', 'Impulsive', 'Strategic'];

const PREMIUM_MERCHANTS = [
  'apple', 'starbucks', 'whole foods', 'lululemon', 'tesla', 'nike',
  'uber black', 'emirates', 'hyatt', 'hilton', 'marriott', 'taj',
  'oberoi', 'four seasons', 'ritz-carlton', 'le meridien',
];

function stddev(nums) {
  if (!nums.length) return 0;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.sqrt(nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length);
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

/* --------------------------- feature extraction --------------------------- */

function extractFeatures({ transactions = [], income = 0, investments = [], receipts = [] }) {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const incomeTxs = transactions.filter((t) => t.type === 'income');

  // Bucket both income and expenses per YYYY-MM so we can compute real monthly averages.
  const expMonths = {};
  for (const t of expenses) {
    const key = new Date(t.date).toISOString().slice(0, 7);
    expMonths[key] = (expMonths[key] || 0) + t.amount;
  }
  const incMonths = {};
  for (const t of incomeTxs) {
    const key = new Date(t.date).toISOString().slice(0, 7);
    incMonths[key] = (incMonths[key] || 0) + t.amount;
  }
  const monthsObserved = Math.max(1, new Set([...Object.keys(expMonths), ...Object.keys(incMonths)]).size);
  const expTotals = Object.values(expMonths);
  const avgMonthly = expTotals.length ? expTotals.reduce((a, b) => a + b, 0) / expTotals.length : 0;

  // Income resolution: prefer explicit `income`, then observed income-tx avg/month,
  // then derive a sensible fallback from spend so ratios are never zero when we have
  // expenses. This keeps Saver/Spender/Investor labels meaningful for users who
  // haven't logged income yet.
  const observedIncAvg = incomeTxs.length ? incomeTxs.reduce((a, t) => a + t.amount, 0) / monthsObserved : 0;
  let incomeSource = 'provided';
  let inc = Number(income) || 0;
  if (!inc) {
    if (observedIncAvg > 0) {
      inc = observedIncAvg;
      incomeSource = 'transactions';
    } else if (avgMonthly > 0) {
      // Implied income assumes a typical 75% spend ratio, giving inc ≈ spend × 1.33.
      inc = avgMonthly * 1.333;
      incomeSource = 'implied';
    }
  }

  const spendRatio = inc > 0 ? avgMonthly / inc : 0;

  const byCat = {};
  for (const t of expenses) byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  const total = Object.values(byCat).reduce((a, b) => a + b, 0) || 1;
  const share = Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, v / total]));
  const smallImpulses = expenses.filter((t) =>
    t.amount < 25 && ['Shopping', 'Food & Dining', 'Entertainment'].includes(t.category)).length;
  const impulseDensity = expenses.length ? smallImpulses / expenses.length : 0;
  const categoryVariance = stddev(Object.values(share));
  const investValue = investments.reduce((a, i) => a + (i.lastPrice || 0) * (i.qty || 0), 0);
  // Invest ratio = monthly-equivalent invested value / monthly income.
  // Spread the portfolio across the observed window so short-history users aren't
  // penalised, and fall back to avgMonthly-based normalisation when inc is still 0.
  const investRatio = inc > 0
    ? (investValue / Math.max(1, monthsObserved)) / inc
    : (avgMonthly > 0 ? (investValue / Math.max(1, monthsObserved)) / (avgMonthly * 1.333) : 0);
  const subscriptionsShare = share['Bills & Utilities'] || share['Subscriptions'] || 0;

  /* -------- receipt-level signals -------- */
  const rec = Array.isArray(receipts) ? receipts : [];
  const merchantCounts = {};
  const receiptTotals = [];
  const itemCounts = [];
  let premiumSpend = 0;
  let totalRecSpend = 0;
  let lateNightSpend = 0;
  let weekendSpend = 0;
  let weekdaySpend = 0;
  let cashlessSpend = 0;
  let cashSpend = 0;
  for (const r of rec) {
    const amt = Number(r.total) || 0;
    totalRecSpend += amt;
    merchantCounts[r.merchant] = (merchantCounts[r.merchant] || 0) + 1;
    receiptTotals.push(amt);
    itemCounts.push((r.items || []).length);
    const ml = String(r.merchant || '').toLowerCase();
    if (PREMIUM_MERCHANTS.some((p) => ml.includes(p))) premiumSpend += amt;
    const d = r.createdAt ? new Date(r.createdAt) : (r.date ? new Date(r.date) : null);
    if (d && !Number.isNaN(+d)) {
      const hour = d.getHours();
      const isWeekend = [0, 6].includes(d.getDay());
      if (hour >= 22 || hour < 5) lateNightSpend += amt;
      if (isWeekend) weekendSpend += amt; else weekdaySpend += amt;
    }
    if (r.paymentMethod) {
      if (/cash/i.test(r.paymentMethod)) cashSpend += amt;
      else cashlessSpend += amt;
    }
  }
  const uniqueMerchants = Object.keys(merchantCounts).length;
  const merchantDiversity = rec.length ? uniqueMerchants / rec.length : 0;
  const premiumShare = totalRecSpend > 0 ? premiumSpend / totalRecSpend : 0;
  const lateNightShare = totalRecSpend > 0 ? lateNightSpend / totalRecSpend : 0;
  const weekendRatio = weekdaySpend + weekendSpend > 0 ? weekendSpend / (weekdaySpend + weekendSpend) : 0;
  const avgReceipt = rec.length ? totalRecSpend / rec.length : 0;
  const avgItemsPerReceipt = rec.length ? itemCounts.reduce((a, b) => a + b, 0) / rec.length : 0;
  const cashlessRatio = cashSpend + cashlessSpend > 0 ? cashlessSpend / (cashSpend + cashlessSpend) : 0;

  return {
    income: inc,
    incomeSource,
    monthsObserved,
    avgMonthly,
    spendRatio,
    shareByCategory: share,
    impulseDensity,
    categoryVariance,
    investRatio,
    investValue,
    subscriptionsShare,
    txCount: expenses.length,
    // Receipt features
    receiptCount: rec.length,
    uniqueMerchants,
    merchantDiversity,
    premiumShare,
    lateNightShare,
    weekendRatio,
    avgReceipt,
    avgItemsPerReceipt,
    cashlessRatio,
    topMerchants: Object.entries(merchantCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([m, c]) => ({ merchant: m, count: c })),
  };
}

/* ------------------------------ scoring ------------------------------ */

function scoreFeatures(f) {
  const s = Object.fromEntries(LABELS.map((l) => [l, 0]));

  // Saver
  s.Saver += clamp(1 - f.spendRatio, 0, 1) * 0.6;
  s.Saver += (f.impulseDensity < 0.1 ? 0.25 : 0);
  s.Saver += clamp(1 - f.premiumShare * 1.5, 0, 1) * 0.15;

  // Investor
  s.Investor += clamp(f.investRatio * 5, 0, 1) * 0.6;
  s.Investor += clamp(1 - f.spendRatio, 0, 1) * 0.25;
  s.Investor += clamp(1 - f.impulseDensity * 2, 0, 1) * 0.15;

  // Balanced
  s.Balanced += clamp(1 - Math.abs(f.spendRatio - 0.7) * 2, 0, 1) * 0.5;
  s.Balanced += clamp(1 - f.categoryVariance * 5, 0, 1) * 0.3;
  s.Balanced += clamp(f.merchantDiversity, 0, 1) * 0.2;

  // Spender
  s.Spender += clamp(f.spendRatio - 0.7, 0, 1) * 0.7;
  s.Spender += (f.shareByCategory['Shopping'] || 0) * 0.4;
  s.Spender += (f.shareByCategory['Food & Dining'] || 0) * 0.25;
  s.Spender += clamp(f.premiumShare * 1.2, 0, 1) * 0.25;

  // Impulsive
  s.Impulsive += clamp(f.impulseDensity * 3, 0, 1) * 0.55;
  s.Impulsive += clamp(f.categoryVariance * 3, 0, 1) * 0.25;
  s.Impulsive += clamp(f.lateNightShare * 3, 0, 1) * 0.25;
  s.Impulsive += clamp(f.weekendRatio * 1.5, 0, 1) * 0.2;

  // Strategic
  s.Strategic += clamp(f.subscriptionsShare * 4, 0, 1) * 0.45;
  s.Strategic += clamp(1 - f.impulseDensity * 2, 0, 1) * 0.3;
  s.Strategic += clamp(f.cashlessRatio, 0, 1) * 0.15;
  s.Strategic += clamp(1 - f.merchantDiversity, 0, 1) * 0.15; // concentrated spend

  // Normalize
  const max = Math.max(...Object.values(s)) || 1;
  for (const k of Object.keys(s)) s[k] = +(s[k] / max).toFixed(3);
  return s;
}

/* ------------------------------ narratives ------------------------------ */

function narrate(f, label) {
  const top = Object.entries(f.shareByCategory).sort((a, b) => b[1] - a[1])[0];
  const lines = [];
  lines.push(`Primary profile: ${label}.`);
  lines.push(`• Spend ratio: ${(f.spendRatio * 100).toFixed(1)}% of monthly income.`);
  if (top) lines.push(`• Top category: ${top[0]} (${(top[1] * 100).toFixed(1)}% of expenses).`);
  lines.push(`• Impulse-buy density: ${(f.impulseDensity * 100).toFixed(1)}% of transactions under $25 in discretionary categories.`);
  lines.push(`• Investment-to-income ratio: ${(f.investRatio * 100).toFixed(2)}%.`);
  if (f.receiptCount) {
    lines.push(`• Receipts analysed: ${f.receiptCount} across ${f.uniqueMerchants} merchants (avg $${f.avgReceipt.toFixed(2)}).`);
    if (f.premiumShare > 0.1)
      lines.push(`• Premium-brand share: ${(f.premiumShare * 100).toFixed(1)}% of receipt spend.`);
    if (f.lateNightShare > 0.1)
      lines.push(`• Late-night spend (10pm-5am): ${(f.lateNightShare * 100).toFixed(1)}%.`);
    if (f.weekendRatio > 0.5)
      lines.push(`• Weekend-heavy: ${(f.weekendRatio * 100).toFixed(1)}% of receipt spend on weekends.`);
    if (f.cashlessRatio > 0)
      lines.push(`• Cashless ratio: ${(f.cashlessRatio * 100).toFixed(1)}%.`);
  }
  if (label === 'Spender') lines.push('Recommendation: automate a 15% income transfer to savings before discretionary spend.');
  if (label === 'Impulsive') lines.push('Recommendation: impose a 24h rule on non-essential buys > $30.');
  if (label === 'Saver') lines.push('Recommendation: you have headroom — consider investing the excess savings.');
  if (label === 'Investor') lines.push('Recommendation: rebalance quarterly and ensure a 6-month emergency fund.');
  if (label === 'Balanced') lines.push('Recommendation: maintain ratios; review subscription overlap annually.');
  if (label === 'Strategic') lines.push('Recommendation: audit subscription utilization — cancel items used <2x/mo.');
  return lines.join('\n');
}

/* ------------------------------ insights ------------------------------ */

function buildInsights(f) {
  const insights = [];
  if (f.premiumShare > 0.3) insights.push({
    kind: 'premium_heavy',
    severity: 'medium',
    title: 'High premium-brand share',
    detail: `${(f.premiumShare * 100).toFixed(1)}% of your receipt spend is at premium merchants. Consider alternating with mid-tier options 2x/month to reclaim 5–8%.`,
  });
  if (f.lateNightShare > 0.15) insights.push({
    kind: 'late_night',
    severity: 'high',
    title: 'Late-night spending pattern detected',
    detail: `${(f.lateNightShare * 100).toFixed(1)}% of spend happens between 10pm–5am, when impulse buys peak. Apps often target this window — enable a daily spend alert at 9pm.`,
  });
  if (f.impulseDensity > 0.35) insights.push({
    kind: 'impulse',
    severity: 'high',
    title: 'Impulse-buy density elevated',
    detail: `${(f.impulseDensity * 100).toFixed(1)}% of your transactions are small discretionary purchases. A 24-hour hold on items > $30 usually cuts this in half.`,
  });
  if (f.merchantDiversity < 0.3 && f.receiptCount > 5) insights.push({
    kind: 'concentrated',
    severity: 'low',
    title: 'Highly concentrated merchant footprint',
    detail: `You repeat the same merchants frequently (diversity ${(f.merchantDiversity * 100).toFixed(0)}%). Loyalty can help you negotiate or stack rewards — check for unused program benefits.`,
  });
  if (f.subscriptionsShare > 0.2) insights.push({
    kind: 'sub_heavy',
    severity: 'medium',
    title: 'Subscriptions share above 20%',
    detail: 'Run a 90-day usage audit: any service used fewer than twice per month is a candidate for cancellation.',
  });
  if (f.weekendRatio > 0.65) insights.push({
    kind: 'weekend_heavy',
    severity: 'low',
    title: 'Weekend-heavy discretionary spend',
    detail: `${(f.weekendRatio * 100).toFixed(1)}% of receipt spend falls on weekends. Pre-loading a weekend budget on Friday evening tends to reduce weekend overshoot.`,
  });
  if (!insights.length) insights.push({
    kind: 'healthy',
    severity: 'info',
    title: 'No red flags detected',
    detail: 'Your spending patterns are balanced across the signals we track. Keep logging receipts to improve accuracy.',
  });
  return insights;
}

/* ------------------------------ public API ------------------------------ */

export function classifyPersonality({ transactions, income, investments, receipts, manualOverride }) {
  const features = extractFeatures({ transactions, income, investments, receipts });
  const scores = scoreFeatures(features);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const label = manualOverride && LABELS.includes(manualOverride) ? manualOverride : ranked[0][0];
  const narrative = narrate(features, label);
  const insights = buildInsights(features);

  return {
    label,
    scores,
    ranked: ranked.map(([k, v]) => ({ label: k, score: v })),
    features: {
      spendRatio: features.spendRatio,
      impulseDensity: features.impulseDensity,
      investRatio: features.investRatio,
      avgMonthly: features.avgMonthly,
      income: features.income,
      incomeSource: features.incomeSource,
      monthsObserved: features.monthsObserved,
      investValue: features.investValue,
      categoryVariance: features.categoryVariance,
      subscriptionsShare: features.subscriptionsShare,
      topCategories: Object.entries(features.shareByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ category: k, share: v })),
      // receipt-derived
      receiptCount: features.receiptCount,
      uniqueMerchants: features.uniqueMerchants,
      merchantDiversity: features.merchantDiversity,
      premiumShare: features.premiumShare,
      lateNightShare: features.lateNightShare,
      weekendRatio: features.weekendRatio,
      avgReceipt: features.avgReceipt,
      avgItemsPerReceipt: features.avgItemsPerReceipt,
      cashlessRatio: features.cashlessRatio,
      topMerchants: features.topMerchants,
    },
    narrative,
    insights,
    manualOverride: !!manualOverride,
  };
}

export default { classifyPersonality };
