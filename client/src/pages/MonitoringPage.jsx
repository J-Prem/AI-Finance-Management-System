import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/common/Layout'
import { getProviderDiagnostics, getSnapshot } from '../services/monitoringService'
import { io as socketIO } from 'socket.io-client'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../services/api'
import { createTransaction } from '../services/transactionService'
import toast from 'react-hot-toast'

const severityColor = { critical: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' }

const CATEGORIES = [
  'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Healthcare', 'Education', 'Travel',
  'Income', 'Investment', 'Uncategorized',
]

export default function MonitoringPage() {
  const [snap, setSnap] = useState(null)
  const [providers, setProviders] = useState([])
  const [history, setHistory] = useState([])
  const [connected, setConnected] = useState(false)
  const [indices, setIndices] = useState([])
  const [crypto, setCrypto] = useState([])
  const [alertFilter, setAlertFilter] = useState('all')
  const [quickEntry, setQuickEntry] = useState({
    amount: '', description: '', category: 'Uncategorized', type: 'expense',
  })
  const [health, setHealth] = useState(null)

  // Live market pulse
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [idxRes, cryRes, healthRes] = await Promise.allSettled([
          api.get('/external/stocks/indices?region=IN'),
          api.get('/external/crypto/market?limit=5'),
          api.get('/health'),
        ])
        if (!mounted) return
        if (idxRes.status === 'fulfilled') {
          setIndices(idxRes.value?.data?.indices || idxRes.value?.data?.data?.indices || [])
        }
        if (cryRes.status === 'fulfilled') {
          setCrypto(cryRes.value?.data?.coins || cryRes.value?.data?.data?.coins || [])
        }
        if (healthRes.status === 'fulfilled') {
          setHealth(healthRes.value?.data || healthRes.value?.data?.data)
        }
      } catch {}
    }
    load()
    const t = setInterval(load, 60_000)
    return () => { mounted = false; clearInterval(t) }
  }, [])

  const submitQuickEntry = async () => {
    if (!quickEntry.amount || !quickEntry.description) {
      toast.error('Amount and description are required')
      return
    }
    try {
      await createTransaction({
        amount: Number(quickEntry.amount),
        description: quickEntry.description,
        category: quickEntry.category,
        type: quickEntry.type,
        date: new Date().toISOString(),
      })
      toast.success('Transaction logged')
      setQuickEntry({ amount: '', description: '', category: 'Uncategorized', type: 'expense' })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Unable to log')
    }
  }

  const filteredAlerts = useMemo(() => {
    if (!snap?.alerts) return []
    return alertFilter === 'all' ? snap.alerts : snap.alerts.filter((a) => a.severity === alertFilter)
  }, [snap, alertFilter])

  useEffect(() => {
    // Pull initial snapshot
    getSnapshot().then((r) => setSnap(r?.data)).catch(() => {})
    getProviderDiagnostics().then((r) => setProviders(r?.data || [])).catch(() => {})

    // Open socket for live updates. The Vite dev proxy forwards /socket.io
    // to the backend, so use the current origin; in production the client
    // and API are on the same origin anyway.
    const sock = socketIO(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000', {
      auth: { token: localStorage.getItem('token') || '' },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
    sock.on('connect', () => setConnected(true))
    sock.on('disconnect', () => setConnected(false))
    sock.on('connect_error', (err) => {
      // Connection failed — log but don't blow up UI. Auto-reconnect handles retry.
      // eslint-disable-next-line no-console
      console.warn('[socket] connect_error', err?.message)
      setConnected(false)
    })
    sock.on('metrics:update', (payload) => {
      if (!payload?.kpi) return
      setSnap(payload)
      setHistory((h) => [...h.slice(-40), {
        t: new Date(payload.ts || Date.now()).toLocaleTimeString(),
        burn: payload.kpi.burnRate || 0,
        spend: payload.kpi.monthSpend || 0,
      }])
    })
    return () => sock.close()
  }, [])

  if (!snap) return <Layout><div className="p-6">Booting monitoring stream…</div></Layout>

  const k = snap.kpi
  const kpis = [
    { label: 'Today Spend', value: `$${k.todaySpend.toFixed(2)}`, accent: 'bg-blue-600' },
    { label: 'Week Spend', value: `$${k.weekSpend.toFixed(2)}`, accent: 'bg-indigo-600' },
    { label: 'Month Spend', value: `$${k.monthSpend.toFixed(2)}`, accent: 'bg-purple-600' },
    { label: 'Burn Rate /day', value: `$${k.burnRate.toFixed(2)}`, accent: 'bg-pink-600' },
    { label: 'Savings Rate', value: `${(k.savingsRate * 100).toFixed(1)}%`, accent: 'bg-emerald-600' },
    { label: 'Top Category', value: k.topCategory, accent: 'bg-amber-600' },
    { label: 'Active Bills', value: k.activeBills, accent: 'bg-cyan-600' },
    { label: 'Recurring', value: k.recurringCount, accent: 'bg-rose-600' },
  ]

  return (
    <Layout>
      <div className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Finance Ops Console</h1>
            <p className="text-gray-500 text-sm">Live KPIs · socket {connected ? <span className="text-green-600 font-semibold">CONNECTED</span> : <span className="text-red-500">DISCONNECTED</span>} · last tick {new Date(snap.ts).toLocaleTimeString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-gray-900 text-green-400 font-mono text-xs">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
              STREAM {connected ? 'LIVE' : 'IDLE'}
            </div>
            <div className="px-3 py-1 rounded bg-gray-900 text-blue-300 font-mono text-xs">FORECAST: ${snap.forecastTotal.toFixed(2)}</div>
          </div>
        </header>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {kpis.map((x) => (
            <div key={x.label} className="bg-gray-900 text-white rounded-lg p-3 shadow border border-gray-800">
              <div className={`w-8 h-1 rounded ${x.accent} mb-2`} />
              <div className="text-xs uppercase text-gray-400">{x.label}</div>
              <div className="text-lg font-bold mt-1 truncate">{x.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-navy-800 border rounded-lg p-4">
            <div className="text-sm font-semibold mb-2">Burn rate trend (live)</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="t" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="burn" stroke="#ec4899" dot={false} />
                <Line type="monotone" dataKey="spend" stroke="#6366f1" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-navy-800 border rounded-lg p-4">
            <div className="text-sm font-semibold mb-2">Top categories (30d)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={snap.topCategories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={10} />
                <YAxis type="category" dataKey="category" fontSize={10} width={80} />
                <Tooltip />
                <Bar dataKey="amount" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live market pulse + quick transaction entry */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-navy-800 border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Live Market Pulse</div>
              <span className="text-xs text-gray-400">auto 60s</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-gray-500 font-semibold mb-1">Indices (IN)</div>
                {indices.slice(0, 4).map((idx) => (
                  <div key={idx.symbol} className="flex justify-between py-0.5">
                    <span className="truncate">{idx.name}</span>
                    <span className={idx.changePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {idx.changePercent >= 0 ? '+' : ''}{Number(idx.changePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                ))}
                {!indices.length && <div className="text-gray-400">Loading…</div>}
              </div>
              <div>
                <div className="text-gray-500 font-semibold mb-1">Top Crypto</div>
                {crypto.slice(0, 4).map((c) => (
                  <div key={c.id || c.symbol} className="flex justify-between py-0.5">
                    <span className="truncate">{c.symbol?.toUpperCase() || c.name}</span>
                    <span className={c.change24h >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {c.change24h >= 0 ? '+' : ''}{Number(c.change24h || 0).toFixed(2)}%
                    </span>
                  </div>
                ))}
                {!crypto.length && <div className="text-gray-400">Loading…</div>}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-navy-800 border rounded-lg p-4">
            <div className="text-sm font-semibold mb-3">Quick Transaction Entry</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <input
                type="number"
                placeholder="Amount"
                value={quickEntry.amount}
                onChange={(e) => setQuickEntry({ ...quickEntry, amount: e.target.value })}
                className="rounded border px-2 py-1.5 dark:bg-navy-900"
              />
              <select
                value={quickEntry.type}
                onChange={(e) => setQuickEntry({ ...quickEntry, type: e.target.value })}
                className="rounded border px-2 py-1.5 dark:bg-navy-900"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <input
                type="text"
                placeholder="Description"
                value={quickEntry.description}
                onChange={(e) => setQuickEntry({ ...quickEntry, description: e.target.value })}
                className="col-span-2 rounded border px-2 py-1.5 dark:bg-navy-900"
              />
              <select
                value={quickEntry.category}
                onChange={(e) => setQuickEntry({ ...quickEntry, category: e.target.value })}
                className="col-span-2 rounded border px-2 py-1.5 dark:bg-navy-900"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={submitQuickEntry}
                className="col-span-2 rounded bg-emerald-600 text-white px-3 py-1.5 font-medium hover:bg-emerald-700"
              >
                Log transaction
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 text-white rounded-lg p-4 border border-gray-800 font-mono text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400">[ ALERT FEED ]</div>
              <select
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value)}
                className="bg-gray-800 text-white text-xs px-2 py-0.5 rounded border-gray-700"
              >
                <option value="all">all</option>
                <option value="critical">critical</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
              </select>
            </div>
            {filteredAlerts.length === 0 && <div className="text-gray-500">No alerts in this filter</div>}
            {filteredAlerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className={`w-2 h-2 rounded-full ${severityColor[a.severity] || 'bg-gray-500'}`} />
                <span className="text-gray-400">{a.code.padEnd(18)}</span>
                <span className="flex-1">{a.message}</span>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-navy-800 border rounded-lg p-4">
            <div className="text-sm font-semibold mb-2">Detected recurring subscriptions</div>
            <div className="space-y-1 text-sm">
              {snap.recurring.map((r) => (
                <div key={r.merchant} className="flex justify-between">
                  <span>{r.merchant}</span>
                  <span className="tabular-nums">${r.amount.toFixed(2)} × {r.count}</span>
                </div>
              ))}
              {!snap.recurring.length && <div className="text-gray-500 text-sm">No recurring charges detected yet.</div>}
            </div>
          </div>
        </div>

        {/* API / system health */}
        {health && (
          <div className="bg-white dark:bg-navy-800 border rounded-lg p-4">
            <div className="text-sm font-semibold mb-3">System health</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded border p-3 bg-gray-50 dark:bg-navy-900">
                <div className="text-xs text-gray-500">API Status</div>
                <div className={`text-lg font-semibold ${health.status === 'ok' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {health.status || 'unknown'}
                </div>
              </div>
              <div className="rounded border p-3 bg-gray-50 dark:bg-navy-900">
                <div className="text-xs text-gray-500">Uptime</div>
                <div className="text-lg font-semibold">
                  {health.uptime ? `${Math.floor(health.uptime / 60)}m` : '—'}
                </div>
              </div>
              <div className="rounded border p-3 bg-gray-50 dark:bg-navy-900">
                <div className="text-xs text-gray-500">DB</div>
                <div className={`text-lg font-semibold ${health.database === 'connected' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {health.database || '—'}
                </div>
              </div>
              <div className="rounded border p-3 bg-gray-50 dark:bg-navy-900">
                <div className="text-xs text-gray-500">Environment</div>
                <div className="text-lg font-semibold">{health.environment || '—'}</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-navy-800 border rounded-lg p-4">
          <div className="text-sm font-semibold mb-3">AI provider readiness</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {providers.map((p) => (
              <div key={p.name} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold capitalize">{p.name}</div>
                  <span className={`h-2.5 w-2.5 rounded-full ${p.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
                <div className="mt-1 text-xs text-gray-500">{p.configured ? 'Configured' : 'Missing key'}</div>
                {p.activeModel && <div className="mt-2 text-xs font-mono text-green-700">{p.activeModel}</div>}
                {p.error && <div className="mt-2 text-xs text-red-600">{p.error}</div>}
                {!!p.models?.length && (
                  <div className="mt-2 text-xs text-gray-500 line-clamp-2">{p.models.join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
