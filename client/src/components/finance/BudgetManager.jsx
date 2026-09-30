import { useMemo, useState, useEffect } from 'react'
import { FaEdit, FaTrash, FaPlus, FaBolt, FaArrowTrendUp } from 'react-icons/fa6'
import toast from 'react-hot-toast'
import { formatCurrency } from '../../utils/formatters'
import {
  useBudgetStatus,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from '../../hooks/useBudgets'
import Modal from '../common/Modal'
import api from '../../services/api'

// Static benchmarks — % of income for each category (India urban, 2024 CPI averages).
const CATEGORY_BENCHMARKS = {
  'Food & Dining':    { pctIncome: 0.15, hint: 'Typical 12-18% of income' },
  'Transportation':   { pctIncome: 0.10, hint: 'Typical 8-12% of income' },
  'Bills & Utilities':{ pctIncome: 0.08, hint: 'Typical 5-10% of income' },
  'Healthcare':       { pctIncome: 0.05, hint: 'Minimum 5% recommended' },
  'Shopping':         { pctIncome: 0.06, hint: 'Keep under 8% for savings' },
  'Entertainment':    { pctIncome: 0.05, hint: 'Balance: 3-7% of income' },
  'Travel':           { pctIncome: 0.07, hint: 'Plan for 5-10% annually' },
  'Education':        { pctIncome: 0.08, hint: 'Investment: 5-15% of income' },
}

// Smart templates applied when user clicks quick-start.
const TEMPLATES = {
  '50/30/20': {
    name: '50/30/20 Rule',
    desc: '50% needs · 30% wants · 20% savings',
    allocations: {
      'Bills & Utilities': 0.20,
      'Food & Dining': 0.15,
      'Transportation': 0.10,
      'Shopping': 0.10,
      'Entertainment': 0.10,
      'Healthcare': 0.05,
      'Travel': 0.10,
    },
  },
  Conservative: {
    name: 'Conservative',
    desc: 'High savings, low discretionary',
    allocations: {
      'Bills & Utilities': 0.22,
      'Food & Dining': 0.14,
      'Transportation': 0.08,
      'Healthcare': 0.06,
      'Shopping': 0.05,
      'Entertainment': 0.03,
      'Education': 0.05,
    },
  },
  Aggressive: {
    name: 'Growth',
    desc: 'Focus on education + investment',
    allocations: {
      'Bills & Utilities': 0.18,
      'Food & Dining': 0.12,
      'Transportation': 0.07,
      'Education': 0.15,
      'Healthcare': 0.05,
      'Shopping': 0.04,
      'Entertainment': 0.04,
    },
  },
}

// Canonical server categories (see server/config/constants.js TRANSACTION_CATEGORIES).
const SERVER_CATEGORIES = [
  'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Healthcare', 'Education', 'Travel',
  'Personal Care', 'Home & Garden', 'Gifts & Donations',
  'Business Services', 'Financial Charges', 'Taxes', 'Uncategorized',
]

const PERIODS = ['weekly', 'monthly', 'quarterly', 'yearly']

function progressPct(spent, amount) {
  if (!amount || amount <= 0) return 0
  return Math.min((spent / amount) * 100, 100)
}
function statusColor(pct) {
  if (pct >= 90) return 'text-rose-600 dark:text-rose-400'
  if (pct >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}
function barColor(pct) {
  if (pct >= 90) return 'bg-rose-500'
  if (pct >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

const EMPTY_FORM = {
  name: '',
  category: 'Food & Dining',
  amount: '',
  period: 'monthly',
  startDate: new Date().toISOString().slice(0, 10),
}

export default function BudgetManager() {
  const { data: budgets = [], isLoading, isError, refetch } = useBudgetStatus()
  const createMut = useCreateBudget()
  const updateMut = useUpdateBudget()
  const deleteMut = useDeleteBudget()

  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [inflation, setInflation] = useState(null)
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [isTemplateOpen, setIsTemplateOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('50/30/20')

  // Fetch latest CPI/inflation (best-effort — many free APIs don't expose CPI, so we
  // fall back to a sensible default of 4.8% if the endpoint isn't available).
  useEffect(() => {
    let mounted = true
    api.get('/external/economy/inflation')
      .then((res) => {
        const val = res?.data?.inflationRate ?? res?.data?.data?.inflationRate
        if (mounted && typeof val === 'number') setInflation(val)
      })
      .catch(() => { if (mounted) setInflation(4.8) })
    return () => { mounted = false }
  }, [])

  const applyTemplate = async (templateKey) => {
    const tpl = TEMPLATES[templateKey]
    const income = Number(monthlyIncome)
    if (!tpl) return
    if (!income || income <= 0) return toast.error('Enter your monthly income first')
    let created = 0
    try {
      for (const [cat, pct] of Object.entries(tpl.allocations)) {
        const amount = Math.round(income * pct)
        await createMut.mutateAsync({
          name: cat,
          category: cat,
          amount,
          period: 'monthly',
          startDate: new Date().toISOString().slice(0, 10),
        })
        created++
      }
      toast.success(`Created ${created} budgets using ${tpl.name}`)
      setIsTemplateOpen(false)
      refetch()
    } catch (err) {
      toast.error(`Created ${created} budgets before error. ${err?.response?.data?.message || ''}`)
    }
  }

  const totals = useMemo(() => {
    const list = budgets || []
    return list.reduce(
      (acc, b) => {
        acc.budget += Number(b.amount) || 0
        acc.spent += Number(b.spent) || 0
        return acc
      },
      { budget: 0, spent: 0 }
    )
  }, [budgets])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setIsOpen(true)
  }

  const openEdit = (b) => {
    setEditing(b)
    setForm({
      name: b.name || '',
      category: b.category || 'Food & Dining',
      amount: String(b.amount ?? ''),
      period: b.period || 'monthly',
      startDate: (b.startDate || new Date().toISOString()).slice(0, 10),
    })
    setIsOpen(true)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Enter a budget name')
    const amount = Number(form.amount)
    if (!amount || amount <= 0) return toast.error('Amount must be positive')

    try {
      if (editing?.id || editing?._id) {
        await updateMut.mutateAsync({ id: editing.id || editing._id, data: form })
        toast.success('Budget updated')
      } else {
        await createMut.mutateAsync(form)
        toast.success('Budget created')
      }
      setIsOpen(false)
      setForm(EMPTY_FORM)
      setEditing(null)
    } catch (err) {
      const msg = err?.response?.data?.message
        || err?.response?.data?.errors?.[0]?.message
        || err?.message
      toast.error(msg || 'Unable to save budget')
    }
  }

  const onDelete = async (b) => {
    if (!confirm(`Delete budget "${b.name}"?`)) return
    try {
      await deleteMut.mutateAsync(b.id || b._id)
      toast.success('Budget removed')
    } catch {
      toast.error('Unable to delete budget')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-navy-900 dark:text-navy-100">Budget Overview</h2>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">
            {budgets.length} active · total limit {formatCurrency(totals.budget)} · spent {formatCurrency(totals.spent)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary btn-sm" onClick={() => refetch()}>Refresh</button>
          <button
            className="px-3 py-2 text-sm rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold flex items-center gap-1 hover:opacity-90"
            onClick={() => setIsTemplateOpen(true)}
            title="Use smart templates to bootstrap budgets"
          >
            <FaBolt size={12} /> Smart Templates
          </button>
          <button className="btn-primary btn-sm" onClick={openCreate}>
            <FaPlus className="mr-1" /> New Budget
          </button>
        </div>
      </div>

      {/* Live inflation banner */}
      {inflation != null && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border border-primary-200 dark:border-primary-800 flex items-center gap-3 text-sm">
          <FaArrowTrendUp className="text-primary-600" />
          <span className="text-navy-700 dark:text-navy-300">
            Current inflation: <strong>{inflation.toFixed(2)}%</strong> — budgets set 12 months ago may need a {inflation.toFixed(1)}% uplift to maintain purchasing power.
          </span>
        </div>
      )}

      {isLoading && (
        <div className="py-12 text-center text-navy-500">Loading budgets…</div>
      )}

      {isError && (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
          Couldn&apos;t load budgets. Make sure you&apos;re signed in, then click Refresh.
        </div>
      )}

      {!isLoading && !isError && budgets.length === 0 && (
        <div className="card p-10 text-center">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-2">
            No budgets yet
          </h3>
          <p className="text-sm text-navy-500 dark:text-navy-400 mb-4">
            Create your first budget to start tracking spending against a target.
          </p>
          <button className="btn-primary" onClick={openCreate}>
            <FaPlus className="mr-2" /> Create budget
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map((b) => {
          const pct = progressPct(b.spent, b.amount)
          const remaining = Math.max(0, (b.amount || 0) - (b.spent || 0))
          return (
            <div key={b.id || b._id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-navy-900 dark:text-navy-100">{b.name}</h3>
                  <p className="text-xs text-navy-600 dark:text-navy-400 mt-1">
                    {(b.period || 'monthly').charAt(0).toUpperCase() + (b.period || 'monthly').slice(1)}
                    {b.category ? ` · ${b.category}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    className="p-2 hover:bg-navy-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                    onClick={() => openEdit(b)}
                    title="Edit"
                  >
                    <FaEdit className="text-primary-500" size={14} />
                  </button>
                  <button
                    className="p-2 hover:bg-navy-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                    onClick={() => onDelete(b)}
                    title="Delete"
                  >
                    <FaTrash className="text-rose-500" size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-navy-600 dark:text-navy-400">Spent</span>
                  <span className={`font-semibold ${statusColor(pct)}`}>
                    {formatCurrency(b.spent || 0)}
                  </span>
                </div>
                <div className="w-full bg-navy-200 dark:bg-navy-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-navy-600 dark:text-navy-400">
                  <span>{formatCurrency(remaining)} remaining</span>
                  <span>{Math.round(pct)}%</span>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <div className="text-navy-600 dark:text-navy-400">Budget: {formatCurrency(b.amount || 0)}</div>
                {b.status && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.status === 'exceeded' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                    : b.status === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  }`}>
                    {b.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'Edit Budget' : 'Create Budget'}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Groceries"
              className="input-base w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-base w-full"
              >
                {SERVER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">Period</label>
              <select
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                className="input-base w-full"
              >
                {PERIODS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">Amount</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="input-base w-full"
                required
              />
              {CATEGORY_BENCHMARKS[form.category] && (
                <p className="text-xs text-navy-500 mt-1">
                  📊 {CATEGORY_BENCHMARKS[form.category].hint}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input-base w-full"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={createMut.isLoading || updateMut.isLoading}>
              {editing ? 'Save changes' : 'Create budget'}
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setIsOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Smart Template modal */}
      <Modal isOpen={isTemplateOpen} onClose={() => setIsTemplateOpen(false)} title="Smart Budget Templates">
        <div className="space-y-4">
          <p className="text-sm text-navy-600 dark:text-navy-400">
            Pick a pre-built plan and we&apos;ll split your income into category budgets.
          </p>

          <div>
            <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
              Your monthly income
            </label>
            <input
              type="number"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              placeholder="50000"
              className="input-base w-full"
            />
          </div>

          <div className="space-y-2">
            {Object.entries(TEMPLATES).map(([key, tpl]) => (
              <div
                key={key}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedTemplate === key
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-navy-200 dark:border-navy-700 hover:border-navy-400'
                }`}
                onClick={() => setSelectedTemplate(key)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-navy-900 dark:text-navy-100">{tpl.name}</div>
                    <div className="text-xs text-navy-500">{tpl.desc}</div>
                  </div>
                  <div className="text-xs text-navy-600 dark:text-navy-400">
                    {Object.keys(tpl.allocations).length} budgets
                  </div>
                </div>
                {selectedTemplate === key && Number(monthlyIncome) > 0 && (
                  <div className="mt-3 pt-3 border-t border-navy-200 dark:border-navy-700 space-y-1">
                    {Object.entries(tpl.allocations).map(([cat, pct]) => (
                      <div key={cat} className="flex justify-between text-xs">
                        <span className="text-navy-600 dark:text-navy-400">{cat}</span>
                        <span className="font-semibold">
                          {formatCurrency(Math.round(Number(monthlyIncome) * pct))}
                          <span className="text-navy-400 ml-1">({(pct * 100).toFixed(0)}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => applyTemplate(selectedTemplate)}
              disabled={!monthlyIncome || createMut.isLoading}
            >
              Apply template
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setIsTemplateOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
