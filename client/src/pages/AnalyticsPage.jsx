import { useMemo, useEffect, useState } from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import {
  FaChartPie, FaArrowTrendUp, FaArrowTrendDown, FaTriangleExclamation,
  FaBullseye, FaGaugeHigh, FaMagnifyingGlassChart, FaCircleNodes,
} from 'react-icons/fa6'
import Layout from '../components/common/Layout'
import CurrencySwitcher from '../components/common/CurrencySwitcher'
import { useCurrency } from '../contexts/CurrencyContext'
import { safeNum, safeDiv, clamp, mean, stddev, fmtSigned } from '../utils/safe'
import {
  useSpendingTrend, useCategoryBreakdown, useIncomeExpense, useFinancialHealth,
} from '../hooks/useAnalytics'
import {
  getAIInsights, getMonthlyComparison, getAnomalies,
} from '../services/analyticsService'
import api from '../services/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, BarChart, Bar, ComposedChart,
} from 'recharts'

const TABS = [
  { id: 'command',     label: 'Command',        icon: <FaGaugeHigh /> },
  { id: 'cohorts',     label: 'Cohort Trends',  icon: <FaArrowTrendUp /> },
  { id: 'anomalies',   label: 'Anomalies',      icon: <FaTriangleExclamation /> },
  { id: 'benchmark',   label: 'Benchmarks',     icon: <FaBullseye /> },
  { id: 'decomposition', label: 'Decomposition', icon: <FaCircleNodes /> },
]

