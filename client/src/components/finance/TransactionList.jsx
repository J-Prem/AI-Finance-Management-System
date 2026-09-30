import { useState, useEffect, useMemo, useRef } from 'react'
import { FaPlus, FaTrash, FaDownload, FaUpload, FaFileCsv, FaArrowsRotate } from 'react-icons/fa6'
import toast from 'react-hot-toast'
import { useTransactions, useDeleteTransaction } from '../../hooks/useTransactions'
import DataTable from '../common/DataTable'
import TransactionForm from './TransactionForm'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { importTransactions, exportTransactions } from '../../services/transactionService'
import api from '../../services/api'

const SERVER_CATEGORIES = [
  'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Healthcare', 'Education', 'Travel',
  'Income', 'Investment', 'Uncategorized',
]

// Map common CSV header variants to the server's schema.
const HEADER_MAP = {
  date: 'date', transactiondate: 'date', txndate: 'date',
  description: 'description', desc: 'description', narration: 'description', details: 'description',
  category: 'category', cat: 'category',
  amount: 'amount', amt: 'amount', value: 'amount',
  type: 'type', kind: 'type',
  merchant: 'merchant', vendor: 'merchant',
  notes: 'notes', memo: 'notes',
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  // Simple CSV split — handles quoted fields with commas.
  const splitLine = (line) => {
    const out = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQ = !inQ
      else if (c === ',' && !inQ) { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out
  }
  const headers = splitLine(lines[0]).map((h) => HEADER_MAP[h.trim().toLowerCase().replace(/[^a-z]/g, '')] || h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cells = splitLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = (cells[i] || '').trim() })
    // Coerce
    if (row.amount) row.amount = parseFloat(String(row.amount).replace(/[^\d.-]/g, '')) || 0
    // Guess type from sign of amount if missing
    if (!row.type) row.type = row.amount < 0 ? 'expense' : (row.amount > 0 ? 'income' : 'expense')
    if (row.amount < 0) row.amount = Math.abs(row.amount)
    if (!row.category) row.category = 'Uncategorized'
    if (!row.date) row.date = new Date().toISOString()
    else {
      const d = new Date(row.date)
      if (!isNaN(d)) row.date = d.toISOString()
    }
    return row
  }).filter((r) => r.amount > 0 && r.description)
}

export default function TransactionList() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({})
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [rates, setRates] = useState(null)
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState(null)
  const fileInputRef = useRef(null)
  const { data, isLoading, refetch } = useTransactions(filters, page)
  const deleteMutation = useDeleteTransaction()

  const transactions = data?.data?.transactions || data?.transactions || []

  // Live forex ticker — refresh every 5 min
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await api.get('/external/forex/rates?base=INR&symbols=USD,EUR,GBP,JPY,AED')
        const r = res?.data?.rates || res?.data?.data?.rates
        if (mounted && r) {
          setRates(r)
          setRatesUpdatedAt(new Date())
        }
      } catch {}
    }
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => { mounted = false; clearInterval(t) }
  }, [])

  const stats = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0)
    const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0)
    return { income, expense, net: income - expense }
  }, [transactions])

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteMutation.mutateAsync(id)
        toast.success('Transaction deleted')
      } catch (error) {
        toast.error('Failed to delete transaction')
      }
    }
  }

  const handleFilePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const text = ev.target.result
        const rows = parseCSV(String(text))
        if (!rows.length) { toast.error('No valid rows found in CSV'); return }
        toast.loading(`Importing ${rows.length} transactions...`, { id: 'csvimport' })
        await importTransactions(rows)
        toast.success(`Imported ${rows.length} transactions`, { id: 'csvimport' })
        refetch?.()
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Import failed', { id: 'csvimport' })
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  const handleExport = async () => {
    try {
      const res = await exportTransactions(filters)
      const blob = res?.data instanceof Blob ? res.data : new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export ready')
    } catch {
      // Client-side fallback: CSV from current page
      const headers = ['date', 'description', 'category', 'type', 'amount']
      const rows = transactions.map((t) => [
        new Date(t.date).toISOString().slice(0, 10),
        JSON.stringify(t.description || ''),
        t.category || '',
        t.type || '',
        t.amount || 0,
      ].join(','))
      const csv = [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported current page')
    }
  }

  const categoryLabel = (value) => (!value || typeof value !== 'string') ? '—' : value

  const columns = [
    { key: 'date', label: 'Date', render: (value) => formatDate(value, 'MMM dd, yyyy') },
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category', render: (value) => categoryLabel(value) },
    {
      key: 'amount',
      label: 'Amount',
      render: (value, row) => (
        <span className={row.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
          {row.type === 'income' ? '+' : '-'} {formatCurrency(value)}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (value) => (
        <span className={`badge ${value === 'income' ? 'badge-success' : 'badge-primary'}`}>
          {value?.charAt(0).toUpperCase() + value?.slice(1)}
        </span>
      ),
    },
    {
      key: '_id',
      label: 'Action',
      render: (value, row) => (
        <button
          onClick={() => handleDelete(value || row.id)}
          className="text-rose-500 hover:text-rose-600 transition-colors"
        >
          <FaTrash />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-navy-100">Transactions</h1>
          <p className="text-sm text-navy-500 dark:text-navy-400">
            {transactions.length} entries on this page
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFilePick}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-lg bg-navy-100 hover:bg-navy-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-navy-900 dark:text-navy-100 flex items-center gap-2 text-sm"
            title="Upload CSV (columns: date,description,category,type,amount)"
          >
            <FaFileCsv /> Import CSV
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 rounded-lg bg-navy-100 hover:bg-navy-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-navy-900 dark:text-navy-100 flex items-center gap-2 text-sm"
          >
            <FaDownload /> Export
          </button>
          <button onClick={() => setIsFormOpen(true)} className="btn-primary">
            <FaPlus className="mr-2" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-navy-500">Income (page)</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(stats.income)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-navy-500">Expense (page)</div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(stats.expense)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-navy-500">Net (page)</div>
          <div className={`text-2xl font-bold ${stats.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {stats.net >= 0 ? '+' : ''}{formatCurrency(stats.net)}
          </div>
        </div>
      </div>

      {/* Live forex ticker */}
      {rates && (
        <div className="card p-3 flex items-center gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0 text-xs text-navy-500 border-r border-navy-200 dark:border-navy-700 pr-3">
            <FaArrowsRotate className="animate-spin-slow" size={12} />
            Live FX
            {ratesUpdatedAt && <span className="hidden md:inline">· {ratesUpdatedAt.toLocaleTimeString()}</span>}
          </div>
          {Object.entries(rates).slice(0, 10).map(([cur, v]) => (
            <div key={cur} className="text-sm shrink-0">
              <span className="text-navy-500">1 INR = </span>
              <span className="font-semibold text-navy-900 dark:text-navy-100">{Number(v).toFixed(4)} {cur}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <input
          type="date"
          placeholder="From date"
          onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
          className="input-base"
        />
        <input
          type="date"
          placeholder="To date"
          onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
          className="input-base"
        />
        <select
          onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}
          className="input-base"
        >
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select
          onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })}
          className="input-base"
        >
          <option value="">All Categories</option>
          {SERVER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={transactions}
        loading={isLoading}
        pagination
        pageSize={20}
      />

      <TransactionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => { setIsFormOpen(false); refetch?.() }}
      />
    </div>
  )
}
