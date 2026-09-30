import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import Layout from '../components/common/Layout'
import { formatDate } from '../utils/formatters'
import { FaDownload, FaCheck, FaCrown } from 'react-icons/fa'
import toast from 'react-hot-toast'
import {
  getCurrentSubscription,
  getPlans,
  getBillingHistory,
  getUsageStats,
  upgradePlan,
  downgradePlan,
  cancelSubscription,
  resumeSubscription,
  createCheckoutSession,
  addPaymentMethod,
  removePaymentMethod,
  subscribeWithRazorpay,
} from '../services/subscriptionService'

/**
 * Subscription & Billing page.
 *
 * Loads the user's plan, catalog, usage and invoices from the real
 * /api/subscriptions endpoints. When Stripe is disabled server-side
 * the upgrade button still works — the backend switches the plan
 * in-place and records a synthetic invoice for display.
 */
export default function SubscriptionPage() {
  const user = useSelector((s) => s.auth?.user)
  const [selectedTab, setSelectedTab] = useState('plans')
  const [subscription, setSubscription] = useState(null)
  const [plans, setPlans] = useState([])
  const [stripeEnabled, setStripeEnabled] = useState(false)
  const [razorpayEnabled, setRazorpayEnabled] = useState(true)
  const [invoices, setInvoices] = useState([])
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyPlanId, setBusyPlanId] = useState(null)
  const [showAddPm, setShowAddPm] = useState(false)
  const [currency, setCurrency] = useState('INR')
  const [pmDraft, setPmDraft] = useState({ brand: 'visa', last4: '', expMonth: '', expYear: '' })

  async function loadAll() {
    setLoading(true)
    try {
      const [sub, catalog, billing, usageRes] = await Promise.all([
        getCurrentSubscription(),
        getPlans(),
        getBillingHistory(1, 20),
        getUsageStats(),
      ])
      setSubscription(sub)
      setPlans(catalog.plans || [])
      setStripeEnabled(Boolean(catalog.stripeEnabled))
      setRazorpayEnabled(Boolean(catalog.razorpayEnabled ?? true))
      setInvoices(billing.invoices || [])
      setUsage(usageRes)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load subscription')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Real-time refresh: while the user is on the Usage or Billing tab,
  // re-poll the relevant endpoint so meters / invoices reflect activity
  // happening elsewhere in the app (new transactions, ML calls, etc).
  // Avoid hammering the backend on the Plans / Payment tabs.
  useEffect(() => {
    if (selectedTab !== 'usage' && selectedTab !== 'billing') return undefined
    const tick = async () => {
      try {
        if (selectedTab === 'usage') {
          const u = await getUsageStats()
          setUsage(u)
        } else if (selectedTab === 'billing') {
          const b = await getBillingHistory(1, 20)
          setInvoices(b.invoices || [])
        }
      } catch {/* keep last good state */}
    }
    const id = setInterval(tick, 15_000)
    return () => clearInterval(id)
  }, [selectedTab])

  const currentPlanCode = subscription?.plan || 'FREE'

  const handleSelectPlan = async (plan) => {
    if (plan.code === currentPlanCode) {
      toast('You are already on this plan', { icon: 'ℹ️' })
      return
    }
    setBusyPlanId(plan.id)
    try {
      if (plan.code === 'FREE') {
        await downgradePlan(plan.id)
        toast.success('Switched to Free plan')
      } else if (currency === 'INR' && razorpayEnabled) {
        // Razorpay path — opens checkout, verifies signature, activates plan.
        await subscribeWithRazorpay({
          plan: plan.id,
          user,
          amountINR: plan.priceINR || Math.round(plan.price * 83),
        })
        toast.success(`Subscription activated: ${plan.name}`)
      } else if (stripeEnabled) {
        const session = await createCheckoutSession(plan.id)
        if (session.mode === 'stripe' && session.url) {
          window.location.href = session.url
          return
        }
        toast.success(`Upgraded to ${plan.name}`)
      } else {
        await upgradePlan(plan.id)
        toast.success(`Upgraded to ${plan.name}`)
      }
      await loadAll()
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to change plan'
      if (msg !== 'Payment cancelled') toast.error(msg)
    } finally {
      setBusyPlanId(null)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel auto-renewal at the end of this billing period?')) return
    try {
      await cancelSubscription(false)
      toast.success('Auto-renewal disabled')
      await loadAll()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to cancel')
    }
  }

  const handleResume = async () => {
    try {
      await resumeSubscription()
      toast.success('Subscription resumed')
      await loadAll()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to resume')
    }
  }

  const handleAddPm = async (e) => {
    e.preventDefault()
    try {
      await addPaymentMethod({
        brand: pmDraft.brand,
        last4: pmDraft.last4,
        expMonth: pmDraft.expMonth,
        expYear: pmDraft.expYear,
      })
      toast.success('Payment method saved')
      setShowAddPm(false)
      setPmDraft({ brand: 'visa', last4: '', expMonth: '', expYear: '' })
      await loadAll()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save payment method')
    }
  }

  const handleRemovePm = async () => {
    const pmId = subscription?.paymentMethod?.id
    if (!pmId) return
    if (!window.confirm('Remove this payment method?')) return
    try {
      await removePaymentMethod(pmId)
      toast.success('Payment method removed')
      await loadAll()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove')
    }
  }

  const usageRows = useMemo(() => {
    const u = usage?.usage || {}
    const pct = (cur, lim) => (!lim ? 0 : Math.min(100, Math.round(((cur || 0) / lim) * 100)))
    return [
      { key: 'apiCalls', label: 'API calls', info: u.apiCalls },
      { key: 'transactions', label: 'Transactions', info: u.transactions },
      { key: 'mlPredictions', label: 'ML predictions', info: u.mlPredictions },
    ].map((r) => ({
      ...r,
      pct: pct(r.info?.current, r.info?.limit),
    }))
  }, [usage])

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy-900 dark:text-navy-100">
            Subscription &amp; Billing
          </h1>
          <p className="text-navy-600 dark:text-navy-400 mt-2">
            Manage your plan, usage and payment details
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-navy-200 dark:border-navy-700">
          {[
            { id: 'plans', label: 'Plans' },
            { id: 'usage', label: 'Usage' },
            { id: 'billing', label: 'Billing History' },
            { id: 'payment', label: 'Payment Methods' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                selectedTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-navy-600 dark:text-navy-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="card p-6 text-center text-navy-600 dark:text-navy-400">
            Loading subscription…
          </div>
        )}

        {!loading && selectedTab === 'plans' && (
          <div className="space-y-8">
            {/* Current plan banner */}
            <div className="card p-6 bg-gradient-to-r from-primary-50 dark:from-primary-900/20 to-emerald-50 dark:to-emerald-900/20 border border-primary-200 dark:border-primary-800">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <FaCrown className="text-amber-500" />
                    <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-100">
                      Current Plan: {subscription?.planMeta?.name || currentPlanCode}
                    </h2>
                    {subscription?.status && (
                      <span
                        className={`badge ${
                          subscription.status === 'active' ? 'badge-success' : 'badge-warning'
                        }`}
                      >
                        {subscription.status}
                      </span>
                    )}
                  </div>
                  <p className="text-navy-600 dark:text-navy-400 mt-1">
                    {subscription?.currentPeriodEnd
                      ? `Renews on ${formatDate(subscription.currentPeriodEnd, 'MMM dd, yyyy')}`
                      : 'No renewal date on file'}
                    {subscription?.cancelAtPeriodEnd && ' · Cancels at period end'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {subscription?.cancelAtPeriodEnd ? (
                    <button className="btn-secondary" onClick={handleResume}>
                      Resume
                    </button>
                  ) : (
                    currentPlanCode !== 'FREE' && (
                      <button className="btn-secondary" onClick={handleCancel}>
                        Cancel Renewal
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Currency toggle */}
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-navy-500 dark:text-navy-400">
                {razorpayEnabled ? 'Powered by Razorpay (UPI/Card/Netbanking)' : ''}
              </span>
              <div className="inline-flex bg-navy-100 dark:bg-navy-800 rounded-lg p-1">
                <button
                  onClick={() => setCurrency('INR')}
                  className={`px-3 py-1 text-xs font-semibold rounded ${currency === 'INR' ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-navy-100 shadow' : 'text-navy-600'}`}
                >
                  INR ₹
                </button>
                <button
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-1 text-xs font-semibold rounded ${currency === 'USD' ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-navy-100 shadow' : 'text-navy-600'}`}
                >
                  USD $
                </button>
              </div>
            </div>

            {/* Pricing cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => {
                const isCurrent = plan.code === currentPlanCode
                const isUpgrade =
                  plan.code !== 'FREE' &&
                  (currentPlanCode === 'FREE' ||
                    (currentPlanCode === 'PRO' && plan.code === 'ENTERPRISE'))
                return (
                  <div
                    key={plan.id}
                    className={`relative card p-8 transition-all ${
                      plan.popular ? 'ring-2 ring-primary-500 scale-105' : ''
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="badge badge-primary">Most Popular</span>
                      </div>
                    )}
                    <h3 className="text-2xl font-bold text-navy-900 dark:text-navy-100 mb-2">
                      {plan.name}
                    </h3>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-navy-900 dark:text-navy-100">
                        {plan.price === 0
                          ? 'Free'
                          : currency === 'INR'
                            ? `₹${(plan.priceINR || Math.round(plan.price * 83)).toLocaleString('en-IN')}`
                            : `$${plan.price.toFixed(2)}`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-navy-600 dark:text-navy-400">/{plan.period}</span>
                      )}
                      {plan.price > 0 && currency === 'INR' && (
                        <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">
                          Billed monthly via Razorpay (UPI / Cards / Netbanking)
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrent || busyPlanId === plan.id}
                      className={`w-full mb-8 py-3 rounded-lg font-semibold transition-all ${
                        isCurrent
                          ? 'bg-navy-200 dark:bg-navy-700 text-navy-600 dark:text-navy-400 cursor-not-allowed'
                          : plan.popular
                            ? 'btn-primary'
                            : 'btn-secondary'
                      }`}
                    >
                      {busyPlanId === plan.id
                        ? 'Working…'
                        : isCurrent
                          ? 'Current plan'
                          : isUpgrade
                            ? stripeEnabled
                              ? 'Upgrade'
                              : 'Activate'
                            : plan.code === 'FREE'
                              ? 'Downgrade'
                              : 'Switch'}
                    </button>
                    <div className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <FaCheck
                            className="text-emerald-500 mt-1 flex-shrink-0"
                            size={14}
                          />
                          <span className="text-sm text-navy-600 dark:text-navy-400">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && selectedTab === 'usage' && (
          <div className="card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-100">
              This period's usage
            </h2>
            {usageRows.map((row) => (
              <div key={row.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-navy-700 dark:text-navy-300">{row.label}</span>
                  <span className="text-navy-500 dark:text-navy-400">
                    {row.info?.current || 0}
                    {row.info?.limit ? ` / ${row.info.limit}` : ' / unlimited'}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded bg-navy-100 dark:bg-navy-700 overflow-hidden">
                  <div
                    className={`h-2 ${
                      row.pct > 90
                        ? 'bg-red-500'
                        : row.pct > 70
                          ? 'bg-amber-500'
                          : 'bg-primary-500'
                    }`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
            {!usageRows.length && (
              <p className="text-sm text-navy-500 dark:text-navy-400">No usage recorded yet.</p>
            )}
          </div>
        )}

        {!loading && selectedTab === 'billing' && (
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-navy-200 dark:border-navy-700">
              <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-100">
                Billing History
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-navy-200 dark:border-navy-700">
                    {['Date', 'Invoice', 'Description', 'Amount', 'Status', 'Action'].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-left text-sm font-semibold text-navy-700 dark:text-navy-300"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-12 text-center text-sm text-navy-500 dark:text-navy-400"
                      >
                        No invoices yet. Upgrades will appear here once processed.
                      </td>
                    </tr>
                  )}
                  {invoices.map((inv) => (
                    <tr
                      key={inv._id || inv.stripeInvoiceId}
                      className="border-b border-navy-200 dark:border-navy-700 hover:bg-navy-50 dark:hover:bg-navy-800"
                    >
                      <td className="px-6 py-4 text-sm text-navy-600 dark:text-navy-400">
                        {inv.invoiceDate ? formatDate(inv.invoiceDate, 'MMM dd, yyyy') : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-navy-600 dark:text-navy-400">
                        {inv.stripeInvoiceId || inv._id}
                      </td>
                      <td className="px-6 py-4 text-sm text-navy-600 dark:text-navy-400">
                        {inv.description || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-navy-900 dark:text-navy-100">
                        {(inv.currency || 'usd').toUpperCase() === 'USD' ? '$' : ''}
                        {Number(inv.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`badge ${
                            inv.status === 'paid' ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {inv.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {inv.pdfUrl ? (
                          <a
                            className="text-primary-500 hover:text-primary-600 flex items-center gap-1"
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FaDownload size={14} />
                          </a>
                        ) : (
                          <span className="text-navy-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && selectedTab === 'payment' && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-100">
                Payment Methods
              </h2>
              <button
                className="btn-primary btn-sm"
                onClick={() => setShowAddPm((v) => !v)}
              >
                {showAddPm ? 'Close' : 'Add Payment Method'}
              </button>
            </div>

            {showAddPm && (
              <form
                onSubmit={handleAddPm}
                className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6 p-4 rounded-lg bg-navy-50 dark:bg-navy-800/50"
              >
                <select
                  className="input"
                  value={pmDraft.brand}
                  onChange={(e) => setPmDraft({ ...pmDraft, brand: e.target.value })}
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">Amex</option>
                  <option value="discover">Discover</option>
                  <option value="upi">UPI</option>
                </select>
                <input
                  className="input"
                  placeholder="Last 4 digits"
                  value={pmDraft.last4}
                  onChange={(e) => setPmDraft({ ...pmDraft, last4: e.target.value })}
                  maxLength={4}
                  required
                />
                <input
                  className="input"
                  placeholder="Exp. month"
                  value={pmDraft.expMonth}
                  onChange={(e) => setPmDraft({ ...pmDraft, expMonth: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Exp. year"
                  value={pmDraft.expYear}
                  onChange={(e) => setPmDraft({ ...pmDraft, expYear: e.target.value })}
                />
                <div className="md:col-span-4 flex justify-end">
                  <button className="btn-primary" type="submit">
                    Save
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {subscription?.paymentMethod?.id ? (
                <div className="p-4 border border-navy-200 dark:border-navy-700 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-navy-100 capitalize">
                      {subscription.paymentMethod.brand || 'Card'}
                    </p>
                    <p className="text-sm text-navy-600 dark:text-navy-400">
                      •••• •••• •••• {subscription.paymentMethod.last4 || '0000'}
                    </p>
                    {(subscription.paymentMethod.expMonth ||
                      subscription.paymentMethod.expYear) && (
                      <p className="text-xs text-navy-500 mt-1">
                        Expires {subscription.paymentMethod.expMonth || '—'}/
                        {subscription.paymentMethod.expYear || '—'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-danger btn-sm" onClick={handleRemovePm}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-navy-500 dark:text-navy-400">
                  No payment method on file.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
