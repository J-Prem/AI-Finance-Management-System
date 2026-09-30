import api from './api'

export const generateKey = (data) => api.post('/api-keys', data)
export const listKeys = () => api.get('/api-keys')
export const getKey = (id) => api.get(`/api-keys/${id}`)
export const updateKey = (id, data) => api.patch(`/api-keys/${id}`, data)
export const revokeKey = (id) => api.post(`/api-keys/${id}/revoke`)
export const rotateKey = (id) => api.post(`/api-keys/${id}/rotate`)
export const deleteKey = (id) => api.delete(`/api-keys/${id}`)
export const addPermission = (id, perm) => api.post(`/api-keys/${id}/permissions`, perm)
export const removePermission = (id, perm) => api.delete(`/api-keys/${id}/permissions`, { data: perm })
export const getKeyUsage = (id) => api.get(`/api-keys/${id}/usage`)

export default {
  generateKey, listKeys, getKey, updateKey, revokeKey, rotateKey,
  deleteKey, addPermission, removePermission, getKeyUsage,
}
