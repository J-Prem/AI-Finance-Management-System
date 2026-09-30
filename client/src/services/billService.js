import api from './api'

// Bill CRUD
export const getBills = async (filters = {}, page = 1, limit = 20) => {
  const params = new URLSearchParams()
  params.append('page', page)
  params.append('limit', limit)

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })

  return api.get(`/bills?${params.toString()}`)
}

export const getBill = async (id) => {
  return api.get(`/bills/${id}`)
}

export const createBill = async (data) => {
  return api.post('/bills', data)
}

export const updateBill = async (id, data) => {
  return api.put(`/bills/${id}`, data)
}

export const deleteBill = async (id) => {
  return api.delete(`/bills/${id}`)
}

// Bill Operations
export const getUpcomingBills = async (days = 30) => {
  return api.get('/bills/upcoming', {
    params: { days },
  })
}

export const getOverdueBills = async () => {
  return api.get('/bills/overdue')
}

export const markBillAsPaid = async (id, paidAmount, paidDate) => {
  return api.post(`/bills/${id}/mark-paid`, {
    paidAmount,
    paidDate,
  })
}

export const markBillAsUnpaid = async (id) => {
  return api.post(`/bills/${id}/mark-unpaid`)
}

export const getBillCalendar = async (month, year) => {
  return api.get('/bills/calendar', {
    params: { month, year },
  })
}

// Autopay
export const toggleAutopay = async (id, enabled) => {
  return api.post(`/bills/${id}/autopay`, { enabled })
}

export const getAutopayBills = async () => {
  return api.get('/bills/autopay')
}

// Analytics
export const getBillStats = async (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  return api.get(`/bills/stats?${params.toString()}`)
}

export const getMonthlySummary = async () => {
  return api.get('/bills/monthly-summary')
}

export const getPaymentHistory = async (id) => {
  return api.get(`/bills/${id}/payment-history`)
}

// Reminders
export const getBillReminders = async () => {
  return api.get('/bills/reminders')
}

export const updateBillReminder = async (id, settings) => {
  return api.put(`/bills/${id}/reminders`, settings)
}
