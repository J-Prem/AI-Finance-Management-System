import api from './api'

export const categorizeTransaction = async (description) => {
  return api.post('/ml/categorize', { description })
}

export const predictSpending = async (months = 3) => {
  return api.get(`/ml/predict-spending?months=${months}`)
}

export const detectAnomalies = async () => {
  return api.get('/ml/detect-anomalies')
}

export const getSpendingPersonality = async () => {
  return api.get('/ml/spending-personality')
}

export const getFinancialHealthScore = async () => {
  return api.get('/ml/financial-health')
}

export const getSpendingDNA = async () => {
  return api.get('/ml/spending-dna')
}

export const getSubscriptionInsights = async () => {
  return api.get('/ml/subscription-insights')
}

export const getSpendingPatterns = async () => {
  return api.get('/ml/spending-patterns')
}

export const whatIfAnalysis = async (scenario) => {
  return api.post('/ml/what-if', scenario)
}

export const chatbotQuery = async (message, conversationHistory = []) => {
  return api.post('/ml/chatbot', {
    message,
    history: conversationHistory,
  })
}

export const getInsightsRecommendations = async () => {
  return api.get('/ml/insights-recommendations')
}
