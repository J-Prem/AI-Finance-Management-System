// Small arithmetic / formatting helpers that guarantee no NaN ever leaks into
// the UI. Every numeric value rendered on Budgets / Investments / Analytics /
// Market / API pages should pass through one of these.

export const safeNum = (v, fallback = 0) => {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : fallback
}

export const safeDiv = (a, b, fallback = 0) => {
  const na = safeNum(a)
  const nb = safeNum(b)
  if (!nb) return fallback
  const r = na / nb
  return Number.isFinite(r) ? r : fallback
}

export const safePct = (part, whole, decimals = 1) => {
  const r = safeDiv(part, whole) * 100
  return Number(r.toFixed(decimals))
}

export const clamp = (v, min = 0, max = 100) => {
  const n = safeNum(v)
  return Math.max(min, Math.min(max, n))
}

// Render helpers — always return a string. Never "NaN", never "undefined".
export const fmtCompact = (v, decimals = 2) => {
  const n = safeNum(v)
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(decimals) + 'T'
  if (Math.abs(n) >= 1e9)  return (n / 1e9 ).toFixed(decimals) + 'B'
  if (Math.abs(n) >= 1e7)  return (n / 1e7 ).toFixed(decimals) + 'Cr'   // Indian crore
  if (Math.abs(n) >= 1e5)  return (n / 1e5 ).toFixed(decimals) + 'L'    // Indian lakh
  if (Math.abs(n) >= 1e3)  return (n / 1e3 ).toFixed(decimals) + 'K'
  return n.toFixed(decimals)
}

export const fmtSigned = (v, decimals = 2) => {
  const n = safeNum(v)
  const sign = n > 0 ? '+' : ''
  return sign + n.toFixed(decimals)
}

// Standard deviation / mean helpers for simple risk analytics.
export const mean = (arr) => {
  if (!Array.isArray(arr) || !arr.length) return 0
  return arr.reduce((s, x) => s + safeNum(x), 0) / arr.length
}
export const stddev = (arr) => {
  if (!Array.isArray(arr) || arr.length < 2) return 0
  const m = mean(arr)
  const v = arr.reduce((s, x) => s + Math.pow(safeNum(x) - m, 2), 0) / (arr.length - 1)
  return Math.sqrt(v)
}

// Simple daily % return given a series of prices.
export const dailyReturns = (prices = []) => {
  const out = []
  for (let i = 1; i < prices.length; i++) {
    const p0 = safeNum(prices[i - 1])
    const p1 = safeNum(prices[i])
    if (p0 > 0) out.push((p1 - p0) / p0)
  }
  return out
}
