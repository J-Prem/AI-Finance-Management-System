import { useEffect, useState, useMemo } from 'react'
import Layout from '../components/common/Layout'
import { analyzePersonality } from '../services/personalityService'
import toast from 'react-hot-toast'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

const OVERRIDES = ['Saver', 'Investor', 'Balanced', 'Spender', 'Impulsive', 'Strategic']
const RISK_APPETITES = [
  { id: 'conservative', label: 'Conservative' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'aggressive', label: 'Aggressive' },
]
const GOALS = [
  'Retirement', 'Home purchase', 'Education', 'Emergency fund',
  'Travel', 'Wealth growth', 'Debt payoff', 'Starting business',
]

const fmtPct = (v, digits = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : '—')
const fmtMoney = (v, cur = 'INR') => {
  if (!Number.isFinite(v)) return '—'
  const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : '₹'
  return `${sym}${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

const HEALTH_BUCKETS = [
  { min: 80, label: 'Excellent', color: 'bg-emerald-500' },
  { min: 60, label: 'Good', color: 'bg-blue-500' },
  { min: 40, label: 'Fair', color: 'bg-amber-500' },
  { min: 0, label: 'Needs work', color: 'bg-rose-500' },
]

export default function PersonalityPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [override, setOverride] = useState('')
  const [income, setIncome] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [dependents, setDependents] = useState('')
  const [savingsTarget, setSavingsTarget] = useState('20')
  const [riskAppetite, setRiskAppetite] = useState('moderate')
  const [emergencyFund, setEmergencyFund] = useState('')
  const [goals, setGoals] = useState([])
  const [debtAmount, setDebtAmount] = useState('')
  const [monthlyDebt, setMonthlyDebt] = useState('')

  const toggleGoal = (g) => {
    setGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])
  }

  const run = async (manualOverride = '') => {
    setLoading(true)
    try {
      const body = { manualOverride: manualOverride || undefined }
      if (income && Number(income) > 0) body.income = Number(income)
      if (dependents) body.dependents = Number(dependents)
      if (savingsTarget) body.targetSavingsRate = Number(savingsTarget) / 100
      if (riskAppetite) body.riskAppetite = riskAppetite
      if (emergencyFund) body.emergencyFund = Number(emergencyFund)
      if (debtAmount) body.debtAmount = Number(debtAmount)
      if (monthlyDebt) body.monthlyDebtPayment = Number(monthlyDebt)
      if (goals.length) body.goals = goals
      if (currency) body.currency = currency
      const res = await analyzePersonality(body)
      setData(res?.data)
    } catch (e) {
      toast.error('Could not analyze: ' + (e?.message || ''))
    } finally { setLoading(false) }
  }

  useEffect(() => { run() }, [])

  const radarData = data?.ranked?.map((r) => ({ label: r.label, score: Math.round(r.score * 100) })) || []
  const f = data?.features || {}
  const isImplied = f.incomeSource === 'implied'

  // Derived financial health metrics (pure client-side; server may also compute these)
  const derived = useMemo(() => {
    const inc = Number(income) || f.income || 0
    const avgSpend = f.avgMonthly || 0
    const savingsRate = inc > 0 ? Math.max(0, (inc - avgSpend) / inc) : 0
    const efMonths = avgSpend > 0 && emergencyFund ? Number(emergencyFund) / avgSpend : 0
    const dti = inc > 0 && monthlyDebt ? Number(monthlyDebt) / inc : 0
    // Health score: savings + investments + low dti + ef coverage + low impulse
    let score = 0
    score += Math.min(savingsRate / 0.3, 1) * 25   // 25 pts for 30% savings rate
    score += Math.min((f.investRatio || 0) / 0.2, 1) * 20  // 20 pts for 20% invest ratio
    score += Math.max(1 - dti / 0.4, 0) * 15  // 15 pts if dti < 40%
    score += Math.min(efMonths / 6, 1) * 20  // 20 pts for 6 months EF
    score += Math.max(1 - (f.impulseDensity || 0) / 0.25, 0) * 10  // 10 pts low impulse
    score += Math.max(1 - (f.subscriptionsShare || 0) / 0.15, 0) * 10  // 10 pts subs ≤15%
    return {
      savingsRate,
      efMonths,
      dti,
      score: Math.max(0, Math.min(100, Math.round(score))),
      netMonthly: inc - avgSpend,
    }
  }, [income, emergencyFund, monthlyDebt, f])

  const bucket = HEALTH_BUCKETS.find((b) => derived.score >= b.min) || HEALTH_BUCKETS[3]

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Spender DNA</h1>
            <p className="text-gray-500 mt-1">Your personalized financial fingerprint — blends behavioral signals with your income, risk appetite, and life stage.</p>
          </div>
          <button onClick={() => run(override)} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
            {loading ? 'Analyzing…' : 'Re-run analysis'}
          </button>
        </header>

        {/* Financial profile inputs */}
        <div className="bg-white dark:bg-navy-800 border rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Financial profile</h2>
            <span className="text-xs text-gray-500">Fill in to sharpen your DNA — all fields optional</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500">Monthly income</label>
              <div className="flex gap-1">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="px-2 py-1 text-sm border rounded bg-white dark:bg-navy-900">
                  <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option>
                </select>
                <input type="number" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="50000" className="flex-1 px-2 py-1 text-sm border rounded bg-white dark:bg-navy-900" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Dependents</label>
              <input type="number" value={dependents} onChange={(e) => setDependents(e.target.value)} placeholder="0" className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-navy-900" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Savings target %</label>
              <input type="number" value={savingsTarget} onChange={(e) => setSavingsTarget(e.target.value)} placeholder="20" className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-navy-900" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Risk appetite</label>
              <select value={riskAppetite} onChange={(e) => setRiskAppetite(e.target.value)} className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-navy-900">
                {RISK_APPETITES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Emergency fund</label>
              <input type="number" value={emergencyFund} onChange={(e) => setEmergencyFund(e.target.value)} placeholder="0" className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-navy-900" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Total debt</label>
              <input type="number" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} placeholder="0" className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-navy-900" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Monthly debt payment</label>
              <input type="number" value={monthlyDebt} onChange={(e) => setMonthlyDebt(e.target.value)} placeholder="0" className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-navy-900" />
            </div>
            <div className="flex items-end">
              <button onClick={() => run(override)} className="w-full px-3 py-1 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700">
                Apply & analyze
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-gray-500 mb-1 block">Life goals</label>
            <div className="flex flex-wrap gap-1">
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGoal(g)}
                  className={`px-3 py-1 text-xs rounded-full border ${goals.includes(g) ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 dark:bg-navy-900'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Financial health scorecard */}
        {Number(income) > 0 && (
          <div className="bg-white dark:bg-navy-800 border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Financial Health Score</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${bucket.color}`}>{bucket.label}</span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl font-bold">{derived.score}</div>
              <div className="text-gray-500 text-sm">/ 100</div>
              <div className="flex-1 h-3 bg-gray-200 dark:bg-navy-900 rounded-full overflow-hidden">
                <div className={`h-3 ${bucket.color} transition-all`} style={{ width: `${derived.score}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded border p-3 bg-gray-50 dark:bg-navy-900">
                <div className="text-xs text-gray-500">Savings rate</div>
                <div className="text-xl font-semibold">{fmtPct(derived.savingsRate, 1)}</div>
                <div className="text-xs text-gray-400">Target: {savingsTarget}%</div>
              </div>
              <div className="rounded border p-3 bg-gray-50 dark:bg-navy-900">
                <div className="text-xs text-gray-500">Net / month</div>
                <div className={`text-xl font-semibold ${derived.netMonthly >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {fmtMoney(derived.netMonthly, currency)}
                </div>
              </div>
              <div className="rounded border p-3 bg-gray-50 dark:bg-navy-900">
                <div className="text-xs text-gray-500">Emergency cover</div>
                <div className="text-xl font-semibold">{derived.efMonths.toFixed(1)}mo</div>
                <div className="text-xs text-gray-400">Target: 6 mo</div>
              </div>
              <div className="rounded border p-3 bg-gray-50 dark:bg-navy-900">
                <div className="text-xs text-gray-500">Debt-to-income</div>
                <div className={`text-xl font-semibold ${derived.dti > 0.4 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {fmtPct(derived.dti, 1)}
                </div>
                <div className="text-xs text-gray-400">Healthy: &lt;40%</div>
              </div>
            </div>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white dark:bg-navy-800 border rounded-xl p-6">
              <div className="text-sm text-gray-500">Primary profile</div>
              <div className="text-4xl font-bold mt-2">{data.label}</div>
              <div className="text-xs text-gray-400 mt-1">{data.manualOverride ? 'Manual override active' : 'Auto classified'}</div>

              {isImplied && (
                <div className="mt-3 text-xs rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 p-2">
                  Income isn't logged yet — we've implied it from your spend. Enter monthly income above for accuracy.
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Spend ratio</div>
                  <div className="text-lg font-semibold">{fmtPct(f.spendRatio, 1)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Impulse density</div>
                  <div className="text-lg font-semibold">{fmtPct(f.impulseDensity, 1)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Invest ratio</div>
                  <div className="text-lg font-semibold">{fmtPct(f.investRatio, 2)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Avg monthly spend</div>
                  <div className="text-lg font-semibold">{fmtMoney(f.avgMonthly, currency)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Income ({f.incomeSource || 'n/a'})</div>
                  <div className="text-lg font-semibold">{fmtMoney(f.income, currency)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Portfolio value</div>
                  <div className="text-lg font-semibold">{fmtMoney(f.investValue, currency)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Category variance</div>
                  <div className="text-lg font-semibold">{fmtPct(f.categoryVariance, 1)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Subs share</div>
                  <div className="text-lg font-semibold">{fmtPct(f.subscriptionsShare, 1)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Cashless ratio</div>
                  <div className="text-lg font-semibold">{fmtPct(f.cashlessRatio, 1)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Premium share</div>
                  <div className="text-lg font-semibold">{fmtPct(f.premiumShare, 1)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Late-night spend</div>
                  <div className="text-lg font-semibold">{fmtPct(f.lateNightShare, 1)}</div>
                </div>
                <div className="rounded border p-2 bg-gray-50 dark:bg-navy-900">
                  <div className="text-gray-500">Weekend ratio</div>
                  <div className="text-lg font-semibold">{fmtPct(f.weekendRatio, 1)}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-1">Manual override</div>
                <div className="flex flex-wrap gap-1">
                  {OVERRIDES.map((o) => (
                    <button key={o} onClick={() => { setOverride(o); run(o) }} className={`px-2 py-1 text-xs rounded border ${override === o ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50'}`}>{o}</button>
                  ))}
                  <button onClick={() => { setOverride(''); run('') }} className="px-2 py-1 text-xs rounded border bg-white">Clear</button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-navy-800 border rounded-xl p-6">
              <div className="text-sm text-gray-500 mb-3">Personality radar</div>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="label" />
                  <PolarRadiusAxis domain={[0, 100]} />
                  <Radar dataKey="score" stroke="#2563eb" fill="#2563eb" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>

              <div className="mt-4 text-sm whitespace-pre-wrap bg-gray-50 dark:bg-navy-900 rounded p-4">
                {data.narrative}
              </div>

              {data.features?.topCategories?.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-semibold mb-2">Top spending categories</div>
                  <div className="space-y-1">
                    {data.features.topCategories.map((c) => (
                      <div key={c.category} className="flex items-center justify-between text-sm">
                        <div className="w-40 truncate">{c.category}</div>
                        <div className="flex-1 mx-3 h-2 bg-gray-100 rounded overflow-hidden">
                          <div className="h-2 bg-blue-500" style={{ width: `${Math.round(c.share * 100)}%` }} />
                        </div>
                        <div className="w-12 text-right">{Math.round(c.share * 100)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {goals.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-semibold mb-2">Your goals</div>
                  <div className="flex flex-wrap gap-1">
                    {goals.map((g) => (
                      <span key={g} className="px-2 py-1 text-xs rounded-full bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300">{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
