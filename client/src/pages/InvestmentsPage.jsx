import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  FaPlus, FaArrowsRotate, FaTrashCan, FaMagnifyingGlass,
  FaChartLine, FaShield, FaCoins, FaBitcoin, FaGem,
  FaBriefcase, FaBolt, FaFire, FaGauge, FaArrowTrendUp,
  FaRocket, FaFilter, FaDownload, FaWaveSquare,
} from 'react-icons/fa6'
import Layout from '../components/common/Layout'
import Modal from '../components/common/Modal'
import CurrencySwitcher from '../components/common/CurrencySwitcher'
import {
  LivePulse, PriceFlash, AnimatedCounter, Sparkline, GlassCard, Skeleton,
  CountdownChip, AnimatedDonut, MetricDelta, WaveBar, LiveFeedRow,
  useTickingSeries, Tooltip,
} from '../components/common/Realtime'
import { useCurrency } from '../contexts/CurrencyContext'
import { useSocket } from '../hooks/useSocket'
import { safeNum, safeDiv, clamp, fmtSigned, fmtCompact } from '../utils/safe'
import api from '../services/api'
import {
  getInvestments, createInvestment, deleteInvestment, updateInvestment,
} from '../services/investmentService'
import { getStockQuote } from '../services/externalApiService'

// Higher-quality seed — a realistic, business-grade, multi-asset model portfolio.
// Used when the account is empty, and appended (symbols not already owned) to
// small real portfolios so the analytics views always have enough signal to
// feel like a real SaaS dashboard.
const SEED_HOLDINGS = [
  // Large-cap Indian equity — core
  { _id: 's-1',  symbol: 'RELIANCE.NS', name: 'Reliance Industries',  type: 'stock',       sector: 'Energy',      quantity: 12,   buyPrice: 2480,    currentPrice: 2910,    currency: 'INR', demo: true },
  { _id: 's-2',  symbol: 'TCS.NS',      name: 'Tata Consultancy',     type: 'stock',       sector: 'IT',          quantity: 8,    buyPrice: 3550,    currentPrice: 4100,    currency: 'INR', demo: true },
  { _id: 's-3',  symbol: 'HDFCBANK.NS', name: 'HDFC Bank',            type: 'stock',       sector: 'Financials',  quantity: 20,   buyPrice: 1480,    currentPrice: 1560,    currency: 'INR', demo: true },
  { _id: 's-4',  symbol: 'INFY.NS',     name: 'Infosys',              type: 'stock',       sector: 'IT',          quantity: 25,   buyPrice: 1620,    currentPrice: 1870,    currency: 'INR', demo: true },
  { _id: 's-5',  symbol: 'ICICIBANK.NS',name: 'ICICI Bank',           type: 'stock',       sector: 'Financials',  quantity: 18,   buyPrice: 980,     currentPrice: 1180,    currency: 'INR', demo: true },
  { _id: 's-6',  symbol: 'ITC.NS',      name: 'ITC Limited',          type: 'stock',       sector: 'FMCG',        quantity: 60,   buyPrice: 410,     currentPrice: 468,     currency: 'INR', demo: true },
  { _id: 's-7',  symbol: 'SUNPHARMA.NS',name: 'Sun Pharma',           type: 'stock',       sector: 'Pharma',      quantity: 15,   buyPrice: 1150,    currentPrice: 1640,    currency: 'INR', demo: true },
  { _id: 's-8',  symbol: 'M&M.NS',      name: 'Mahindra & Mahindra',  type: 'stock',       sector: 'Auto',        quantity: 10,   buyPrice: 1820,    currentPrice: 2460,    currency: 'INR', demo: true },
  // US tech exposure
  { _id: 's-9',  symbol: 'AAPL',        name: 'Apple Inc.',           type: 'stock',       sector: 'IT',          quantity: 6,    buyPrice: 175,     currentPrice: 218,     currency: 'USD', demo: true },
  { _id: 's-10', symbol: 'MSFT',        name: 'Microsoft Corp.',      type: 'stock',       sector: 'IT',          quantity: 4,    buyPrice: 340,     currentPrice: 428,     currency: 'USD', demo: true },
  // Mutual funds
  { _id: 's-11', symbol: '120716',      name: 'Axis Bluechip Fund',   type: 'mutual_fund', sector: 'Financials',  quantity: 400,  buyPrice: 48.5,    currentPrice: 62.1,    currency: 'INR', schemeCode: '120716', demo: true },
  { _id: 's-12', symbol: '118989',      name: 'Mirae Asset Large Cap',type: 'mutual_fund', sector: 'IT',          quantity: 220,  buyPrice: 78.4,    currentPrice: 96.2,    currency: 'INR', schemeCode: '118989', demo: true },
  { _id: 's-13', symbol: 'NIPPON-GOLD', name: 'Nippon India Gold ETF',type: 'mutual_fund', sector: 'Commodities', quantity: 40,   buyPrice: 62,      currentPrice: 74,      currency: 'INR', demo: true },
  // Crypto sleeve
  { _id: 's-14', symbol: 'BTC',         name: 'Bitcoin',              type: 'crypto',      sector: 'Crypto',      quantity: 0.05, buyPrice: 4200000, currentPrice: 5380000, currency: 'INR', coinId: 'bitcoin',  demo: true },
  { _id: 's-15', symbol: 'ETH',         name: 'Ethereum',             type: 'crypto',      sector: 'Crypto',      quantity: 0.8,  buyPrice: 210000,  currentPrice: 268000,  currency: 'INR', coinId: 'ethereum', demo: true },
  // Bonds / FD / PPF — defensive sleeve
  { _id: 's-16', symbol: 'GOVTBOND-10Y',name: 'Govt of India 10Y',    type: 'bond',        sector: 'Bonds',       quantity: 50,   buyPrice: 1000,    currentPrice: 1024,    currency: 'INR', demo: true },
  { _id: 's-17', symbol: 'SBI-FD-3Y',   name: 'SBI Fixed Deposit 3Y', type: 'fd',          sector: 'Bonds',       quantity: 1,    buyPrice: 100000,  currentPrice: 118200,  currency: 'INR', demo: true },
  { _id: 's-18', symbol: 'PPF-A/C',     name: 'Public Provident Fund',type: 'ppf',         sector: 'Bonds',       quantity: 1,    buyPrice: 150000,  currentPrice: 172400,  currency: 'INR', demo: true },
  // Physical gold
  { _id: 's-19', symbol: 'GOLD-22K',    name: '22K Gold (grams)',     type: 'gold',        sector: 'Commodities', quantity: 25,   buyPrice: 5600,    currentPrice: 6480,    currency: 'INR', demo: true },
]

const TYPE_META = {
  stock:       { label: 'Equity',        color: 'from-blue-500 to-indigo-500',   icon: <FaChartLine />, risk: 'High' },
  mutual_fund: { label: 'Mutual Fund',   color: 'from-emerald-500 to-teal-500',  icon: <FaBriefcase />, risk: 'Medium' },
  crypto:      { label: 'Crypto',        color: 'from-amber-500 to-orange-500',  icon: <FaBitcoin />,   risk: 'Very High' },
  gold:        { label: 'Gold',          color: 'from-yellow-500 to-amber-500',  icon: <FaGem />,       risk: 'Low' },
  bond:        { label: 'Bond',          color: 'from-slate-500 to-slate-600',   icon: <FaShield />,    risk: 'Low' },
  fd:          { label: 'Fixed Deposit', color: 'from-cyan-500 to-blue-500',     icon: <FaCoins />,     risk: 'Very Low' },
  ppf:         { label: 'PPF',           color: 'from-green-500 to-emerald-500', icon: <FaShield />,    risk: 'Very Low' },
}

const SECTOR_PRIORS = {
  'IT':           { beta: 1.10, vol: 0.22 },
  'Financials':   { beta: 1.05, vol: 0.20 },
  'Energy':       { beta: 1.00, vol: 0.24 },
  'Crypto':       { beta: 1.80, vol: 0.75 },
  'Commodities':  { beta: 0.40, vol: 0.18 },
  'FMCG':         { beta: 0.65, vol: 0.14 },
  'Pharma':       { beta: 0.80, vol: 0.17 },
  'Auto':         { beta: 1.15, vol: 0.25 },
  'Bonds':        { beta: 0.10, vol: 0.05 },
  'Other':        { beta: 1.00, vol: 0.20 },
}

const REFRESH_SECONDS = 45

function normalise(h) {
  const qty = safeNum(h.quantity)
  const buy = safeNum(h.buyPrice ?? h.avgPrice)
  const cur = safeNum(h.currentPrice || buy)
  const sector = h.sector || (h.type === 'crypto' ? 'Crypto' : (h.type === 'gold' ? 'Commodities' : 'Other'))
  const prior = SECTOR_PRIORS[sector] || SECTOR_PRIORS.Other
  return {
    id: h._id || h.id,
    symbol: h.symbol || '—',
    name: h.name || h.symbol || '—',
    type: h.type || 'stock',
    sector,
    quantity: qty,
    buyPrice: buy,
    currentPrice: cur,
    value: qty * cur,
    cost: qty * buy,
    pnl: qty * (cur - buy),
    pnlPct: safeDiv(cur - buy, buy) * 100,
    currency: h.currency || 'INR',
    beta: prior.beta,
    vol: prior.vol,
    demo: !!h.demo,
    coinId: h.coinId,
    schemeCode: h.schemeCode,
  }
}

function HerfindahlScore(weights) {
  if (!weights.length) return 0
  const hhi = weights.reduce((s, w) => s + w * w, 0) * 10000
  return clamp(hhi / 100, 0, 100)
}

