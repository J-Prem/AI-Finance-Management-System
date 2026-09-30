import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { FaPlus, FaCircleCheck, FaWandMagicSparkles, FaTrashCan } from 'react-icons/fa6'
import Layout from '../components/common/Layout'
import Modal from '../components/common/Modal'
import StatCard from '../components/common/StatCard'
import BillCalendar from '../components/finance/BillCalendar'
import { formatCurrency, formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'
import {
  getBills,
  createBill,
  deleteBill,
  markBillAsPaid,
} from '../services/billService'
import api from '../services/api'

// Sample data used when the user is unauthenticated / has no bills yet.
const DEMO_BILLS = [
  { _id: 'demo-1', name: 'Internet Bill',        category: 'Bills & Utilities', amount: 799,  frequency: 'monthly', dueDate: 15, nextDueDate: new Date(Date.now() + 3  * 86400000).toISOString(), autopay: { enabled: true  }, status: 'upcoming', demo: true },
  { _id: 'demo-2', name: 'Electricity Bill',     category: 'Bills & Utilities', amount: 1250, frequency: 'monthly', dueDate: 22, nextDueDate: new Date(Date.now() + 8  * 86400000).toISOString(), autopay: { enabled: false }, status: 'upcoming', demo: true },
  { _id: 'demo-3', name: 'Netflix Subscription', category: 'Subscriptions',     amount: 149,  frequency: 'monthly', dueDate: 1,  nextDueDate: new Date(Date.now() - 2  * 86400000).toISOString(), autopay: { enabled: true  }, status: 'overdue',  demo: true },
  { _id: 'demo-4', name: 'Credit Card Payment',  category: 'Bills & Utilities', amount: 5000, frequency: 'monthly', dueDate: 28, nextDueDate: new Date(Date.now() + 15 * 86400000).toISOString(), autopay: { enabled: false }, status: 'upcoming', demo: true },
  { _id: 'demo-5', name: 'Insurance Premium',    category: 'Healthcare',        amount: 2500, frequency: 'monthly', dueDate: 20, nextDueDate: new Date(Date.now() + 12 * 86400000).toISOString(), autopay: { enabled: true  }, status: 'upcoming', demo: true },
]

const CATEGORIES = [
  'Bills & Utilities', 'Transportation', 'Subscriptions',
  'Healthcare', 'Education', 'Entertainment', 'Home', 'Other',
]

// Compute status from nextDueDate + lastPaidDate.
function deriveStatus(b) {
  if (b.status) return b.status
  const now = Date.now()
  const due = new Date(b.nextDueDate || b.dueDate || now).getTime()
  if (b.lastPaidDate && new Date(b.lastPaidDate).getTime() > now - 30 * 86400000) return 'paid'
  if (due < now) return 'overdue'
  return 'upcoming'
}

export default function BillsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [deriving, setDeriving] = useState(false)
  const [formData, setFormData] = useState({
    name: '', category: 'Bills & Utilities', amount: '', dueDate: '',
    frequency: 'monthly', autopay: false,
  })

  const fetchBills = useCallback(async () => {
    try {
      const res = await getBills({ isActive: true }, 1, 100)
      const data = res?.data || []
      if (Array.isArray(data) && data.length) {
        setBills(data.map((b) => ({ ...b, status: deriveStatus(b) })))
        setIsDemo(false)
      } else {
        setBills(DEMO_BILLS)
        setIsDemo(true)
      }
    } catch {
      setBills(DEMO_BILLS)
      setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBills() }, [fetchBills])

  // Monthly cost accounts for frequency.
  const monthlyCost = bills.reduce((sum, b) => {
    const f = b.frequency
    if (f === 'weekly') return sum + b.amount * 4.33
    if (f === 'biweekly') return sum + b.amount * 2.17
    if (f === 'quarterly') return sum + b.amount / 3
    if (f === 'yearly') return sum + b.amount / 12
    return sum + b.amount // monthly / daily default
  }, 0)

  const upcomingBills = bills.filter((b) => b.status === 'upcoming')
  const overdueBills = bills.filter((b) => b.status === 'overdue')
  const paidBills = bills.filter((b) => b.status === 'paid')

  const handleAddBill = async () => {
    if (!formData.name || !formData.amount || !formData.dueDate) {
      toast.error('Please fill in name, amount, and due date')
      return
    }
    // dueDate input is a date string → extract day-of-month for backend schema.
    const dueDay = new Date(formData.dueDate).getDate()
    const payload = {
      name: formData.name,
      category: formData.category,
      amount: parseFloat(formData.amount),
      frequency: formData.frequency,
      dueDate: dueDay,
      nextDueDate: new Date(formData.dueDate).toISOString(),
      autopay: { enabled: !!formData.autopay, method: formData.autopay ? 'card' : null },
      currency: 'INR',
    }
    try {
      const res = await createBill(payload)
      const bill = res?.data || res
      setBills((prev) => (isDemo ? [bill] : [...prev, { ...bill, status: deriveStatus(bill) }]))
      setIsDemo(false)
      toast.success('Bill added')
    } catch (err) {
      if (err?.response?.status === 401) {
        toast.error('Sign in to save bills — adding locally')
        const local = { ...payload, _id: `local-${Date.now()}`, status: 'upcoming', demo: true }
        setBills((prev) => [...prev, local])
      } else {
        toast.error(err?.response?.data?.message || 'Unable to add bill')
      }
    } finally {
      setFormData({ name: '', category: 'Bills & Utilities', amount: '', dueDate: '', frequency: 'monthly', autopay: false })
      setIsModalOpen(false)
    }
  }

  const handleMarkAsPaid = async (bill) => {
    if (bill.demo) {
      setBills((prev) => prev.map((b) => (b._id === bill._id ? { ...b, status: 'paid', lastPaidDate: new Date().toISOString() } : b)))
      toast.success('Marked paid (demo)')
      return
    }
    try {
      const res = await markBillAsPaid(bill._id)
      const updated = res?.data || { ...bill, status: 'paid' }
      setBills((prev) => prev.map((b) => (b._id === bill._id ? { ...updated, status: 'paid' } : b)))
      toast.success('Marked paid')
    } catch {
      toast.error('Unable to mark as paid')
    }
  }

  const handleDelete = async (bill) => {
    if (bill.demo) {
      setBills((prev) => prev.filter((b) => b._id !== bill._id))
      return
    }
    try {
      await deleteBill(bill._id)
      setBills((prev) => prev.filter((b) => b._id !== bill._id))
      toast.success('Deleted')
    } catch {
      toast.error('Unable to delete')
    }
  }

  // Ask the server to scan uploaded receipts + transactions for recurring merchants
  // and propose bills. Backend decides which are genuinely recurring (stable amount, >=3 repeats).
  const deriveFromReceipts = async () => {
    setDeriving(true)
    try {
      const res = await api.post('/bills/derive-from-receipts', {})
      const data = res?.data || res
      const added = data?.added || []
      if (added.length) {
        setBills((prev) => {
          // Replace demo list with real bills if this was the user's first derivation.
          const base = isDemo ? [] : prev
          return [...base, ...added.map((b) => ({ ...b, status: deriveStatus(b) }))]
        })
        setIsDemo(false)
        toast.success(`Detected ${added.length} recurring bill${added.length === 1 ? '' : 's'} from your receipts`)
      } else {
        toast('No new recurring bills found — upload more receipts to improve detection.', { icon: 'ℹ️' })
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        toast.error('Sign in to derive bills from your receipts')
      } else {
        toast.error(err?.response?.data?.message || 'Bill detection unavailable — try again later')
      }
    } finally {
      setDeriving(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-navy-100">Bills & Subscriptions</h1>
            <p className="text-navy-600 dark:text-navy-400 mt-2">
              {isDemo ? 'Sample bills — add yours or auto-detect from receipts.' : 'Live bill tracker with auto-detection.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={deriveFromReceipts}
              disabled={deriving}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold rounded-lg disabled:opacity-50"
              title="Scan your receipts + transactions for recurring merchants"
            >
              <FaWandMagicSparkles />
              {deriving ? 'Scanning…' : 'Detect from Receipts'}
            </motion.button>
            <motion.button
              onClick={() => setIsModalOpen(true)}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg"
            >
              <FaPlus size={18} /> Add Bill
            </motion.button>
          </div>
        </div>

        {isDemo && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
            You&apos;re viewing sample bills. Sign in, then add a bill or upload a few receipts and hit <strong>Detect from Receipts</strong> to go live.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard label="Monthly Cost" value={Math.round(monthlyCost)} color="primary" />
          <StatCard label="Upcoming"       value={upcomingBills.length} currency={false} suffix="bills" color="amber" />
          <StatCard label="Overdue"        value={overdueBills.length}  currency={false} suffix="bills" color="rose" />
          <StatCard label="Paid This Month" value={paidBills.length}    currency={false} suffix="bills" color="emerald" />
        </div>

        {overdueBills.length > 0 && (
          <motion.div
            className="p-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-rose-900 dark:text-rose-100">
                  You have {overdueBills.length} overdue bill{overdueBills.length > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                  Pay soon to avoid late fees — enable autopay on recurring ones to never miss again.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            className="lg:col-span-2 space-y-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          >
            <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100">All Bills</h3>

            {loading ? (
              <div className="py-10 text-center text-navy-500">Loading bills…</div>
            ) : bills.length === 0 ? (
              <div className="py-10 text-center text-navy-500">
                No bills yet — add one or click <strong>Detect from Receipts</strong>.
              </div>
            ) : (
              bills.map((bill, idx) => {
                const due = new Date(bill.nextDueDate || bill.dueDate || Date.now())
                const daysUntilDue = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24))
                const isOverdue = daysUntilDue < 0
                const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0

                return (
                  <motion.div
                    key={bill._id || idx}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      bill.status === 'paid'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                        : isOverdue
                          ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'
                          : isDueSoon
                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                            : 'bg-navy-50 dark:bg-navy-800 border-navy-200 dark:border-navy-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-semibold text-navy-900 dark:text-navy-100">{bill.name}</p>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-navy-200/60 dark:bg-navy-700 text-navy-700 dark:text-navy-200">
                            {bill.frequency}
                          </span>
                          {bill.autopay?.enabled && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                              Autopay ✓
                            </span>
                          )}
                          {bill.metadata?.source === 'receipt-derived' && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                              AI-detected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-navy-600 dark:text-navy-400">{bill.category}</p>
                          <p className={`text-sm font-medium ${
                            isOverdue ? 'text-rose-600 dark:text-rose-400'
                            : isDueSoon ? 'text-amber-600 dark:text-amber-400'
                            : 'text-navy-600 dark:text-navy-400'
                          }`}>
                            {isOverdue
                              ? `Overdue ${Math.abs(daysUntilDue)} days`
                              : isDueSoon
                                ? `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`
                                : `Due on ${formatDate(due, 'MMM dd')}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-bold text-navy-900 dark:text-navy-100">{formatCurrency(bill.amount)}</p>
                          <p className="text-xs text-navy-600 dark:text-navy-400">{bill.status}</p>
                        </div>

                        {bill.status !== 'paid' && (
                          <motion.button
                            onClick={() => handleMarkAsPaid(bill)}
                            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                            className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                            title="Mark paid"
                          >
                            <FaCircleCheck size={18} />
                          </motion.button>
                        )}
                        <button
                          onClick={() => handleDelete(bill)}
                          className="p-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                          title="Delete"
                        >
                          <FaTrashCan size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          >
            <BillCalendar bills={bills} />
          </motion.div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Bill">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">Bill Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Internet Bill"
              className="w-full px-4 py-2 bg-navy-100 dark:bg-navy-800 border border-navy-300 dark:border-navy-700 rounded-lg text-navy-900 dark:text-navy-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 bg-navy-100 dark:bg-navy-800 border border-navy-300 dark:border-navy-700 rounded-lg text-navy-900 dark:text-navy-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">Amount</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-2 bg-navy-100 dark:bg-navy-800 border border-navy-300 dark:border-navy-700 rounded-lg text-navy-900 dark:text-navy-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">Next Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-2 bg-navy-100 dark:bg-navy-800 border border-navy-300 dark:border-navy-700 rounded-lg text-navy-900 dark:text-navy-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-4 py-2 bg-navy-100 dark:bg-navy-800 border border-navy-300 dark:border-navy-700 rounded-lg text-navy-900 dark:text-navy-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.autopay}
              onChange={(e) => setFormData({ ...formData, autopay: e.target.checked })}
              className="w-4 h-4 accent-primary-500"
            />
            <span className="text-sm text-navy-700 dark:text-navy-300">Enable Autopay</span>
          </label>

          <motion.button
            onClick={handleAddBill}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg transition-all"
          >
            Add Bill
          </motion.button>
        </div>
      </Modal>
    </Layout>
  )
}
