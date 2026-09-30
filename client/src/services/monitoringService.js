import api from './api'

export const getSnapshot = async () => {
  return api.get('/monitoring/snapshot')
}

export const getHealth = async () => {
  return api.get('/monitoring/health')
}

export const getProviderDiagnostics = async () => {
  return api.get('/llm/diagnostics')
}

export default { getSnapshot, getHealth, getProviderDiagnostics }
