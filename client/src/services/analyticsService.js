import api from './api'

// The server mounts these under /api/analytics/* — see server/routes/analytics.js.
// Some of the client-facing names don't match one-to-one so we adapt here.

function daysAgoISO(days) {
  const d = new Date()
  d.setDate(d.getDate() - Number(days || 0))
  return d.toISOString().slice(0, 10)
}

export const getSpendingTrend = async (days = 180) => {
  // Daily granularity is required by the cohort heatmap and STL-style
  // decomposition on the Analytics page — monthly buckets only ever yield
  // ~12 points which is below the 14-point minimum the decomposition needs
  // and collapses the day-of-week × week-of-month cohort grid to a single
  // cell. Pass `months` as the lookback window; the server uses it to
  // derive startDate regardless of granularity.
  const months = Math.max(1, Math.min(24, Math.round(days / 30)))
  return api.get(`/analytics/trends?period=daily&months=${months}`)
}

export const getCategoryBreakdown = async (days = 30) => {
  const startDate = daysAgoISO(days)
  return api.get(`/analytics/categories?startDate=${startDate}`)
}

export const getIncomeExpense = async (days = 180) => {
  const startDate = daysAgoISO(days)
  return api.get(`/analytics/income-expense?startDate=${startDate}`)
}

// Financial health uses a derived score backed by the savings-rate and
// monthly-comparison endpoints if the dedicated one isn't available.
export const getFinancialHealth = async () => {
  return api.get('/analytics/financial-health')
}

export const getBudgetAnalysis = async () => api.get('/budgets/status/all')

export const getMonthlyComparison = async () => api.get('/analytics/monthly')

export const getDashboardStats = async () => api.get('/analytics/dashboard')

export const getAIInsights = async () => api.get('/analytics/ai-insights')

export const getAnomalies = async () => api.get('/analytics/anomalies')

export const getSavingsRate = async (period = 'monthly') =>
  api.get(`/analytics/savings-rate?period=${period}`)

export const runWhatIf = async (scenario) => api.post('/analytics/what-if', { scenario })
