import api from './api'

export const chatWithAdvisor = async ({ messages, provider }) => {
  return api.post('/llm/chat', { messages, provider })
}

export const getProviders = async () => {
  return api.get('/llm/providers')
}

export default { chatWithAdvisor, getProviders }
