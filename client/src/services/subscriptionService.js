import api from './api'

/**
 * Subscription service
 *
 * All endpoints hit the real /api/subscriptions/* backend which is
 * backed by MongoDB Atlas. Stripe is optional — if ENABLE_STRIPE_PAYMENTS
 * is disabled server-side, the checkout endpoint returns `mode: 'inline'`
 * and upgrades the plan directly.
 *
 * NOTE: the axios client's response interceptor unwraps to `response.data`,
 * so `api.get('/x')` already resolves to the server's JSON body (which is
 * usually `{ success, data: { ... } }`). We therefore read from `res.data`,
 * not `res.data.data`.
 */

// Safe-pick: walk a preferred path, but fall back to common shapes so the
// UI keeps working if the API wrapper changes.
const pick = (res, ...paths) => {
  for (const path of paths) {
    let cur = res
    for (const key of path.split('.')) {
      if (cur == null) break
      cur = cur[key]
    }
    if (cur !== undefined && cur !== null) return cur
  }
  return null
}

export const getCurrentSubscription = async () => {
  const res = await api.get('/subscriptions/current')
  return pick(res, 'data.subscription', 'subscription', 'data.data.subscription') || null
}

export const getPlans = async () => {
  const res = await api.get('/subscriptions/plans')
  return pick(res, 'data', 'data.data') || { plans: [], stripeEnabled: false }
}

export const createCheckoutSession = async (plan) => {
  const res = await api.post('/subscriptions/checkout', { plan })
  return pick(res, 'data', 'data.data') || {}
}

export const upgradePlan = async (planId, paymentMethodId) => {
  const res = await api.post('/subscriptions/upgrade', { planId, paymentMethodId })
  return pick(res, 'data.subscription', 'data.data.subscription') || null
}

export const downgradePlan = async (planId) => {
  const res = await api.post('/subscriptions/downgrade', { planId })
  return pick(res, 'data.subscription', 'data.data.subscription') || null
}

export const cancelSubscription = async (immediately = false) => {
  const res = await api.post('/subscriptions/cancel', { immediately })
  return pick(res, 'data.subscription', 'data.data.subscription') || null
}

export const resumeSubscription = async () => {
  const res = await api.post('/subscriptions/resume')
  return pick(res, 'data.subscription', 'data.data.subscription') || null
}

export const getBillingHistory = async (page = 1, limit = 20) => {
  const res = await api.get(`/subscriptions/billing-history?page=${page}&limit=${limit}`)
  const data = pick(res, 'data', 'data.data')
  return data || { invoices: [], total: 0, page, limit, pages: 1 }
}

export const getUsageStats = async () => {
  const res = await api.get('/subscriptions/usage-stats')
  return pick(res, 'data', 'data.data') || { usage: {}, summary: {} }
}

export const addPaymentMethod = async (data) => {
  const res = await api.post('/subscriptions/payment-methods', data)
  return pick(res, 'data.subscription', 'data.data.subscription') || null
}

export const removePaymentMethod = async (paymentMethodId) => {
  const res = await api.delete(`/subscriptions/payment-methods/${paymentMethodId}`)
  return res || { success: true }
}

export const getInvoice = async (invoiceId) => {
  const res = await api.get(`/subscriptions/invoices/${invoiceId}`)
  return pick(res, 'data.invoice', 'data.data.invoice') || null
}

/* ------------------------ Razorpay helpers ------------------------ */

export const getRazorpayKey = async () => {
  const res = await api.get('/subscriptions/razorpay/key')
  return pick(res, 'data.keyId', 'data.data.keyId') || 'rzp_test_SfQrr3XqTwUvJH'
}

export const createRazorpayOrder = async (plan, { amount, currency = 'INR' } = {}) => {
  const res = await api.post('/subscriptions/razorpay/order', { plan, amount, currency })
  return pick(res, 'data', 'data.data') || {}
}

export const verifyRazorpayPayment = async (payload) => {
  const res = await api.post('/subscriptions/razorpay/verify', payload)
  return pick(res, 'data', 'data.data') || {}
}

/**
 * Dynamically load the Razorpay checkout script.
 */
export const loadRazorpayCheckout = () =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'))
    if (window.Razorpay) return resolve(window.Razorpay)
    const existing = document.getElementById('razorpay-checkout-script')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay))
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')))
      return
    }
    const script = document.createElement('script')
    script.id = 'razorpay-checkout-script'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(window.Razorpay)
    script.onerror = () => reject(new Error('Failed to load Razorpay'))
    document.body.appendChild(script)
  })

/**
 * End-to-end subscribe flow: create order → open widget → verify →
 * update backend. Returns the updated subscription on success.
 */
export const subscribeWithRazorpay = async ({ plan, user, amountINR, onOrder } = {}) => {
  if (!plan) throw new Error('Plan is required')
  await loadRazorpayCheckout()
  const { order, plan: planMeta } = await createRazorpayOrder(plan, {
    amount: amountINR,
    currency: 'INR',
  })
  if (!order?.id) throw new Error('Unable to create order')
  if (onOrder) onOrder(order)
  const keyId = order.keyId || (await getRazorpayKey())
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'AI Finance',
      description: `${planMeta?.name || plan} plan – monthly`,
      order_id: order.id,
      prefill: {
        name: user?.name || '',
        email: user?.email || '',
        contact: user?.phone || '',
      },
      theme: { color: '#3B82F6' },
      handler: async (response) => {
        try {
          const verified = await verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            plan,
          })
          resolve(verified)
        } catch (err) {
          reject(err)
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    })
    rz.on('payment.failed', (response) => reject(new Error(response?.error?.description || 'Payment failed')))
    rz.open()
  })
}

export default {
  getCurrentSubscription,
  getPlans,
  createCheckoutSession,
  upgradePlan,
  downgradePlan,
  cancelSubscription,
  resumeSubscription,
  getBillingHistory,
  getUsageStats,
  addPaymentMethod,
  removePaymentMethod,
  getInvoice,
  getRazorpayKey,
  createRazorpayOrder,
  verifyRazorpayPayment,
  loadRazorpayCheckout,
  subscribeWithRazorpay,
}
