import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { FaDownload } from 'react-icons/fa6'
import toast from 'react-hot-toast'
import Layout from '../components/common/Layout'
import MonthlyComparisonChart from '../components/charts/MonthlyComparisonChart'
import { formatCurrency } from '../utils/formatters'
import { getTransactions } from '../services/transactionService'
import { getCategoryBreakdown, getSavingsRate, getIncomeExpense } from '../services/analyticsService'

const REPORT_TYPES = [
  { id: 'monthly', label: 'Monthly', icon: '📊' },
  { id: 'quarterly', label: 'Quarterly', icon: '📈' },
  { id: 'annual', label: 'Annual', icon: '📋' },
  { id: 'tax', label: 'Tax', icon: '🧾' },
  { id: 'custom', label: 'Custom', icon: '🛠️' },
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Compute the date range for a given report type + anchor year/month.
function rangeFor(type, year, month, customStart, customEnd) {
  let start, end
  if (type === 'custom' && customStart && customEnd) {
    start = new Date(customStart)
    end = new Date(customEnd + 'T23:59:59')
  } else if (type === 'monthly') {
    start = new Date(year, month - 1, 1)
    end = new Date(year, month, 0, 23, 59, 59)
  } else if (type === 'quarterly') {
    const q = Math.floor((month - 1) / 3)
    start = new Date(year, q * 3, 1)
    end = new Date(year, q * 3 + 3, 0, 23, 59, 59)
  } else {
    // annual / tax — full calendar year
    start = new Date(year, 0, 1)
    end = new Date(year, 11, 31, 23, 59, 59)
  }
  return { start, end }
}

// Force-download a Blob.
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function toCsv(rows, columns) {
  const escape = (v) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => escape(c.label || c.key)).join(',')
  const body = rows.map((r) => columns.map((c) => escape(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(',')).join('\n')
  return `${header}\n${body}`
}

// Minimal HTML-to-PDF via window.print of a hidden iframe. Reliable, no deps.
function downloadAsPdf(html, filename) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.src = url
  document.body.appendChild(iframe)
  iframe.onload = () => {
    try {
      iframe.contentWindow.document.title = filename.replace(/\.pdf$/i, '')
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe)
        URL.revokeObjectURL(url)
      }, 500)
    }
  }
}