export default function AnalyticsPage() {
  const { format, convert, currency, symbol } = useCurrency()
  const [tab, setTab] = useState('command')
  const [periodDays, setPeriodDays] = useState(180)

  const { data: trendRes, isLoading: trendLoading } = useSpendingTrend(periodDays)
  const { data: catRes, isLoading: catLoading } = useCategoryBreakdown(30)
  const { data: ieRes } = useIncomeExpense(periodDays)
  const { data: healthRes } = useFinancialHealth()
  const { data: monthlyRes } = useQuery(['monthly-comp'], getMonthlyComparison, { staleTime: 60_000 })
  const { data: insightsRes } = useQuery(['ai-insights'], getAIInsights, { staleTime: 120_000, retry: 1 })
  const { data: anomaliesRes } = useQuery(['anomalies'], getAnomalies, { staleTime: 60_000 })

  // Normalize trend series
  const trend = useMemo(() => {
    const src = trendRes?.data?.trends || trendRes?.trends || {}
    return Object.entries(src)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, amount]) => ({ period, amount: safeNum(amount) }))
  }, [trendRes])

  const category = useMemo(() => {
    const list = catRes?.data?.breakdown || catRes?.breakdown || []
    return list.map((c) => ({
      name: c.category || 'Uncategorized',
      amount: safeNum(c.amount),
      count: safeNum(c.count),
    })).sort((a, b) => b.amount - a.amount)
  }, [catRes])

  const ie = useMemo(() => {
    const d = ieRes?.data?.incomeVsExpense || ieRes?.incomeVsExpense || {}
    return {
      income: safeNum(d.income),
      expense: safeNum(d.expense),
      savings: Math.max(0, safeNum(d.savings)),
    }
  }, [ieRes])

  const monthly = monthlyRes?.data?.comparison || monthlyRes?.comparison
  const health  = healthRes?.data || healthRes || {}
  const insights = insightsRes?.data?.insights || insightsRes?.insights || {}
  const anomalies = anomaliesRes?.data?.anomalies || anomaliesRes?.anomalies || []

  // ---- Computed analytics (all NaN-safe) ----
  const trendStats = useMemo(() => {
    const amounts = trend.map((t) => t.amount)
    const avg = mean(amounts)
    const sd = stddev(amounts)
    const n = amounts.length
    // Simple linear regression slope (amount vs index)
    const xs = amounts.map((_, i) => i)
    const xMean = mean(xs), yMean = avg
    const num = amounts.reduce((s, y, i) => s + (xs[i] - xMean) * (y - yMean), 0)
    const den = xs.reduce((s, x) => s + Math.pow(x - xMean, 2), 0)
    const slope = den > 0 ? num / den : 0
    const momentum = avg > 0 ? (slope / avg) * 100 : 0
    const last30 = amounts.slice(-30)
    const prev30 = amounts.slice(-60, -30)
    const pace30 = mean(last30)
    const pacePrev = mean(prev30)
    const paceDelta = pacePrev > 0 ? ((pace30 - pacePrev) / pacePrev) * 100 : 0
    return { avg, sd, n, slope, momentum, pace30, pacePrev, paceDelta }
  }, [trend])

  const topCats = category.slice(0, 6)
  const healthScore = Number.isFinite(safeNum(health?.score)) ? Math.round(safeNum(health.score)) : 0
  const components = health?.components || {}
  const savingsRate = safeDiv(ie.savings, ie.income) * 100

  // Cohort grid: by day-of-week + by week-of-month → heat intensity by spend
  const cohort = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => [0, 0, 0, 0, 0, 0])
    let maxVal = 0
    trend.forEach((t, i) => {
      const d = parseDay(t.period)
      if (!d) return
      const dow = d.getDay()
      const wom = Math.min(5, Math.floor((d.getDate() - 1) / 7))
      grid[dow][wom] += t.amount
      if (grid[dow][wom] > maxVal) maxVal = grid[dow][wom]
    })
    return { grid, maxVal }
  }, [trend])

  // Benchmark: live indices for inflation / market comparison
  const [indices, setIndices] = useState({ IN: [], US: [] })
  useEffect(() => {
    let ok = true
    async function load() {
      try {
        const [inR, usR] = await Promise.all([
          api.get('/external/stocks/indices?region=IN').catch(() => null),
          api.get('/external/stocks/indices?region=US').catch(() => null),
        ])
        if (!ok) return
        setIndices({
          IN: inR?.data?.indices || inR?.data?.data?.indices || [],
          US: usR?.data?.indices || usR?.data?.data?.indices || [],
        })
      } catch {}
    }
    load()
    const t = setInterval(load, 60_000)
    return () => { ok = false; clearInterval(t) }
  }, [])

  // Benchmark series: your cumulative spend growth vs synthetic inflation /
  // market tracks. Rates are anchored to fractional progress (i / N-1) so the
  // chart stays readable regardless of granularity (daily vs monthly).
  const benchmark = useMemo(() => {
    if (!trend.length) return []
    const base = trend[0].amount || 1
    const N = Math.max(1, trend.length - 1)
    const periodFrac = (periodDays || 180) / 365
    const targetInflation = 6 * periodFrac     // ~6% annualised
    const targetMarket = 9 * periodFrac        // ~9% annualised
    return trend.map((t, i) => {
      const f = i / N
      return {
        period: t.period,
        mySpend: Number((((t.amount - base) / base) * 100).toFixed(2)),
        inflation: Number((f * targetInflation).toFixed(2)),
        market: Number((f * targetMarket + Math.sin(i / 4) * 0.6).toFixed(2)),
      }
    })
  }, [trend, periodDays])

  // Anomaly intensity: 0-100 based on stddev distance
  const anomalyRows = useMemo(() => {
    if (!Array.isArray(anomalies)) return []
    return anomalies.slice(0, 12).map((a) => {
      const amt = safeNum(a.amount || a.value)
      const z = trendStats.sd > 0 ? Math.abs((amt - trendStats.avg) / trendStats.sd) : 0
      const severity = clamp(z * 15, 0, 100)
      return {
        id: a._id || a.id || a.description,
        description: a.description || a.category || 'Unusual transaction',
        amount: amt,
        date: a.date || a.createdAt,
        category: a.category || 'Other',
        severity,
        zScore: z,
      }
    })
  }, [anomalies, trendStats])

  // Decomposition: trend vs seasonality vs noise (very simple STL-like breakdown)
  const decomposition = useMemo(() => {
    if (trend.length < 14) return []
    const window = 7
    const rolling = trend.map((_, i, arr) => {
      const slice = arr.slice(Math.max(0, i - window), i + 1)
      return mean(slice.map((x) => x.amount))
    })
    return trend.map((t, i) => {
      const trendVal = rolling[i]
      const seasonal = t.amount - trendVal
      return {
        period: t.period,
        actual: t.amount,
        trend: Number(trendVal.toFixed(0)),
        seasonal: Number(seasonal.toFixed(0)),
      }
    })
  }, [trend])

  // ---- Render ----
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 text-xs font-semibold text-teal-700 dark:text-teal-300 mb-2">
              <FaMagnifyingGlassChart size={11} /> INSIGHTS LAB
            </div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-navy-100">Analytics &amp; Insights</h1>
            <p className="text-navy-600 dark:text-navy-400 mt-1">
              Executive view · cohort breakdown, anomaly detection, benchmark overlay.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CurrencySwitcher />
            <div className="inline-flex rounded-lg bg-navy-100 dark:bg-navy-800 p-1">
              {[30, 90, 180, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => setPeriodDays(d)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                    periodDays === d
                      ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-navy-100 shadow'
                      : 'text-navy-600 dark:text-navy-400'
                  }`}
                >
                  {d === 365 ? '1Y' : `${d}d`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi
            icon={<FaGaugeHigh />} accent="from-emerald-500 to-teal-500"
            label="Health score" value={`${healthScore}/100`}
            sub={
              healthScore >= 80 ? 'Excellent' :
              healthScore >= 60 ? 'Good' :
              healthScore >= 40 ? 'Fair' : 'Needs attention'
            }
            tone={healthScore >= 60 ? 'green' : healthScore >= 40 ? 'amber' : 'red'}
          />
          <Kpi
            icon={<FaChartPie />} accent="from-blue-500 to-cyan-500"
            label="Savings rate" value={`${savingsRate.toFixed(1)}%`}
            sub={`Income ${format(ie.income)}`}
            tone={savingsRate >= 20 ? 'green' : savingsRate >= 10 ? 'amber' : 'red'}
          />
          <Kpi
            icon={<FaArrowTrendUp />} accent="from-violet-500 to-purple-500"
            label="30d momentum" value={`${fmtSigned(trendStats.paceDelta, 1)}%`}
            sub={`vs prior 30d (avg ${format(trendStats.pace30)}/d)`}
            tone={trendStats.paceDelta <= 0 ? 'green' : trendStats.paceDelta <= 5 ? 'amber' : 'red'}
          />
          <Kpi
            icon={<FaArrowTrendDown />} accent="from-rose-500 to-pink-500"
            label="Month-over-month"
            value={monthly?.changePercent != null ? `${fmtSigned(safeNum(monthly.changePercent), 1)}%` : '—'}
            sub={monthly ? `${format(safeNum(monthly.currentMonth?.total))} this month` : 'No data'}
          />
          <Kpi
            icon={<FaTriangleExclamation />} accent="from-amber-500 to-orange-500"
            label="Anomalies (30d)" value={anomalyRows.length}
            sub={anomalyRows.length ? `Top severity ${Math.round(Math.max(...anomalyRows.map((a) => a.severity)))}` : 'All clear'}
            tone={anomalyRows.length > 5 ? 'red' : anomalyRows.length > 0 ? 'amber' : 'green'}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-navy-200 dark:border-navy-700 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                tab === t.id
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-navy-600 dark:text-navy-400 hover:text-navy-900'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* COMMAND */}
        {tab === 'command' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-navy-900 dark:text-navy-100">Cashflow momentum</h3>
                  <span className="text-xs text-navy-500">Daily spend · last {periodDays} days</span>
                </div>
                {trendLoading ? <EmptyState text="Loading trend…" /> : trend.length === 0 ? <EmptyState text="No trend data yet." /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"  stopColor="#14b8a6" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => format(v, 'INR', { compact: true, maximumFractionDigits: 1 })} />
                      <Tooltip formatter={(v) => format(v)} />
                      <Area type="monotone" dataKey="amount" stroke="#14b8a6" strokeWidth={2} fill="url(#tg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-3">
                <div className="card p-5">
                  <h4 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Income vs Expense</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={[
                      { name: 'Income',  value: ie.income,  fill: '#10b981' },
                      { name: 'Expense', value: ie.expense, fill: '#ef4444' },
                      { name: 'Savings', value: ie.savings, fill: '#3b82f6' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => format(v, 'INR', { compact: true, maximumFractionDigits: 0 })} />
                      <Tooltip formatter={(v) => format(v)} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card p-5">
                  <h4 className="font-semibold text-navy-900 dark:text-navy-100 mb-2">Score breakdown</h4>
                  <BreakdownBar label="Savings rate" v={safeNum(components.savingsRate)} />
                  <BreakdownBar label="Budget compliance" v={safeNum(components.budgetScore)} />
                  <BreakdownBar label="Spending stability" v={safeNum(components.volatilityScore)} />
                  <BreakdownBar label="Anomaly health" v={safeNum(components.anomalyScore)} />
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Top categories · last 30 days</h3>
              {catLoading ? <EmptyState text="Loading…" /> : topCats.length === 0 ? <EmptyState text="No spend yet." /> : (
                <div className="space-y-2">
                  {(() => {
                    const catMax = Math.max(1, ...topCats.map((c) => c.amount))
                    return topCats.map((c) => (
                      <div key={c.name} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3 text-sm text-navy-700 dark:text-navy-300 truncate">{c.name}</div>
                        <div className="col-span-7">
                          <div className="h-2 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500" style={{ width: `${safeDiv(c.amount, catMax) * 100}%` }} />
                          </div>
                        </div>
                        <div className="col-span-2 text-right text-sm font-semibold tabular-nums">{format(c.amount)}</div>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* COHORTS */}
        {tab === 'cohorts' && (
          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Cohort heatmap — spend by day-of-week × week-of-month</h3>
              <p className="text-xs text-navy-500 mb-4">Darker cells = heavier spend. Weekend splurge? Month-end bills? The grid tells you.</p>
              <CohortHeatmap grid={cohort.grid} maxVal={cohort.maxVal} format={format} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-5">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Spend velocity (30d avg)</h3>
                <Stat label="Current pace" value={`${format(trendStats.pace30)} / day`} />
                <Stat label="Prior 30d pace" value={`${format(trendStats.pacePrev)} / day`} />
                <Stat label="Change" value={`${fmtSigned(trendStats.paceDelta)}%`} tone={trendStats.paceDelta <= 0 ? 'green' : 'red'} />
                <Stat label="Trend slope (linear)" value={`${fmtSigned(trendStats.slope, 1)} / period`} />
                <Stat label="Volatility (σ)" value={format(trendStats.sd)} />
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Predictive forecast (next 30d)</h3>
                <PredictionPanel insights={insights} format={format} fallbackPace={trendStats.pace30} />
              </div>
            </div>
          </div>
        )}

        {/* ANOMALIES */}
        {tab === 'anomalies' && (
          <div className="card p-5">
            <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Anomaly ledger</h3>
            <p className="text-xs text-navy-500 mb-4">Statistical outliers flagged by Z-score against your 180-day baseline.</p>
            {anomalyRows.length === 0 ? (
              <EmptyState text="All clear — no anomalies in the last 30 days." />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-navy-600 dark:text-navy-400">
                  <tr className="border-b border-navy-200 dark:border-navy-700">
                    <th className="text-left py-2 px-2">Description</th>
                    <th className="text-left py-2 px-2">Category</th>
                    <th className="text-right py-2 px-2">Amount</th>
                    <th className="text-right py-2 px-2">Z-score</th>
                    <th className="text-left py-2 px-2">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalyRows.map((a) => (
                    <tr key={a.id} className="border-b border-navy-100 dark:border-navy-800">
                      <td className="py-2 px-2">
                        <p className="text-navy-900 dark:text-navy-100 truncate max-w-[260px]">{a.description}</p>
                        {a.date && <p className="text-[11px] text-navy-500">{new Date(a.date).toLocaleDateString()}</p>}
                      </td>
                      <td className="py-2 px-2 text-xs text-navy-600 dark:text-navy-400">{a.category}</td>
                      <td className="py-2 px-2 text-right font-semibold tabular-nums">{format(a.amount)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{a.zScore.toFixed(2)}</td>
                      <td className="py-2 px-2 w-40">
                        <div className="h-1.5 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
                          <div className={`h-full ${a.severity > 66 ? 'bg-rose-500' : a.severity > 33 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${a.severity}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* BENCHMARK */}
        {tab === 'benchmark' && (
          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-1">Your spend growth vs benchmarks</h3>
              <p className="text-xs text-navy-500 mb-4">Everything indexed to 0% at start of period. If your line outpaces the market / inflation, your real purchasing power is shrinking.</p>
              {benchmark.length === 0 ? <EmptyState text="Need more data." /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={benchmark}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="mySpend"   name="Your spend" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="inflation" name="Inflation"  stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="market"    name="Market"     stroke="#10b981" strokeWidth={2} strokeDasharray="6 2" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <BenchGrid title="🇮🇳 India" rows={indices.IN} />
              <BenchGrid title="🌎 United States" rows={indices.US} />
            </div>
          </div>
        )}

        {/* DECOMPOSITION */}
        {tab === 'decomposition' && (
          <div className="card p-5">
            <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-1">Spend decomposition — trend vs seasonal</h3>
            <p className="text-xs text-navy-500 mb-4">The underlying trend strips out weekly seasonality so you can see the real direction.</p>
            {decomposition.length === 0 ? <EmptyState text="Need at least 14 data points." /> : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={decomposition}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => format(v, 'INR', { compact: true, maximumFractionDigits: 1 })} />
                  <Tooltip formatter={(v) => format(v)} />
                  <Legend />
                  <Bar dataKey="seasonal" name="Seasonal Δ" fill="#93c5fd" />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#0f172a" dot={false} />
                  <Line type="monotone" dataKey="trend"  name="Trend"  stroke="#ef4444" strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

function Kpi({ icon, label, value, sub, tone, accent }) {
  const toneCls = tone === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'red' ? 'text-rose-600 dark:text-rose-400'
    : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : 'text-navy-900 dark:text-navy-100'
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex items-center justify-between text-navy-500">
        <span className="text-[11px] uppercase tracking-wider font-semibold">{label}</span>
        <span className={`bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>{icon}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums mt-1 ${toneCls}`}>{value}</p>
      {sub && <p className="text-xs text-navy-500 mt-0.5">{sub}</p>}
    </motion.div>
  )
}

function BreakdownBar({ label, v }) {
  const pct = clamp(v, 0, 100)
  return (
    <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
      <span className="text-navy-500 w-36">{label}</span>
      <div className="flex-1 h-1.5 bg-navy-200 dark:bg-navy-700 rounded overflow-hidden">
        <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-semibold tabular-nums">{Math.round(pct)}</span>
    </div>
  )
}

function EmptyState({ text }) {
  return <div className="py-10 text-center text-navy-500 text-sm">{text}</div>
}

function Stat({ label, value, tone }) {
  const toneCls = tone === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'red' ? 'text-rose-600 dark:text-rose-400'
    : 'text-navy-900 dark:text-navy-100'
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-b-0 border-navy-100 dark:border-navy-800 text-sm">
      <span className="text-navy-600 dark:text-navy-400">{label}</span>
      <span className={`font-semibold tabular-nums ${toneCls}`}>{value}</span>
    </div>
  )
}

function CohortHeatmap({ grid, maxVal, format }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="p-1.5"></th>
            {['W1', 'W2', 'W3', 'W4', 'W5', 'W6'].map((w) => (
              <th key={w} className="p-1.5 text-navy-500 font-semibold">{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, dow) => (
            <tr key={dow}>
              <td className="p-1.5 text-navy-500 font-semibold">{days[dow]}</td>
              {row.map((val, i) => {
                const alpha = maxVal ? Math.max(0.05, val / maxVal) : 0.05
                return (
                  <td key={i} className="p-1">
                    <div
                      className="w-12 h-10 rounded flex items-center justify-center text-[10px] tabular-nums text-navy-900 dark:text-white"
                      style={{ background: `rgba(20, 184, 166, ${alpha})` }}
                      title={format(val)}
                    >
                      {val > 0 ? format(val, 'INR', { compact: true, maximumFractionDigits: 0 }) : '·'}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BenchGrid({ title, rows }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-navy-500">Loading live indices…</p> : (
        <div className="space-y-2">
          {rows.map((r) => {
            const chg = safeNum(r.changePercent)
            const up = chg >= 0
            return (
              <div key={r.symbol || r.name} className="flex items-center justify-between py-1 border-b last:border-b-0 border-navy-100 dark:border-navy-800">
                <div>
                  <p className="font-medium text-navy-900 dark:text-navy-100 text-sm">{r.name}</p>
                  <p className="text-[11px] text-navy-500">{r.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{safeNum(r.value).toLocaleString()}</p>
                  <p className={`text-xs ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {up ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PredictionPanel({ insights, format, fallbackPace }) {
  const p = insights?.predictions || {}
  const total = safeNum(p.total)
  const show = total > 0 ? total : safeNum(fallbackPace) * 30
  return (
    <div>
      <p className="text-3xl font-bold text-teal-600 dark:text-teal-400 tabular-nums">{format(show)}</p>
      <p className="text-xs text-navy-500 mt-1">
        {p.description || p.explanation ||
          `Projected spend over the next 30 days based on your current ${format(safeNum(fallbackPace))}/day pace.`}
      </p>
      {Array.isArray(p.breakdown) && p.breakdown.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {p.breakdown.slice(0, 5).map((b, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-navy-600 dark:text-navy-400">{b.category || b.label}</span>
              <span className="font-semibold tabular-nums">{format(safeNum(b.amount || b.value))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Defensive date parser: trend periods come back as YYYY-MM, YYYY-MM-DD, or
// sometimes just a bucket label. Non-parseable returns null.
function parseDay(s) {
  if (!s) return null
  try {
    const full = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : /^\d{4}-\d{2}$/.test(s) ? `${s}-15` : null
    if (!full) return null
    const d = new Date(full)
    return isNaN(d) ? null : d
  } catch { return null }
}
