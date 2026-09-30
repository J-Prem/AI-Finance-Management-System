import api from './api'

// Budgets API client. The server model stores `spent` as a running total
// that's updated by hooks on the Transaction model, and exposes virtuals
// `remaining`, `percentSpent`, and `status` via getBudgetStatus.

// Map legacy category names (Spender DNA / old UI) to canonical server names.
const CATEGORY_ALIASES = {
  food: 'Food & Dining',
  transport: 'Transportation',
  utilities: 'Bills & Utilities',
  entertainment: 'Entertainment',
  healthcare: 'Healthcare',
  shopping: 'Shopping',
  subscriptions: 'Bills & Utilities',
  insurance: 'Financial Charges',
  education: 'Education',
  travel: 'Travel',
  other: 'Uncategorized',
}

function normalizeBody(data) {
  const out = { ...data }
  if (out.category && CATEGORY_ALIASES[out.category]) {
    out.category = CATEGORY_ALIASES[out.category]
  }
  if (out.amount != null) out.amount = Number(out.amount) || 0
  if (!out.period) out.period = 'monthly'
  if (!out.startDate) out.startDate = new Date().toISOString().slice(0, 10)
  return out
}

export const getBudgets = async () => api.get('/budgets')

export const getBudgetStatus = async () => api.get('/budgets/status/all')

export const getBudget = async (id) => api.get(`/budgets/${id}`)

export const createBudget = async (data) => api.post('/budgets', normalizeBody(data))

export const updateBudget = async (id, data) => api.patch(`/budgets/${id}`, normalizeBody(data))

export const deleteBudget = async (id) => api.delete(`/budgets/${id}`)

export const getBudgetComparison = async (id) => api.get(`/budgets/${id}/comparison`)

export const getBudgetAlerts = async () => api.get('/budgets/alerts/pending')
