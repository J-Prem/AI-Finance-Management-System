import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from 'react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FaMagnifyingGlass, FaArrowUp, FaArrowDown, FaArrowsRotate, FaTrashCan, FaPlus,
  FaTableCells, FaChartSimple, FaBitcoin, FaIndustry, FaGem, FaBolt,
  FaArrowRightArrowLeft, FaNewspaper, FaGlobe, FaClock, FaFire, FaStar,
} from 'react-icons/fa6'
import Layout from '../components/common/Layout'
import CurrencySwitcher from '../components/common/CurrencySwitcher'
import {
  LivePulse, PriceFlash, AnimatedCounter, Sparkline, CountdownChip,
  MetricDelta, Skeleton, useTickingSeries, Tooltip,
} from '../components/common/Realtime'
import { useCurrency, CURRENCY_META } from '../contexts/CurrencyContext'
import { safeNum, safeDiv, clamp, fmtCompact } from '../utils/safe'
import api from '../services/api'

const WATCHLIST_KEY = 'market_watchlist_v2'

function loadWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY)
    const list = raw ? JSON.parse(raw) : null
    if (Array.isArray(list) && list.length) return list
  } catch {}
  return ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'AAPL', 'MSFT', 'BTC-USD']
}
function saveWatchlist(list) {
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)) } catch {}
}

// Sector buckets for the heatmap — loose groupings, safe defaults.
const SECTOR_FOR_SYMBOL = (sym = '') => {
  const s = sym.toUpperCase()
  if (/BTC|ETH|SOL|BNB|XRP|DOT|ADA|USDT|-USD/.test(s)) return 'Crypto'
  if (/BANK|HDFC|ICICI|AXIS|KOTAK|SBI|JPM|GS|MS|WFC/.test(s)) return 'Financials'
  if (/TCS|INFY|WIPRO|HCLT|TECHM|AAPL|MSFT|GOOG|META|NVDA/.test(s)) return 'Technology'
  if (/RELIANCE|ONGC|COAL|POWERGRID|NTPC|XOM|CVX|BP/.test(s)) return 'Energy'
  if (/MARUTI|TATAMOTORS|BAJAJ|HEROMOTO|TSLA|F|GM/.test(s)) return 'Auto'
  if (/SUNPHARMA|CIPLA|DRREDDY|PFE|MRK|JNJ/.test(s)) return 'Pharma'
  if (/ITC|HUL|NESTLE|BRIT|KO|PEP|WMT/.test(s)) return 'Consumer'
  return 'Other'
}

// World market session times for the Economic panel (approx, in IST).
const WORLD_MARKETS = [
  { name: 'Mumbai',   tz: 'Asia/Kolkata',  open: 9.25, close: 15.5,  flag: '🇮🇳' },
  { name: 'Tokyo',    tz: 'Asia/Tokyo',    open: 9,    close: 15,    flag: '🇯🇵' },
  { name: 'Hong Kong',tz: 'Asia/Hong_Kong',open: 9.5,  close: 16,    flag: '🇭🇰' },
  { name: 'London',   tz: 'Europe/London', open: 8,    close: 16.5,  flag: '🇬🇧' },
  { name: 'Frankfurt',tz: 'Europe/Berlin', open: 9,    close: 17.5,  flag: '🇩🇪' },
  { name: 'New York', tz: 'America/New_York', open: 9.5, close: 16,  flag: '🇺🇸' },
]

function isMarketOpen(tz, openF, closeF) {
  try {
    const now = new Date()
    const local = new Date(now.toLocaleString('en-US', { timeZone: tz }))
    const hours = local.getHours() + local.getMinutes() / 60
    const day = local.getDay()
    if (day === 0 || day === 6) return false
    return hours >= openF && hours < closeF
  } catch { return false }
}

