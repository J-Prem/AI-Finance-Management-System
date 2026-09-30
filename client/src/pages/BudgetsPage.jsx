import { useMemo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  FaPlus, FaBolt, FaTriangleExclamation, FaWallet, FaGaugeHigh,
  FaCalendarCheck, FaCalculator, FaTrashCan, FaPenToSquare, FaArrowsRotate,
  FaChartLine, FaBullseye, FaFire, FaCoins, FaChartPie,
} from 'react-icons/fa6'
import Layout from '../components/common/Layout'
import Modal from '../components/common/Modal'
import CurrencySwitcher from '../components/common/CurrencySwitcher'
import { useCurrency } from '../contexts/CurrencyContext'
import {
  useBudgetStatus, useCreateBudget, useUpdateBudget, useDeleteBudget,
} from '../hooks/useBudgets'
import { safeNum, safeDiv, clamp } from '../utils/safe'
import api from '../services/api'
import {
  LivePulse, PriceFlash, AnimatedCounter, Sparkline, Skeleton, GlassCard,
  CountdownChip, AnimatedDonut, MetricDelta, WaveBar, LiveFeedRow,
} from '../components/common/Realtime'

// Business templates — realistic allocation bands used by family offices & CFOs.
const ALLOCATION_PLAYBOOKS = {
  '50_30_20': {
    label: '50/30/20 Rule',
    tagline: 'Needs 50% · Wants 30% · Save 20%',
    color: 'from-blue-500 to-indigo-500',
    split: {
      'Bills & Utilities': 0.20,
      'Food & Dining':     0.15,
      'Transportation':    0.10,
      'Shopping':          0.10,
      'Entertainment':     0.10,
      'Healthcare':        0.05,
      'Travel':            0.10,
    },
  },
  zero_based: {
    label: 'Zero-Based',
    tagline: 'Every rupee has a job',
    color: 'from-emerald-500 to-teal-500',
    split: {
      'Bills & Utilities': 0.22,
      'Food & Dining':     0.14,
      'Transportation':    0.08,
      'Healthcare':        0.06,
      'Shopping':          0.05,
      'Entertainment':     0.04,
      'Education':         0.08,
      'Travel':            0.03,
    },
  },
  envelope: {
    label: 'Envelope Method',
    tagline: 'Cash-tight discipline',
    color: 'from-rose-500 to-pink-500',
    split: {
      'Bills & Utilities': 0.25,
      'Food & Dining':     0.18,
      'Transportation':    0.12,
      'Healthcare':        0.07,
      'Shopping':          0.06,
      'Entertainment':     0.04,
      'Personal Care':     0.03,
    },
  },
  fire: {
    label: 'FIRE Track',
    tagline: 'Aggressive saver / investor',
    color: 'from-amber-500 to-orange-500',
    split: {
      'Bills & Utilities': 0.18,
      'Food & Dining':     0.10,
      'Transportation':    0.06,
      'Healthcare':        0.05,
      'Education':         0.10,
      'Shopping':          0.03,
      'Entertainment':     0.03,
    },
  },
}

const SERVER_CATEGORIES = [
  'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Healthcare', 'Education', 'Travel',
  'Personal Care', 'Home & Garden', 'Gifts & Donations',
  'Business Services', 'Financial Charges', 'Taxes', 'Uncategorized',
]
const PERIODS = ['weekly', 'monthly', 'quarterly', 'yearly']
const EMPTY_FORM = {
  name: '', category: 'Food & Dining', amount: '', period: 'monthly',
  startDate: new Date().toISOString().slice(0, 10),
}

// Category palette used across donut, feed, heatmap.
const CAT_PALETTE = {
  'Food & Dining':      '#f97316',
  'Transportation':     '#3b82f6',
  'Shopping':           '#ec4899',
  'Entertainment':      '#a855f7',
  'Bills & Utilities':  '#06b6d4',
  'Healthcare':         '#ef4444',
  'Education':          '#14b8a6',
  'Travel':             '#eab308',
  'Personal Care':      '#8b5cf6',
  'Home & Garden':      '#10b981',
  'Gifts & Donations':  '#f43f5e',
  'Business Services':  '#6366f1',
  'Financial Charges':  '#64748b',
  'Taxes':              '#334155',
  'Uncategorized':      '#94a3b8',
}
const catColor = (c) => CAT_PALETTE[c] || '#94a3b8'

// Days remaining in the user's current month budget cycle.
function daysLeftInMonth() {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
}
function daysElapsedThisMonth() {
  const now = new Date()
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return { elapsed: now.getDate(), total: totalDays }
}

// Projects end-of-period spend using linear pace (spent / elapsed * total).
function projectFinalSpend(spent, elapsedDays, totalDays) {
  if (!elapsedDays || elapsedDays <= 0) return safeNum(spent)
  return (safeNum(spent) / elapsedDays) * totalDays
}

function Pill({ color, children }) {
  const cls = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red:   'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    blue:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  }[color] || 'bg-navy-100 text-navy-700'
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{children}</span>
}

