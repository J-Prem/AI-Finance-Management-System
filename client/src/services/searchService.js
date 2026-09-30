import api from './api'

export const globalSearch = async (q, limit = 5) => {
  if (!q) return { results: [] }
  const res = await api.get(`/search?q=${encodeURIComponent(q)}&limit=${limit}`)
  return res?.data || { results: [] }
}

export default { globalSearch }
