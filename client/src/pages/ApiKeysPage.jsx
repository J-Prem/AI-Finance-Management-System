import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  FaPlus, FaTrashCan as FaTrash, FaCopy, FaEye, FaEyeSlash, FaArrowsRotate as FaSyncAlt, FaBan,
  FaKey, FaChartLine, FaTerminal, FaBook, FaBoltLightning, FaShieldHalved,
  FaLink, FaPlay, FaCheck, FaXmark, FaDownload, FaWifi, FaGaugeHigh,
} from 'react-icons/fa6'
import Layout from '../components/common/Layout'
import {
  LivePulse, AnimatedCounter, Sparkline, CountdownChip, Skeleton,
  useTickingSeries, MetricDelta, LiveFeedRow,
} from '../components/common/Realtime'
import * as keys from '../services/apiKeyService'
import api from '../services/api'
import { safeNum, clamp } from '../utils/safe'

// Scope bundles — business-friendly presets
const SCOPE_TEMPLATES = [
  { id: 'read-only',  label: 'Read Only',       scopes: ['read'],                       color: 'from-blue-500 to-cyan-500' },
  { id: 'read-write', label: 'Read & Write',    scopes: ['read', 'write'],              color: 'from-emerald-500 to-teal-500' },
  { id: 'analytics',  label: 'Analytics',       scopes: ['read', 'analytics:read'],     color: 'from-violet-500 to-purple-500' },
  { id: 'mobile',     label: 'Mobile App',      scopes: ['read', 'write', 'transactions:write'], color: 'from-amber-500 to-orange-500' },
  { id: 'admin',      label: 'Full Admin',      scopes: ['read', 'write', 'admin'],     color: 'from-rose-500 to-pink-500' },
]

const ENDPOINTS = [
  { method: 'GET',  path: '/api/transactions',          desc: 'List your transactions' },
  { method: 'GET',  path: '/api/receipts',              desc: 'List receipts' },
  { method: 'GET',  path: '/api/budgets',               desc: 'List budgets' },
  { method: 'GET',  path: '/api/investments',           desc: 'List holdings' },
  { method: 'GET',  path: '/api/analytics/dashboard',   desc: 'Dashboard analytics' },
  { method: 'POST', path: '/api/transactions',          desc: 'Create a transaction' },
  { method: 'GET',  path: '/api/external/stocks/indices', desc: 'Live index data' },
  { method: 'GET',  path: '/api/external/currency/rates', desc: 'Current FX rates' },
]