function reportHtml({ title, subtitle, kpis, txns, categories, currency }) {
  const kpiRows = kpis.map((k) => `<tr><td>${k.label}</td><td style="text-align:right">${k.value}</td></tr>`).join('')
  const txRows = txns.slice(0, 500).map((t) => `
    <tr>
      <td>${new Date(t.date).toLocaleDateString()}</td>
      <td>${(t.description || '').replace(/</g, '&lt;')}</td>
      <td>${t.category || ''}</td>
      <td>${t.type}</td>
      <td style="text-align:right">${formatCurrency(t.amount || 0)}</td>
    </tr>`).join('')
  const catRows = categories.map((c) => `<tr><td>${c.category}</td><td style="text-align:right">${formatCurrency(c.amount)}</td><td style="text-align:right">${c.count}</td></tr>`).join('')
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;padding:24px}
  h1{font-size:22px;margin:0 0 4px 0}
  .sub{color:#64748b;font-size:12px;margin-bottom:16px}
  h2{font-size:14px;margin:18px 0 8px 0;border-bottom:1px solid #cbd5e1;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
  th{background:#f1f5f9}
  .muted{color:#64748b}
  @media print {body{padding:8px}}
</style></head>
<body>
  <h1>${title}</h1>
  <div class="sub">${subtitle} · Generated ${new Date().toLocaleString()} · Currency ${currency || ''}</div>
  <h2>Summary</h2>
  <table><tbody>${kpiRows}</tbody></table>
  <h2>Top categories</h2>
  <table><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Count</th></tr></thead><tbody>${catRows || '<tr><td colspan="3" class="muted">No data</td></tr>'}</tbody></table>
  <h2>Transactions (${txns.length})</h2>
  <table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th style="text-align:right">Amount</th></tr></thead><tbody>${txRows || '<tr><td colspan="5" class="muted">No transactions</td></tr>'}</tbody></table>
</body></html>`
}

export default function ReportsPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [reportType, setReportType] = useState('monthly')
  const [exportFormat, setExportFormat] = useState('pdf')
  const [isExporting, setIsExporting] = useState(false)
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10))
  const [includeInvestments, setIncludeInvestments] = useState(true)

  const range = useMemo(() => rangeFor(reportType, selectedYear, selectedMonth, customStart, customEnd),
    [reportType, selectedYear, selectedMonth, customStart, customEnd])

  // All transactions in the selected range — pull up to 1000 rows which is
  // plenty for any single-period report.
  const { data: txRes } = useQuery(
    ['report-txs', range.start.toISOString(), range.end.toISOString()],
    () => getTransactions({
      fromDate: range.start.toISOString().slice(0, 10),
      toDate: range.end.toISOString().slice(0, 10),
    }, 1, 1000),
    { staleTime: 60_000 }
  )
  const txs = txRes?.data?.transactions || txRes?.transactions || []

  const { data: ieRes } = useQuery(
    ['report-ie', range.start.toISOString(), range.end.toISOString()],
    () => getIncomeExpense(Math.max(1, Math.round((range.end - range.start) / 86400000))),
    { staleTime: 60_000 }
  )

  const { data: catRes } = useQuery(
    ['report-cat', range.start.toISOString(), range.end.toISOString()],
    () => getCategoryBreakdown(Math.max(1, Math.round((range.end - range.start) / 86400000))),
    { staleTime: 60_000 }
  )

  const { data: savingsRes } = useQuery(['report-savings'], () => getSavingsRate('monthly'), { staleTime: 60_000 })

  // Build monthly comparison from savings series
  const monthlySeries = useMemo(() => {
    const list = savingsRes?.data?.savingsRate || savingsRes?.savingsRate || []
    return list.map((r) => {
      const [y, m] = String(r.period || '').split('-')
      return {
        month: MONTH_NAMES[(Number(m) || 1) - 1]?.slice(0, 3) || r.period,
        income: Number(r.income) || 0,
        expense: Number(r.expense) || 0,
        savings: Math.max(0, (Number(r.income) || 0) - (Number(r.expense) || 0)),
      }
    }).slice(-12)
  }, [savingsRes])

  const ie = ieRes?.data?.incomeVsExpense || ieRes?.incomeVsExpense || { income: 0, expense: 0, savings: 0 }
  const categories = (catRes?.data?.breakdown || catRes?.breakdown || []).map((c) => ({
    category: c.category || 'Uncategorized',
    amount: Number(c.amount) || 0,
    count: c.count || 0,
  }))
  const categoriesTop = categories.slice(0, 10)
  const categoryTotal = categories.reduce((s, c) => s + c.amount, 0) || 1

  const doExport = async (format) => {
    if (!txs.length && !categories.length) {
      toast.error('No data in the selected range — nothing to export.')
      return
    }
    const typeLabel = REPORT_TYPES.find((t) => t.id === reportType)?.label || 'Report'
    const periodLabel =
      reportType === 'monthly' ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
      : reportType === 'quarterly' ? `Q${Math.ceil(selectedMonth / 3)} ${selectedYear}`
      : `${selectedYear}`
    const filenameBase = `${reportType}-report-${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

    setIsExporting(true)
    try {
      if (format === 'csv') {
        const columns = [
          { key: 'date', label: 'Date', get: (r) => new Date(r.date).toISOString().slice(0, 10) },
          { key: 'description', label: 'Description' },
          { key: 'category', label: 'Category' },
          { key: 'merchant', label: 'Merchant' },
          { key: 'type', label: 'Type' },
          { key: 'amount', label: 'Amount' },
          { key: 'paymentMethod', label: 'Payment Method' },
        ]
        const csv = toCsv(txs, columns)
        triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filenameBase}.csv`)
        toast.success('CSV exported')
        return
      }

      if (format === 'excel' || format === 'xlsx') {
        // Generate an SpreadsheetML 2003 XML workbook — opens natively in
        // Excel/LibreOffice/Numbers without needing xlsx dependency.
        const sheetHeader = (cols) => `<Row>${cols.map((c) => `<Cell><Data ss:Type="String">${c}</Data></Cell>`).join('')}</Row>`
        const sheetRows = (rows) => rows.map((r) => `<Row>${r.map((v) => {
          const num = typeof v === 'number' && Number.isFinite(v)
          return `<Cell><Data ss:Type="${num ? 'Number' : 'String'}">${String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>`
        }).join('')}</Row>`).join('')
        const kpiRows = [
          ['Total Income', ie.income || 0],
          ['Total Expense', ie.expense || 0],
          ['Net Savings', (ie.income || 0) - (ie.expense || 0)],
          ['Savings Rate %', ie.savingsRate || 0],
          ['Transaction count', txs.length],
        ]
        const catRows = categories.map((c) => [c.category, c.amount, c.count])
        const txRows = txs.map((t) => [
          new Date(t.date).toISOString().slice(0, 10),
          t.description || '',
          t.category || '',
          t.merchant || '',
          t.type || '',
          Number(t.amount) || 0,
          t.paymentMethod || '',
        ])
        const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Summary"><Table>${sheetHeader(['Metric', 'Value'])}${sheetRows(kpiRows)}</Table></Worksheet>
 <Worksheet ss:Name="Categories"><Table>${sheetHeader(['Category', 'Amount', 'Count'])}${sheetRows(catRows)}</Table></Worksheet>
 <Worksheet ss:Name="Transactions"><Table>${sheetHeader(['Date', 'Description', 'Category', 'Merchant', 'Type', 'Amount', 'Payment'])}${sheetRows(txRows)}</Table></Worksheet>
</Workbook>`
        triggerDownload(new Blob([xml], { type: 'application/vnd.ms-excel' }), `${filenameBase}.xls`)
        toast.success('Excel exported')
        return
      }

      // Default — PDF via print-to-PDF. Browser shows the system print dialog
      // where user picks "Save as PDF".
      const html = reportHtml({
        title: `${typeLabel} — ${periodLabel}`,
        subtitle: `${range.start.toLocaleDateString()} → ${range.end.toLocaleDateString()}`,
        kpis: [
          { label: 'Total Income', value: formatCurrency(ie.income || 0) },
          { label: 'Total Expense', value: formatCurrency(ie.expense || 0) },
          { label: 'Net Savings', value: formatCurrency((ie.income || 0) - (ie.expense || 0)) },
          { label: 'Savings Rate', value: `${ie.savingsRate || 0}%` },
          { label: 'Transactions', value: String(txs.length) },
        ],
        txns: txs,
        categories: categories.slice(0, 15),
        currency: txs[0]?.currency || 'INR',
      })
      downloadAsPdf(html, `${filenameBase}.pdf`)
      toast.success('PDF ready — use "Save as PDF" in the print dialog')
    } catch (err) {
      toast.error(err?.message || 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const totalIncome = ie.income || 0
  const totalExpense = ie.expense || 0
  const totalSavings = (ie.income || 0) - (ie.expense || 0)
  const periodMonths = Math.max(1, monthlySeries.length)

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy-900 dark:text-navy-100">Financial Reports</h1>
          <p className="text-navy-600 dark:text-navy-400 mt-2">
            Live reports generated from your actual transactions. Export as PDF, CSV, or Excel.
          </p>
        </div>

        {/* Report type */}
        <motion.div className="card p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-6">Select Report Type</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {REPORT_TYPES.map((type) => (
              <motion.button
                key={type.id}
                onClick={() => setReportType(type.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`p-4 rounded-lg border-2 transition-all text-center ${
                  reportType === type.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-navy-300 dark:border-navy-700 bg-navy-50 dark:bg-navy-800 hover:border-primary-400'
                }`}
              >
                <span className="text-3xl mb-2 block">{type.icon}</span>
                <p className="font-medium text-sm text-navy-900 dark:text-navy-100">{type.label}</p>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Date selectors */}
        <motion.div className="card p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-6">Select Date Range</h3>
          {reportType === 'custom' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-3">From date</label>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input-base w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-3">To date</label>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input-base w-full" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-3">Year</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="input-base w-full">
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
              {(reportType === 'monthly' || reportType === 'quarterly') && (
                <div>
                  <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-3">
                    {reportType === 'monthly' ? 'Month' : 'Month in quarter'}
                  </label>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="input-base w-full">
                    {months.map((month) => <option key={month} value={month}>{MONTH_NAMES[month - 1]}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex items-center gap-4">
            <p className="text-xs text-navy-500">
              Range: {range.start.toLocaleDateString()} → {range.end.toLocaleDateString()}
            </p>
            <label className="flex items-center gap-2 text-xs text-navy-600 dark:text-navy-400 cursor-pointer">
              <input type="checkbox" checked={includeInvestments} onChange={(e) => setIncludeInvestments(e.target.checked)} className="rounded" />
              Include investment holdings
            </label>
          </div>
        </motion.div>

        {/* Chart from live monthly savings */}
        {monthlySeries.length > 0 && <MonthlyComparisonChart data={monthlySeries} />}

        {/* Summary cards from live aggregates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div className="card p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <p className="text-sm text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold mb-2">Total Income</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">{formatCurrency(totalIncome)}</p>
            <p className="text-xs text-navy-600 dark:text-navy-400">Avg: {formatCurrency(totalIncome / periodMonths)}/month</p>
          </motion.div>
          <motion.div className="card p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <p className="text-sm text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold mb-2">Total Expense</p>
            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mb-2">{formatCurrency(totalExpense)}</p>
            <p className="text-xs text-navy-600 dark:text-navy-400">Avg: {formatCurrency(totalExpense / periodMonths)}/month</p>
          </motion.div>
          <motion.div className="card p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
            <p className="text-sm text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold mb-2">Net Savings</p>
            <p className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-2">{formatCurrency(totalSavings)}</p>
            <p className="text-xs text-navy-600 dark:text-navy-400">Rate: {ie.savingsRate || 0}%</p>
          </motion.div>
        </div>

        {/* Category breakdown — live */}
        <motion.div className="card p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-6">Top Expense Categories</h3>
          {categoriesTop.length === 0 ? (
            <p className="text-sm text-navy-500">No expense transactions in this range.</p>
          ) : (
            <div className="space-y-4">
              {categoriesTop.map((item, idx) => {
                const pct = Math.round((item.amount / categoryTotal) * 100)
                return (
                  <motion.div key={item.category} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-navy-900 dark:text-navy-100">{item.category}</p>
                      <p className="font-semibold text-navy-900 dark:text-navy-100">{formatCurrency(item.amount)} <span className="text-xs text-navy-500">· {pct}%</span></p>
                    </div>
                    <div className="w-full h-2 bg-navy-200 dark:bg-navy-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.2 + idx * 0.05, duration: 0.8 }}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Export */}
        <motion.div className="card p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }}>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-6">Export Report</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-3">Format</label>
              <div className="flex gap-2">
                {['PDF', 'CSV', 'Excel'].map((fmt) => (
                  <motion.button
                    key={fmt}
                    onClick={() => setExportFormat(fmt.toLowerCase())}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      exportFormat === fmt.toLowerCase()
                        ? 'bg-primary-500 text-white'
                        : 'bg-navy-100 dark:bg-navy-800 text-navy-900 dark:text-navy-100 hover:bg-navy-200 dark:hover:bg-navy-700'
                    }`}
                  >
                    {fmt}
                  </motion.button>
                ))}
              </div>
            </div>
            <motion.button
              onClick={() => doExport(exportFormat)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg transition-all disabled:opacity-60"
            >
              <FaDownload size={18} />
              {isExporting ? 'Exporting…' : `Export ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`}
            </motion.button>
            <p className="text-xs text-navy-500">
              PDF exports open the browser print dialog — choose &ldquo;Save as PDF&rdquo;. CSV and Excel download directly.
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  )
}
