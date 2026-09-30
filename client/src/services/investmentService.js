import api from './api'

// Investment CRUD
export const getInvestments = async (filters = {}, page = 1, limit = 20) => {
  const params = new URLSearchParams()
  params.append('page', page)
  params.append('limit', limit)

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })

  return api.get(`/investments?${params.toString()}`)
}

export const getInvestment = async (id) => {
  return api.get(`/investments/${id}`)
}

export const createInvestment = async (data) => {
  return api.post('/investments', data)
}

export const updateInvestment = async (id, data) => {
  return api.put(`/investments/${id}`, data)
}

export const deleteInvestment = async (id) => {
  return api.delete(`/investments/${id}`)
}

// Portfolio Operations
export const getPortfolio = async () => {
  return api.get('/investments/portfolio')
}

export const getPortfolioSummary = async () => {
  return api.get('/investments/portfolio/summary')
}

export const getDiversification = async () => {
  return api.get('/investments/portfolio/diversification')
}

export const getPortfolioPerformance = async (days = 30) => {
  return api.get('/investments/portfolio/performance', {
    params: { days },
  })
}

export const getPortfolioAllocation = async () => {
  return api.get('/investments/portfolio/allocation')
}

// Analytics
export const getInvestmentStats = async (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  return api.get(`/investments/stats?${params.toString()}`)
}

export const calculatePortfolioMetrics = async () => {
  return api.get('/investments/metrics')
}

// Goals
export const createInvestmentGoal = async (data) => {
  return api.post('/investments/goals', data)
}

export const getInvestmentGoals = async () => {
  return api.get('/investments/goals')
}

export const updateInvestmentGoal = async (id, data) => {
  return api.put(`/investments/goals/${id}`, data)
}

export const deleteInvestmentGoal = async (id) => {
  return api.delete(`/investments/goals/${id}`)
}