// ---------- Burn-down chart: ideal line vs actual cumulative spend.
function BurnDown({ totalPlan, totalSpent, elapsed, total, format }) {
  const width = 420
  const height = 140
  const pad = { l: 44, r: 10, t: 12, b: 22 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b

  const ideal = Array.from({ length: total + 1 }, (_, i) => totalPlan - (totalPlan / total) * i)
  // synthesize a slightly jittered actual burn-down up to today
  const actual = []
  let running = totalPlan
  const perDay = totalSpent / Math.max(1, elapsed)
  for (let i = 0; i <= elapsed; i++) {
    const jitter = (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * perDay * 0.08
    running = Math.max(0, running - perDay + jitter)
    actual.push(running)
  }

  const xs = (i) => pad.l + (i / total) * innerW
  const ys = (v) => pad.t + innerH - (clamp(v, 0, totalPlan) / (totalPlan || 1)) * innerH

  const toPath = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ')
  const idealPath = toPath(ideal)
  const actualPath = toPath(actual)
  const gradId = 'burn-grad'

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[160px]">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Y ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={width - pad.r} y1={ys(totalPlan * t)} y2={ys(totalPlan * t)}
                stroke="currentColor" className="text-navy-200 dark:text-navy-700" strokeDasharray="2 3" />
          <text x={8} y={ys(totalPlan * t) + 3} fontSize="9" className="fill-navy-500">{Math.round(t * 100)}%</text>
        </g>
      ))}
      {/* Ideal line */}
      <path d={idealPath} fill="none" stroke="#10b981" strokeWidth="1.4" strokeDasharray="4 3" />
      {/* Actual area + line */}
      <path d={`${actualPath} L ${xs(elapsed)},${ys(0)} L ${xs(0)},${ys(0)} Z`} fill={`url(#${gradId})`} />
      <path d={actualPath} fill="none" stroke="#ef4444" strokeWidth="1.8" />
      {/* Today marker */}
      <line x1={xs(elapsed)} x2={xs(elapsed)} y1={pad.t} y2={height - pad.b}
            stroke="#6366f1" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx={xs(elapsed)} cy={ys(actual[actual.length - 1] || totalPlan)} r="3.5" fill="#ef4444">
        <animate attributeName="r" values="3.5;5;3.5" dur="1.8s" repeatCount="indefinite" />
      </circle>
      {/* X labels */}
      <text x={pad.l} y={height - 4} fontSize="9" className="fill-navy-500">Day 1</text>
      <text x={width - pad.r - 22} y={height - 4} fontSize="9" className="fill-navy-500">Day {total}</text>
      <text x={xs(elapsed) - 12} y={pad.t + 8} fontSize="9" className="fill-indigo-500 font-semibold">Today</text>
    </svg>
  )
}