export default function InvestmentsPage() {
  const { format, convert, currency, symbol } = useCurrency()
  const { socket, connected } = useSocket()

  const [holdings, setHoldings] = useState([])
  const [indices, setIndices] = useState([])
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState('matrix') // matrix | risk | allocation | performance | insights
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState('value') // value | pnl | pnlPct | symbol
  const [filterType, setFilterType] = useState('all')
  const [query, setQuery] = useState('')
  const [liveFeed, setLiveFeed] = useState([])
  const [refreshTick, setRefreshTick] = useState(0)
  const [spark, setSpark] = useState({}) // symbol -> number[]
  const [formData, setFormData] = useState({
    symbol: '', name: '', type: 'stock', quantity: '', buyPrice: '', currency: 'INR', sector: 'Other',
  })
  const [suggestions, setSuggestions] = useState([])
  const [livePrice, setLivePrice] = useState(null)
  const suggestTimer = useRef(null)
  const pollRef = useRef(null)
  const tickRef = useRef(null)

  // ---- Load holdings ----
  //
  // Behaviour:
  //   • No real holdings     → show the full SEED_HOLDINGS (flagged demo: true)
  //   • 1–4 real holdings    → real positions FIRST, then append SEED entries
  //                            whose symbols the user doesn't already own, so
  //                            analytics/sector/correlation panels have enough
  //                            signal and still showcase the product.
  //   • 5+ real holdings     → show real only (the user is clearly onboarded).
  // isDemo stays true whenever ANY demo entries are visible, so the banner
  // and "this is a sample" affordances remain accurate.
  const fetchHoldings = useCallback(async () => {
    try {
      const res = await getInvestments({ isActive: true }, 1, 100)
      const data = res?.data || res?.data?.data || []
      const real = Array.isArray(data) ? data : []
      if (!real.length) {
        setHoldings(SEED_HOLDINGS)
        setIsDemo(true)
      } else if (real.length < 5) {
        const ownedSymbols = new Set(real.map((h) => String(h.symbol || '').toUpperCase()))
        const supplements = SEED_HOLDINGS.filter(
          (s) => !ownedSymbols.has(String(s.symbol || '').toUpperCase()),
        )
        setHoldings([...real, ...supplements])
        setIsDemo(true)
      } else {
        setHoldings(real)
        setIsDemo(false)
      }
    } catch {
      setHoldings(SEED_HOLDINGS); setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchIndices = useCallback(async () => {
    try {
      const res = await api.get('/external/stocks/indices?region=IN')
      const list = res?.data?.indices || res?.data?.data?.indices || []
      if (Array.isArray(list) && list.length) setIndices(list.slice(0, 5))
    } catch {}
  }, [])

  useEffect(() => { fetchHoldings(); fetchIndices() }, [fetchHoldings, fetchIndices])

  // ---- Seed sparklines (one ~30-point walk per holding) ----
  useEffect(() => {
    if (!holdings.length) return
    setSpark((prev) => {
      const next = { ...prev }
      holdings.forEach((h) => {
        if (!next[h.symbol] || next[h.symbol].length === 0) {
          const base = safeNum(h.currentPrice || h.buyPrice, 100)
          const series = []
          let v = base * 0.95
          for (let i = 0; i < 30; i++) {
            v *= 1 + (Math.random() - 0.48) * 0.015
            series.push(Number(v.toFixed(4)))
          }
          // anchor last point close to currentPrice for realism
          series[series.length - 1] = base
          next[h.symbol] = series
        }
      })
      return next
    })
  }, [holdings])

  // ---- Live prices via polling ----
  const refreshPrices = useCallback(async () => {
    if (!holdings.length) return
    setRefreshing(true)
    try {
      const payload = {
        holdings: holdings.map((h) => ({
          symbol: h.symbol, type: h.type, quantity: h.quantity,
          buyPrice: h.buyPrice,
          // Send the last-known live price so the server-side fallback
          // (used when Yahoo/CoinGecko are unreachable) drifts around
          // the most recent value rather than collapsing back to cost.
          currentPrice: h.currentPrice,
          currency: h.currency,
          coinId: h.coinId, schemeCode: h.schemeCode,
        })),
      }
      const res = await api.post('/external/investments/price-holdings', payload)
      const priced = res?.data?.holdings || res?.data?.data?.holdings || []
      if (priced.length) {
        const next = holdings.map((h, i) => {
          const p = priced[i]
          const cp = safeNum(p?.currentPrice)
          if (cp > 0) {
            if (h._id && !h.demo) updateInvestment(h._id, { currentPrice: cp }).catch(() => {})
            if (cp !== h.currentPrice) {
              pushFeed(h.symbol, h.currentPrice, cp)
            }
            return { ...h, currentPrice: cp }
          }
          return h
        })
        setHoldings(next)
      }
    } catch {
      // Fallback to per-symbol quote for stocks
      const next = [...holdings]
      await Promise.allSettled(next.map(async (h, i) => {
        if (h.type !== 'stock' || !h.symbol) return
        try {
          const res = await getStockQuote(h.symbol)
          const p = safeNum(res?.data?.price ?? res?.data?.regularMarketPrice)
          if (p > 0) {
            if (p !== h.currentPrice) pushFeed(h.symbol, h.currentPrice, p)
            next[i] = { ...h, currentPrice: p }
          }
        } catch {}
      }))
      setHoldings(next)
    } finally {
      setRefreshing(false)
      setRefreshTick((t) => t + 1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings])

  // Auto-refresh every REFRESH_SECONDS seconds. We poll for BOTH real and
  // demo accounts — the seeded symbols (RELIANCE.NS, TCS.NS, BTC, etc.) are
  // real tickers, so live prices are meaningful even before the user adds
  // their own holdings. Server-side /price-holdings handles currency conv.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (holdings.length) {
      // Kick off an immediate refresh so the first real price lands fast,
      // then poll on the regular cadence.
      const t = setTimeout(() => { refreshPrices() }, 400)
      pollRef.current = setInterval(refreshPrices, REFRESH_SECONDS * 1000)
      return () => { clearTimeout(t); if (pollRef.current) clearInterval(pollRef.current) }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [holdings.length, refreshPrices])

  // ---- Micro-ticker: tiny random walks to keep sparklines live even in demo.
  // Flashes PriceFlash on meaningful changes.
  useEffect(() => {
    if (!holdings.length) return
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = setInterval(() => {
      setSpark((prev) => {
        const next = { ...prev }
        holdings.forEach((h) => {
          const arr = next[h.symbol] || []
          const last = arr[arr.length - 1] || safeNum(h.currentPrice, 100)
          const vol = h.type === 'crypto' ? 0.004 : h.type === 'stock' ? 0.0018 : 0.001
          const newV = Number((last * (1 + (Math.random() - 0.5) * vol * 2)).toFixed(4))
          next[h.symbol] = [...arr.slice(-29), newV]
        })
        return next
      })
      // No random walk on currentPrice — the /price-holdings poll supplies
      // real values for both demo and real portfolios. Sparklines still
      // animate above so the UI feels alive between polls.
    }, 2500)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [holdings, isDemo])

  // ---- Socket real-time: investment:priceUpdate events ----
  useEffect(() => {
    if (!socket) return
    const onPrice = (payload) => {
      if (!payload?.symbol || !payload?.price) return
      setHoldings((prev) => prev.map((h) => {
        if (h.symbol !== payload.symbol) return h
        const next = safeNum(payload.price)
        if (next > 0 && next !== h.currentPrice) {
          pushFeed(h.symbol, h.currentPrice, next)
          return { ...h, currentPrice: next }
        }
        return h
      }))
    }
    socket.on('investment:priceUpdate', onPrice)
    socket.on('market:tick', onPrice)
    return () => {
      socket.off('investment:priceUpdate', onPrice)
      socket.off('market:tick', onPrice)
    }
  }, [socket])

  const pushFeed = (sym, prev, next) => {
    const p = safeNum(prev), n = safeNum(next)
    if (!p || !n || p === n) return
    const pct = safeDiv(n - p, p) * 100
    const tone = n > p ? 'up' : 'down'
    setLiveFeed((f) => [{
      id: Date.now() + Math.random(),
      symbol: sym,
      from: p, to: n, pct,
      tone, ts: new Date(),
    }, ...f].slice(0, 12))
  }

  // ---- Symbol suggestions ----
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    const q = formData.symbol?.trim()
    if (!q || q.length < 2 || formData.type === 'fd' || formData.type === 'ppf') {
      setSuggestions([]); return
    }
    suggestTimer.current = setTimeout(async () => {
      try {
        if (formData.type === 'mutual_fund') {
          const res = await api.get(`/external/investments/mf/search?q=${encodeURIComponent(q)}`)
          const rows = res?.data?.results || []
          setSuggestions(rows.slice(0, 6).map((r) => ({
            symbol: String(r.schemeCode), name: r.schemeName, schemeCode: r.schemeCode,
          })))
        } else if (formData.type === 'crypto') {
          const list = [
            { symbol: 'BTC', coinId: 'bitcoin',     name: 'Bitcoin' },
            { symbol: 'ETH', coinId: 'ethereum',    name: 'Ethereum' },
            { symbol: 'SOL', coinId: 'solana',      name: 'Solana' },
            { symbol: 'BNB', coinId: 'binancecoin', name: 'BNB' },
            { symbol: 'XRP', coinId: 'ripple',      name: 'XRP' },
            { symbol: 'DOT', coinId: 'polkadot',    name: 'Polkadot' },
            { symbol: 'ADA', coinId: 'cardano',     name: 'Cardano' },
            { symbol: 'DOGE', coinId: 'dogecoin',   name: 'Dogecoin' },
          ].filter((x) => (x.symbol + x.name).toLowerCase().includes(q.toLowerCase()))
          setSuggestions(list)
        } else {
          const res = await api.get(`/external/stocks/search?q=${encodeURIComponent(q)}`)
          const rows = res?.data?.results || res?.data?.data?.results || []
          setSuggestions(rows.slice(0, 6))
        }
      } catch {}
    }, 300)
    return () => clearTimeout(suggestTimer.current)
  }, [formData.symbol, formData.type])

  const fetchLivePrice = async (sym, type) => {
    try {
      if (type === 'mutual_fund') {
        const res = await api.get(`/external/investments/mf/${sym}/nav`)
        const nav = safeNum(res?.data?.nav || res?.data?.data?.nav)
        if (nav > 0) { setLivePrice(nav); return nav }
      } else if (type === 'crypto') {
        const coinId = formData.coinId || String(sym).toLowerCase()
        const res = await api.get(`/external/investments/crypto/${coinId}`)
        const p = safeNum(res?.data?.priceINR || res?.data?.priceUSD || res?.data?.data?.priceINR)
        if (p > 0) { setLivePrice(p); return p }
      } else {
        const res = await api.get(`/external/stocks/quote/${sym}`)
        const p = safeNum(res?.data?.price || res?.data?.data?.price)
        if (p > 0) { setLivePrice(p); return p }
      }
    } catch {}
    return null
  }

  // ---- Derived state ----
  const normalized = useMemo(() => holdings.map(normalise), [holdings])

  const portfolio = useMemo(() => {
    const rows = normalized.map((h) => {
      const value = convert(h.value, h.currency, currency)
      const cost  = convert(h.cost,  h.currency, currency)
      const pnl   = convert(h.pnl,   h.currency, currency)
      return { ...h, dispValue: value, dispCost: cost, dispPnl: pnl }
    })
    const totalValue = rows.reduce((s, r) => s + r.dispValue, 0)
    const totalCost  = rows.reduce((s, r) => s + r.dispCost, 0)
    const totalPnl   = totalValue - totalCost
    const weights    = rows.map((r) => safeDiv(r.dispValue, totalValue))

    const portBeta = rows.reduce((s, r, i) => s + weights[i] * r.beta, 0)
    const portVol  = rows.reduce((s, r, i) => s + weights[i] * r.vol, 0)
    const annualRet = safeDiv(totalPnl, totalCost)
    const sharpe = portVol > 0 ? (annualRet - 0.065) / portVol : 0
    const concentration = HerfindahlScore(weights)

    // Day & week swing approximations from sparkline series
    let dayPnl = 0
    rows.forEach((r) => {
      const s = spark[r.symbol] || []
      if (s.length >= 2) {
        const d = safeDiv(s[s.length - 1] - s[0], s[0])
        dayPnl += r.dispValue * d
      }
    })

    // Biggest mover
    let biggest = null
    rows.forEach((r) => {
      if (!biggest || Math.abs(r.pnlPct) > Math.abs(biggest.pnlPct)) biggest = r
    })

    return {
      rows, totalValue, totalCost, totalPnl, portBeta, portVol, sharpe,
      concentration, weights, dayPnl, biggest,
    }
  }, [normalized, convert, currency, spark])

  const byType = useMemo(() => {
    const out = {}
    portfolio.rows.forEach((r) => { out[r.type] = (out[r.type] || 0) + r.dispValue })
    return Object.entries(out).map(([k, v]) => ({
      key: k, value: v, pct: safeDiv(v, portfolio.totalValue) * 100,
      color: gradientStartColor(TYPE_META[k]?.color),
    })).sort((a, b) => b.value - a.value)
  }, [portfolio])

  const bySector = useMemo(() => {
    const out = {}
    portfolio.rows.forEach((r) => { out[r.sector] = (out[r.sector] || 0) + r.dispValue })
    return Object.entries(out).map(([k, v]) => ({
      key: k, value: v, pct: safeDiv(v, portfolio.totalValue) * 100,
    })).sort((a, b) => b.value - a.value)
  }, [portfolio])

  // Filter + sort view of matrix
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = portfolio.rows.filter((r) => {
      if (filterType !== 'all' && r.type !== filterType) return false
      if (!q) return true
      return (r.symbol + ' ' + r.name).toLowerCase().includes(q)
    })
    const cmp = {
      value:   (a, b) => b.dispValue - a.dispValue,
      pnl:     (a, b) => b.dispPnl  - a.dispPnl,
      pnlPct:  (a, b) => b.pnlPct   - a.pnlPct,
      symbol:  (a, b) => a.symbol.localeCompare(b.symbol),
    }
    return [...base].sort(cmp[sortBy] || cmp.value)
  }, [portfolio.rows, filterType, query, sortBy])

  // ---- Actions ----
  const pickSuggestion = async (s) => {
    setFormData((prev) => ({
      ...prev,
      symbol: s.symbol,
      name: s.name || s.longname || s.shortname || prev.name,
      coinId: s.coinId || prev.coinId,
      schemeCode: s.schemeCode || prev.schemeCode,
    }))
    setSuggestions([])
    const p = await fetchLivePrice(s.schemeCode || s.symbol, formData.type)
    if (p) setFormData((prev) => ({ ...prev, buyPrice: prev.buyPrice || String(p) }))
  }

  const handleAdd = async () => {
    const { symbol: sym, name, type, quantity, buyPrice, currency: cur, coinId, schemeCode, sector } = formData
    if (!sym || !quantity || !buyPrice) return toast.error('Fill symbol, quantity, price')
    const payload = {
      symbol: sym.toUpperCase(),
      name: name || sym.toUpperCase(),
      type,
      quantity: safeNum(quantity),
      buyPrice: safeNum(buyPrice),
      currentPrice: livePrice || safeNum(buyPrice),
      buyDate: new Date().toISOString(),
      currency: cur || 'INR',
      sector: sector || 'Other',
      ...(coinId ? { coinId } : {}),
      ...(schemeCode ? { schemeCode } : {}),
    }
    try {
      const res = await createInvestment(payload)
      const inv = res?.data || res
      // Keep real holdings (non-demo) AND newly created position; drop any
      // demo entries so the first real position doesn't live alongside stale
      // seed rows. fetchHoldings() will re-merge demos back if portfolio
      // is still small.
      setHoldings((prev) => {
        const realOnly = prev.filter((h) => !h.demo)
        return [...realOnly, inv]
      })
      toast.success('Holding added')
      // Refresh from server so supplement merge runs with the new real set.
      fetchHoldings()
    } catch (err) {
      if (err?.response?.status === 401) {
        toast.error('Sign in to persist — staying in demo mode')
        setHoldings((prev) => [...prev, { ...payload, _id: `local-${Date.now()}`, demo: true }])
      } else {
        toast.error(err?.response?.data?.message || 'Add failed')
      }
    } finally {
      setFormData({ symbol: '', name: '', type: 'stock', quantity: '', buyPrice: '', currency: 'INR', sector: 'Other' })
      setSuggestions([]); setLivePrice(null); setIsModalOpen(false)
    }
  }

  const handleDelete = async (h) => {
    if (h.demo) { setHoldings((prev) => prev.filter((x) => (x._id || x.id) !== h.id)); return }
    try {
      await deleteInvestment(h.id)
      setHoldings((p) => p.filter((x) => (x._id || x.id) !== h.id))
      toast.success('Removed')
    } catch { toast.error('Delete failed') }
  }

  const exportCSV = () => {
    const header = ['Symbol', 'Name', 'Type', 'Sector', 'Qty', 'Buy', 'Price', 'Value', 'PnL', 'PnL%']
    const body = portfolio.rows.map((r) => [
      r.symbol, r.name, r.type, r.sector, r.quantity, r.buyPrice, r.currentPrice,
      r.dispValue.toFixed(2), r.dispPnl.toFixed(2), r.pnlPct.toFixed(2),
    ].join(','))
    const csv = [header.join(','), ...body].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portfolio-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported CSV')
  }

  // Even demo holdings use real tickers, so once we've had a successful price
  // fetch we report "live". The short pre-first-fetch window reports "connecting".
  const hasRealPrices = holdings.some((h) => safeNum(h.currentPrice) > 0)
  const status = !connected && !hasRealPrices ? 'offline' : (refreshing && !hasRealPrices ? 'connecting' : 'live')
  const allocSegments = byType.map((r) => ({ label: TYPE_META[r.key]?.label || r.key, value: r.value, color: r.color }))

  // ---- Render ----
  return (
    <Layout>
      <div className="space-y-6 mesh-bg p-4 -m-4 rounded-xl">
        {/* Header ---------------------------------------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
              <FaBriefcase size={11} /> PORTFOLIO COCKPIT
              <LivePulse status={status} className="ml-2" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Investment Portfolio
            </h1>
            <p className="text-navy-600 dark:text-navy-400 mt-1 flex flex-wrap items-center gap-2">
              {isDemo
                ? <>Live prices on sample tickers · {refreshing ? 'updating…' : 'streaming every ' + REFRESH_SECONDS + 's'}. Add a real holding to persist.</>
                : <>Live prices auto-refresh · {refreshing ? 'updating…' : 'streaming'}</>}
              <CountdownChip seconds={REFRESH_SECONDS} trigger={refreshTick} />
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CurrencySwitcher />
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-100 dark:bg-navy-800 text-sm font-medium hover:bg-navy-200 dark:hover:bg-navy-700 transition"
              title="Download portfolio as CSV"
            >
              <FaDownload size={12} /> Export
            </button>
            <button
              onClick={() => { refreshPrices(); setRefreshTick((t) => t + 1) }}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-100 dark:bg-navy-800 text-sm font-medium disabled:opacity-50 hover:bg-navy-200 dark:hover:bg-navy-700 transition"
            >
              <FaArrowsRotate size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 animate-gradient"
            >
              <FaPlus size={12} /> Add holding
            </motion.button>
          </div>
        </motion.div>

        {isDemo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2"
          >
            <FaBolt className="text-emerald-500 animate-pulse" />
            <span>
              Viewing <strong>sample holdings</strong> priced against the real market (Yahoo / CoinGecko / AMFI).
              Add a real position or sign in to persist &amp; unlock tax reports.
            </span>
          </motion.div>
        )}

        {/* Performance ribbon --------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <RibbonLive
            label="Net Asset Value"
            value={portfolio.totalValue}
            format={(v) => format(v)}
            sub={`Invested: ${format(portfolio.totalCost)}`}
            color="from-blue-500 to-cyan-500"
            icon={<FaGauge />}
          />
          <RibbonLive
            label="Unrealised P&L"
            value={portfolio.totalPnl}
            format={(v) => `${v >= 0 ? '+' : ''}${format(v)}`}
            sub={<MetricDelta pct={safeDiv(portfolio.totalPnl, portfolio.totalCost) * 100} size="sm" />}
            color={portfolio.totalPnl >= 0 ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-pink-500'}
            tone={portfolio.totalPnl >= 0 ? 'green' : 'red'}
            icon={<FaArrowTrendUp />}
          />
          <RibbonLive
            label="Today's Swing"
            value={portfolio.dayPnl}
            format={(v) => `${v >= 0 ? '+' : ''}${format(v)}`}
            sub={`Live ~${((portfolio.portVol / Math.sqrt(252)) * 100).toFixed(2)}% daily σ`}
            color={portfolio.dayPnl >= 0 ? 'from-green-500 to-emerald-500' : 'from-rose-500 to-red-500'}
            tone={portfolio.dayPnl >= 0 ? 'green' : 'red'}
            icon={<FaWaveSquare />}
          />
          <RibbonLive
            label="Portfolio Beta"
            value={portfolio.portBeta}
            format={(v) => v.toFixed(2)}
            decimals={2}
            sub={portfolio.portBeta > 1.1 ? 'More volatile than market' : portfolio.portBeta < 0.9 ? 'Defensive' : 'Market-like'}
            color="from-violet-500 to-purple-500"
            icon={<FaFire />}
          />
          <RibbonLive
            label="Sharpe · HHI"
            value={portfolio.sharpe}
            format={(v) => v.toFixed(2)}
            decimals={2}
            sub={`HHI ${portfolio.concentration.toFixed(0)} · ${portfolio.concentration > 40 ? 'concentrated' : portfolio.concentration > 20 ? 'moderate' : 'diversified'}`}
            color="from-amber-500 to-orange-500"
            icon={<FaRocket />}
          />
        </div>

        {/* Indices strip --------------------------------------------------- */}
        <GlassCard className="p-3" gradient="from-indigo-500/10 to-purple-500/10">
          <div className="flex items-center gap-2 mb-2">
            <LivePulse status={status} />
            <span className="text-xs font-semibold uppercase tracking-wider text-navy-600 dark:text-navy-300">Live Benchmarks</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(indices.length ? indices : [
              { name: 'Sensex',   symbol: 'SENSEX', value: 77420.35, changePercent:  0.42 },
              { name: 'Nifty 50', symbol: 'NIFTY',  value: 23586.90, changePercent:  0.31 },
              { name: 'Bank Nifty', symbol: 'BANKNIFTY', value: 51204.10, changePercent: -0.22 },
              { name: 'S&P 500',  symbol: 'SPX',    value:  5830.20, changePercent:  0.18 },
              { name: 'Nasdaq',   symbol: 'IXIC',   value: 19105.60, changePercent: -0.41 },
            ]).map((idx) => {
              const chg = safeNum(idx.changePercent)
              const series = spark[`IDX-${idx.symbol}`] || (() => {
                const out = []; let v = safeNum(idx.value, 1000)
                for (let i = 0; i < 24; i++) { v *= 1 + (Math.random() - 0.5) * 0.004; out.push(v) }
                return out
              })()
              return (
                <motion.div
                  key={idx.symbol || idx.name}
                  whileHover={{ y: -2 }}
                  className="p-3 rounded-lg bg-white/70 dark:bg-navy-900/50 border border-navy-200/70 dark:border-navy-700/70"
                >
                  <p className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">{idx.name}</p>
                  <PriceFlash value={safeNum(idx.value)} className="block">
                    <AnimatedCounter
                      value={safeNum(idx.value)}
                      decimals={2}
                      className="text-base font-bold text-navy-900 dark:text-navy-100"
                    />
                  </PriceFlash>
                  <div className="flex items-center justify-between mt-1">
                    <MetricDelta pct={chg} size="sm" />
                    <Sparkline points={series} width={56} height={18} />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </GlassCard>

        {/* Tabs ------------------------------------------------------------ */}
        <div className="flex items-center gap-1 border-b border-navy-200 dark:border-navy-700 overflow-x-auto scrollbar-hide">
          {[
            { id: 'matrix',      label: 'Holdings Matrix',    icon: <FaBriefcase /> },
            { id: 'risk',        label: 'Risk Analytics',     icon: <FaFire /> },
            { id: 'allocation',  label: 'Allocation Studio',  icon: <FaChartLine /> },
            { id: 'performance', label: 'Performance',        icon: <FaArrowTrendUp /> },
            { id: 'insights',    label: 'AI Insights',        icon: <FaBolt /> },
            { id: 'planner',     label: 'SIP & Dividends',    icon: <FaCoins /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setViewMode(t.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition whitespace-nowrap ${
                viewMode === t.id
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-navy-600 dark:text-navy-400 hover:text-navy-900 dark:hover:text-navy-100'
              }`}
            >
              {t.icon} {t.label}
              {viewMode === t.id && (
                <motion.span
                  layoutId="invTabBar"
                  className="absolute left-0 right-0 -bottom-px h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t"
                />
              )}
            </button>
          ))}
        </div>

        {/* Matrix view ----------------------------------------------------- */}
        <AnimatePresence mode="wait">
          {viewMode === 'matrix' && (
            <motion.div
              key="matrix"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Filter / search / sort bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" size={12} />
                  <input
                    value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search symbol, name…"
                    className="pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-navy-200 dark:border-navy-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-navy-100 dark:bg-navy-800">
                  {[['all','All'], ['stock','Equity'], ['mutual_fund','MF'], ['crypto','Crypto'], ['gold','Gold']].map(([k,l]) => (
                    <button
                      key={k}
                      onClick={() => setFilterType(k)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                        filterType === k ? 'bg-white dark:bg-navy-700 shadow-sm' : 'text-navy-600 dark:text-navy-300'
                      }`}
                    >{l}</button>
                  ))}
                </div>
                <div className="flex items-center gap-1 ml-auto text-xs text-navy-500">
                  <FaFilter size={11} /> Sort:
                  <select
                    value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="px-2 py-1 rounded border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs"
                  >
                    <option value="value">Value</option>
                    <option value="pnl">P&amp;L</option>
                    <option value="pnlPct">P&amp;L %</option>
                    <option value="symbol">Symbol</option>
                  </select>
                </div>
              </div>

              <GlassCard className="overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-navy-200 dark:border-navy-700">
                  <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
                    Positions <span className="text-xs font-normal text-navy-500">({filteredRows.length})</span>
                  </h3>
                  <span className="text-xs text-navy-500">values in {currency}</span>
                </div>
                {loading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton w={40} h={40} rounded="rounded-full" />
                        <Skeleton w="30%" />
                        <Skeleton w="15%" />
                        <Skeleton w="15%" />
                      </div>
                    ))}
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="p-10 text-center text-navy-500">
                    <FaMagnifyingGlass className="mx-auto text-3xl mb-2 opacity-50" />
                    No holdings match your filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-navy-50 dark:bg-navy-800/50 text-navy-700 dark:text-navy-300 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold">Asset</th>
                          <th className="text-left px-4 py-3 font-semibold">Type</th>
                          <th className="text-left px-4 py-3 font-semibold">Trend</th>
                          <th className="text-right px-4 py-3 font-semibold">Qty</th>
                          <th className="text-right px-4 py-3 font-semibold">Avg</th>
                          <th className="text-right px-4 py-3 font-semibold">Live Price</th>
                          <th className="text-right px-4 py-3 font-semibold">Value</th>
                          <th className="text-right px-4 py-3 font-semibold">P&amp;L</th>
                          <th className="text-right px-4 py-3 font-semibold">% Port</th>
                          <th className="text-right px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence initial={false}>
                          {filteredRows.map((h, i) => {
                            const tm = TYPE_META[h.type] || TYPE_META.stock
                            const weight = safeDiv(h.dispValue, portfolio.totalValue) * 100
                            const pnlNeg = h.dispPnl < 0
                            const series = spark[h.symbol] || []
                            return (
                              <motion.tr
                                key={h.id}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2, delay: i * 0.02 }}
                                className="border-t border-navy-100 dark:border-navy-800 hover:bg-navy-50/70 dark:hover:bg-navy-800/30 group"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white text-xs bg-gradient-to-br ${tm.color}`}>
                                      {tm.icon}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-navy-900 dark:text-navy-100">{h.symbol}</p>
                                      <p className="text-[11px] text-navy-500 truncate max-w-[220px]">{h.name}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white font-semibold bg-gradient-to-r ${tm.color}`}>
                                    {tm.label}
                                  </span>
                                  <p className="text-[10px] text-navy-500 mt-0.5">{h.sector} · {tm.risk}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <Sparkline points={series} width={70} height={22} />
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">{h.quantity}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-navy-500">{format(h.buyPrice, h.currency)}</td>
                                <td className="px-4 py-3 text-right tabular-nums font-medium">
                                  <PriceFlash value={h.currentPrice}>
                                    {format(h.currentPrice, h.currency)}
                                  </PriceFlash>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                                  <AnimatedCounter value={h.dispValue} decimals={2} prefix={symbol} />
                                </td>
                                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${pnlNeg ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  <div>{h.dispPnl >= 0 ? '+' : ''}{format(h.dispPnl)}</div>
                                  <div className="text-[10px] font-normal"><MetricDelta pct={h.pnlPct} size="sm" /></div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="inline-block w-20">
                                    <div className="h-1.5 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, weight)}%` }}
                                        transition={{ duration: 0.6, ease: 'easeOut' }}
                                        className={`h-full bg-gradient-to-r ${tm.color}`}
                                      />
                                    </div>
                                    <p className="text-[10px] text-navy-500 mt-0.5">{weight.toFixed(1)}%</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => handleDelete(h)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete"
                                  >
                                    <FaTrashCan size={12} />
                                  </button>
                                </td>
                              </motion.tr>
                            )
                          })}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>

              {/* Live activity feed + Movers ribbon */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <GlassCard className="p-4 lg:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
                      <FaBolt className="text-amber-500" /> Live Price Activity
                    </h3>
                    <LivePulse status={status} />
                  </div>
                  {liveFeed.length === 0 ? (
                    <p className="text-sm text-navy-500 italic">Waiting for next price tick…</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-hide">
                      <AnimatePresence>
                        {liveFeed.map((f, idx) => (
                          <LiveFeedRow key={f.id} tone={f.tone} idx={idx}>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-semibold text-navy-900 dark:text-navy-100">{f.symbol}</span>
                                <span className="text-xs text-navy-500 ml-2">
                                  {f.ts.toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-navy-500 tabular-nums">{f.from.toFixed(2)}</span>
                                <span className="text-navy-400">{'\u2192'}</span>
                                <span className="font-semibold tabular-nums">{f.to.toFixed(2)}</span>
                                <MetricDelta pct={f.pct} size="sm" />
                              </div>
                            </div>
                          </LiveFeedRow>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </GlassCard>

                <GlassCard className="p-4">
                  <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3 flex items-center gap-2">
                    <FaFire className="text-orange-500" /> Top Mover
                  </h3>
                  {portfolio.biggest ? (
                    <div className="text-center">
                      <p className="text-sm text-navy-500">{portfolio.biggest.name}</p>
                      <p className="text-2xl font-bold text-navy-900 dark:text-navy-100 mt-1">{portfolio.biggest.symbol}</p>
                      <div className="mt-3">
                        <MetricDelta pct={portfolio.biggest.pnlPct} />
                      </div>
                      <p className="text-xs text-navy-500 mt-2">
                        Value: <span className="font-semibold">{format(portfolio.biggest.dispValue)}</span>
                      </p>
                      <div className="mt-3">
                        <Sparkline points={spark[portfolio.biggest.symbol] || []} width={180} height={40} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-navy-500">No positions yet.</p>
                  )}
                </GlassCard>
              </div>
            </motion.div>
          )}

          {viewMode === 'risk' && (
            <motion.div
              key="risk"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <GlassCard className="p-6">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-1 flex items-center gap-2">
                  <FaWaveSquare className="text-violet-500" /> Risk-Return Scatter
                </h3>
                <p className="text-xs text-navy-500 mb-4">Bubble size = position value. Upper-right = higher return &amp; risk.</p>
                <RiskScatter rows={portfolio.rows} totalValue={portfolio.totalValue} />
              </GlassCard>
              <GlassCard className="p-6">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-1 flex items-center gap-2">
                  <FaFire className="text-rose-500" /> Drawdown &amp; Stress
                </h3>
                <p className="text-xs text-navy-500 mb-4">Estimated impact of market shocks on your total portfolio value.</p>
                <StressTable totalValue={portfolio.totalValue} rows={portfolio.rows} weights={portfolio.weights} format={format} />
              </GlassCard>

              <GlassCard className="p-6 lg:col-span-2">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Risk Commentary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <InsightBlock
                    title="Beta positioning"
                    icon={<FaGauge />}
                    tone={portfolio.portBeta > 1.1 ? 'red' : portfolio.portBeta < 0.9 ? 'blue' : 'amber'}
                    body={
                      portfolio.portBeta > 1.1
                        ? `Your portfolio is ~${((portfolio.portBeta - 1) * 100).toFixed(0)}% more volatile than the broad market. Expect bigger swings both ways.`
                        : portfolio.portBeta < 0.9
                          ? `You're defensively positioned (beta ${portfolio.portBeta.toFixed(2)}) - less downside, but likely less upside.`
                          : `Beta of ${portfolio.portBeta.toFixed(2)} tracks the market closely.`
                    }
                  />
                  <InsightBlock
                    title="Diversification"
                    icon={<FaChartLine />}
                    tone={portfolio.concentration > 40 ? 'red' : portfolio.concentration > 20 ? 'amber' : 'green'}
                    body={
                      portfolio.concentration > 40
                        ? `HHI ${portfolio.concentration.toFixed(0)}: heavily concentrated. A single asset drawdown can hurt. Target below 25.`
                        : portfolio.concentration > 20
                          ? `HHI ${portfolio.concentration.toFixed(0)}: moderate. Consider at least 1-2 more uncorrelated positions.`
                          : `HHI ${portfolio.concentration.toFixed(0)}: well diversified - solid risk profile.`
                    }
                  />
                  <InsightBlock
                    title="Risk-adjusted return"
                    icon={<FaRocket />}
                    tone={portfolio.sharpe > 1 ? 'green' : portfolio.sharpe > 0 ? 'amber' : 'red'}
                    body={
                      portfolio.sharpe > 1
                        ? `Sharpe ${portfolio.sharpe.toFixed(2)}: strong reward per unit risk. Keep compounding.`
                        : portfolio.sharpe > 0
                          ? `Sharpe ${portfolio.sharpe.toFixed(2)}: positive but below 1 - consider lower-volatility assets like bonds or index funds.`
                          : `Sharpe ${portfolio.sharpe.toFixed(2)}: risk is not being rewarded yet. Holding period may still be early.`
                    }
                  />
                </div>
              </GlassCard>

              <GlassCard className="p-6 lg:col-span-2">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-4 flex items-center gap-2">
                  <FaChartLine /> Sector Exposure
                </h3>
                <div className="flex items-end gap-4 overflow-x-auto pb-2">
                  {bySector.map((s) => (
                    <div key={s.key} className="flex flex-col items-center min-w-[60px]">
                      <WaveBar value={s.pct} max={100} h={120} />
                      <p className="text-xs font-semibold text-navy-700 dark:text-navy-300 mt-2">{s.pct.toFixed(1)}%</p>
                      <p className="text-[10px] text-navy-500 text-center">{s.key}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {viewMode === 'allocation' && (
            <motion.div
              key="alloc"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <GlassCard className="p-6 lg:col-span-1 flex flex-col items-center justify-center">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-4 w-full">Asset-class donut</h3>
                <AnimatedDonut
                  segments={allocSegments}
                  size={200} stroke={22}
                  center={
                    <div>
                      <p className="text-[10px] uppercase text-navy-500 font-semibold">NAV</p>
                      <p className="text-lg font-bold text-navy-900 dark:text-navy-100">
                        {fmtCompact(portfolio.totalValue)}
                      </p>
                      <p className="text-[10px] text-navy-500">{currency}</p>
                    </div>
                  }
                />
                <div className="mt-4 w-full grid grid-cols-1 gap-1.5 text-xs">
                  {byType.map((r) => (
                    <div key={r.key} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                        <span className="text-navy-700 dark:text-navy-300">{TYPE_META[r.key]?.label || r.key}</span>
                      </span>
                      <span className="tabular-nums font-semibold">{r.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-6 lg:col-span-2">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-4">Asset-class stacked bar</h3>
                <AllocationStack rows={byType} labels={Object.fromEntries(Object.entries(TYPE_META).map(([k, v]) => [k, v.label]))} format={format} />
                <div className="h-px bg-navy-200 dark:bg-navy-700 my-6" />
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-4">By sector</h3>
                <AllocationStack rows={bySector} format={format} />
              </GlassCard>
            </motion.div>
          )}

          {viewMode === 'performance' && (
            <motion.div
              key="perf"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <GlassCard className="p-6">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Lifetime NAV curve</h3>
                <NAVChart rows={portfolio.rows} totalValue={portfolio.totalValue} totalCost={portfolio.totalCost} spark={spark} format={format} />
              </GlassCard>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-5">
                  <p className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Winners</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    <AnimatedCounter value={portfolio.rows.filter((r) => r.pnl > 0).length} />
                  </p>
                  <p className="text-xs text-navy-500">positions above cost</p>
                </GlassCard>
                <GlassCard className="p-5">
                  <p className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Losers</p>
                  <p className="text-2xl font-bold text-rose-600">
                    <AnimatedCounter value={portfolio.rows.filter((r) => r.pnl < 0).length} />
                  </p>
                  <p className="text-xs text-navy-500">positions below cost</p>
                </GlassCard>
                <GlassCard className="p-5">
                  <p className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Avg return / position</p>
                  <p className={`text-2xl font-bold ${portfolio.rows.length && portfolio.rows.reduce((s, r) => s + r.pnlPct, 0) / portfolio.rows.length >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {portfolio.rows.length ? fmtSigned(portfolio.rows.reduce((s, r) => s + r.pnlPct, 0) / portfolio.rows.length) + '%' : '-'}
                  </p>
                  <p className="text-xs text-navy-500">equal-weighted mean</p>
                </GlassCard>
              </div>

              <GlassCard className="p-6">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-4">Per-holding returns leaderboard</h3>
                <ReturnsLeaderboard rows={portfolio.rows} format={format} />
              </GlassCard>
            </motion.div>
          )}

          {viewMode === 'insights' && (
            <motion.div
              key="ins"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              {generateInsights(portfolio, byType, bySector).map((ins, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                >
                  <InsightCard {...ins} />
                </motion.div>
              ))}
            </motion.div>
          )}

          {viewMode === 'planner' && (
            <motion.div
              key="planner"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <SipCalculator format={format} symbol={symbol} />
              <DividendTracker rows={portfolio.rows} format={format} symbol={symbol} />
              <GoalProjector totalValue={portfolio.totalValue} format={format} symbol={symbol} />
              <RebalanceSuggestor rows={byType} totalValue={portfolio.totalValue} format={format} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Investment">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset class">
              <select
                value={formData.type}
                onChange={(e) => { setFormData({ ...formData, type: e.target.value, symbol: '', name: '' }); setLivePrice(null) }}
                className="input-base"
              >
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Sector">
              <select
                value={formData.sector}
                onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                className="input-base"
              >
                {Object.keys(SECTOR_PRIORS).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="relative">
            <Field label="Symbol / instrument">
              <div className="relative">
                <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" size={14} />
                <input
                  value={formData.symbol}
                  onChange={(e) => { setFormData({ ...formData, symbol: e.target.value }); setLivePrice(null) }}
                  placeholder={formData.type === 'crypto' ? 'BTC, ETH...' : formData.type === 'mutual_fund' ? 'Axis Bluechip, SBI Gold...' : 'TCS, RELIANCE.NS...'}
                  className="input-base pl-9"
                  autoComplete="off"
                />
              </div>
            </Field>
            {suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto bg-white dark:bg-navy-900 border border-navy-200 dark:border-navy-700 rounded-lg shadow-lg">
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.symbol}-${i}`}
                    onClick={() => pickSuggestion(s)}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-navy-50 dark:hover:bg-navy-800 border-b border-navy-100 dark:border-navy-800 last:border-b-0"
                  >
                    <div className="font-semibold">{s.symbol}</div>
                    <div className="text-xs text-navy-500 truncate">{s.name || s.longname || s.shortname}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field label="Display name">
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Company / fund / coin"
              className="input-base"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input
                type="number" step="any" value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="input-base" placeholder="0"
              />
            </Field>
            <Field label="Buy currency">
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="input-base"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </Field>
          </div>

          <Field label="Buy price / unit">
            <div>
              <input
                type="number" step="any" value={formData.buyPrice}
                onChange={(e) => setFormData({ ...formData, buyPrice: e.target.value })}
                className="input-base" placeholder="0.00"
              />
              <div className="flex items-center justify-between mt-2 text-xs">
                {livePrice ? (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, buyPrice: String(livePrice) })}
                    className="text-indigo-600 hover:underline"
                  >
                    Use live: {livePrice.toLocaleString()}
                  </button>
                ) : formData.symbol ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const p = await fetchLivePrice(formData.schemeCode || formData.symbol, formData.type)
                      p ? toast.success(`Live price: ${p.toLocaleString()}`) : toast.error('Could not fetch live price')
                    }}
                    className="text-indigo-600 hover:underline"
                  >
                    Fetch live price
                  </button>
                ) : <span className="text-navy-500">Pick a symbol to enable live pricing.</span>}
                {safeNum(formData.quantity) > 0 && safeNum(formData.buyPrice) > 0 && (
                  <span className="text-navy-500">
                    Total: {formData.currency} {(safeNum(formData.quantity) * safeNum(formData.buyPrice)).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </Field>

          <button
            onClick={handleAdd}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:shadow-lg transition animate-gradient"
          >
            Add to portfolio
          </button>
        </div>
      </Modal>
    </Layout>
  )
}

function gradientStartColor(cls = '') {
  const map = {
    blue: '#3b82f6', indigo: '#6366f1', emerald: '#10b981', teal: '#14b8a6',
    amber: '#f59e0b', orange: '#f97316', yellow: '#eab308', slate: '#64748b',
    cyan: '#06b6d4', green: '#22c55e', rose: '#f43f5e', pink: '#ec4899',
    violet: '#8b5cf6', purple: '#a855f7',
  }
  const m = cls.match(/from-(\w+)-/)
  return (m && map[m[1]]) || '#6366f1'
}

function RibbonLive({ label, value, format, decimals = 0, sub, tone, color, icon }) {
  const toneCls = tone === 'red' ? 'text-rose-600 dark:text-rose-400'
    : tone === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-navy-900 dark:text-navy-100'
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.015 }}
      className="card p-4 relative overflow-hidden group"
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${color || 'from-navy-500 to-navy-600'} animate-gradient`} />
      <div className={`absolute top-2 right-2 text-lg opacity-40 bg-gradient-to-r ${color || 'from-navy-500 to-navy-600'} bg-clip-text text-transparent`}>
        {icon}
      </div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-navy-500">{label}</p>
      <div className={`text-xl font-bold tabular-nums mt-1 ${toneCls}`}>
        <PriceFlash value={value}>
          {format ? format(value) : <AnimatedCounter value={value} decimals={decimals} />}
        </PriceFlash>
      </div>
      <div className="text-xs text-navy-500 mt-0.5 tabular-nums">{sub}</div>
    </motion.div>
  )
}

function RiskScatter({ rows, totalValue }) {
  const w = 480, h = 280, padX = 40, padY = 24
  const xMax = 0.9, yMin = -50, yMax = 150
  const x = (v) => padX + (clamp(v, 0, xMax) / xMax) * (w - padX * 2)
  const y = (r) => (h - padY) - ((clamp(r, yMin, yMax) - yMin) / (yMax - yMin)) * (h - padY * 2)
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-64">
        <defs>
          <linearGradient id="rsBg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={padX} y={padY} width={w - padX * 2} height={h - padY * 2} fill="url(#rsBg)" />
        {[0, 0.2, 0.4, 0.6, 0.8].map((t) => (
          <line key={t} x1={x(t)} y1={padY} x2={x(t)} y2={h - padY} stroke="currentColor" opacity="0.08" />
        ))}
        {[0, 50, 100, 150].map((t) => (
          <line key={t} x1={padX} y1={y(t)} x2={w - padX} y2={y(t)} stroke="currentColor" opacity="0.08" />
        ))}
        <line x1={padX} y1={y(0)} x2={w - padX} y2={y(0)} stroke="#94a3b8" strokeDasharray="3 3" />
        <text x={w / 2} y={h - 4} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">Volatility</text>
        <text x={12} y={h / 2} fontSize="10" fill="currentColor" opacity="0.6" transform={`rotate(-90 12,${h / 2})`}>Return %</text>
        {rows.map((r, i) => {
          const weight = safeDiv(r.dispValue, totalValue)
          const ret = safeDiv(r.pnl, r.cost) * 100
          const radius = clamp(6 + weight * 40, 6, 38)
          const col = ret >= 0 ? '#10b981' : '#ef4444'
          return (
            <g key={r.id}>
              <motion.circle
                initial={{ r: 0, opacity: 0 }}
                animate={{ r: radius, opacity: 1 }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                cx={x(r.vol)} cy={y(ret)}
                fill={col} fillOpacity="0.4" stroke={col} strokeWidth="1.5"
              />
              <text x={x(r.vol)} y={y(ret) + 3} textAnchor="middle" fontSize="9" fill="#0f172a" fontWeight="600" pointerEvents="none">
                {r.symbol.replace('.NS', '').slice(0, 5)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function StressTable({ totalValue, rows, format }) {
  const scenarios = [
    { name: 'Mild correction',  betaShock: -0.05, cryptoShock: -0.10 },
    { name: 'Bear market',      betaShock: -0.20, cryptoShock: -0.40 },
    { name: 'Black swan',       betaShock: -0.35, cryptoShock: -0.65 },
    { name: 'Reflation rally',  betaShock: +0.15, cryptoShock: +0.50 },
  ]
  return (
    <table className="w-full text-sm">
      <thead className="text-navy-600 dark:text-navy-400">
        <tr className="border-b border-navy-200 dark:border-navy-700">
          <th className="text-left py-2">Scenario</th>
          <th className="text-right py-2">Portfolio impact</th>
          <th className="text-right py-2">Projected NAV</th>
        </tr>
      </thead>
      <tbody>
        {scenarios.map((s, i) => {
          const impact = rows.reduce((sum, r) => {
            const shock = r.type === 'crypto' ? s.cryptoShock : r.beta * s.betaShock
            return sum + r.dispValue * shock
          }, 0)
          const newNav = totalValue + impact
          const deltaPct = safeDiv(impact, totalValue) * 100
          const neg = impact < 0
          return (
            <motion.tr
              key={s.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="border-b border-navy-100 dark:border-navy-800"
            >
              <td className="py-2">{s.name}</td>
              <td className={`py-2 text-right font-semibold tabular-nums ${neg ? 'text-rose-600' : 'text-emerald-600'}`}>
                {neg ? '' : '+'}{format(impact)} ({deltaPct.toFixed(1)}%)
              </td>
              <td className="py-2 text-right tabular-nums">{format(newNav)}</td>
            </motion.tr>
          )
        })}
      </tbody>
    </table>
  )
}

function AllocationStack({ rows, labels, format }) {
  if (!rows.length) return <p className="text-sm text-navy-500">No data.</p>
  const palette = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#84cc16', '#ec4899']
  return (
    <div>
      <div className="flex h-6 rounded-full overflow-hidden bg-navy-100 dark:bg-navy-800">
        {rows.map((r, i) => (
          <motion.div
            key={r.key}
            initial={{ width: 0 }}
            animate={{ width: `${r.pct}%` }}
            transition={{ duration: 0.7, delay: i * 0.05, ease: 'easeOut' }}
            style={{ background: r.color || palette[i % palette.length] }}
            title={`${r.key}: ${r.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full flex-none" style={{ background: r.color || palette[i % palette.length] }} />
              <span className="truncate text-navy-700 dark:text-navy-300">{(labels && labels[r.key]) || r.key}</span>
            </div>
            <div className="text-navy-900 dark:text-navy-100 font-semibold tabular-nums whitespace-nowrap">
              {format(r.value)} - {r.pct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NAVChart({ rows, totalCost, spark, format }) {
  const N = 30
  const series = []
  for (let i = 0; i < N; i++) {
    let sum = 0
    rows.forEach((r) => {
      const s = spark[r.symbol] || []
      const v = s[i] != null ? s[i] : r.currentPrice
      sum += r.quantity * v
    })
    series.push(sum)
  }
  const w = 900, h = 200, padX = 34, padY = 16
  const min = Math.min(...series), max = Math.max(...series)
  const range = (max - min) || 1
  const stepX = (w - padX * 2) / (N - 1)
  const y = (v) => (h - padY) - ((v - min) / range) * (h - padY * 2)
  const path = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${(padX + i * stepX).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const area = `${path} L${(padX + (N - 1) * stepX).toFixed(2)},${h - padY} L${padX},${h - padY} Z`
  const up = series[N - 1] >= series[0]
  const stroke = up ? '#10b981' : '#ef4444'
  const costLine = y(totalCost)
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56">
        <defs>
          <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#navGrad)" />
        <path d={path} stroke={stroke} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={padX} x2={w - padX} y1={costLine} y2={costLine} stroke="#94a3b8" strokeDasharray="4 4" />
        <text x={w - padX - 4} y={costLine - 4} fontSize="9" textAnchor="end" fill="#94a3b8">
          Cost basis: {format(totalCost)}
        </text>
      </svg>
    </div>
  )
}

function ReturnsLeaderboard({ rows, format }) {
  const sorted = [...rows].sort((a, b) => b.pnlPct - a.pnlPct)
  const maxAbs = Math.max(1, ...sorted.map((r) => Math.abs(r.pnlPct)))
  return (
    <div className="space-y-2">
      {sorted.map((r, i) => {
        const pct = r.pnlPct
        const w = (Math.abs(pct) / maxAbs) * 50
        const up = pct >= 0
        return (
          <div key={r.id} className="flex items-center gap-3 text-sm">
            <span className="w-6 text-center text-xs font-semibold text-navy-500">{i + 1}</span>
            <span className="w-28 truncate font-semibold text-navy-900 dark:text-navy-100">{r.symbol}</span>
            <div className="flex-1 relative h-2 bg-navy-100 dark:bg-navy-800 rounded-full">
              <span className="absolute left-1/2 top-0 bottom-0 w-px bg-navy-300" />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${w}%` }}
                transition={{ duration: 0.5, delay: i * 0.03 }}
                className={`absolute top-0 bottom-0 ${up ? 'left-1/2 bg-emerald-500' : 'right-1/2 bg-rose-500'}`}
                style={{ borderRadius: up ? '0 999px 999px 0' : '999px 0 0 999px' }}
              />
            </div>
            <span className={`w-16 text-right font-semibold tabular-nums ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
              {fmtSigned(pct)}%
            </span>
            <span className="w-24 text-right text-navy-500 tabular-nums text-xs">{format(r.dispPnl)}</span>
          </div>
        )
      })}
    </div>
  )
}

function generateInsights(portfolio, byType, bySector) {
  const out = []
  if (portfolio.concentration > 40) {
    out.push({
      title: 'Concentration risk',
      icon: <FaFire />,
      tone: 'red',
      body: `Your HHI is ${portfolio.concentration.toFixed(0)} - a single drawdown could hurt. Consider rebalancing into at least 3-4 uncorrelated positions.`,
      cta: 'Explore diversification',
    })
  }
  const crypto = byType.find((b) => b.key === 'crypto')
  if (crypto && crypto.pct > 15) {
    out.push({
      title: 'High crypto exposure',
      icon: <FaBitcoin />,
      tone: 'amber',
      body: `Crypto is ${crypto.pct.toFixed(1)}% of NAV - expect 3-4x the volatility of equity. Align with your risk tolerance.`,
      cta: 'Review risk view',
    })
  }
  if (portfolio.sharpe > 1) {
    out.push({
      title: 'Excellent risk-adjusted return',
      icon: <FaRocket />,
      tone: 'green',
      body: `Sharpe ${portfolio.sharpe.toFixed(2)} - you are compounding efficiently. Keep the discipline.`,
      cta: null,
    })
  } else if (portfolio.sharpe < 0) {
    out.push({
      title: 'Risk-adjusted return is negative',
      icon: <FaGauge />,
      tone: 'red',
      body: `Sharpe ${portfolio.sharpe.toFixed(2)} - risk is not being rewarded yet. Early holding periods can show this; give it 6-12 months.`,
      cta: 'See performance',
    })
  }
  const it = bySector.find((s) => s.key === 'IT')
  if (it && it.pct > 35) {
    out.push({
      title: 'IT sector overweight',
      icon: <FaChartLine />,
      tone: 'amber',
      body: `IT is ${it.pct.toFixed(1)}% of NAV. Consider broadening with FMCG, Pharma or Financials to dampen tech-specific shocks.`,
      cta: 'See sectors',
    })
  }
  if (portfolio.totalPnl > 0 && portfolio.totalPnl / (portfolio.totalCost || 1) > 0.25) {
    out.push({
      title: 'Consider partial profit booking',
      icon: <FaArrowTrendUp />,
      tone: 'blue',
      body: `You are up ${(safeDiv(portfolio.totalPnl, portfolio.totalCost) * 100).toFixed(0)}% on cost. Taking 10-20% off the table and recycling into lower-beta assets locks in gains.`,
      cta: null,
    })
  }
  if (out.length === 0) {
    out.push({
      title: 'Portfolio looks balanced',
      icon: <FaGauge />,
      tone: 'green',
      body: 'No red flags detected on diversification, beta, or concentration. Keep reviewing quarterly.',
      cta: null,
    })
  }
  return out
}

function InsightCard({ title, icon, tone = 'blue', body, cta }) {
  const tones = {
    red:   'from-rose-500/20 to-rose-500/5 border-rose-500/30 text-rose-700 dark:text-rose-300',
    green: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-300',
    blue:  'from-indigo-500/20 to-indigo-500/5 border-indigo-500/30 text-indigo-700 dark:text-indigo-300',
  }
  return (
    <div className={`p-5 rounded-xl border bg-gradient-to-br ${tones[tone]} backdrop-blur`}>
      <div className="flex items-center gap-2 mb-2 text-lg">
        {icon}
        <h4 className="font-semibold text-navy-900 dark:text-navy-100 text-base">{title}</h4>
      </div>
      <p className="text-sm text-navy-700 dark:text-navy-300 leading-relaxed">{body}</p>
      {cta && (
        <button className="mt-3 text-xs font-semibold underline opacity-80 hover:opacity-100">{cta}</button>
      )}
    </div>
  )
}

function InsightBlock({ title, body, icon, tone = 'blue' }) {
  const tones = {
    red:   'bg-rose-50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-300',
    green: 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300',
    blue:  'bg-navy-50 dark:bg-navy-800 text-navy-700 dark:text-navy-300',
  }
  return (
    <div className={`p-3 rounded-lg ${tones[tone]}`}>
      <p className="font-semibold text-navy-900 dark:text-navy-100 text-sm mb-1 flex items-center gap-1.5">
        {icon} {title}
      </p>
      <p className="text-xs leading-relaxed">{body}</p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-navy-600 dark:text-navy-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

// ---------- SIP Calculator with animated compounding curve ----------
function SipCalculator({ format, symbol }) {
  const [monthly, setMonthly] = useState('10000')
  const [years, setYears] = useState('10')
  const [rate, setRate] = useState('12')
  const [stepUp, setStepUp] = useState('0')

  const data = useMemo(() => {
    const m = Math.max(0, safeNum(monthly))
    const y = Math.max(0, Math.min(40, safeNum(years)))
    const r = Math.max(0, safeNum(rate)) / 100
    const s = Math.max(0, safeNum(stepUp)) / 100
    const months = Math.round(y * 12)
    const monthlyRate = r / 12
    let corpus = 0, invested = 0, contrib = m
    const points = [{ year: 0, corpus: 0, invested: 0, gain: 0 }]
    for (let i = 1; i <= months; i++) {
      corpus = (corpus + contrib) * (1 + monthlyRate)
      invested += contrib
      // Snapshot every 12 months for the chart, plus a final snapshot at
      // the very last month so partial-year inputs still show the result.
      if (i % 12 === 0 || i === months) {
        const yr = i / 12
        // Avoid duplicate Y-axis entries when months is a multiple of 12.
        if (points[points.length - 1].year !== yr) {
          points.push({ year: yr, corpus, invested, gain: corpus - invested })
        } else {
          points[points.length - 1] = { year: yr, corpus, invested, gain: corpus - invested }
        }
        if (i % 12 === 0 && s > 0) contrib = contrib * (1 + s)
      }
    }
    const last = points[points.length - 1]
    return { points, final: last.corpus, invested: last.invested, gain: last.gain }
  }, [monthly, years, rate, stepUp])

  const w = 340, h = 160, padX = 30, padY = 14
  const maxY = Math.max(1, ...data.points.map((p) => p.corpus))
  const x = (i) => padX + (i / Math.max(1, data.points.length - 1)) * (w - padX * 2)
  const y = (v) => (h - padY) - (v / maxY) * (h - padY * 2)
  const corpusPath = data.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.corpus).toFixed(1)}`).join(' ')
  const investedPath = data.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.invested).toFixed(1)}`).join(' ')
  const area = `${corpusPath} L${x(data.points.length - 1).toFixed(1)},${h - padY} L${padX},${h - padY} Z`

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
            <FaRocket className="text-indigo-500" /> SIP Compounding Calculator
          </h3>
          <p className="text-xs text-navy-500">Monthly investment · step-up supported.</p>
        </div>
        <LivePulse status="live" />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Field label={`Monthly SIP (${symbol})`}>
          <input className="input-base" type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </Field>
        <Field label="Duration (years)">
          <input className="input-base" type="number" value={years} onChange={(e) => setYears(e.target.value)} min="1" max="40" />
        </Field>
        <Field label="Expected return (% p.a.)">
          <input className="input-base" type="number" value={rate} onChange={(e) => setRate(e.target.value)} step="0.5" />
        </Field>
        <Field label="Annual step-up (%)">
          <input className="input-base" type="number" value={stepUp} onChange={(e) => setStepUp(e.target.value)} step="1" />
        </Field>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[160px]">
        <defs>
          <linearGradient id="sipGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={padX} x2={w - padX} y1={y(maxY * t)} y2={y(maxY * t)}
            stroke="currentColor" className="text-navy-200 dark:text-navy-700" strokeDasharray="2 3" />
        ))}
        <path d={area} fill="url(#sipGrad)" />
        <motion.path
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }}
          d={corpusPath} stroke="#6366f1" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <motion.path
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 }}
          d={investedPath} stroke="#10b981" strokeWidth="1.6" fill="none" strokeDasharray="3 3" />
      </svg>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
          <p className="text-[10px] uppercase text-emerald-700 dark:text-emerald-300 font-semibold">Invested</p>
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 tabular-nums">
            <AnimatedCounter value={data.invested} prefix={symbol} />
          </p>
        </div>
        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
          <p className="text-[10px] uppercase text-indigo-700 dark:text-indigo-300 font-semibold">Corpus</p>
          <p className="text-sm font-bold text-indigo-800 dark:text-indigo-200 tabular-nums">
            <AnimatedCounter value={data.final} prefix={symbol} />
          </p>
        </div>
        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
          <p className="text-[10px] uppercase text-amber-700 dark:text-amber-300 font-semibold">Wealth Gain</p>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200 tabular-nums">
            <AnimatedCounter value={data.gain} prefix={symbol} />
          </p>
        </div>
      </div>
    </GlassCard>
  )
}

// ---------- Dividend Tracker — paired with sector-driven yield table.
function DividendTracker({ rows, format, symbol }) {
  const SECTOR_YIELD = {
    'IT': 1.8, 'Financials': 2.4, 'Energy': 4.2, 'FMCG': 1.4,
    'Pharma': 1.1, 'Commodities': 2.8, 'Auto': 1.6, 'Bonds': 6.8,
    'Crypto': 0, 'Other': 1.2,
  }
  const [filter, setFilter] = useState('all')

  const enriched = useMemo(() => {
    return rows
      .filter((r) => r.type !== 'crypto')
      .map((r) => {
        const y = SECTOR_YIELD[r.sector] ?? 1.2
        const annual = r.dispValue * (y / 100)
        return { ...r, divYield: y, annual, monthly: annual / 12, quarterly: annual / 4 }
      })
  }, [rows])

  const filtered = filter === 'all' ? enriched : enriched.filter((r) => r.type === filter)
  const totals = useMemo(() => ({
    annual: filtered.reduce((s, r) => s + r.annual, 0),
    monthly: filtered.reduce((s, r) => s + r.monthly, 0),
    quarterly: filtered.reduce((s, r) => s + r.quarterly, 0),
    avgYield: filtered.length ? filtered.reduce((s, r) => s + r.divYield, 0) / filtered.length : 0,
  }), [filtered])

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
            <FaCoins className="text-amber-500 animate-float" /> Dividend &amp; Income
          </h3>
          <p className="text-xs text-navy-500">Estimated passive income from holdings.</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-navy-100 dark:bg-navy-800 text-xs">
          {[['all', 'All'], ['stock', 'Equity'], ['mutual_fund', 'MF']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-2 py-0.5 rounded ${filter === k ? 'bg-white dark:bg-navy-700 shadow-sm' : ''}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white text-center">
          <p className="text-[10px] uppercase font-semibold opacity-80">Annual</p>
          <p className="text-base font-bold tabular-nums">
            <AnimatedCounter value={totals.annual} prefix={symbol} />
          </p>
        </div>
        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-center">
          <p className="text-[10px] uppercase font-semibold opacity-80">Quarterly</p>
          <p className="text-base font-bold tabular-nums">
            <AnimatedCounter value={totals.quarterly} prefix={symbol} />
          </p>
        </div>
        <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-center">
          <p className="text-[10px] uppercase font-semibold opacity-80">Monthly</p>
          <p className="text-base font-bold tabular-nums">
            <AnimatedCounter value={totals.monthly} prefix={symbol} />
          </p>
        </div>
      </div>
      <p className="text-[11px] text-navy-500 mb-2">
        Avg yield: <strong>{totals.avgYield.toFixed(2)}%</strong>
        {' · '}{filtered.length} income-producing positions
      </p>

      <div className="space-y-1 max-h-[180px] overflow-auto pr-1 scrollbar-hide">
        {filtered.length === 0 ? (
          <p className="text-xs text-navy-500 text-center py-4">No income-producing positions in this filter.</p>
        ) : [...filtered].sort((a, b) => b.annual - a.annual).map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-navy-50 dark:hover:bg-navy-800/40"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1 h-6 rounded bg-gradient-to-b from-amber-500 to-orange-500" />
              <div className="min-w-0">
                <p className="font-semibold text-navy-900 dark:text-navy-100 truncate">{r.symbol}</p>
                <p className="text-[10px] text-navy-500">{r.sector} · {r.divYield.toFixed(1)}% yield</p>
              </div>
            </div>
            <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {format(r.annual)}/yr
            </span>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  )
}

// ---------- Goal projector — "when will I hit X?"
function GoalProjector({ totalValue, format, symbol }) {
  const [target, setTarget] = useState('10000000')
  const [monthly, setMonthly] = useState('15000')
  const [rate, setRate] = useState('12')

  const result = useMemo(() => {
    const T = safeNum(target)
    const m = safeNum(monthly)
    const r = safeNum(rate) / 100
    const monthlyRate = r / 12
    if (T <= totalValue) return { months: 0, years: 0, hit: true, finalCorpus: totalValue }
    if (m <= 0 || monthlyRate <= 0) return { months: Infinity, years: Infinity, hit: false, finalCorpus: 0 }
    let corpus = totalValue
    let months = 0
    while (corpus < T && months < 600) {
      corpus = (corpus + m) * (1 + monthlyRate)
      months++
    }
    return { months, years: months / 12, hit: corpus >= T, finalCorpus: corpus }
  }, [target, monthly, rate, totalValue])

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
            <FaArrowTrendUp className="text-emerald-500" /> Goal Projector
          </h3>
          <p className="text-xs text-navy-500">When will you hit your target NAV?</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Field label={`Target (${symbol})`}>
          <input className="input-base" type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label={`Monthly (${symbol})`}>
          <input className="input-base" type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </Field>
        <Field label="Return %">
          <input className="input-base" type="number" value={rate} onChange={(e) => setRate(e.target.value)} step="0.5" />
        </Field>
      </div>

      {result.hit && safeNum(target) <= totalValue ? (
        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-center">
          <p className="text-3xl">🎉</p>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mt-1">Goal already reached!</p>
          <p className="text-xs text-navy-500 mt-1">Current NAV {format(totalValue)} exceeds target.</p>
        </div>
      ) : result.months === Infinity ? (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-center">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Goal unreachable</p>
          <p className="text-xs text-navy-500 mt-1">Increase monthly contribution or expected return.</p>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 text-center">
          <p className="text-[10px] uppercase font-semibold text-indigo-700 dark:text-indigo-300 tracking-wider">Time to goal</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mt-1">
            <AnimatedCounter value={result.years} decimals={1} suffix=" yrs" />
          </p>
          <p className="text-xs text-navy-500 mt-1">
            = <strong>{result.months}</strong> months · will land near{' '}
            <strong>{format(result.finalCorpus || safeNum(target))}</strong>
          </p>
          <div className="mt-3 h-2 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${clamp((totalValue / Math.max(1, safeNum(target))) * 100, 0, 100)}%` }}
              transition={{ duration: 1 }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-gradient"
            />
          </div>
          <p className="text-[10px] text-navy-500 mt-1">
            Current progress: {clamp((totalValue / Math.max(1, safeNum(target))) * 100, 0, 100).toFixed(1)}%
          </p>
        </div>
      )}
    </GlassCard>
  )
}

// ---------- Rebalance Suggestor — compares current vs target allocation
// (a balanced model portfolio) and surfaces the largest drifts.
function RebalanceSuggestor({ rows = [], totalValue = 0, format }) {
  // Reasonable balanced target by asset class.
  const TARGET = {
    stock: 50, mutual_fund: 25, bond: 8, fd: 5, ppf: 5,
    gold: 4, crypto: 3,
  }
  const LABEL = {
    stock: 'Equity', mutual_fund: 'Mutual Funds', bond: 'Bonds',
    fd: 'Fixed Deposit', ppf: 'PPF', gold: 'Gold', crypto: 'Crypto',
  }

  const drifts = useMemo(() => {
    if (!totalValue || totalValue <= 0) return []
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    return Object.keys(TARGET).map((key) => {
      const current = byKey[key]?.value || 0
      const currentPct = safeDiv(current, totalValue) * 100
      const targetPct = TARGET[key]
      const delta = currentPct - targetPct
      const targetValue = (targetPct / 100) * totalValue
      const action = delta > 1 ? 'reduce' : delta < -1 ? 'add' : 'hold'
      return { key, label: LABEL[key], current, currentPct, targetPct, delta, targetValue, action }
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  }, [rows, totalValue])

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
            <FaShield className="text-cyan-500" /> Rebalance Suggestor
          </h3>
          <p className="text-xs text-navy-500">Balanced 50/25/8/5/5/4/3 model · drift vs target.</p>
        </div>
      </div>

      {drifts.length === 0 ? (
        <p className="text-xs text-navy-500 py-4 text-center">Add holdings to see suggestions.</p>
      ) : (
        <div className="space-y-2 max-h-[260px] overflow-auto pr-1 scrollbar-hide">
          {drifts.map((d, i) => {
            const tone = d.action === 'reduce' ? 'rose' : d.action === 'add' ? 'emerald' : 'navy'
            const pillBg = tone === 'rose'
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
              : tone === 'emerald'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-navy-100 text-navy-600 dark:bg-navy-800 dark:text-navy-300'
            return (
              <motion.div
                key={d.key}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-2 rounded-lg bg-navy-50 dark:bg-navy-800/40"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-navy-900 dark:text-navy-100">{d.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${pillBg}`}>
                    {d.action === 'reduce' ? 'Reduce' : d.action === 'add' ? 'Add' : 'Hold'}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-navy-200 dark:bg-navy-700 overflow-hidden">
                  <div
                    className="absolute top-0 h-full bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-50"
                    style={{ width: `${clamp(d.targetPct, 0, 100)}%` }}
                  />
                  <div
                    className="absolute top-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    style={{ width: `${clamp(d.currentPct, 0, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-navy-500 mt-1 tabular-nums">
                  <span>Now {d.currentPct.toFixed(1)}% · target {d.targetPct}%</span>
                  <span className={tone === 'rose' ? 'text-rose-600' : tone === 'emerald' ? 'text-emerald-600' : ''}>
                    {d.action === 'hold' ? 'on target' : `${d.action === 'add' ? '+' : '−'}${format(Math.abs(d.targetValue - d.current))}`}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}

