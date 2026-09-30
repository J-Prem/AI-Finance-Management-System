import { useEffect, useMemo, useRef, useState } from 'react'
import { FaChartPie, FaSyncAlt, FaTags, FaTrash, FaUpload, FaDownload, FaFilter } from 'react-icons/fa'
import Layout from '../components/common/Layout'
import {
  deleteReceipt,
  listReceipts,
  overrideReceiptCategory,
  receiptStats,
  retagReceipt,
  uploadReceipt,
  getReceiptImageUrl,
} from '../services/receiptService'
import toast from 'react-hot-toast'
import api from '../services/api'

const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Education',
  'Personal Care',
  'Home & Garden',
  'Travel',
  'Uncategorized',
]

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function money(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0)
  } catch {
    return `$${Number(value || 0).toFixed(2)}`
  }
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState([])
  const [stats, setStats] = useState(null)
  const [latestPersonality, setLatestPersonality] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [manualText, setManualText] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [editingNotes, setEditingNotes] = useState({})
  const [rates, setRates] = useState(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })
  const fileRef = useRef(null)

  // Live forex for non-INR → INR conversion
  useEffect(() => {
    api.get('/external/forex/rates?base=USD&symbols=INR,EUR,GBP,JPY,AED')
      .then((res) => {
        const r = res?.data?.rates || res?.data?.data?.rates
        if (r) setRates(r)
      })
      .catch(() => {})
  }, [])

  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (filterCategory && r.category !== filterCategory) return false
      if (searchQ) {
        const q = searchQ.toLowerCase()
        return (r.merchant || '').toLowerCase().includes(q)
          || (r.notes || '').toLowerCase().includes(q)
          || (r.tags || []).some((t) => t.toLowerCase().includes(q))
      }
      return true
    })
  }, [receipts, filterCategory, searchQ])

  const refresh = async () => {
    const [receiptRes, statsRes] = await Promise.allSettled([listReceipts(), receiptStats()])
    if (receiptRes.status === 'fulfilled') setReceipts(receiptRes.value?.data || [])
    if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data || null)
  }

  useEffect(() => {
    refresh().catch(() => {})
  }, [])

  const handleParsed = (res) => {
    const receipt = res?.data?.receipt
    const personality = res?.data?.personality
    if (personality) setLatestPersonality(personality)
    toast.success(`Parsed ${receipt?.merchant || 'receipt'} via ${receipt?.provider || 'fallback'}`)
    refresh().catch(() => {})
  }

  const handleFile = async (file) => {
    if (!file) return
    if (file.size > 7 * 1024 * 1024) {
      toast.error('Use an image below 7 MB for reliable free-tier OCR.')
      return
    }
    setLoading(true)
    try {
      const base64 = arrayBufferToBase64(await file.arrayBuffer())
      const res = await uploadReceipt({ imageBase64: base64, mimeType: file.type || 'image/jpeg' })
      handleParsed(res)
    } catch (e) {
      toast.error('Upload failed: ' + (e?.response?.data?.message || e?.message || 'unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleBulkFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.size <= 7 * 1024 * 1024)
    if (!files.length) return
    setLoading(true)
    setUploadProgress({ done: 0, total: files.length })
    let success = 0
    for (let i = 0; i < files.length; i++) {
      try {
        const base64 = arrayBufferToBase64(await files[i].arrayBuffer())
        await uploadReceipt({ imageBase64: base64, mimeType: files[i].type || 'image/jpeg' })
        success++
      } catch {}
      setUploadProgress({ done: i + 1, total: files.length })
    }
    setLoading(false)
    toast.success(`Processed ${success}/${files.length} receipts`)
    setUploadProgress({ done: 0, total: 0 })
    refresh().catch(() => {})
  }

  const exportReceiptsCSV = () => {
    const headers = ['date', 'merchant', 'category', 'total', 'currency', 'provider', 'confidence', 'notes', 'tags']
    const rows = filteredReceipts.map((r) => [
      r.date || '',
      JSON.stringify(r.merchant || ''),
      r.category || '',
      r.total || 0,
      r.currency || 'INR',
      r.provider || '',
      Math.round((r.confidence || 0) * 100) + '%',
      JSON.stringify(r.notes || ''),
      (r.tags || []).join(';'),
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length} receipts`)
  }

  const convertToINR = (amount, currency) => {
    if (!rates || !currency || currency === 'INR') return null
    const usdInr = rates.INR
    if (!usdInr) return null
    // If currency is USD, direct convert
    if (currency === 'USD') return (Number(amount) * usdInr).toFixed(2)
    // Otherwise, route via USD: rates[currency] is currency-per-USD
    const curPerUsd = rates[currency]
    if (!curPerUsd) return null
    const usdAmount = Number(amount) / curPerUsd
    return (usdAmount * usdInr).toFixed(2)
  }

  const submitManual = async () => {
    if (!manualText.trim()) return
    setLoading(true)
    try {
      const res = await uploadReceipt({ text: manualText })
      setManualText('')
      handleParsed(res)
    } catch (e) {
      toast.error('Parse failed: ' + (e?.response?.data?.message || e?.message || 'unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const changeCategory = async (id, category) => {
    try {
      await overrideReceiptCategory(id, category)
      toast.success('Category updated')
      refresh()
    } catch (e) {
      toast.error('Could not update category')
    }
  }

  const saveTags = async (receipt) => {
    const draft = editingNotes[receipt._id] || {}
    try {
      await retagReceipt(receipt._id, {
        tags: String(draft.tags ?? receipt.tags?.join(', ') ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        notes: draft.notes ?? receipt.notes ?? '',
      })
      toast.success('Receipt notes saved')
      refresh()
    } catch {
      toast.error('Could not save tags')
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Receipt Intelligence</h1>
            <p className="mt-1 max-w-3xl text-gray-500">
              Upload receipt images or paste text. The backend runs free-tier Gemini/Hugging Face OCR, image preprocessing,
              MongoDB persistence, transaction creation, and receipt-based personality analysis.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportReceiptsCSV}
              disabled={!filteredReceipts.length}
              className="inline-flex items-center gap-2 rounded border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              <FaDownload /> Export CSV
            </button>
            <button
              onClick={() => refresh()}
              className="inline-flex items-center gap-2 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <FaSyncAlt /> Refresh
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-4 dark:bg-navy-800">
            <div className="flex items-center gap-2 text-sm text-gray-500"><FaChartPie /> 90-day receipts</div>
            <div className="mt-2 text-3xl font-bold">{stats?.count || 0}</div>
          </div>
          <div className="rounded-lg border bg-white p-4 dark:bg-navy-800">
            <div className="text-sm text-gray-500">Receipt spend</div>
            <div className="mt-2 text-3xl font-bold">{money(stats?.total || 0)}</div>
          </div>
          <div className="rounded-lg border bg-white p-4 dark:bg-navy-800">
            <div className="text-sm text-gray-500">Latest profile update</div>
            <div className="mt-2 text-3xl font-bold">{latestPersonality?.label || 'Ready'}</div>
          </div>
        </section>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const files = e.dataTransfer.files
            if (files?.length > 1) handleBulkFiles(files)
            else if (files?.[0]) handleFile(files[0])
          }}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white dark:bg-navy-800'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={(e) => {
              const files = e.target.files
              if (files?.length > 1) handleBulkFiles(files)
              else if (files?.[0]) handleFile(files[0])
            }}
            className="hidden"
          />
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded bg-blue-600 text-white">
            <FaUpload />
          </div>
          <div className="text-lg font-semibold">
            {loading && uploadProgress.total > 0
              ? `Processing ${uploadProgress.done} / ${uploadProgress.total}...`
              : loading
                ? 'Parsing and saving...'
                : 'Drop receipts here or click to browse (multi-select supported)'}
          </div>
          <div className="mt-2 text-sm text-gray-500">JPG, PNG, WebP, HEIC, TIFF, BMP, or PDF. OCR runs server-side.</div>
          {uploadProgress.total > 0 && (
            <div className="mt-3 w-full h-2 bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3 dark:bg-navy-800">
          <FaFilter className="text-gray-400" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search merchant, notes, tags..."
            className="flex-1 min-w-[200px] rounded border px-3 py-1.5 text-sm dark:bg-navy-900"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded border px-3 py-1.5 text-sm dark:bg-navy-900"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <div className="text-xs text-gray-500 ml-auto">
            Showing {filteredReceipts.length} of {receipts.length}
          </div>
        </div>

        <div>
          <button onClick={() => setShowManual(!showManual)} className="text-sm font-medium text-blue-600 underline">
            {showManual ? 'Hide manual text input' : 'Paste receipt text manually'}
          </button>
          {showManual && (
            <div className="mt-3 space-y-2">
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={`Whole Foods Market\n2x Milk  $6.98\nBread    $4.50\nTotal    $11.48\nDate 04/19/2026`}
                className="w-full rounded border p-3 font-mono text-sm dark:bg-navy-800"
                rows={8}
              />
              <button onClick={submitManual} disabled={loading} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
                Parse and save
              </button>
            </div>
          )}
        </div>

        {latestPersonality && (
          <section className="rounded-lg border bg-white p-4 dark:bg-navy-800">
            <div className="text-sm font-semibold">Receipt-based personality snapshot</div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{latestPersonality.narrative}</div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-xl font-semibold">Recent receipts ({filteredReceipts.length})</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredReceipts.map((r) => {
              const draft = editingNotes[r._id] || {}
              return (
                <div key={r._id} className="rounded-lg border bg-white p-4 dark:bg-navy-800">
                  {(r.imageBytes > 0 || r.storagePath || r.thumbnailDataUrl) && (
                    <div className="mb-3 -mx-4 -mt-4 overflow-hidden rounded-t-lg bg-gray-50 dark:bg-navy-900">
                      <img
                        src={getReceiptImageUrl(r._id)}
                        alt={r.merchant}
                        loading="lazy"
                        className="h-40 w-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{r.merchant}</div>
                      <div className="text-xs text-gray-500">{r.date} | {r.provider} | {Math.round((r.confidence || 0) * 100)}%</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{money(r.total, r.currency)}</div>
                      {r.currency && r.currency !== 'INR' && convertToINR(r.total, r.currency) && (
                        <div className="text-xs text-gray-400">≈ ₹{convertToINR(r.total, r.currency)}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>Quality: {Math.round((r.quality || 0) * 100)}%</div>
                    <div>Items: {r.items?.length || 0}</div>
                    <div>Width: {r.dims?.width || '-'}</div>
                    <div>Height: {r.dims?.height || '-'}</div>
                  </div>

                  <select
                    value={r.category || 'Uncategorized'}
                    onChange={(e) => changeCategory(r._id, e.target.value)}
                    className="mt-3 w-full rounded border px-2 py-2 text-sm dark:bg-navy-900"
                  >
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>

                  {r.items?.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm">
                      {r.items.slice(0, 5).map((it, i) => (
                        <li key={`${it.name}-${i}`} className="flex justify-between gap-3">
                          <span className="truncate">{it.name}</span>
                          <span>{money(it.amount, r.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 space-y-2">
                    <input
                      value={draft.tags ?? r.tags?.join(', ') ?? ''}
                      onChange={(e) => setEditingNotes((old) => ({ ...old, [r._id]: { ...old[r._id], tags: e.target.value } }))}
                      placeholder="tags: grocery, weekend"
                      className="w-full rounded border px-2 py-2 text-sm dark:bg-navy-900"
                    />
                    <textarea
                      value={draft.notes ?? r.notes ?? ''}
                      onChange={(e) => setEditingNotes((old) => ({ ...old, [r._id]: { ...old[r._id], notes: e.target.value } }))}
                      placeholder="notes"
                      rows={2}
                      className="w-full rounded border px-2 py-2 text-sm dark:bg-navy-900"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button onClick={() => saveTags(r)} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-medium">
                      <FaTags /> Save tags
                    </button>
                    <button
                      onClick={async () => { await deleteReceipt(r._id); await refresh() }}
                      className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-600"
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                </div>
              )
            })}
            {!receipts.length && <div className="text-gray-500">No receipts yet. Upload one to start the real ML workflow.</div>}
          </div>
        </section>
      </div>
    </Layout>
  )
}
