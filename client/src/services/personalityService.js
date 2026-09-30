import api from './api'

export const analyzePersonality = async (body = {}) => {
  return api.post('/personality/analyze', body)
}

export const personalityHistory = async () => {
  return api.get('/personality/history')
}

export default { analyzePersonality, personalityHistory }
