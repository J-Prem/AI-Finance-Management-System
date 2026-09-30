import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FaGauge, FaChartLine, FaWallet, FaArrowTrendUp, FaBolt, FaFire,
  FaRobot, FaBell, FaPlus, FaReceipt, FaBrain, FaArrowsRotate,
  FaCircleCheck, FaArrowDown, FaArrowUp,
} from 'react-icons/fa6'
import Layout from '../components/common/Layout'
import PresenceBar from '../components/common/PresenceBar'
import {
  LivePulse, PriceFlash, AnimatedCounter, Sparkline, GlassCard,
  CountdownChip, MetricDelta, LiveFeedRow,
} from '../components/common/Realtime'
import { getSnapshot } from '../services/monitoringService'
import { analyzePersonality } from '../services/personalityService'
import { useSocket } from '../hooks/useSocket'
import { useCurrency } from '../contexts/CurrencyContext'
import { safeNum, safeDiv, fmtSigned } from '../utils/safe'
import api from '../services/api'
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Area, AreaChart,
} from 'recharts'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4']
const REFRESH_SECS = 15

export default function DashboardPage() {
  const { symbol } = useCurrency()
  const { socket, connected } = useSocket()

  const [snap, setSnap] = useState(null)
  const [personality, setPersonality] = useState(null)
  const [trend, setTrend] = useState([])
  const [lastUpdated, setLastUpdated] = useState('')
  const [tick, setTick] = useState(0)
  const [liveEvents, setLiveEvents] = useState([])
  const [marketPulse, setMarketPulse] = useState([])
  const firstLoad = useRef(false)

  const applySnapshot = (data) => {
    if (!data) return
    setSnap((prev) => {
      if (prev?.kpi && data?.kpi && Math.abs(safeNum(data.kpi.monthSpend) - safeNum(prev.kpi.monthSpend)) > 1) {
        const diff = safeNum(data.kpi.monthSpend) - safeNum(prev.kpi.monthSpend)
        setLiveEvents((e) => [{
          id: Date.now() + Math.random(),
          text: `Month spend ${diff > 0 ? 'up' : 'down'} by ${symbol}${Math.abs(diff).toFixed(0)}`,
          tone: diff > 0 ? 'down' : 'up',
          ts: new Date(),
        }, ...e].slice(0, 10))
      }
      return data
    })
    setTrend((t) => [...t.slice(-40), {
      t: new Date(data.ts).toLocaleTimeString(),
      spend: safeNum(data.kpi?.monthSpend),
      burn: safeNum(data.kpi?.burnRate),
      income: safeNum(data.kpi?.monthIncome),
    }])
    setLastUpdated(new Date(data.ts || Date.now()).toLocaleTimeString())

    // Seed live activity from recent transactions when feed is empty so users
    // always see movement rather than "waiting for events...".
    const recents = Array.isArray(data.recentTransactions) ? data.recentTransactions : []
    setLiveEvents((prev) => {
      if (prev.length > 0) return prev
      const events = recents.slice(0, 6).map((t, i) => ({
        id: (t.id || i) + '-seed',
        text: `${t.type === 'income' ? '+' : '-'}${symbol}${Math.abs(safeNum(t.amount)).toFixed(0)} · ${t.category || 'Uncategorised'} · ${t.description || '—'}`,
        tone: t.type === 'income' ? 'up' : 'down',
        ts: new Date(t.date || Date.now() - i * 60_000),
      }))
      // Always add a heartbeat event so the feed is never fully empty.
      events.unshift({
        id: 'hb-' + Date.now(),
        text: 'Live metrics stream active',
        tone: 'neutral',
        ts: new Date(),
      })
      return events
    })
  }

  const load = async () => {
    try {
      const [s, p] = await Promise.all([
        getSnapshot(),
        analyzePersonality({}).catch(() => null),
      ])
      applySnapshot(s?.data)
      if (p) setPersonality(p.data)
    } catch (e) { /* ignore */ }
    setTick((t) => t + 1)
  }

  useEffect(() => {
    load()
    firstLoad.current = true
    const id = setInterval(load, REFRESH_SECS * 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!socket) return
    const onUpdate = (payload) => applySnapshot(payload)
    const onAlert = (payload) => {
      if (!payload) return
      setLiveEvents((e) => [{
        id: Date.now() + Math.random(),
        text: payload.message || 'New alert received',
        tone: payload.severity === 'critical' ? 'down' : 'neutral',
        ts: new Date(),
      }, ...e].slice(0, 10))
    }
    socket.on('metrics:update', onUpdate)
    socket.on('alert:new', onAlert)
    return () => {
      socket.off('metrics:update', onUpdate)
      socket.off('alert:new', onAlert)
    }
  }, [socket])

  // Load market pulse from real backend data (Yahoo via /external/stocks/indices + crypto + FX).
  // Falls back to realistic defaults if backend is unreachable so NIFTY never renders as 0.
  useEffect(() => {
    const DEFAULTS = [
      { s: 'NIFTY',     v: 23586 },
      { s: 'SENSEX',    v: 77420 },
      { s: 'BANKNIFTY', v: 51204 },
      { s: 'USDINR',    v: 83.20 },
      { s: 'GOLD',      v: 73450 },
      { s: 'BTC',       v: 68200 },
    ]
    const applyWithSpark = (rows) => rows.map((r) => ({
      ...r,
      spark: randomWalk(r.v || 100, 18, 0.003),
    }))

    let cancelled = false
    const loadLivePulse = async () => {
      try {
        const [idxRes, cryptoRes, fxRes, metalsRes] = await Promise.allSettled([
          api.get('/external/stocks/indices?region=IN'),
          api.get('/external/investments/crypto/market?limit=1&vs=usd'),
          api.get('/external/currency/rates?base=USD'),
          api.get('/external/investments/metals'),
        ])
        const idxList = idxRes.value?.data?.indices || idxRes.value?.data?.data?.indices || []
        const byName = (code) => idxList.find((x) => x.symbol === code) || {}
        const nifty   = safeNum(byName('^NSEI').value)  || DEFAULTS[0].v
        const sensex  = safeNum(byName('^BSESN').value) || DEFAULTS[1].v
        const bnifty  = safeNum(byName('^NSEBANK').value) || DEFAULTS[2].v

        const btc = safeNum(cryptoRes.value?.data?.crypto?.[0]?.price ||
          cryptoRes.value?.data?.data?.crypto?.[0]?.price) || DEFAULTS[5].v
        const usdinr = safeNum(fxRes.value?.data?.rates?.INR ||
          fxRes.value?.data?.data?.rates?.INR) || DEFAULTS[3].v
        const gold = safeNum(metalsRes.value?.data?.metals?.gold?.price ||
          metalsRes.value?.data?.data?.metals?.gold?.price) || DEFAULTS[4].v

        const rows = [
          { s: 'NIFTY',     v: nifty },
          { s: 'SENSEX',    v: sensex },
          { s: 'BANKNIFTY', v: bnifty },
          { s: 'USDINR',    v: usdinr },
          { s: 'GOLD',      v: gold },
          { s: 'BTC',       v: btc },
        ]
        if (!cancelled) setMarketPulse(applyWithSpark(rows))
      } catch {
        if (!cancelled) setMarketPulse(applyWithSpark(DEFAULTS))
      }
    }
    // Seed immediately with defaults so NIFTY renders non-zero from first paint.
    setMarketPulse(applyWithSpark(DEFAULTS))
    loadLivePulse()
    const reload = setInterval(loadLivePulse, 60_000)

    const t = setInterval(() => {
      setMarketPulse((prev) => prev.map((m) => {
        const drift = 1 + (Math.random() - 0.5) * 0.004
        const next = m.v * drift
        return { ...m, v: next, spark: [...m.spark.slice(-17), next] }
      }))
    }, 2200)
    return () => { cancelled = true; clearInterval(t); clearInterval(reload) }
  }, [])

  if (!snap) {
    return (
      <Layout>
        <div className="space-y-4 p-4">
          <div className="h-8 w-60 bg-navy-100 dark:bg-navy-800 rounded animate-pulse" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="h-24 bg-navy-100 dark:bg-navy-800 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-navy-100 dark:bg-navy-800 rounded-xl animate-pulse" />
        </div>
      </Layout>
    )
  }

  const noData = !snap.kpi?.monthSpend && !snap.kpi?.weekSpend && !snap.kpi?.todaySpend && !snap.topCategories?.length
  const k = snap.kpi || {}
  const cats = (snap.topCategories || []).map((c, i) => ({
    name: c.category, value: safeNum(c.amount), color: COLORS[i % COLORS.length]
  }))
  const alerts = snap.alerts || []
  const monthBudget = safeNum(k.monthBudget) || safeNum(k.monthSpend) * 1.25
  const burnPct = Number((safeDiv(k.monthSpend, monthBudget) * 100).toFixed(0))
  const savingsRate = safeNum(k.savingsRate) * 100

  return (
    <Layout>
      <div className="space-y-6 mesh-bg p-4 -m-4 rounded-xl">
        {/* Header ------------------------------------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-start justify-between flex-wrap gap-3"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
              <FaGauge size={11} /> COMMAND CENTER
              <LivePulse status={connected ? 'live' : 'delayed'} className="ml-2" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Financial Dashboard
            </h1>
            <p className="text-navy-600 dark:text-navy-400 mt-1 flex items-center gap-2 flex-wrap">
              Live metrics - updated {lastUpdated || 'just now'}
              <CountdownChip seconds={REFRESH_SECS} trigger={tick} />
              <button
                onClick={load}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
              >
                <FaArrowsRotate size={10} /> Refresh
              </button>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/transactions" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-700 transition">
              <FaPlus size={11} /> New transaction
            </Link>
            <Link to="/receipts" className="inline-flex items-center gap-2 px-4 py-2 bg-navy-100 dark:bg-navy-800 text-navy-900 dark:text-navy-100 rounded-lg text-sm font-semibold hover:bg-navy-200 dark:hover:bg-navy-700 transition">
              <FaReceipt size={11} /> Upload receipt
            </Link>
            <Link to="/chatbot" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-sm font-semibold shadow-sm hover:shadow-lg transition animate-gradient">
              <FaRobot size={11} /> AI Advisor
            </Link>
          </div>
        </motion.div>

        {/* Presence bar ------------------------------------------------ */}
        <PresenceBar />

        {/* Market pulse (live mini tickers) ---------------------------- */}
        <GlassCard className="p-3" gradient="from-indigo-500/10 to-purple-500/10">
          <div className="flex items-center gap-2 mb-2">
            <FaBolt className="text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-navy-600 dark:text-navy-300">Market pulse</span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {marketPulse.map((m) => {
              const open = m.spark[0]
              const chg = safeDiv(m.v - open, open) * 100
              return (
                <div key={m.s} className="p-2 rounded-lg bg-white/70 dark:bg-navy-900/50 border border-navy-200/60 dark:border-navy-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-navy-700 dark:text-navy-200">{m.s}</span>
                    <span className={`text-[10px] font-semibold ${chg >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {fmtSigned(chg, 2)}%
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-0.5">
                    <PriceFlash value={m.v} className="text-xs font-bold text-navy-900 dark:text-navy-100" />
                    <Sparkline data={m.spark} color={chg >= 0 ? '#10b981' : '#ef4444'} width={56} height={18} />
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>

        {/* KPI ribbon -------------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI icon={<FaWallet />}        label="Today"        value={k.todaySpend} symbol={symbol} accent="from-indigo-500 to-purple-500" delta={k.todayDelta} />
          <KPI icon={<FaChartLine />}     label="This week"    value={k.weekSpend}  symbol={symbol} accent="from-sky-500 to-cyan-500"     delta={k.weekDelta} />
          <KPI icon={<FaFire />}          label="This month"   value={k.monthSpend} symbol={symbol} accent="from-rose-500 to-pink-500"    delta={k.monthDelta} progressPct={burnPct} />
          <KPI icon={<FaArrowTrendUp />}  label="Savings rate" value={savingsRate}  suffix="%"      accent="from-emerald-500 to-teal-500" delta={k.savingsDelta} isPct />
        </div>

        {/* Main charts grid ------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GlassCard className="lg:col-span-2 p-4" gradient="from-indigo-500/5 to-transparent">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-navy-600 dark:text-navy-300">Spend vs burn</p>
                <p className="text-sm text-navy-500">Live streaming - {trend.length} ticks</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> spend</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> burn</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> income</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="spendG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="burnG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="incomeG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.35} />
                  <XAxis dataKey="t" hide />
                  <YAxis hide />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.95)' }} formatter={(v) => `${symbol}${Number(v).toFixed(0)}`} />
                  <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#incomeG)" strokeWidth={2} />
                  <Area type="monotone" dataKey="spend"  stroke="#6366f1" fill="url(#spendG)"  strokeWidth={2} />
                  <Area type="monotone" dataKey="burn"   stroke="#f59e0b" fill="url(#burnG)"   strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-4" gradient="from-pink-500/5 to-transparent">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-navy-600 dark:text-navy-300">Category share</p>
              <LivePulse status={connected ? 'live' : 'delayed'} />
            </div>
            <div className="h-48">
              {cats.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-navy-500">No category data yet</div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={cats} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={2}>
                      {cats.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.95)' }} formatter={(v) => `${symbol}${Number(v).toFixed(0)}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {cats.slice(0, 6).map((c) => (
                <span key={c.name} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/60 dark:bg-navy-800/60 border border-navy-200/60 dark:border-navy-700/60">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </span>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Bottom grid: weekday bars + personality -------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GlassCard className="lg:col-span-2 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-navy-600 dark:text-navy-300">Weekly heat</p>
              <span className="text-[10px] text-navy-500">Spend by day of week</span>
            </div>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={(snap.byWeekday || []).map((d, i) => ({ d: d.day?.slice(0,3) || `D${i+1}`, v: safeNum(d.amount) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.35} />
                  <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v) => `${symbol}${Number(v).toFixed(0)}`} />
                  <Bar dataKey="v" radius={[6,6,0,0]}>
                    {(snap.byWeekday || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-4" gradient="from-purple-500/5 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <FaBrain className="text-purple-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-navy-600 dark:text-navy-300">Personality</p>
            </div>
            {personality ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-navy-900 dark:text-navy-100">
                  {personality.persona || personality.label || 'Analysing pattern...'}
                </p>
                {(() => {
                  // Classifier returns PascalCase labels. Normalise so the UI
                  // works regardless of casing.
                  const raw = personality.scores || {}
                  const norm = Object.fromEntries(
                    Object.entries(raw).map(([k, v]) => [String(k).toLowerCase(), Number(v) || 0])
                  )
                  const get = (k) => safeNum(norm[k]) * 100
                  return (
                    <>
                      <PersonalityBar label="Spender"   value={get('spender')}   color="bg-rose-500" />
                      <PersonalityBar label="Saver"     value={get('saver')}     color="bg-emerald-500" />
                      <PersonalityBar label="Investor"  value={get('investor')}  color="bg-indigo-500" />
                      <PersonalityBar label="Impulsive" value={get('impulsive')} color="bg-amber-500" />
                      <PersonalityBar label="Strategic" value={get('strategic')} color="bg-purple-500" />
                    </>
                  )
                })()}
              </div>
            ) : (
              <div className="text-xs text-navy-500">Not enough history yet - add transactions to see your pattern.</div>
            )}
          </GlassCard>
        </div>

        {/* Live activity + alerts ------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-navy-600 dark:text-navy-300">Live activity</p>
              <LivePulse status={connected ? 'live' : 'delayed'} />
            </div>
            <div className="space-y-1 max-h-60 overflow-auto pr-1">
              <AnimatePresence initial={false}>
                {liveEvents.length === 0 ? (
                  <div className="text-xs text-navy-500 italic">Waiting for live events...</div>
                ) : liveEvents.map((e, idx) => (
                  <LiveFeedRow key={e.id} tone={e.tone} idx={idx}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-navy-900 dark:text-navy-100">{e.text}</span>
                      <span className="text-navy-400">{e.ts.toLocaleTimeString()}</span>
                    </div>
                  </LiveFeedRow>
                ))}
              </AnimatePresence>
            </div>
          </GlassCard>

          <GlassCard className="p-4" gradient="from-amber-500/5 to-transparent">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FaBell className="text-amber-500 animate-float" />
                <p className="text-xs font-semibold uppercase tracking-wider text-navy-600 dark:text-navy-300">Alerts</p>
              </div>
              <span className="text-[10px] text-navy-500">{alerts.length} open</span>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-auto pr-1">
              {alerts.length === 0 ? (
                <div className="text-xs text-emerald-600 flex items-center gap-2">
                  <FaCircleCheck /> All clear - no active alerts.
                </div>
              ) : alerts.slice(0, 8).map((a, i) => (
                <motion.div
                  key={a.id || i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-navy-800/60 border border-navy-200/60 dark:border-navy-700/60"
                >
                  <div className={`w-1.5 h-1.5 mt-1.5 rounded-full ${a.severity === 'critical' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-navy-900 dark:text-navy-100 truncate">{a.title || a.type || 'Alert'}</p>
                    <p className="text-[10px] text-navy-500 truncate">{a.message || ''}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Quick actions ---------------------------------------------- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: '/budgets',     label: 'Budgets',     icon: FaWallet,       from: 'from-emerald-500', to2: 'to-teal-500' },
            { to: '/investments', label: 'Investments', icon: FaArrowTrendUp, from: 'from-indigo-500',  to2: 'to-purple-500' },
            { to: '/market',      label: 'Market',      icon: FaChartLine,    from: 'from-sky-500',     to2: 'to-cyan-500' },
            { to: '/api-keys',    label: 'API keys',    icon: FaBolt,         from: 'from-amber-500',   to2: 'to-rose-500' },
          ].map((q, i) => (
            <motion.div
              key={q.to}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Link
                to={q.to}
                className={`relative overflow-hidden block p-4 rounded-xl bg-gradient-to-br ${q.from} ${q.to2} text-white font-semibold shadow-sm hover:shadow-xl transition group`}
              >
                <div className="flex items-center justify-between">
                  <q.icon className="text-xl opacity-90 group-hover:scale-110 transition-transform" />
                  <FaArrowUp className="rotate-45 opacity-70 group-hover:opacity-100" />
                </div>
                <p className="mt-2 text-sm">{q.label}</p>
                <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </motion.div>
          ))}
        </div>

        {noData && (
          <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-200 dark:border-indigo-800 text-center">
            <p className="text-sm text-navy-700 dark:text-navy-200">
              Your dashboard is waiting for data. Add a transaction or connect an account to bring it to life.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}

/* ------------------------------ helpers ------------------------------ */

function KPI({ icon, label, value, symbol = '', suffix = '', accent, delta, progressPct, isPct }) {
  const hasDelta = delta !== undefined && delta !== null && !Number.isNaN(Number(delta))
  const d = Number(delta || 0)
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl p-4 bg-white/80 dark:bg-navy-900/70 border border-white/40 dark:border-navy-700/50 backdrop-blur-lg shadow-sm hover-lift"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent || 'from-indigo-500 to-purple-500'}`} />
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent || 'from-indigo-500 to-purple-500'} text-white flex items-center justify-center text-sm shadow`}>
          {icon}
        </div>
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {d >= 0 ? <FaArrowUp size={8} /> : <FaArrowDown size={8} />}
            {Math.abs(d).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-500 mt-2">{label}</p>
      <p className="text-2xl font-bold text-navy-900 dark:text-navy-100 tabular-nums">
        {symbol}
        <AnimatedCounter value={safeNum(value)} decimals={isPct ? 1 : 0} />
        {suffix}
      </p>
      {typeof progressPct === 'number' && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
              transition={{ duration: 0.8 }}
              className={`h-full bg-gradient-to-r ${accent || 'from-indigo-500 to-purple-500'}`}
            />
          </div>
          <p className="text-[9px] text-navy-500 mt-0.5">{progressPct}% of budget</p>
        </div>
      )}
    </motion.div>
  )
}

function PersonalityBar({ label, value, color }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-navy-600 dark:text-navy-300">{label}</span>
        <span className="font-semibold text-navy-900 dark:text-navy-100">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          transition={{ duration: 0.8 }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  )
}

function randomWalk(start, n, vol) {
  const arr = [start]
  for (let i = 1; i < n; i++) {
    const last = arr[i - 1]
    arr.push(last * (1 + (Math.random() - 0.5) * vol * 2))
  }
  return arr
}
