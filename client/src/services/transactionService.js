import api from './api'

// Map legacy lowercase category IDs to the category names the server validator
// accepts. The form can submit either the new server-style name directly or an
// old ID; this normalizes on the way out so we never trigger a 400.
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
  other_expense: 'Uncategorized',
  salary: 'Income',
  freelance: 'Income',
  investment: 'Investment',
  bonus: 'Income',
  other_income: 'Income',
}

function normalizeCategory(c) {
  if (!c) return 'Uncategorized'
  return CATEGORY_ALIASES[c] || c
}

function normalizeBody(data) {
  const out = { ...data }
  if (out.category) out.category = normalizeCategory(out.category)
  if (out.amount != null) out.amount = Number(out.amount) || 0
  if (out.type === 'transfer') out.type = 'expense' // server allows only income/expense
  return out
}

export const getTransactions = async (filters = {}, page = 1, limit = 20) => {
  const params = new URLSearchParams()
  params.append('page', page)
  params.append('limit', limit)

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value === 'string' ? value : String(value))
  })

  return api.get(`/transactions?${params.toString()}`)
}

export const getTransaction = async (id) => {
  return api.get(`/transactions/${id}`)
}

export const createTransaction = async (data) => {
  return api.post('/transactions', normalizeBody(data))
}

export const updateTransaction = async (id, data) => {
  // server mounts PATCH, not PUT
  return api.patch(`/transactions/${id}`, normalizeBody(data))
}

export const deleteTransaction = async (id) => {
  return api.delete(`/transactions/${id}`)
}

export const importTransactions = async (file) => {
  // server exposes /bulk-import (JSON body), not /import multipart. If file is
  // a CSV/JSON we let caller parse first; otherwise send rows.
  const rows = Array.isArray(file) ? file : []
  return api.post('/transactions/bulk-import', { transactions: rows.map(normalizeBody) })
}

export const exportTransactions = async (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  return api.get(`/transactions/export?${params.toString()}`, {
    responseType: 'blob',
  })
}

export const getTransactionStats = async (filters = {}) => {
  // server exposes /summary/overview, not /stats
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  return api.get(`/transactions/summary/overview?${params.toString()}`)
}