export default function MarketPage() {
  const { format, convert, currency, symbol: curSym } = useCurrency()

  const [watchlist, setWatchlist] = useState(loadWatchlist)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [region, setRegion] = useState('GLOBAL')
  const [viewMode, setViewMode] = useState('floor')  // floor | heatmap | crypto | fx | news | econ
  const [fxAmount, setFxAmount] = useState('1000')
  const [fxFrom, setFxFrom] = useState('USD')
  const [fxTo, setFxTo] = useState('INR')
  const [refreshTick, setRefreshTick] = useState(0)
  const searchTimer = useRef(null)

  // ---- Queries ----
  const indicesQ = useQuery(['market-indices', region],
    () => api.get(`/external/stocks/indices?region=${region}`),
    { refetchInterval: 60_000, staleTime: 45_000 })
  const indices = useMemo(() => {
    const d = indicesQ.data?.data?.indices || indicesQ.data?.data || indicesQ.data?.indices || []
    return Array.isArray(d) ? d : []
  }, [indicesQ.data])

  const regionCode = region === 'US' ? 'US' : 'IN'
  const gainersQ = useQuery(['gainers', regionCode],
    () => api.get(`/external/stocks/gainers?region=${regionCode}&limit=10`),
    { refetchInterval: 60_000, staleTime: 45_000 })
  const losersQ = useQuery(['losers', regionCode],
    () => api.get(`/external/stocks/losers?region=${regionCode}&limit=10`),
    { refetchInterval: 60_000, staleTime: 45_000 })
  const gainers = gainersQ.data?.data || []
  const losers  = losersQ.data?.data || []

  const watchQ = useQuery(['watchlist-v2', watchlist.join(',')],
    () => api.get(`/external/stocks/watchlist?symbols=${encodeURIComponent(watchlist.join(','))}`),
    { refetchInterval: 30_000, staleTime: 20_000, enabled: watchlist.length > 0 })
  const watchQuotes = watchQ.data?.data || []

  const cryptoQ = useQuery(['crypto-v2'],
    () => api.get('/external/investments/crypto/market?limit=20&vs=usd'),
    { refetchInterval: 30_000, staleTime: 20_000 })
  const crypto = useMemo(() => {
    const d = cryptoQ.data?.data?.crypto || cryptoQ.data?.data || []
    return Array.isArray(d) ? d : []
  }, [cryptoQ.data])

  const metalsQ = useQuery(['metals-v2'],
    () => api.get('/external/investments/metals'),
    { refetchInterval: 5 * 60_000, staleTime: 5 * 60_000 })
  const metals = metalsQ.data?.data?.metals || metalsQ.data?.data || {}

  const newsQ = useQuery(['financial-news-v2'],
    () => api.get('/external/news/financial?q=markets'),
    { refetchInterval: 2 * 60_000, staleTime: 2 * 60_000, retry: 0 })
  const news = useMemo(() => {
    const list = newsQ.data?.data?.articles || newsQ.data?.data?.news || newsQ.data?.articles || []
    return (Array.isArray(list) ? list : []).map((n, i) => ({
      id: n.id || n.url || i,
      title: n.title || n.headline || '',
      summary: n.summary || n.description || '',
      source: n.source?.name || n.source || 'Wire',
      url: n.url || n.link || '#',
      time: n.publishedAt || n.time || '',
    })).filter((x) => x.title)
  }, [newsQ.data])

  // Econ / inflation data
  const econQ = useQuery(['economy'],
    () => api.get('/external/economy/inflation'),
    { refetchInterval: 10 * 60_000, staleTime: 10 * 60_000, retry: 0 })

  // Symbol search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!search || search.length < 2) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/external/stocks/search?q=${encodeURIComponent(search)}`)
        const rows = res?.data?.results || res?.data?.data?.results || []
        setSearchResults(rows.slice(0, 10))
      } catch {}
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  const addSym = (sym) => {
    const next = Array.from(new Set([...watchlist, String(sym).toUpperCase()]))
    setWatchlist(next); saveWatchlist(next)
    setSearch(''); setSearchResults([])
  }
  const delSym = (sym) => {
    const next = watchlist.filter((x) => x !== sym)
    setWatchlist(next); saveWatchlist(next)
  }

  const refreshAll = () => {
    indicesQ.refetch(); gainersQ.refetch(); losersQ.refetch()
    watchQ.refetch(); cryptoQ.refetch(); metalsQ.refetch(); econQ.refetch()
    setRefreshTick((v) => v + 1)
  }
  const anyLoading = indicesQ.isFetching || gainersQ.isFetching || watchQ.isFetching || cryptoQ.isFetching
  const connStatus = anyLoading ? 'connecting' : (indices.length ? 'live' : 'delayed')

  // ---- Breadth / market pulse ----
  const breadth = useMemo(() => {
    const all = [...gainers, ...losers]
    const ups = all.filter((x) => safeNum(x.changePercent) > 0).length
    const dns = all.filter((x) => safeNum(x.changePercent) < 0).length
    return { ups, dns, ratio: safeDiv(ups, ups + dns) * 100 }
  }, [gainers, losers])

  const tickerItems = useMemo(() => {
    const ix = indices.slice(0, 6).map((i) => ({ label: i.symbol || i.name, price: safeNum(i.value), pct: safeNum(i.changePercent) }))
    const top = watchQuotes.slice(0, 6).map((q) => ({ label: q.symbol, price: safeNum(q.price), pct: safeNum(q.changePercent) }))
    return [...ix, ...top]
  }, [indices, watchQuotes])

  // Heatmap data: group watchlist quotes by sector, compute weighted %.
  const heatmap = useMemo(() => {
    const bySector = {}
    watchQuotes.forEach((q) => {
      const sec = SECTOR_FOR_SYMBOL(q.symbol)
      if (!bySector[sec]) bySector[sec] = []
      bySector[sec].push({
        symbol: q.symbol,
        price: safeNum(q.price),
        pct: safeNum(q.changePercent),
        cap: safeNum(q.marketCap) || safeNum(q.price) * 1e6,
      })
    })
    return Object.entries(bySector).map(([sec, rows]) => ({ sec, rows }))
  }, [watchQuotes])

  // Currency converter — live
  const fxResult = useMemo(() => {
    const a = safeNum(fxAmount)
    return convert(a, fxFrom, fxTo)
  }, [fxAmount, fxFrom, fxTo, convert])

  return (
    <Layout>
      <div className="space-y-6 relative">
        {/* Mesh backdrop */}
        <div className="absolute inset-0 mesh-bg pointer-events-none rounded-xl -z-10" aria-hidden />

        {/* Ticker tape */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 dark:from-black dark:via-navy-950 dark:to-black text-white border border-navy-700 shadow-lg">
          <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-navy-900 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-navy-900 to-transparent z-10 pointer-events-none" />
          <div className="flex gap-8 py-2 whitespace-nowrap ticker-scroll">
            {tickerItems.concat(tickerItems).map((t, i) => {
              const up = t.pct >= 0
              return (
                <span key={i} className="inline-flex items-center gap-2 text-xs px-3">
                  <span className="text-navy-300">{t.label}</span>
                  <span className="font-semibold tabular-nums">
                    <PriceFlash value={t.price}>{t.price ? t.price.toLocaleString() : '—'}</PriceFlash>
                  </span>
                  <span className={up ? 'text-emerald-400' : 'text-rose-400'}>
                    {up ? '▲' : '▼'} {Math.abs(t.pct).toFixed(2)}%
                  </span>
                </span>
              )
            })}
          </div>
          <style>{`
            .ticker-scroll { animation: tickerScroll 60s linear infinite; }
            @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
            .ticker-scroll:hover { animation-play-state: paused; }
          `}</style>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
                <FaBolt size={11} /> TRADING FLOOR
              </div>
              <LivePulse status={connStatus} />
              <CountdownChip seconds={60} trigger={refreshTick} />
            </div>
            <h1 className="text-3xl font-bold text-navy-900 dark:text-navy-100 bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 bg-clip-text text-transparent animate-gradient">
              Market Center
            </h1>
            <p className="text-navy-600 dark:text-navy-400 mt-1">
              Live indices · sector heatmap · watchlist · crypto · FX · metals · economic data.
              <span className="ml-2">Breadth: <strong className="text-emerald-600">{breadth.ups}↑</strong> / <strong className="text-rose-600">{breadth.dns}↓</strong></span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CurrencySwitcher />
            <div className="inline-flex rounded-lg bg-navy-100 dark:bg-navy-800 p-1">
              {['GLOBAL', 'IN', 'US'].map((r) => (
                <motion.button
                  key={r}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRegion(r)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                    region === r ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-navy-100 shadow' : 'text-navy-600 dark:text-navy-400'
                  }`}
                >
                  {r === 'GLOBAL' ? 'Global' : r === 'IN' ? 'India' : 'US'}
                </motion.button>
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
              onClick={refreshAll}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold shadow-md shadow-rose-500/20"
            >
              <FaArrowsRotate size={12} className={anyLoading ? 'animate-spin' : ''} /> Pulse
            </motion.button>
          </div>
        </div>

        {/* Indices */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {indices.length === 0 && indicesQ.isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-3">
                  <Skeleton w="60%" h={10} className="mb-2" />
                  <Skeleton w="80%" h={22} className="mb-1" />
                  <Skeleton w="50%" h={10} />
                </div>
              ))
            : indices.slice(0, 8).map((ix, i) => (
                <IndexCard key={ix.symbol || ix.name || i} ix={ix} i={i} />
              ))}
        </div>

        {/* Market pulse — sentiment, breadth, volatility */}
        <MarketPulse
          indices={indices}
          gainers={gainers}
          losers={losers}
          breadth={breadth}
        />

        {/* View tabs */}
        <div className="flex items-center gap-1 border-b border-navy-200 dark:border-navy-700 overflow-x-auto scrollbar-hide">
          {[
            { id: 'floor',   label: 'Trading Floor',  icon: <FaChartSimple /> },
            { id: 'heatmap', label: 'Sector Heatmap', icon: <FaTableCells /> },
            { id: 'crypto',  label: 'Crypto & Metals',icon: <FaBitcoin /> },
            { id: 'fx',      label: 'FX Terminal',    icon: <FaArrowRightArrowLeft /> },
            { id: 'econ',    label: 'Global & Econ',  icon: <FaGlobe /> },
            { id: 'news',    label: 'News Wire',      icon: <FaNewspaper /> },
          ].map((t) => (
            <motion.button
              key={t.id}
              whileHover={{ y: -1 }}
              onClick={() => setViewMode(t.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition whitespace-nowrap ${
                viewMode === t.id
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-navy-600 dark:text-navy-400 hover:text-navy-900'
              }`}
            >
              {t.icon} {t.label}
              {viewMode === t.id && (
                <motion.span layoutId="market-tab-underline" className="absolute left-0 right-0 -bottom-px h-0.5 bg-gradient-to-r from-rose-500 to-pink-500" />
              )}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* FLOOR VIEW */}
          {viewMode === 'floor' && (
            <motion.div
              key="floor"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MoversCard title="Top Gainers" rows={gainers} positive />
                <MoversCard title="Top Losers"  rows={losers}  />
              </div>

              {/* Watchlist */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="font-semibold text-navy-900 dark:text-navy-100 inline-flex items-center gap-2">
                    <FaStar className="text-amber-500" /> Watchlist
                  </h3>
                  <span className="text-xs text-navy-500 inline-flex items-center gap-3">
                    {watchlist.length} symbols · auto-refresh 30s
                    {watchQ.isFetching && <span className="inline-flex items-center gap-1 text-primary-500"><span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-ping" /> syncing</span>}
                  </span>
                </div>
                <div className="relative mb-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" size={14} />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Add symbol (e.g. RELIANCE.NS, AAPL, BTC-USD)"
                        className="w-full pl-9 pr-3 py-2 bg-navy-50 dark:bg-navy-800 border border-navy-200 dark:border-navy-700 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition"
                      />
                    </div>
                    {search && !searchResults.length && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => addSym(search)} className="px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm flex items-center gap-1"
                      >
                        <FaPlus size={12} /> Add
                      </motion.button>
                    )}
                  </div>
                  {searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                      className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl"
                    >
                      {searchResults.map((r, i) => (
                        <motion.button
                          key={r.symbol}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => addSym(r.symbol)}
                          className="flex items-center justify-between w-full px-3 py-2 hover:bg-navy-50 dark:hover:bg-navy-800 text-left"
                        >
                          <div>
                            <p className="font-medium text-sm">{r.symbol}</p>
                            <p className="text-xs text-navy-500">{r.name}</p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-navy-100 dark:bg-navy-800">{r.exchange || r.type}</span>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </div>
                {watchlist.length === 0 ? (
                  <p className="text-sm text-navy-500">Add symbols to start tracking.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-navy-600 dark:text-navy-400">
                        <tr className="border-b border-navy-200 dark:border-navy-700">
                          <th className="text-left py-2 px-2">Symbol</th>
                          <th className="text-left py-2 px-2">Trend</th>
                          <th className="text-right py-2 px-2">Price ({currency})</th>
                          <th className="text-right py-2 px-2">Change</th>
                          <th className="text-right py-2 px-2">Day Range</th>
                          <th className="text-right py-2 px-2">52w</th>
                          <th className="py-2 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {watchlist.map((sym) => {
                          const q = watchQuotes.find((x) => x.symbol === sym) || {}
                          return (
                            <WatchRow key={sym} sym={sym} q={q} currency={currency}
                              format={format} onDel={() => delSym(sym)} />
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* HEATMAP VIEW */}
          {viewMode === 'heatmap' && (
            <motion.div
              key="heatmap"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="card p-5"
            >
              <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-1 inline-flex items-center gap-2">
                <FaFire className="text-rose-500" /> Sector heatmap
              </h3>
              <p className="text-xs text-navy-500 mb-4">Tile size ∝ market cap proxy. Color = today&apos;s % move (red ↓ / green ↑).</p>
              {heatmap.length === 0 ? (
                <p className="text-sm text-navy-500">Add watchlist symbols to populate the heatmap.</p>
              ) : (
                <div className="space-y-4">
                  {heatmap.map(({ sec, rows }) => {
                    const total = rows.reduce((s, r) => s + Math.max(1, r.cap), 0)
                    return (
                      <div key={sec}>
                        <p className="text-xs uppercase tracking-wider font-semibold text-navy-500 mb-2">{sec}</p>
                        <div className="flex gap-1 flex-wrap">
                          {rows.map((r, i) => {
                            const pct = safeDiv(Math.max(1, r.cap), total)
                            const size = clamp(pct * 100, 10, 45)
                            const heat = clamp(r.pct * 15, -100, 100)
                            const bg = heat >= 0
                              ? `rgba(16, 185, 129, ${0.2 + Math.abs(heat) / 140})`
                              : `rgba(239, 68, 68, ${0.2 + Math.abs(heat) / 140})`
                            return (
                              <motion.div
                                key={r.symbol}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.03 }}
                                whileHover={{ scale: 1.07, zIndex: 10 }}
                                className="rounded-lg text-white flex flex-col items-center justify-center text-xs font-semibold p-2 min-w-[85px] cursor-pointer shadow-sm"
                                style={{ flexBasis: `${size}%`, background: bg }}
                                title={`${r.symbol} · ${r.pct.toFixed(2)}%`}
                              >
                                <span className="tabular-nums">{r.symbol.replace('.NS', '').slice(0, 7)}</span>
                                <span className="tabular-nums">{r.pct >= 0 ? '+' : ''}{r.pct.toFixed(2)}%</span>
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* CRYPTO & METALS */}
          {viewMode === 'crypto' && (
            <motion.div
              key="crypto"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-navy-900 dark:text-navy-100 inline-flex items-center gap-2">
                    <FaBitcoin className="text-amber-500" /> Crypto · Top {crypto.length}
                  </h3>
                  {cryptoQ.isFetching && <LivePulse status="connecting" label="SYNCING" />}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-navy-600 dark:text-navy-400">
                      <tr className="border-b border-navy-200 dark:border-navy-700">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">Asset</th>
                        <th className="text-left py-2 px-2">24h</th>
                        <th className="text-right py-2 px-2">Price</th>
                        <th className="text-right py-2 px-2">Δ</th>
                        <th className="text-right py-2 px-2">Market Cap</th>
                        <th className="text-right py-2 px-2">Vol 24h</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crypto.map((c, i) => (
                        <CryptoRow key={c.id || c.symbol || i} c={c} i={i} format={format} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetalCard label="Gold" icon={<FaGem />}
                  value={metals?.gold?.price} cur={metals?.gold?.currency || 'INR'} change={metals?.gold?.change}
                  accent="from-yellow-500 to-amber-500" />
                <MetalCard label="Silver" icon={<FaGem />}
                  value={metals?.silver?.price} cur={metals?.silver?.currency || 'INR'} change={metals?.silver?.change}
                  accent="from-slate-400 to-slate-600" />
                <MetalCard label="Crude Oil" icon={<FaIndustry />}
                  value={metals?.oil?.price} cur={metals?.oil?.currency || 'USD'} change={metals?.oil?.change}
                  accent="from-rose-500 to-pink-500" />
              </div>
            </motion.div>
          )}

          {/* FX TERMINAL */}
          {viewMode === 'fx' && (
            <motion.div
              key="fx"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2 card p-5">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-4 inline-flex items-center gap-2">
                  <FaArrowRightArrowLeft className="text-primary-500" /> Live FX terminal
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-navy-500 mb-1">From</label>
                    <div className="flex gap-2">
                      <select
                        value={fxFrom} onChange={(e) => setFxFrom(e.target.value)}
                        className="input-base w-28"
                      >
                        {Object.keys(CURRENCY_META).map((c) => <option key={c} value={c}>{CURRENCY_META[c].flag} {c}</option>)}
                      </select>
                      <input
                        type="number" value={fxAmount} step="any"
                        onChange={(e) => setFxAmount(e.target.value)}
                        className="input-base flex-1" placeholder="Amount"
                      />
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}
                    onClick={() => { const p = fxFrom; setFxFrom(fxTo); setFxTo(p) }}
                    className="h-10 px-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-white"
                    title="Swap"
                  >
                    <FaArrowRightArrowLeft />
                  </motion.button>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-navy-500 mb-1">To</label>
                    <div className="flex gap-2">
                      <select
                        value={fxTo} onChange={(e) => setFxTo(e.target.value)}
                        className="input-base w-28"
                      >
                        {Object.keys(CURRENCY_META).map((c) => <option key={c} value={c}>{CURRENCY_META[c].flag} {c}</option>)}
                      </select>
                      <input
                        readOnly value={fxResult.toFixed(2)}
                        className="input-base flex-1 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300 font-semibold tabular-nums"
                      />
                    </div>
                  </div>
                </div>
                <motion.div
                  key={`${fxFrom}-${fxTo}-${fxAmount}`}
                  initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 p-4 rounded-lg bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-900/10 dark:via-teal-900/10 dark:to-emerald-900/10 border border-emerald-200 dark:border-emerald-800"
                >
                  <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                    <AnimatedCounter value={safeNum(fxAmount)} decimals={2} /> {fxFrom} ={' '}
                    <AnimatedCounter value={fxResult} decimals={4} /> {fxTo}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    Rate: 1 {fxFrom} = {convert(1, fxFrom, fxTo).toFixed(6)} {fxTo}
                  </p>
                </motion.div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[['USD','INR'], ['EUR','USD'], ['GBP','INR'], ['USD','JPY']].map(([f, t]) => (
                    <motion.button
                      key={`${f}-${t}`}
                      whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                      onClick={() => { setFxFrom(f); setFxTo(t) }}
                      className="p-2 rounded-lg bg-navy-100 dark:bg-navy-800 hover:bg-primary-100 dark:hover:bg-primary-900/20 text-sm font-medium"
                    >
                      {CURRENCY_META[f].flag} {f} → {t} {CURRENCY_META[t].flag}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Cross rates vs {curSym}</h3>
                <div className="space-y-2">
                  {Object.keys(CURRENCY_META).filter((c) => c !== currency).slice(0, 10).map((c, i) => {
                    const r = convert(1, c, currency)
                    return (
                      <motion.div
                        key={c}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between text-sm py-1 border-b border-navy-100 dark:border-navy-800 last:border-0"
                      >
                        <span>{CURRENCY_META[c].flag} 1 {c}</span>
                        <span className="font-semibold tabular-nums">{r.toFixed(4)} {currency}</span>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ECONOMIC / GLOBAL MARKETS */}
          {viewMode === 'econ' && (
            <motion.div
              key="econ"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="card p-5">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3 inline-flex items-center gap-2">
                  <FaGlobe className="text-primary-500" /> Global Market Sessions
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {WORLD_MARKETS.map((m, i) => {
                    const open = isMarketOpen(m.tz, m.open, m.close)
                    let local = ''
                    try { local = new Date().toLocaleTimeString('en-US', { timeZone: m.tz, hour: '2-digit', minute: '2-digit' }) } catch {}
                    return (
                      <motion.div
                        key={m.name}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className={`relative rounded-lg p-3 border overflow-hidden ${
                          open ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                               : 'bg-navy-50 dark:bg-navy-800/40 border-navy-200 dark:border-navy-700'
                        }`}
                      >
                        {open && <div className="absolute inset-x-0 top-0 h-0.5 status-bar" />}
                        <div className="flex items-center justify-between">
                          <span className="text-xl">{m.flag}</span>
                          <LivePulse status={open ? 'live' : 'offline'} label={open ? 'OPEN' : 'CLOSED'} />
                        </div>
                        <p className="mt-1 font-semibold text-sm">{m.name}</p>
                        <p className="text-xs text-navy-500 inline-flex items-center gap-1"><FaClock size={9} /> {local}</p>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-5">
                  <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Economic indicators</h3>
                  <IndicatorRow label="India CPI (inflation)" value={safeNum(econQ.data?.data?.inflationRate ?? econQ.data?.inflationRate, 4.8)} suffix="%" good={(v) => v <= 4} />
                  <IndicatorRow label="RBI repo rate" value={6.5} suffix="%" good={() => true} />
                  <IndicatorRow label="US 10Y yield"  value={4.25} suffix="%" good={() => true} />
                  <IndicatorRow label="Brent crude"   value={safeNum(metals?.oil?.price, 82)} prefix="$" suffix="/bbl" good={(v) => v < 90} />
                  <IndicatorRow label="DXY (USD idx)" value={103.5} good={() => true} />
                </div>
                <div className="card p-5">
                  <h3 className="font-semibold text-navy-900 dark:text-navy-100 mb-3">Upcoming data & events</h3>
                  <ul className="space-y-2 text-sm">
                    {[
                      { d: 'Fri', label: 'US Non-Farm Payrolls', impact: 'high' },
                      { d: 'Tue', label: 'India WPI Inflation',  impact: 'med' },
                      { d: 'Wed', label: 'FOMC meeting minutes', impact: 'high' },
                      { d: 'Thu', label: 'ECB rate decision',    impact: 'high' },
                      { d: 'Fri', label: 'India Industrial Production', impact: 'med' },
                    ].map((e, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 border-b border-navy-100 dark:border-navy-800 pb-2 last:border-0"
                      >
                        <span className="w-10 text-xs font-bold text-center px-2 py-1 rounded bg-navy-100 dark:bg-navy-800">{e.d}</span>
                        <span className="flex-1">{e.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          e.impact === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}>{e.impact.toUpperCase()}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* NEWS WIRE */}
          {viewMode === 'news' && (
            <motion.div
              key="news"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-navy-900 dark:text-navy-100 inline-flex items-center gap-2">
                  <FaNewspaper className="text-primary-500" /> Financial news wire
                </h3>
                {newsQ.isFetching && <LivePulse status="connecting" label="REFRESHING" />}
              </div>
              {news.length === 0 ? (
                <p className="text-sm text-navy-500">News feed is unavailable — try Pulse in a moment.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {news.slice(0, 12).map((n, i) => (
                    <motion.a
                      key={n.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      whileHover={{ y: -2, scale: 1.01 }}
                      href={n.url} target="_blank" rel="noreferrer"
                      className="block p-4 rounded-lg border border-navy-200 dark:border-navy-700 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-navy-50 dark:hover:bg-navy-800/40 transition"
                    >
                      <p className="font-medium text-sm text-navy-900 dark:text-navy-100 mb-1">{n.title}</p>
                      {n.summary && <p className="text-xs text-navy-600 dark:text-navy-400 line-clamp-2">{n.summary}</p>}
                      <p className="text-[10px] text-navy-500 mt-2">{n.source}{n.time ? ` · ${new Date(n.time).toLocaleString()}` : ''}</p>
                    </motion.a>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  )
}

function IndexCard({ ix, i }) {
  const chg = safeNum(ix.changePercent)
  const up = chg >= 0
  const series = useTickingSeries(ix.symbol || ix.name, { base: safeNum(ix.value) || 100, volatility: 0.003, length: 28, intervalMs: 4000 })
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      whileHover={{ y: -3, scale: 1.02 }}
      className="card p-3 relative overflow-hidden hover-lift"
    >
      <div className={`absolute top-0 left-0 right-0 h-1 ${up ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : 'bg-gradient-to-r from-rose-400 to-pink-400'}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-navy-500">{ix.symbol}</p>
          <p className="text-lg font-bold tabular-nums text-navy-900 dark:text-navy-100">
            <PriceFlash value={safeNum(ix.value)}>
              <AnimatedCounter value={safeNum(ix.value)} decimals={2} />
            </PriceFlash>
          </p>
          <p className="text-[11px] text-navy-500 truncate max-w-[120px]">{ix.name}</p>
        </div>
        <Sparkline points={series} width={60} height={28} color={up ? '#10b981' : '#ef4444'} />
      </div>
      <p className={`text-xs font-semibold mt-1 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
        {up ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
        {Number.isFinite(safeNum(ix.change)) ? ` (${safeNum(ix.change).toFixed(2)})` : ''}
      </p>
    </motion.div>
  )
}

function WatchRow({ sym, q, currency, format, onDel }) {
  const chg = safeNum(q.changePercent)
  const up = chg >= 0
  const quoteCur = q.currency || (sym.endsWith('.NS') || sym.endsWith('.BO') ? 'INR' : 'USD')
  const series = useTickingSeries(sym, { base: safeNum(q.price) || 100, volatility: 0.005, length: 24, intervalMs: 3500 })
  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="border-b border-navy-100 dark:border-navy-800 hover:bg-navy-50/50 dark:hover:bg-navy-800/30"
    >
      <td className="py-2 px-2">
        <p className="font-semibold">{sym}</p>
        <p className="text-xs text-navy-500 truncate max-w-[240px]">{q.name || '—'}</p>
      </td>
      <td className="py-2 px-2">
        <Sparkline points={series} width={72} height={24} color={up ? '#10b981' : '#ef4444'} />
      </td>
      <td className="py-2 px-2 text-right font-semibold tabular-nums">
        <PriceFlash value={safeNum(q.price)}>
          {safeNum(q.price) > 0 ? format(q.price, quoteCur) : '—'}
        </PriceFlash>
      </td>
      <td className={`py-2 px-2 text-right font-medium ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
        <span className="inline-flex items-center gap-1 justify-end">
          {up ? <FaArrowUp size={10} /> : <FaArrowDown size={10} />}
          {Number.isFinite(chg) ? Math.abs(chg).toFixed(2) + '%' : '—'}
        </span>
      </td>
      <td className="py-2 px-2 text-right text-xs tabular-nums text-navy-600 dark:text-navy-400">
        {safeNum(q.low) > 0 && safeNum(q.high) > 0
          ? `${safeNum(q.low).toFixed(2)} – ${safeNum(q.high).toFixed(2)}` : '—'}
      </td>
      <td className="py-2 px-2 text-right text-xs tabular-nums text-navy-600 dark:text-navy-400">
        {safeNum(q.fiftyTwoWeekLow) > 0 && safeNum(q.fiftyTwoWeekHigh) > 0
          ? `${Math.round(safeNum(q.fiftyTwoWeekLow))}–${Math.round(safeNum(q.fiftyTwoWeekHigh))}` : '—'}
      </td>
      <td className="py-2 px-2 text-right">
        <button onClick={onDel} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition"><FaTrashCan size={13} /></button>
      </td>
    </motion.tr>
  )
}

function CryptoRow({ c, i, format }) {
  const up = safeNum(c.change24h) >= 0
  const priceUsd = safeNum(c.price)
  const series = useTickingSeries(c.id || c.symbol, { base: priceUsd || 100, volatility: 0.012, length: 26, intervalMs: 3200 })
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 10) * 0.02 }}
      className="border-b border-navy-100 dark:border-navy-800 hover:bg-navy-50/50 dark:hover:bg-navy-800/30"
    >
      <td className="py-2 px-2 text-navy-500">{c.marketCapRank || i + 1}</td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-2">
          {c.image && <img src={c.image} alt="" width={20} height={20} className="rounded-full" />}
          <div>
            <p className="font-semibold">{c.symbol}</p>
            <p className="text-xs text-navy-500">{c.name}</p>
          </div>
        </div>
      </td>
      <td className="py-2 px-2">
        <Sparkline points={series} width={72} height={22} color={up ? '#10b981' : '#ef4444'} />
      </td>
      <td className="py-2 px-2 text-right font-semibold tabular-nums">
        <PriceFlash value={priceUsd}>{format(priceUsd, 'USD')}</PriceFlash>
      </td>
      <td className={`py-2 px-2 text-right font-medium ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
        {up ? '+' : ''}{safeNum(c.change24h).toFixed(2)}%
      </td>
      <td className="py-2 px-2 text-right text-xs tabular-nums">${fmtCompact(c.marketCap)}</td>
      <td className="py-2 px-2 text-right text-xs text-navy-500 tabular-nums">${fmtCompact(c.volume24h)}</td>
    </motion.tr>
  )
}

function IndicatorRow({ label, value, prefix = '', suffix = '', good }) {
  const ok = good(value)
  return (
    <div className="flex items-center justify-between py-2 border-b border-navy-100 dark:border-navy-800 last:border-0">
      <span className="text-sm text-navy-700 dark:text-navy-300">{label}</span>
      <span className="inline-flex items-center gap-2">
        <span className="font-bold tabular-nums text-navy-900 dark:text-navy-100">
          {prefix}<AnimatedCounter value={safeNum(value)} decimals={2} />{suffix}
        </span>
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      </span>
    </div>
  )
}

function MoversCard({ title, rows, positive }) {
  const color = positive ? 'emerald' : 'rose'
  return (
    <div className="card p-5">
      <h3 className={`font-semibold mb-3 inline-flex items-center gap-2 text-${color}-600 dark:text-${color}-400`}>
        {positive ? <FaArrowUp /> : <FaArrowDown />} {title}
      </h3>
      {!rows?.length ? <p className="text-sm text-navy-500">Loading…</p> : (
        <table className="w-full text-sm">
          <tbody>
            {rows.slice(0, 8).map((r, i) => {
              const chg = safeNum(r.changePercent)
              const up = chg >= 0
              return (
                <motion.tr
                  key={r.symbol}
                  initial={{ opacity: 0, x: positive ? -8 : 8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-navy-100 dark:border-navy-800 last:border-0"
                >
                  <td className="py-2">
                    <p className="font-semibold">{String(r.symbol).replace('.NS', '').replace('.BO', '')}</p>
                    <p className="text-xs text-navy-500 truncate max-w-[200px]">{r.name}</p>
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {safeNum(r.price) > 0 ? safeNum(r.price).toLocaleString() : '—'}
                  </td>
                  <td className={`py-2 text-right font-bold tabular-nums ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                    <MetricDelta pct={chg} size="sm" />
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function MetalCard({ label, icon, value, cur, change, accent }) {
  const v = safeNum(value)
  const chg = safeNum(change)
  const up = chg >= 0
  const prefix = cur === 'INR' ? '₹' : '$'
  const series = useTickingSeries(label, { base: v || 1000, volatility: 0.002, length: 22, intervalMs: 5000 })
  return (
    <motion.div whileHover={{ y: -3 }} className="card p-5 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent} animate-gradient`} />
      <div className="flex items-center gap-2 text-navy-500 text-xs uppercase tracking-wider font-semibold mb-2">
        <span className={`bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>{icon}</span>
        {label}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tabular-nums">
          {v > 0 ? <>{prefix}<AnimatedCounter value={v} decimals={2} /></> : '—'}
        </p>
        <Sparkline points={series} width={80} height={32} color={up ? '#10b981' : '#ef4444'} />
      </div>
      <p className={`text-sm font-medium mt-1 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
        {up ? '▲' : '▼'} {Number.isFinite(chg) ? Math.abs(chg).toFixed(2) : '—'}% today
      </p>
    </motion.div>
  )
}

// -----------------------------------------------------------------------------
// Market pulse widgets — Fear & Greed gauge, Breadth, Volatility
// -----------------------------------------------------------------------------

function MarketPulse({ indices = [], gainers = [], losers = [], breadth }) {
  const score = useMemo(() => {
    const b = clamp(safeNum(breadth?.ratio), 0, 100)
    const avgIxMove = indices.length
      ? indices.reduce((s, i) => s + safeNum(i.changePercent), 0) / indices.length
      : 0
    const momentum = clamp(50 + avgIxMove * 15, 0, 100)
    return clamp(Math.round(b * 0.55 + momentum * 0.45), 0, 100)
  }, [breadth, indices])

  const label = score >= 75 ? 'Extreme Greed'
              : score >= 60 ? 'Greed'
              : score >= 45 ? 'Neutral'
              : score >= 25 ? 'Fear'
              :               'Extreme Fear'
  const color = score >= 75 ? '#10b981'
              : score >= 60 ? '#22c55e'
              : score >= 45 ? '#f59e0b'
              : score >= 25 ? '#f97316'
              :               '#ef4444'

  const vol = useMemo(() => {
    const all = [...gainers, ...losers].map((x) => safeNum(x.changePercent))
    if (!all.length) return 0
    const m = all.reduce((s, x) => s + x, 0) / all.length
    const v = all.reduce((s, x) => s + (x - m) ** 2, 0) / all.length
    return Math.sqrt(v)
  }, [gainers, losers])

  const volLabel = vol < 1 ? 'Calm' : vol < 2 ? 'Normal' : vol < 3.5 ? 'Elevated' : 'Turbulent'
  const volColor = vol < 1 ? 'text-emerald-500' : vol < 2 ? 'text-sky-500' : vol < 3.5 ? 'text-amber-500' : 'text-rose-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      <div className="card p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 animate-gradient" />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-navy-500 mb-2 inline-flex items-center gap-1">
          <FaBolt size={10} /> Market Sentiment
        </p>
        <FearGreedGauge score={score} color={color} />
        <div className="mt-2 text-center">
          <p className="text-2xl font-bold tabular-nums" style={{ color }}>
            <AnimatedCounter value={score} decimals={0} />
            <span className="text-sm text-navy-500 ml-1">/ 100</span>
          </p>
          <p className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</p>
        </div>
      </div>

      <div className="card p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-rose-400" />
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-navy-500 inline-flex items-center gap-1">
            <FaChartSimple size={10} /> Market Breadth
          </p>
          <span className="text-[10px] text-navy-500">{(gainers.length + losers.length)} tracked</span>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold text-emerald-600 tabular-nums">
            <AnimatedCounter value={breadth?.ups || 0} decimals={0} />
          </span>
          <span className="text-navy-400">vs</span>
          <span className="text-3xl font-bold text-rose-600 tabular-nums">
            <AnimatedCounter value={breadth?.dns || 0} decimals={0} />
          </span>
        </div>
        <BreadthBar ups={breadth?.ups || 0} dns={breadth?.dns || 0} />
        <p className="text-[11px] text-navy-500 mt-2">
          A/D ratio {safeDiv(breadth?.ups || 0, (breadth?.dns || 0) || 1).toFixed(2)}
          {' · '}
          <span className={breadth?.ratio >= 50 ? 'text-emerald-600' : 'text-rose-600'}>
            {breadth?.ratio >= 50 ? 'bullish' : 'bearish'} tilt
          </span>
        </p>
      </div>

      <div className="card p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 animate-gradient" />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-navy-500 mb-2 inline-flex items-center gap-1">
          <FaFire size={10} /> Volatility Pulse
        </p>
        <VolatilityWave vol={vol} />
        <div className="flex items-baseline gap-2 mt-2">
          <p className="text-3xl font-bold tabular-nums text-navy-900 dark:text-navy-100">
            <AnimatedCounter value={vol} decimals={2} />
            <span className="text-xs text-navy-500 ml-1">σ</span>
          </p>
          <p className={`text-sm font-semibold ${volColor}`}>{volLabel}</p>
        </div>
        <p className="text-[11px] text-navy-500 mt-1">Intraday dispersion across movers</p>
      </div>
    </motion.div>
  )
}

function FearGreedGauge({ score = 50, color = '#f59e0b' }) {
  const angle = -90 + (clamp(score, 0, 100) / 100) * 180
  const r = 60
  const cx = 80, cy = 70
  const rad = (angle * Math.PI) / 180
  const needleX = cx + r * Math.cos(rad - Math.PI / 2)
  const needleY = cy + r * Math.sin(rad - Math.PI / 2)
  const zone = (a, b, col) => {
    const aRad = (a - 90) * Math.PI / 180
    const bRad = (b - 90) * Math.PI / 180
    const x1 = cx + r * Math.cos(aRad), y1 = cy + r * Math.sin(aRad)
    const x2 = cx + r * Math.cos(bRad), y2 = cy + r * Math.sin(bRad)
    return <path key={a} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} stroke={col} strokeWidth="10" fill="none" strokeLinecap="butt" />
  }
  return (
    <svg viewBox="0 0 160 90" className="w-full h-28">
      {zone(0,   36,  '#ef4444')}
      {zone(36,  72,  '#f97316')}
      {zone(72,  108, '#f59e0b')}
      {zone(108, 144, '#22c55e')}
      {zone(144, 180, '#10b981')}
      <motion.line
        x1={cx} y1={cy}
        x2={needleX} y2={needleY}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <circle cx={cx} cy={cy} r="4" fill={color} />
    </svg>
  )
}

function BreadthBar({ ups = 0, dns = 0 }) {
  const total = ups + dns || 1
  const upPct = (ups / total) * 100
  return (
    <div className="relative h-3 rounded-full overflow-hidden bg-navy-100 dark:bg-navy-800">
      <motion.div
        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
        initial={{ width: 0 }}
        animate={{ width: `${upPct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute top-0 h-full bg-gradient-to-l from-rose-400 to-rose-500"
        style={{ right: 0, left: `${upPct}%` }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      />
    </div>
  )
}

function VolatilityWave({ vol = 0 }) {
  const amp = clamp(vol * 6, 2, 28)
  const path = (phase, a) => {
    const pts = []
    for (let x = 0; x <= 160; x += 8) {
      const y = 30 + a * Math.sin((x / 160) * Math.PI * 4 + phase)
      pts.push(`${x},${y.toFixed(1)}`)
    }
    return 'M ' + pts.join(' L ')
  }
  return (
    <svg viewBox="0 0 160 60" className="w-full h-16">
      <motion.path
        d={path(0, amp)} stroke="#6366f1" strokeWidth="1.5" fill="none" opacity="0.5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.path
        d={path(1, amp * 0.7)} stroke="#8b5cf6" strokeWidth="1.5" fill="none" opacity="0.7"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.1 }}
      />
      <motion.path
        d={path(2.3, amp * 0.4)} stroke="#0ea5e9" strokeWidth="2" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      />
    </svg>
  )
}
