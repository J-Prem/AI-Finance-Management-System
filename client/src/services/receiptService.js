import api from './api'

export const uploadReceipt = async ({ imageBase64, mimeType, text }) => {
  return api.post('/receipts/upload', { imageBase64, mimeType, text })
}

export const listReceipts = async () => {
  return api.get('/receipts')
}

export const receiptStats = async () => {
  return api.get('/receipts/stats')
}

export const getReceipt = async (id) => {
  return api.get(`/receipts/${id}`)
}

export const deleteReceipt = async (id) => {
  return api.delete(`/receipts/${id}`)
}

export const overrideReceiptCategory = async (id, category) => {
  return api.patch(`/receipts/${id}/category`, { category })
}

export const retagReceipt = async (id, { tags = [], notes = '' }) => {
  return api.post(`/receipts/${id}/retag`, { tags, notes })
}

// Returns a signed-ish URL the <img> tag can use directly — the server
// authenticates via the same Bearer token cookie/header, so this works for a
// logged-in user within the SPA.
export const getReceiptImageUrl = (id) => `/api/receipts/${id}/image`

export default {
  uploadReceipt,
  listReceipts,
  receiptStats,
  getReceipt,
  deleteReceipt,
  overrideReceiptCategory,
  retagReceipt,
  getReceiptImageUrl,
}