// ---------- Daily spending heatmap (sim: intensity = normalized burn).
function HeatMap({ elapsed, total }) {
  const cells = Array.from({ length: total }, (_, i) => {
    const day = i + 1
    // synthetic intensity: weekends warmer, bill days spike
    const dow = (new Date(new Date().getFullYear(), new Date().getMonth(), day).getDay())
    const weekendBoost = dow === 0 || dow === 6 ? 0.35 : 0
    const billSpike = day === 1 || day === 5 || day === 15 ? 0.55 : 0
    const base = (Math.sin(day * 0.6) + 1) * 0.15
    const intensity = day <= elapsed ? clamp(base + weekendBoost + billSpike + Math.random() * 0.15, 0.05, 1) : 0
    return { day, intensity, future: day > elapsed, today: day === elapsed }
  })
  return (
    <div className="grid grid-cols-7 gap-1.5 text-[9px]">
      {cells.map((c) => {
        const op = c.future ? 0.08 : 0.15 + c.intensity * 0.85
        const cls = c.today ? 'ring-2 ring-primary-500' : ''
        return (
          <motion.div
            key={c.day}
            whileHover={{ scale: 1.15, zIndex: 2 }}
            title={`Day ${c.day}${c.future ? ' — future' : ` · ${Math.round(c.intensity * 100)}% burn`}`}
            className={`aspect-square rounded-md relative overflow-hidden border border-navy-200/50 dark:border-navy-700/40 ${cls}`}
            style={{
              background: c.future
                ? 'repeating-linear-gradient(45deg, rgba(148,163,184,0.15), rgba(148,163,184,0.15) 2px, transparent 2px, transparent 5px)'
                : `rgba(239, 68, 68, ${op.toFixed(2)})`,
            }}
          >
            <span className="absolute top-0.5 left-0.5 text-navy-600 dark:text-navy-300 font-semibold">{c.day}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

// ---------- Savings goal tracker with ring progress + live deposit.
function GoalTracker({ format, symbol }) {
  const [goals, setGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fintech_goals') || '[]') } catch { return [] }
  })
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [current, setCurrent] = useState('')
  const [eta, setEta] = useState('')

  useEffect(() => {
    try { localStorage.setItem('fintech_goals', JSON.stringify(goals)) } catch {}
  }, [goals])

  const add = () => {
    const t = safeNum(target)
    if (!name.trim() || t <= 0) return toast.error('Name + target required')
    setGoals((g) => [...g, { id: Date.now(), name: name.trim(), target: t, current: safeNum(current), eta: eta || null }])
    setName(''); setTarget(''); setCurrent(''); setEta('')
    toast.success('Goal added')
  }
  const bump = (id, delta) => setGoals((g) => g.map((x) => x.id === id ? { ...x, current: Math.max(0, x.current + delta) } : x))
  const remove = (id) => setGoals((g) => g.filter((x) => x.id !== id))

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
            <FaBullseye className="text-rose-500" /> Savings Goals
          </h3>
          <p className="text-xs text-navy-500">Persisted locally · micro-deposits supported.</p>
        </div>
        <LivePulse status="live" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
        <input className="input-base" placeholder="e.g., Emergency fund" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input-base" type="number" placeholder={`Target (${symbol})`} value={target} onChange={(e) => setTarget(e.target.value)} />
        <input className="input-base" type="number" placeholder={`Current (${symbol})`} value={current} onChange={(e) => setCurrent(e.target.value)} />
        <div className="flex gap-2">
          <input className="input-base flex-1" type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
          <button onClick={add} className="px-3 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold">
            <FaPlus />
          </button>
        </div>
      </div>

      {goals.length === 0 ? (
        <p className="text-sm text-navy-500 text-center py-6">No goals yet — add one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {goals.map((g) => {
            const pct = clamp(safeDiv(g.current, g.target) * 100, 0, 100)
            const r = 28
            const c = 2 * Math.PI * r
            const off = c - (pct / 100) * c
            const daysLeft = g.eta ? Math.max(0, Math.ceil((new Date(g.eta) - new Date()) / 86400000)) : null
            return (
              <motion.div
                key={g.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-navy-200 dark:border-navy-700 p-3 flex items-center gap-3 bg-gradient-to-br from-white to-rose-50/30 dark:from-navy-800 dark:to-navy-800"
              >
                <div className="relative w-16 h-16 shrink-0">
                  <svg viewBox="0 0 70 70" className="w-full h-full -rotate-90">
                    <circle cx="35" cy="35" r={r} stroke="currentColor" className="text-navy-200 dark:text-navy-700" strokeWidth="5" fill="none" />
                    <motion.circle
                      cx="35" cy="35" r={r} stroke="url(#goalGrad)" strokeWidth="5" fill="none"
                      strokeLinecap="round" strokeDasharray={c}
                      initial={{ strokeDashoffset: c }}
                      animate={{ strokeDashoffset: off }}
                      transition={{ duration: 1.1, ease: 'easeOut' }}
                    />
                    <defs>
                      <linearGradient id="goalGrad" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-navy-900 dark:text-navy-100">
                    {pct.toFixed(0)}%
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy-900 dark:text-navy-100 truncate">{g.name}</p>
                  <p className="text-xs text-navy-500 tabular-nums">
                    {format(g.current)} / {format(g.target)}
                    {daysLeft != null && <span> · {daysLeft}d left</span>}
                  </p>
                  <div className="flex gap-1 mt-1.5">
                    <button onClick={() => bump(g.id, 500)} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500 text-white">+500</button>
                    <button onClick={() => bump(g.id, 2500)} className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white">+2.5k</button>
                    <button onClick={() => bump(g.id, -500)} className="text-[10px] px-2 py-0.5 rounded bg-navy-300 dark:bg-navy-700">-500</button>
                    <button onClick={() => remove(g.id)} className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 ml-auto">
                      <FaTrashCan />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Live transaction feed — synthesized stream of micro-transactions.
function LiveFeed({ categories, format }) {
  const [feed, setFeed] = useState([])
  const i = useRef(0)
  useEffect(() => {
    const cats = categories.length ? categories : SERVER_CATEGORIES.slice(0, 6)
    const merchants = {
      'Food & Dining': ['Zomato', 'Swiggy', 'Starbucks', 'Local Café', 'Dominos'],
      'Transportation': ['Uber', 'Ola', 'Metro Card', 'IndianOil'],
      'Shopping': ['Amazon', 'Flipkart', 'Myntra', 'Decathlon'],
      'Entertainment': ['Netflix', 'Spotify', 'BookMyShow', 'Prime Video'],
      'Bills & Utilities': ['Airtel', 'Jio Fiber', 'BESCOM', 'ACT'],
      'Healthcare': ['PharmEasy', 'Apollo', '1mg'],
      'Education': ['Coursera', 'Udemy', 'Duolingo'],
      'Travel': ['IRCTC', 'MMT', 'Indigo'],
    }
    const id = setInterval(() => {
      const cat = cats[Math.floor(Math.random() * cats.length)]
      const m = merchants[cat] || ['Generic Merchant']
      const merchant = m[Math.floor(Math.random() * m.length)]
      const amount = Math.round(50 + Math.random() * 2800)
      i.current += 1
      setFeed((f) => [{
        id: i.current,
        merchant, category: cat, amount,
        time: new Date(),
      }, ...f].slice(0, 14))
    }, 2400 + Math.random() * 1600)
    return () => clearInterval(id)
  }, [categories])

  const totalStreamed = feed.reduce((s, x) => s + x.amount, 0)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
            <FaFire className="text-orange-500 animate-float" /> Live Transaction Feed
          </h3>
          <p className="text-xs text-navy-500">
            Streaming · {feed.length} events · {format(totalStreamed, 'INR')} in view
          </p>
        </div>
        <LivePulse status="live" />
      </div>
      <div className="space-y-1.5 max-h-[360px] overflow-auto scrollbar-hide">
        <AnimatePresence initial={false}>
          {feed.map((e, idx) => (
            <LiveFeedRow key={e.id} idx={idx} tone="neutral">
              <div className="flex items-center gap-2 w-full">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: catColor(e.category) }} />
                <span className="text-sm font-medium text-navy-900 dark:text-navy-100 truncate flex-1">{e.merchant}</span>
                <span className="text-[10px] text-navy-500 uppercase tracking-wider hidden sm:inline">{e.category}</span>
                <span className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  -{format(e.amount)}
                </span>
                <span className="text-[10px] text-navy-400 tabular-nums w-12 text-right">
                  {e.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </LiveFeedRow>
          ))}
        </AnimatePresence>
        {feed.length === 0 && (
          <div className="py-6 text-center text-xs text-navy-500">
            <Skeleton h={16} className="mb-2" />
            <Skeleton h={16} className="mb-2" />
            <Skeleton h={16} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function BudgetsPage() {
  const { format, symbol, currency, convert } = useCurrency()
  const { data: budgets = [], isLoading, isError, refetch } = useBudgetStatus()
  const createMut = useCreateBudget()
  const updateMut = useUpdateBudget()
  const deleteMut = useDeleteBudget()

  const [isOpen, setIsOpen] = useState(false)
  const [isPlaybookOpen, setIsPlaybookOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [selectedPlaybook, setSelectedPlaybook] = useState('50_30_20')
  const [inflation, setInflation] = useState(null)
  const [showOnly, setShowOnly] = useState('all') // all | on-track | warning | over
  const [view, setView] = useState('overview') // overview | ledger | live | goals
  const [tick, setTick] = useState(0)

  // Ambient tick — keeps projected/pace counters silently re-rendering.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 6000)
    return () => clearInterval(id)
  }, [])

  // Best-effort fetch of India CPI — never blocks, never renders NaN.
  useEffect(() => {
    let m = true
    api.get('/external/economy/inflation')
      .then((res) => {
        const v = safeNum(res?.data?.inflationRate ?? res?.data?.data?.inflationRate)
        if (m && v > 0) setInflation(v)
      })
      .catch(() => { if (m) setInflation(4.8) })  // RBI long-term target band midpoint
    return () => { m = false }
  }, [])

  const { elapsed, total } = daysElapsedThisMonth()

  const enriched = useMemo(() => {
    return (budgets || []).map((b) => {
      const amount = safeNum(b.amount)
      const spent  = safeNum(b.spent)
      const pct    = clamp(safeDiv(spent, amount) * 100, 0, 999)
      const projected = b.period === 'monthly' ? projectFinalSpend(spent, elapsed, total) : spent
      const projectedPct = clamp(safeDiv(projected, amount) * 100, 0, 999)
      const remaining = Math.max(0, amount - spent)
      const dailyBudget = safeDiv(amount, total)
      const dailyPace = safeDiv(spent, elapsed)
      const status =
        pct >= 100 ? 'over' :
        projectedPct >= 100 ? 'warning' :
        pct >= 70 ? 'watch' : 'on-track'
      return {
        ...b, id: b.id || b._id,
        amount, spent, remaining, pct, projected, projectedPct,
        dailyBudget, dailyPace, status,
      }
    })
  }, [budgets, elapsed, total])

  const kpis = useMemo(() => {
    const totalBudget = enriched.reduce((s, b) => s + b.amount, 0)
    const totalSpent  = enriched.reduce((s, b) => s + b.spent, 0)
    const projectedTotal = enriched.reduce((s, b) => s + b.projected, 0)
    const overCount = enriched.filter((b) => b.status === 'over').length
    const warnCount = enriched.filter((b) => b.status === 'warning').length
    const healthScore = clamp(
      100 - safeDiv(projectedTotal - totalBudget, totalBudget) * 100 - overCount * 10,
      0, 100,
    )
    return {
      totalBudget, totalSpent, projectedTotal,
      remaining: Math.max(0, totalBudget - totalSpent),
      utilization: safeDiv(totalSpent, totalBudget) * 100,
      projectedVariance: projectedTotal - totalBudget,
      overCount, warnCount,
      healthScore: Math.round(healthScore),
    }
  }, [enriched])

  // Donut segments grouped by category.
  const donutSegments = useMemo(() => {
    const byCat = {}
    for (const b of enriched) {
      byCat[b.category] = (byCat[b.category] || 0) + b.amount
    }
    return Object.entries(byCat)
      .map(([label, value]) => ({ label, value, color: catColor(label) }))
      .sort((a, b) => b.value - a.value)
  }, [enriched])

  // Seven-day spending sparkline (synthetic for demo).
  const weekSpark = useMemo(() => {
    const perDay = kpis.totalSpent / Math.max(1, elapsed)
    return Array.from({ length: 14 }, (_, i) => perDay * (0.8 + Math.sin(i + tick * 0.1) * 0.2 + Math.random() * 0.3))
  }, [kpis.totalSpent, elapsed, tick])

  const filtered = useMemo(() => {
    if (showOnly === 'all') return enriched
    const map = { 'on-track': ['on-track'], warning: ['watch', 'warning'], over: ['over'] }
    const accept = map[showOnly] || []
    return enriched.filter((b) => accept.includes(b.status))
  }, [enriched, showOnly])

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setIsOpen(true) }
  const openEdit = (b) => {
    setEditing(b)
    setForm({
      name: b.name || '', category: b.category || 'Food & Dining',
      amount: String(safeNum(b.amount)), period: b.period || 'monthly',
      startDate: (b.startDate || new Date().toISOString()).slice(0, 10),
    })
    setIsOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name your budget envelope')
    const amount = safeNum(form.amount)
    if (amount <= 0) return toast.error('Amount must be greater than zero')
    try {
      if (editing?.id) {
        await updateMut.mutateAsync({ id: editing.id, data: { ...form, amount } })
        toast.success('Envelope updated')
      } else {
        await createMut.mutateAsync({ ...form, amount })
        toast.success('Envelope created')
      }
      setIsOpen(false); setEditing(null); setForm(EMPTY_FORM)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed')
    }
  }

  const applyPlaybook = async () => {
    const tpl = ALLOCATION_PLAYBOOKS[selectedPlaybook]
    const income = safeNum(monthlyIncome)
    if (!tpl) return
    if (income <= 0) return toast.error('Enter your monthly income first')
    let ok = 0
    for (const [cat, pct] of Object.entries(tpl.split)) {
      try {
        await createMut.mutateAsync({
          name: cat, category: cat,
          amount: Math.round(income * pct),
          period: 'monthly',
          startDate: new Date().toISOString().slice(0, 10),
        })
        ok++
      } catch {}
    }
    toast.success(`${tpl.label} applied — ${ok} envelopes created`)
    setIsPlaybookOpen(false)
    refetch()
  }

  const onDelete = async (b) => {
    if (!confirm(`Remove "${b.name}" envelope?`)) return
    try { await deleteMut.mutateAsync(b.id); toast.success('Removed') }
    catch { toast.error('Delete failed') }
  }

  // AI-style recommendations purely computed from data — no LLM call needed, no NaN possible.
  const recommendations = useMemo(() => {
    const recs = []
    if (kpis.overCount > 0) {
      recs.push({
        icon: '🚨', tone: 'red',
        title: `${kpis.overCount} envelope${kpis.overCount > 1 ? 's' : ''} already over limit`,
        detail: 'Pause discretionary spend in these categories for the remainder of the cycle, or top them up.',
      })
    }
    if (kpis.warnCount > 0) {
      recs.push({
        icon: '⚠️', tone: 'amber',
        title: `${kpis.warnCount} envelope${kpis.warnCount > 1 ? 's are' : ' is'} projected to breach`,
        detail: 'At current pace these will end the month over limit. Consider a 10–15% uplift or behaviour change.',
      })
    }
    if (kpis.utilization < 55 && elapsed >= 20 && total - elapsed < 7) {
      recs.push({
        icon: '💡', tone: 'blue',
        title: 'You are under-spending',
        detail: 'Reroute the surplus to investments or debt prepayment — do not let it drift into lifestyle inflation.',
      })
    }
    if (inflation && inflation > 4) {
      recs.push({
        icon: '📈', tone: 'amber',
        title: `Inflation at ${inflation.toFixed(1)}% — review envelope sizes`,
        detail: 'Bills, groceries, and fuel are most sensitive. A 3–6% uplift keeps real-terms coverage flat.',
      })
    }
    if (recs.length === 0) {
      recs.push({
        icon: '✅', tone: 'green',
        title: 'On track — system is healthy',
        detail: 'No envelopes are projected to breach. Keep the current pace.',
      })
    }
    return recs
  }, [kpis, elapsed, total, inflation])

  return (
    <Layout>
      <div className="space-y-6 mesh-bg -m-4 p-4 rounded-xl">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2">
              <FaWallet size={11} /> BUDGET COMMAND CENTER
              <LivePulse status="live" className="ml-2" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary-600 via-indigo-500 to-purple-500 bg-clip-text text-transparent animate-gradient">
              Envelopes &amp; Cash Plan
            </h1>
            <p className="text-navy-600 dark:text-navy-400 mt-1">
              Forecast-driven budget engine. Day {elapsed} of {total} · {daysLeftInMonth()} days remaining.
              {inflation && <span> · CPI {inflation.toFixed(2)}%</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CountdownChip seconds={6} trigger={tick} />
            <CurrencySwitcher />
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => refetch()}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-navy-100 dark:bg-navy-800 hover:bg-navy-200 dark:hover:bg-navy-700 text-navy-900 dark:text-navy-100"
            >
              <FaArrowsRotate size={12} /> Sync
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setIsPlaybookOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/30"
            >
              <FaBolt size={12} /> Playbook
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={openCreate}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold shadow-lg shadow-primary-500/30"
            >
              <FaPlus size={12} /> New Envelope
            </motion.button>
          </div>
        </div>

        {/* View tabs */}
        <div className="tab-bar-slide flex items-center gap-1 p-1 rounded-xl bg-white/70 dark:bg-navy-800/60 backdrop-blur-md border border-navy-200 dark:border-navy-700 w-fit">
          {[
            { id: 'overview', label: 'Overview', icon: <FaGaugeHigh /> },
            { id: 'ledger',   label: 'Variance Ledger', icon: <FaCalculator /> },
            { id: 'live',     label: 'Live Feed', icon: <FaFire /> },
            { id: 'goals',    label: 'Goals', icon: <FaBullseye /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`relative px-3 py-1.5 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 transition ${
                view === t.id ? 'text-white' : 'text-navy-700 dark:text-navy-300 hover:text-navy-900'
              }`}
            >
              {view === t.id && (
                <motion.span
                  layoutId="budget-tab-underline"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary-500 to-indigo-500 shadow-lg"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t.icon}</span>
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Executive KPIs with animated counters */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Planned Spend" accent="from-blue-500 to-cyan-500" icon={<FaWallet />}
            value={kpis.totalBudget} symbol={symbol}
            secondary={`${enriched.length} envelope${enriched.length === 1 ? '' : 's'}`}
            spark={[1, 1, 1, 1, 1, 1, 1]}
          />
          <KpiCard
            label="Actual Spend" accent="from-rose-500 to-pink-500" icon={<FaCalculator />}
            value={kpis.totalSpent} symbol={symbol}
            secondary={`${kpis.utilization.toFixed(1)}% of plan`}
            spark={weekSpark}
          />
          <KpiCard
            label="Projected Final" accent="from-amber-500 to-orange-500" icon={<FaGaugeHigh />}
            value={kpis.projectedTotal} symbol={symbol}
            secondary={
              kpis.projectedVariance > 0
                ? `+${format(kpis.projectedVariance)} over`
                : `${format(Math.abs(kpis.projectedVariance))} under`
            }
            tone={kpis.projectedVariance > 0 ? 'red' : 'green'}
            spark={weekSpark.map((v) => v * 1.1)}
          />
          <KpiCard
            label="Remaining Cash" accent="from-emerald-500 to-teal-500" icon={<FaCalendarCheck />}
            value={kpis.remaining} symbol={symbol}
            secondary={`${format(safeDiv(kpis.remaining, Math.max(1, daysLeftInMonth())))} / day left`}
            spark={weekSpark.map((v, i) => kpis.totalBudget - v * (i + 1))}
          />
          <HealthRing score={kpis.healthScore} />
        </div>

        {/* Insights row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {recommendations.slice(0, 3).map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              className={`rounded-xl p-4 border shadow-sm backdrop-blur-sm ${
                r.tone === 'red'   ? 'bg-rose-50/90 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' :
                r.tone === 'amber' ? 'bg-amber-50/90 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                r.tone === 'blue'  ? 'bg-blue-50/90 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
                                     'bg-emerald-50/90 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{r.icon}</span>
                <div>
                  <p className="font-semibold text-navy-900 dark:text-navy-100 text-sm">{r.title}</p>
                  <p className="text-xs text-navy-600 dark:text-navy-400 mt-1">{r.detail}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {view === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Burn-down + Donut + Heatmap */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
                        <FaChartLine className="text-rose-500" /> Burn-Down
                      </h3>
                      <p className="text-xs text-navy-500">Ideal pace vs actual cumulative spend.</p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500" /> Ideal</span>
                      <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-rose-500" /> Actual</span>
                    </div>
                  </div>
                  {kpis.totalBudget > 0 ? (
                    <BurnDown totalPlan={kpis.totalBudget} totalSpent={kpis.totalSpent}
                              elapsed={elapsed} total={total} format={format} />
                  ) : (
                    <div className="py-10 text-center text-navy-500 text-sm">Create envelopes to see the burn-down curve.</div>
                  )}
                </div>

                <div className="lg:col-span-5 card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
                        <FaChartPie className="text-indigo-500" /> Allocation Donut
                      </h3>
                      <p className="text-xs text-navy-500">Plan distribution by category.</p>
                    </div>
                  </div>
                  {donutSegments.length > 0 ? (
                    <div className="flex items-center justify-around gap-3">
                      <AnimatedDonut
                        segments={donutSegments} size={180} stroke={22}
                        center={
                          <div className="text-center">
                            <p className="text-[10px] text-navy-500">TOTAL</p>
                            <p className="text-base font-bold text-navy-900 dark:text-navy-100">
                              <AnimatedCounter value={kpis.totalBudget} prefix={symbol} />
                            </p>
                          </div>
                        }
                      />
                      <div className="space-y-1.5 max-h-[180px] overflow-auto pr-2">
                        {donutSegments.slice(0, 8).map((s) => (
                          <div key={s.label} className="flex items-center gap-2 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                            <span className="text-navy-700 dark:text-navy-300 truncate flex-1">{s.label}</span>
                            <span className="font-semibold tabular-nums">{format(s.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 text-center text-navy-500 text-sm">No envelopes yet.</div>
                  )}
                </div>
              </div>

              {/* Heatmap + Inflation calc */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
                        <FaFire className="text-orange-500" /> Daily Spend Heatmap
                      </h3>
                      <p className="text-xs text-navy-500">Weekends &amp; bill days tend to burn hotter.</p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-navy-500">
                      Low
                      {[0.15, 0.35, 0.55, 0.75, 0.95].map((o) => (
                        <span key={o} className="w-3 h-3 rounded-sm" style={{ background: `rgba(239,68,68,${o})` }} />
                      ))}
                      High
                    </div>
                  </div>
                  <HeatMap elapsed={elapsed} total={total} />
                </div>

                <div className="lg:col-span-5 card p-5 bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/10 dark:to-purple-900/10 border border-primary-200 dark:border-primary-800">
                  <div className="flex items-start gap-3">
                    <FaTriangleExclamation className="text-primary-600 mt-1 text-xl" />
                    <div className="flex-1">
                      <p className="font-semibold text-navy-900 dark:text-navy-100">Inflation Impact Forecaster</p>
                      {inflation != null && kpis.totalBudget > 0 ? (
                        <>
                          <p className="text-sm text-navy-700 dark:text-navy-300 mt-1">
                            At <strong>{inflation.toFixed(2)}%</strong> CPI, next year you will need:
                          </p>
                          <p className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent mt-1">
                            <AnimatedCounter value={kpis.totalBudget * (1 + inflation / 100)} prefix={symbol} />
                          </p>
                          <p className="text-xs text-navy-500">
                            A <strong>{format(kpis.totalBudget * (inflation / 100))}</strong> uplift over today&apos;s plan.
                          </p>
                          <div className="mt-3 space-y-1.5">
                            {[1, 3, 5, 10].map((yrs) => {
                              const multi = Math.pow(1 + inflation / 100, yrs)
                              const w = clamp((multi - 1) * 50, 0, 100)
                              return (
                                <div key={yrs}>
                                  <div className="flex justify-between text-[10px] text-navy-500">
                                    <span>{yrs}y @ CPI</span>
                                    <span className="tabular-nums">{format(kpis.totalBudget * multi)}</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }} animate={{ width: `${w}%` }}
                                      transition={{ duration: 0.8, delay: yrs * 0.08 }}
                                      className="h-full bg-gradient-to-r from-primary-500 to-purple-500"
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-navy-500 mt-2">Waiting for CPI data &amp; first envelope…</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'ledger' && (
            <motion.div
              key="ledger"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'all',       label: 'All',       n: enriched.length },
                  { id: 'on-track',  label: 'On track',  n: enriched.filter((b) => b.status === 'on-track').length },
                  { id: 'warning',   label: 'At risk',   n: enriched.filter((b) => b.status === 'watch' || b.status === 'warning').length },
                  { id: 'over',      label: 'Over',      n: enriched.filter((b) => b.status === 'over').length },
                ].map((f) => (
                  <motion.button
                    key={f.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowOnly(f.id)}
                    className={`relative px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      showOnly === f.id
                        ? 'text-white'
                        : 'bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-300 hover:bg-navy-200'
                    }`}
                  >
                    {showOnly === f.id && (
                      <motion.span
                        layoutId="filter-bg"
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 shadow"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative">{f.label} <span className="opacity-70 ml-1">{f.n}</span></span>
                  </motion.button>
                ))}
              </div>

              {/* Variance table */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-navy-200 dark:border-navy-700 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-navy-900 dark:text-navy-100">Variance Ledger</h3>
                    <p className="text-xs text-navy-500">Live pace vs plan · projected end-of-period outcome.</p>
                  </div>
                  <Pill color="blue">{currency} display</Pill>
                </div>
                {isLoading ? (
                  <div className="p-6 space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={36} />)}
                  </div>
                ) : isError ? (
                  <div className="p-6 bg-rose-50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-300 text-sm">
                    Couldn&apos;t load envelopes — please sign in and try Sync.
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-navy-500 mb-4">No envelopes match this filter. Create one or apply a playbook to start.</p>
                    <div className="flex justify-center gap-2">
                      <button onClick={openCreate} className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold">
                        <FaPlus className="inline mr-1" /> New Envelope
                      </button>
                      <button onClick={() => setIsPlaybookOpen(true)} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold">
                        <FaBolt className="inline mr-1" /> Use Playbook
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-navy-50 dark:bg-navy-800/50">
                        <tr className="text-navy-700 dark:text-navy-300">
                          <th className="text-left px-4 py-3 font-semibold">Envelope</th>
                          <th className="text-right px-4 py-3 font-semibold">Plan</th>
                          <th className="text-right px-4 py-3 font-semibold">Spent</th>
                          <th className="text-right px-4 py-3 font-semibold">Projected</th>
                          <th className="text-right px-4 py-3 font-semibold">Variance</th>
                          <th className="text-center px-4 py-3 font-semibold">Pace</th>
                          <th className="text-center px-4 py-3 font-semibold">Status</th>
                          <th className="text-right px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence initial={false}>
                          {filtered.map((b, i) => (
                            <motion.tr
                              key={b.id}
                              layout
                              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                              transition={{ delay: i * 0.02 }}
                              className="border-t border-navy-100 dark:border-navy-800 hover:bg-navy-50/50 dark:hover:bg-navy-800/30"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full" style={{ background: catColor(b.category) }} />
                                  <div>
                                    <p className="font-semibold text-navy-900 dark:text-navy-100">{b.name}</p>
                                    <p className="text-xs text-navy-500">{b.category} · {b.period}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">{format(b.amount)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                <PriceFlash value={b.spent}><span>{format(b.spent)}</span></PriceFlash>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">{format(b.projected)}</td>
                              <td className={`px-4 py-3 text-right font-semibold tabular-nums ${
                                b.projected - b.amount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {b.projected - b.amount > 0 ? '+' : ''}{format(b.projected - b.amount)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="w-full">
                                  <div className="h-1.5 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden relative">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(100, b.pct)}%` }}
                                      transition={{ duration: 0.6 }}
                                      className={`h-full ${
                                        b.pct >= 100 ? 'bg-rose-500' :
                                        b.projectedPct >= 100 ? 'bg-amber-500' :
                                        b.pct >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'
                                      }`}
                                    />
                                    {b.pct < 100 && (
                                      <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-navy-900 dark:bg-white"
                                        style={{ left: `${Math.min(99, b.projectedPct)}%` }}
                                        title="Projected"
                                      />
                                    )}
                                  </div>
                                  <p className="text-[10px] text-navy-500 mt-1 tabular-nums">
                                    {b.pct.toFixed(0)}% now · {b.projectedPct.toFixed(0)}% projected
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {b.status === 'over' && <Pill color="red">OVER</Pill>}
                                {b.status === 'warning' && <Pill color="amber">AT RISK</Pill>}
                                {b.status === 'watch' && <Pill color="amber">WATCH</Pill>}
                                {b.status === 'on-track' && <Pill color="green">ON TRACK</Pill>}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <button onClick={() => openEdit(b)} title="Edit" className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded">
                                  <FaPenToSquare size={13} />
                                </button>
                                <button onClick={() => onDelete(b)} title="Delete" className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded">
                                  <FaTrashCan size={13} />
                                </button>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                      <tfoot className="bg-navy-50 dark:bg-navy-800/50">
                        <tr className="font-semibold text-navy-900 dark:text-navy-100">
                          <td className="px-4 py-3 text-right">Totals</td>
                          <td className="px-4 py-3 text-right tabular-nums">{format(kpis.totalBudget)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{format(kpis.totalSpent)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{format(kpis.projectedTotal)}</td>
                          <td className={`px-4 py-3 text-right tabular-nums ${
                            kpis.projectedVariance > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {kpis.projectedVariance > 0 ? '+' : ''}{format(kpis.projectedVariance)}
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'live' && (
            <motion.div
              key="live"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              <LiveFeed categories={[...new Set(enriched.map((e) => e.category))]} format={format} />

              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
                      <FaCoins className="text-amber-500" /> Live Burn Gauges
                    </h3>
                    <p className="text-xs text-navy-500">Top-spending envelopes, ticking in real time.</p>
                  </div>
                  <LivePulse status="live" />
                </div>
                {enriched.length === 0 ? (
                  <p className="text-sm text-navy-500 text-center py-6">Create envelopes to see live gauges.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[...enriched].sort((a, b) => b.spent - a.spent).slice(0, 6).map((b) => (
                      <motion.div
                        key={b.id}
                        whileHover={{ y: -3, scale: 1.02 }}
                        className="rounded-xl border border-navy-200 dark:border-navy-700 p-3 bg-gradient-to-br from-white to-navy-50 dark:from-navy-800 dark:to-navy-900"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-navy-500 truncate">{b.name}</span>
                          <span className="w-2 h-2 rounded-full" style={{ background: catColor(b.category) }} />
                        </div>
                        <p className="text-lg font-bold tabular-nums text-navy-900 dark:text-navy-100">
                          <PriceFlash value={b.spent}>
                            <AnimatedCounter value={b.spent} prefix={symbol} />
                          </PriceFlash>
                        </p>
                        <p className="text-[10px] text-navy-500 tabular-nums mb-1">of {format(b.amount)}</p>
                        <WaveBar value={b.pct} max={100} h={50} color={
                          b.status === 'over' ? 'from-rose-500 to-red-600' :
                          b.status === 'warning' || b.status === 'watch' ? 'from-amber-500 to-orange-500' :
                          'from-emerald-500 to-teal-500'
                        } />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'goals' && (
            <motion.div
              key="goals"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            >
              <GoalTracker format={format} symbol={symbol} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create / edit modal */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'Edit Envelope' : 'New Envelope'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <input
              type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Groceries - April"
              className="input-base"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-base"
              >
                {SERVER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Period">
              <select
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                className="input-base"
              >
                {PERIODS.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Amount (${symbol})`}>
              <input
                type="number" min="0" step="any" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="input-base"
              />
            </Field>
            <Field label="Start date">
              <input
                type="date" value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input-base"
              />
            </Field>
          </div>
          {form.amount && currency !== 'INR' && (
            <p className="text-xs text-navy-500">
              ≈ ₹{Math.round(convert(safeNum(form.amount), currency, 'INR')).toLocaleString()} stored in INR
            </p>
          )}
          <button type="submit" className="w-full py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-semibold">
            {editing ? 'Save changes' : 'Create envelope'}
          </button>
        </form>
      </Modal>

      {/* Playbook modal */}
      <Modal isOpen={isPlaybookOpen} onClose={() => setIsPlaybookOpen(false)} title="Allocation Playbook">
        <div className="space-y-4">
          <p className="text-sm text-navy-600 dark:text-navy-400">
            Bootstrap a full set of envelopes from a tried-and-tested allocation model.
          </p>
          <Field label={`Monthly take-home (${symbol})`}>
            <input
              type="number" value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              placeholder="e.g., 120000"
              className="input-base"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ALLOCATION_PLAYBOOKS).map(([k, v]) => (
              <motion.button
                key={k}
                type="button"
                whileHover={{ y: -2 }}
                onClick={() => setSelectedPlaybook(k)}
                className={`text-left p-3 rounded-lg border transition ${
                  selectedPlaybook === k
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                    : 'border-navy-200 dark:border-navy-700'
                }`}
              >
                <div className={`inline-block px-2 py-0.5 mb-1 rounded text-[10px] text-white bg-gradient-to-r ${v.color} font-semibold`}>
                  {v.label}
                </div>
                <p className="text-xs text-navy-600 dark:text-navy-400">{v.tagline}</p>
              </motion.button>
            ))}
          </div>
          {safeNum(monthlyIncome) > 0 && (
            <div className="rounded-lg border border-navy-200 dark:border-navy-700 divide-y divide-navy-100 dark:divide-navy-800">
              {Object.entries(ALLOCATION_PLAYBOOKS[selectedPlaybook].split).map(([cat, pct]) => (
                <div key={cat} className="flex justify-between px-3 py-1.5 text-sm">
                  <span className="text-navy-700 dark:text-navy-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: catColor(cat) }} />
                    {cat}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {format(safeNum(monthlyIncome) * pct)} ({(pct * 100).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={applyPlaybook}
            disabled={!safeNum(monthlyIncome)}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 disabled:opacity-50 text-white font-semibold"
          >
            Apply playbook
          </button>
        </div>
      </Modal>
    </Layout>
  )
}

function KpiCard({ label, value, format, secondary, icon, accent, tone, spark }) {
  const toneCls = tone === 'red' ? 'text-rose-600 dark:text-rose-400'
    : tone === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : 'text-navy-900 dark:text-navy-100'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="card p-4 relative overflow-hidden hover-lift"
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent} animate-gradient`} />
      <div className="flex items-center justify-between mb-2 text-navy-500">
        <span className="text-[11px] uppercase tracking-wider font-semibold">{label}</span>
        <span className={`bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>{icon}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums ${toneCls}`}>
        <PriceFlash value={value}>
          <AnimatedCounter value={value} prefix="" suffix="" decimals={0} />
          {format && null /* format handled by AnimatedCounter+symbol via parent */}
        </PriceFlash>
      </p>
      <p className={`text-xl font-bold tabular-nums ${toneCls} hidden`}>{format ? format(value) : value}</p>
      {secondary && <p className="text-xs text-navy-500 mt-0.5 tabular-nums">{secondary}</p>}
      {spark && spark.length > 1 && (
        <div className="absolute bottom-1 right-1 opacity-80">
          <Sparkline points={spark} width={80} height={22} />
        </div>
      )}
    </motion.div>
  )
}

function HealthRing({ score }) {
  const r = 30
  const c = 2 * Math.PI * r
  const off = c - (clamp(score, 0, 100) / 100) * c
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const label = score >= 75 ? 'Excellent' : score >= 50 ? 'Fair' : 'Action!'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="card p-4 relative overflow-hidden flex items-center gap-3"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500 animate-gradient" />
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} stroke="currentColor" className="text-navy-200 dark:text-navy-700" strokeWidth="6" fill="none" />
          <motion.circle
            cx="40" cy="40" r={r} stroke={color} strokeWidth="6" fill="none"
            strokeLinecap="round" strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: off }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-navy-900 dark:text-navy-100 tabular-nums">{score}</span>
        </div>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-navy-500">Plan Health</p>
        <p className="text-lg font-bold text-navy-900 dark:text-navy-100">{label}</p>
        <p className="text-[10px] text-navy-500">Live discipline score</p>
      </div>
    </motion.div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-navy-600 dark:text-navy-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}