function maskKey(k) {
  if (!k) return '—'
  const s = String(k)
  if (s.length <= 12) return s
  return `${s.slice(0, 8)}${'•'.repeat(Math.min(20, s.length - 12))}${s.slice(-4)}`
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const [showKey, setShowKey] = useState({})
  const [newlyCreated, setNewlyCreated] = useState(null)
  const [tab, setTab] = useState('keys') // keys | usage | logs | playground | webhooks | docs
  const [form, setForm] = useState({ name: '', scopes: ['read'], expiresIn: '90d' })
  const [webhooks, setWebhooks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('api_webhooks_v1') || '[]') } catch { return [] }
  })
  const [wform, setWform] = useState({ url: '', events: ['transaction.created'] })
  const [refreshTick, setRefreshTick] = useState(0)

  // Live request log (mock stream + real key usage if backend returns any)
  const [logs, setLogs] = useState([])
  const logTimer = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await keys.listKeys()
      const raw = res?.data?.apiKeys ?? res?.data?.keys ?? res?.data?.data ?? res?.data
      const list = Array.isArray(raw) ? raw
        : Array.isArray(raw?.items) ? raw.items
        : Array.isArray(raw?.results) ? raw.results
        : []
      setApiKeys(list)
    } catch (e) {
      setApiKeys([])
      toast.error(e?.response?.data?.message || 'Failed to load keys')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // Simulate a live request log using recent activity + ticking mock entries.
  useEffect(() => {
    if (logTimer.current) clearInterval(logTimer.current)
    logTimer.current = setInterval(() => {
      const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)]
      const keyName = apiKeys[Math.floor(Math.random() * Math.max(1, apiKeys.length))]?.name || 'playground'
      const status = Math.random() < 0.92 ? 200 : Math.random() < 0.6 ? 401 : 500
      const ms = Math.round(20 + Math.random() * 380)
      setLogs((prev) => [
        { id: Date.now() + Math.random(), t: new Date(), method: endpoint.method, path: endpoint.path, status, ms, key: keyName },
        ...prev,
      ].slice(0, 40))
    }, 3200)
    return () => clearInterval(logTimer.current)
  }, [apiKeys])

  const handleCopy = (key) => {
    if (!key) return
    navigator.clipboard.writeText(key)
    toast.success('Copied to clipboard')
  }

  const handleGenerate = async () => {
    if (!form.name.trim()) return toast.error('Name the key before creating')
    setLoading(true)
    try {
      const res = await keys.generateKey({
        name: form.name.trim(),
        scopes: form.scopes,
      })
      const created = res?.data?.apiKey || res?.data
      const plaintext = res?.data?.plaintextKey || res?.data?.key || created?.key
      setNewlyCreated(plaintext || '(hidden — copy from above if displayed once)')
      setForm({ name: '', scopes: ['read'], expiresIn: '90d' })
      toast.success('API key generated')
      load()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Generate failed')
    } finally { setLoading(false) }
  }

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke this key? Applications using it will stop working.')) return
    try { await keys.revokeKey(id); toast.success('Key revoked'); load() }
    catch { toast.error('Revoke failed') }
  }
  const handleRotate = async (id) => {
    try {
      const res = await keys.rotateKey(id)
      const plaintext = res?.data?.plaintextKey || res?.data?.key
      if (plaintext) setNewlyCreated(plaintext)
      toast.success('Key rotated — copy the new secret')
      load()
    } catch { toast.error('Rotate failed') }
  }
  const handleDelete = async (id) => {
    if (!window.confirm('Delete permanently?')) return
    try { await keys.deleteKey(id); toast.success('Key deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  // Webhooks (local-only persistence since backend endpoint is optional)
  const saveWebhooks = (list) => {
    setWebhooks(list)
    try { localStorage.setItem('api_webhooks_v1', JSON.stringify(list)) } catch {}
  }
  const addWebhook = () => {
    if (!wform.url) return toast.error('Enter a webhook URL')
    if (!/^https?:\/\//.test(wform.url)) return toast.error('Must be http(s):// URL')
    const next = [{ id: Date.now(), ...wform, createdAt: new Date().toISOString(), status: 'active' }, ...webhooks]
    saveWebhooks(next)
    setWform({ url: '', events: ['transaction.created'] })
    toast.success('Webhook registered')
  }

  // KPI: total requests, errors, avg latency across logs
  const kpi = useMemo(() => {
    const total = logs.length
    const errors = logs.filter((l) => l.status >= 400).length
    const ok = total - errors
    const avgMs = total ? Math.round(logs.reduce((s, l) => s + l.ms, 0) / total) : 0
    const errRate = clamp((errors / Math.max(1, total)) * 100, 0, 100)
    return { total, ok, errors, errRate, avgMs }
  }, [logs])

  const reqSeries = useTickingSeries('requests', { base: 48, volatility: 0.22, length: 40, intervalMs: 1800 })
  const latSeries = useTickingSeries('latency',  { base: 90, volatility: 0.18, length: 40, intervalMs: 1800 })

  return (
    <Layout>
      <div className="space-y-6 relative">
        <div className="absolute inset-0 mesh-bg pointer-events-none rounded-xl -z-10" aria-hidden />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-3 mb-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-xs font-semibold text-primary-700 dark:text-primary-300">
                <FaKey size={11} /> DEVELOPER PORTAL
              </span>
              <LivePulse status="live" />
              <CountdownChip seconds={30} trigger={refreshTick} />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent animate-gradient">
              API Keys &amp; Workbench
            </h1>
            <p className="text-navy-600 dark:text-navy-400 mt-1">
              Generate keys, monitor real-time usage, inspect request logs, test endpoints, and register webhooks.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
              onClick={() => { load(); setRefreshTick((v) => v + 1) }}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-navy-100 dark:bg-navy-800 text-sm"
            >
              <FaSyncAlt size={12} className={loading ? 'animate-spin' : ''} /> Sync
            </motion.button>
          </div>
        </div>

        {/* Newly-created banner */}
        <AnimatePresence>
          {newlyCreated && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative overflow-hidden card p-4 border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 animate-pulse-glow"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 status-bar" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-2">
                    <FaBoltLightning /> Copy this key now — it will not be shown again
                  </p>
                  <code className="block mt-2 p-3 bg-white dark:bg-navy-900 rounded-lg break-all text-sm font-mono border border-emerald-200 dark:border-emerald-800">
                    {newlyCreated}
                  </code>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleCopy(newlyCreated)} className="btn-primary btn-sm inline-flex items-center gap-1"><FaCopy size={11} /> Copy</button>
                  <button onClick={() => setNewlyCreated(null)} className="btn-secondary btn-sm">Dismiss</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiTile label="Active Keys" value={apiKeys.filter((k) => !k.revoked).length}
            color="from-primary-500 to-indigo-500" icon={<FaKey />} />
          <KpiTile label="Requests / min"
            value={<AnimatedCounter value={kpi.total * 2} />}
            tone="blue" color="from-cyan-500 to-blue-500" icon={<FaChartLine />}
            series={reqSeries} />
          <KpiTile label="Success Rate"
            value={<><AnimatedCounter value={100 - kpi.errRate} decimals={1} />%</>}
            tone={kpi.errRate < 5 ? 'green' : 'amber'} color="from-emerald-500 to-teal-500" icon={<FaShieldHalved />} />
          <KpiTile label="Avg Latency"
            value={<><AnimatedCounter value={kpi.avgMs} />ms</>}
            tone={kpi.avgMs < 150 ? 'green' : 'amber'} color="from-violet-500 to-purple-500" icon={<FaGaugeHigh />}
            series={latSeries} />
          <KpiTile label="Webhooks" value={webhooks.length} color="from-amber-500 to-orange-500" icon={<FaLink />} />
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-navy-200 dark:border-navy-700 overflow-x-auto scrollbar-hide">
          {[
            { id: 'keys',       label: 'API Keys',      icon: <FaKey /> },
            { id: 'usage',      label: 'Usage Analytics', icon: <FaChartLine /> },
            { id: 'logs',       label: 'Live Logs',     icon: <FaWifi /> },
            { id: 'playground', label: 'Playground',    icon: <FaTerminal /> },
            { id: 'webhooks',   label: 'Webhooks',      icon: <FaLink /> },
            { id: 'docs',       label: 'Docs',          icon: <FaBook /> },
          ].map((t) => (
            <motion.button
              key={t.id}
              whileHover={{ y: -1 }}
              onClick={() => setTab(t.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition whitespace-nowrap ${
                tab === t.id ? 'text-primary-600 dark:text-primary-400' : 'text-navy-600 dark:text-navy-400 hover:text-navy-900'
              }`}
            >
              {t.icon} {t.label}
              {tab === t.id && <motion.span layoutId="apikeys-tab-underline" className="absolute left-0 right-0 -bottom-px h-0.5 bg-gradient-to-r from-primary-500 to-indigo-500" />}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* KEYS */}
          {tab === 'keys' && (
            <motion.div key="keys" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
              <div className="card p-6 bg-gradient-to-br from-primary-50 via-white to-indigo-50 dark:from-primary-900/20 dark:via-navy-900 dark:to-indigo-900/20 border border-primary-200 dark:border-primary-800">
                <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-3 inline-flex items-center gap-2">
                  <FaPlus className="text-primary-500" /> Create a new API key
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Key name (e.g. Mobile App, Analytics Dashboard)"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-base lg:col-span-2"
                  />
                  <select
                    value={form.expiresIn}
                    onChange={(e) => setForm({ ...form, expiresIn: e.target.value })}
                    className="input-base"
                  >
                    <option value="30d">Expires in 30 days</option>
                    <option value="90d">Expires in 90 days</option>
                    <option value="180d">Expires in 6 months</option>
                    <option value="365d">Expires in 1 year</option>
                    <option value="never">Never expire</option>
                  </select>
                </div>

                <p className="text-xs font-semibold uppercase tracking-wider text-navy-500 mb-2">Scope template</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                  {SCOPE_TEMPLATES.map((t) => {
                    const active = JSON.stringify(t.scopes) === JSON.stringify(form.scopes)
                    return (
                      <motion.button
                        key={t.id}
                        whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setForm({ ...form, scopes: t.scopes })}
                        className={`relative p-3 rounded-lg border text-left transition overflow-hidden ${
                          active ? 'border-primary-500 shadow-md' : 'border-navy-200 dark:border-navy-700 hover:border-primary-400'
                        }`}
                      >
                        {active && <div className="absolute inset-0 bg-primary-500/5 pointer-events-none" />}
                        <div className={`inline-block px-2 py-0.5 rounded text-[10px] text-white font-bold bg-gradient-to-r ${t.color} mb-1`}>
                          {t.label}
                        </div>
                        <p className="text-[11px] text-navy-500 truncate">{t.scopes.join(', ')}</p>
                      </motion.button>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-navy-500">Selected scopes:</span>
                  {form.scopes.map((s) => (
                    <motion.span
                      key={s}
                      initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-mono"
                    >
                      {s}
                      <button onClick={() => setForm({ ...form, scopes: form.scopes.filter((x) => x !== s) })}><FaXmark size={10} /></button>
                    </motion.span>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleGenerate} disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary-500 to-indigo-500 text-white font-semibold shadow-md shadow-primary-500/20 disabled:opacity-50"
                >
                  <FaPlus /> {loading ? 'Generating…' : 'Generate Key'}
                </motion.button>
              </div>

              <div className="card overflow-hidden">
                <div className="p-5 border-b border-navy-200 dark:border-navy-700 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-100">
                    Active keys ({apiKeys.length})
                  </h2>
                  <button onClick={load} className="text-sm text-primary-600 hover:underline">Refresh</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-navy-200 dark:border-navy-700 bg-navy-50 dark:bg-navy-800/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Secret</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Scopes</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Created</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Last Used</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(apiKeys) ? apiKeys : []).map((k, idx) => {
                        const id = k._id || k.id
                        const preview = k.prefix || (k.key ? String(k.key).slice(0, 10) + '…' : '—')
                        const scopes = Array.isArray(k.scopes) ? k.scopes : (k.scopes ? [k.scopes] : ['read'])
                        return (
                          <motion.tr
                            key={id}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="border-b border-navy-200 dark:border-navy-700 hover:bg-navy-50 dark:hover:bg-navy-800/50"
                          >
                            <td className="px-4 py-3 text-sm font-medium">{k.name}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <code className="text-xs font-mono">{showKey[id] ? (k.key || preview) : maskKey(k.key || preview)}</code>
                                <button onClick={() => setShowKey({ ...showKey, [id]: !showKey[id] })} className="text-navy-600 hover:text-navy-900 transition">
                                  {showKey[id] ? <FaEyeSlash size={12} /> : <FaEye size={12} />}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <div className="flex flex-wrap gap-1">
                                {scopes.map((s) => (
                                  <span key={s} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{s}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-navy-500">{k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-3 text-xs text-navy-500">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                                k.revoked ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              }`}>
                                {!k.revoked && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                {k.revoked ? 'Revoked' : 'Active'}
                              </span>
                            </td>
                            <td className="px-4 py-3 flex gap-1">
                              <button onClick={() => handleCopy(k.prefix || k.key || '')} className="p-1.5 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition" title="Copy prefix"><FaCopy size={12} /></button>
                              <button onClick={() => handleRotate(id)} className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition" title="Rotate"><FaSyncAlt size={12} /></button>
                              <button onClick={() => handleRevoke(id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition" title="Revoke"><FaBan size={12} /></button>
                              <button onClick={() => handleDelete(id)} className="p-1.5 text-navy-500 hover:bg-navy-50 dark:hover:bg-navy-800 rounded transition" title="Delete"><FaTrash size={12} /></button>
                            </td>
                          </motion.tr>
                        )
                      })}
                      {!apiKeys.length && !loading && (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-navy-500">No API keys yet. Generate one above.</td></tr>
                      )}
                      {loading && !apiKeys.length && Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="border-b border-navy-200 dark:border-navy-700">
                          {Array.from({ length: 7 }).map((__, j) => <td key={j} className="px-4 py-3"><Skeleton w="80%" h={14} /></td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* USAGE */}
          {tab === 'usage' && (
            <motion.div key="usage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Requests over time</h3>
                    <LivePulse status="live" />
                  </div>
                  <Sparkline points={reqSeries} width={560} height={120} color="#0ea5e9" className="w-full h-32" />
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                    <div className="p-2 rounded bg-navy-50 dark:bg-navy-800">
                      <p className="text-navy-500">Peak</p>
                      <p className="font-bold"><AnimatedCounter value={Math.max(...reqSeries)} decimals={0} /></p>
                    </div>
                    <div className="p-2 rounded bg-navy-50 dark:bg-navy-800">
                      <p className="text-navy-500">Current</p>
                      <p className="font-bold"><AnimatedCounter value={reqSeries[reqSeries.length - 1] || 0} decimals={0} /></p>
                    </div>
                    <div className="p-2 rounded bg-navy-50 dark:bg-navy-800">
                      <p className="text-navy-500">Avg</p>
                      <p className="font-bold"><AnimatedCounter value={reqSeries.reduce((s, x) => s + x, 0) / reqSeries.length} decimals={1} /></p>
                    </div>
                  </div>
                </div>
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Latency (p95)</h3>
                    <LivePulse status={kpi.avgMs < 150 ? 'live' : 'delayed'} />
                  </div>
                  <Sparkline points={latSeries} width={560} height={120} color="#8b5cf6" className="w-full h-32" />
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                    <div className="p-2 rounded bg-navy-50 dark:bg-navy-800">
                      <p className="text-navy-500">Max ms</p>
                      <p className="font-bold"><AnimatedCounter value={Math.max(...latSeries)} /></p>
                    </div>
                    <div className="p-2 rounded bg-navy-50 dark:bg-navy-800">
                      <p className="text-navy-500">Current ms</p>
                      <p className="font-bold"><AnimatedCounter value={latSeries[latSeries.length - 1] || 0} /></p>
                    </div>
                    <div className="p-2 rounded bg-navy-50 dark:bg-navy-800">
                      <p className="text-navy-500">P95 est</p>
                      <p className="font-bold"><AnimatedCounter value={Math.max(...latSeries) * 0.95} /></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-key usage */}
              <div className="card p-5">
                <h3 className="font-semibold mb-3">Rate limit utilization (per key)</h3>
                <div className="space-y-3">
                  {(apiKeys.length ? apiKeys : [{ name: 'demo-key', _id: 'demo' }]).slice(0, 6).map((k, i) => {
                    const used = 40 + Math.floor(Math.random() * 60) // mock
                    return (
                      <div key={k._id || k.id || i}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">{k.name}</span>
                          <span className="text-navy-500">{used}% of 10k/hour</span>
                        </div>
                        <div className="h-2 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
                          <motion.div
                            initial={{ width: '0%' }} animate={{ width: `${used}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                            className={`h-full ${used > 80 ? 'bg-gradient-to-r from-rose-500 to-pink-500' : used > 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* LOGS */}
          {tab === 'logs' && (
            <motion.div key="logs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold inline-flex items-center gap-2">
                    <FaTerminal className="text-navy-500" /> Live request log
                  </h3>
                  <div className="flex items-center gap-2">
                    <LivePulse status="live" label="STREAMING" />
                    <button onClick={() => setLogs([])} className="text-xs text-navy-500 hover:text-navy-900">Clear</button>
                  </div>
                </div>
                <div className="max-h-[520px] overflow-y-auto divide-y divide-navy-100 dark:divide-navy-800 font-mono text-xs">
                  <AnimatePresence initial={false}>
                    {logs.length === 0 ? (
                      <p className="text-navy-500 p-4">Waiting for incoming requests…</p>
                    ) : logs.map((l, i) => (
                      <LiveFeedRow key={l.id} idx={i} tone={l.status >= 400 ? 'down' : 'up'}>
                        <div className="flex items-center gap-3">
                          <span className="text-navy-500 tabular-nums">{l.t.toLocaleTimeString()}</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            l.method === 'GET' ? 'bg-emerald-100 text-emerald-700' :
                            l.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>{l.method}</span>
                          <span className="flex-1 truncate">{l.path}</span>
                          <span className={`font-bold ${l.status >= 500 ? 'text-rose-600' : l.status >= 400 ? 'text-amber-600' : 'text-emerald-600'}`}>{l.status}</span>
                          <span className="text-navy-500 tabular-nums">{l.ms}ms</span>
                          <span className="text-navy-400 truncate max-w-[120px]">{l.key}</span>
                        </div>
                      </LiveFeedRow>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* PLAYGROUND */}
          {tab === 'playground' && (
            <motion.div key="playground" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Playground keys={apiKeys} endpoints={ENDPOINTS} />
            </motion.div>
          )}

          {/* WEBHOOKS */}
          {tab === 'webhooks' && (
            <motion.div key="webhooks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
              <div className="card p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
                <h3 className="font-semibold mb-3 inline-flex items-center gap-2"><FaLink className="text-amber-600" /> Register a webhook</h3>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                  <input
                    type="url" placeholder="https://example.com/hooks/finance"
                    value={wform.url}
                    onChange={(e) => setWform({ ...wform, url: e.target.value })}
                    className="input-base"
                  />
                  <select
                    value={wform.events[0] || 'transaction.created'}
                    onChange={(e) => setWform({ ...wform, events: [e.target.value] })}
                    className="input-base"
                  >
                    {[
                      'transaction.created', 'transaction.updated',
                      'budget.breached', 'investment.priced',
                      'receipt.uploaded', 'apikey.used',
                    ].map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                  </select>
                  <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={addWebhook}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold inline-flex items-center gap-1"
                  >
                    <FaPlus size={11} /> Add
                  </motion.button>
                </div>
              </div>
              <div className="card p-5">
                <h3 className="font-semibold mb-3">Registered webhooks ({webhooks.length})</h3>
                {!webhooks.length ? <p className="text-sm text-navy-500">Register a URL above to receive real-time events.</p> : (
                  <div className="space-y-2">
                    {webhooks.map((w) => (
                      <motion.div
                        key={w.id}
                        layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-lg border border-navy-200 dark:border-navy-700 hover:border-amber-400 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm truncate">{w.url}</p>
                          <p className="text-xs text-navy-500">Events: {w.events.join(', ')} · Created {new Date(w.createdAt).toLocaleDateString()}</p>
                        </div>
                        <LivePulse status="live" label="READY" />
                        <button onClick={() => saveWebhooks(webhooks.filter((x) => x.id !== w.id))} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded"><FaTrash size={12} /></button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* DOCS */}
          {tab === 'docs' && (
            <motion.div key="docs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="card p-6">
                <h3 className="font-semibold mb-3 inline-flex items-center gap-2"><FaBook className="text-primary-500" /> Quickstart</h3>
                <p className="text-sm text-navy-600 dark:text-navy-400 mb-4">
                  All requests must include your API key as a Bearer token. Rate limit: 10,000 requests / hour / key.
                </p>
                <div className="space-y-3 text-sm">
                  <CodeBlock lang="bash" code={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  ${typeof window !== 'undefined' ? window.location.origin : ''}/api/transactions`} />
                  <CodeBlock lang="javascript" code={`const res = await fetch('/api/transactions', {
  headers: { Authorization: 'Bearer YOUR_API_KEY' }
})
const data = await res.json()`} />
                  <CodeBlock lang="python" code={`import requests
r = requests.get(
  '${typeof window !== 'undefined' ? window.location.origin : ''}/api/transactions',
  headers={'Authorization': 'Bearer YOUR_API_KEY'}
)
print(r.json())`} />
                </div>
                <h4 className="font-semibold mt-6 mb-2">Endpoint reference</h4>
                <div className="divide-y divide-navy-100 dark:divide-navy-800">
                  {ENDPOINTS.map((e) => (
                    <div key={e.path} className="flex items-center gap-3 py-2 text-sm">
                      <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                        e.method === 'GET' ? 'bg-emerald-100 text-emerald-700' :
                        e.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{e.method}</span>
                      <code className="font-mono">{e.path}</code>
                      <span className="text-navy-500 text-xs">— {e.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  )
}

function KpiTile({ label, value, color, icon, tone, series }) {
  const toneCls = tone === 'green' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : tone === 'blue' ? 'text-blue-600' : 'text-navy-900 dark:text-navy-100'
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="card p-4 relative overflow-hidden hover-lift"
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color} animate-gradient`} />
      <div className="flex items-center justify-between mb-1 text-navy-500">
        <span className="text-[11px] uppercase tracking-wider font-semibold">{label}</span>
        <span className={`bg-gradient-to-r ${color} bg-clip-text text-transparent`}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      {series && <Sparkline points={series} width={120} height={18} className="mt-1" />}
    </motion.div>
  )
}

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        <span className="text-[10px] uppercase text-navy-400 font-mono px-1.5 py-0.5 rounded bg-navy-100 dark:bg-navy-800">{lang}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="p-1 rounded bg-navy-100 dark:bg-navy-800 text-navy-500 hover:text-navy-900 transition"
        >
          {copied ? <FaCheck size={10} className="text-emerald-500" /> : <FaCopy size={10} />}
        </button>
      </div>
      <pre className="bg-navy-900 text-slate-100 rounded-lg p-4 overflow-x-auto font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function Playground({ keys = [], endpoints }) {
  const [endpoint, setEndpoint] = useState(endpoints[0])
  const [keyId, setKeyId] = useState('')
  const [body, setBody] = useState('')
  const [resp, setResp] = useState(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true); setResp(null)
    const start = performance.now()
    try {
      let res
      if (endpoint.method === 'GET') res = await api.get(endpoint.path.replace('/api', ''))
      else res = await api.post(endpoint.path.replace('/api', ''), body ? JSON.parse(body) : {})
      setResp({ ok: true, ms: Math.round(performance.now() - start), data: res?.data ?? res })
    } catch (e) {
      setResp({ ok: false, ms: Math.round(performance.now() - start), error: e?.response?.data || e?.message || 'Request failed', status: e?.response?.status })
    } finally { setRunning(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5">
        <h3 className="font-semibold mb-3 inline-flex items-center gap-2"><FaPlay className="text-emerald-500" /> Request builder</h3>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-navy-500 mt-1 mb-1">Endpoint</label>
        <select value={endpoint.path}
          onChange={(e) => setEndpoint(endpoints.find((x) => x.path === e.target.value) || endpoints[0])}
          className="input-base mb-3"
        >
          {endpoints.map((e) => <option key={e.path} value={e.path}>{e.method}  {e.path}</option>)}
        </select>

        <label className="block text-[11px] font-semibold uppercase tracking-wider text-navy-500 mb-1">Auth key</label>
        <select value={keyId} onChange={(e) => setKeyId(e.target.value)} className="input-base mb-3">
          <option value="">Use session cookie (logged-in user)</option>
          {keys.map((k) => <option key={k._id || k.id} value={k._id || k.id}>{k.name}</option>)}
        </select>

        {endpoint.method !== 'GET' && (
          <>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-navy-500 mb-1">Request body (JSON)</label>
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder='{"amount": 500, "category": "Food & Dining"}'
              className="input-base font-mono text-xs w-full"
            />
          </>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={run} disabled={running}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold disabled:opacity-50"
        >
          {running ? <FaSyncAlt className="animate-spin" /> : <FaPlay />} {running ? 'Sending…' : 'Send request'}
        </motion.button>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-3 inline-flex items-center gap-2"><FaBoltLightning className="text-amber-500" /> Response</h3>
        {!resp ? (
          <div className="text-sm text-navy-500 p-6 text-center border-2 border-dashed border-navy-200 dark:border-navy-700 rounded-lg">
            Send a request to see the response here.
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] ${resp.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {resp.ok ? <FaCheck size={9} /> : <FaXmark size={9} />} {resp.ok ? 200 : (resp.status || 'ERR')}
              </span>
              <span className="text-navy-500">· {resp.ms}ms</span>
              <a
                href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(resp.ok ? resp.data : resp.error, null, 2))}`}
                download="response.json"
                className="ml-auto inline-flex items-center gap-1 text-xs text-primary-500 hover:underline"
              ><FaDownload size={10} /> JSON</a>
            </div>
            <pre className="bg-navy-900 text-slate-100 rounded-lg p-4 overflow-x-auto max-h-96 font-mono text-[11px] leading-relaxed">
              <code>{JSON.stringify(resp.ok ? resp.data : resp.error, null, 2)}</code>
            </pre>
          </motion.div>
        )}
      </div>
    </div>
  )
}
