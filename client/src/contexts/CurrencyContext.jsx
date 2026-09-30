import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { getRates } from '../services/externalApiService'
import { safeNum } from '../utils/safe'

// Default fallbacks (USD base) — used before rates load, and as offline safety.
const FALLBACK_USD_RATES = {
  USD: 1,    EUR: 0.92, GBP: 0.79, INR: 83.20, JPY: 151.5,
  AUD: 1.52, CAD: 1.36, CHF: 0.88, CNY: 7.22,  MXN: 17.1,
  SGD: 1.34, AED: 3.67, HKD: 7.82,
}

export const CURRENCY_META = {
  USD: { symbol: '$',  flag: '🇺🇸', locale: 'en-US', name: 'US Dollar' },
  EUR: { symbol: '€',  flag: '🇪🇺', locale: 'de-DE', name: 'Euro' },
  GBP: { symbol: '£',  flag: '🇬🇧', locale: 'en-GB', name: 'British Pound' },
  INR: { symbol: '₹',  flag: '🇮🇳', locale: 'en-IN', name: 'Indian Rupee' },
  JPY: { symbol: '¥',  flag: '🇯🇵', locale: 'ja-JP', name: 'Japanese Yen' },
  AUD: { symbol: 'A$', flag: '🇦🇺', locale: 'en-AU', name: 'Australian Dollar' },
  CAD: { symbol: 'C$', flag: '🇨🇦', locale: 'en-CA', name: 'Canadian Dollar' },
  CHF: { symbol: 'Fr', flag: '🇨🇭', locale: 'de-CH', name: 'Swiss Franc' },
  CNY: { symbol: '¥',  flag: '🇨🇳', locale: 'zh-CN', name: 'Chinese Yuan' },
  MXN: { symbol: '$',  flag: '🇲🇽', locale: 'es-MX', name: 'Mexican Peso' },
  SGD: { symbol: 'S$', flag: '🇸🇬', locale: 'en-SG', name: 'Singapore Dollar' },
  AED: { symbol: 'د.إ', flag: '🇦🇪', locale: 'en-AE', name: 'UAE Dirham' },
  HKD: { symbol: 'HK$', flag: '🇭🇰', locale: 'en-HK', name: 'Hong Kong Dollar' },
}

const PERSIST_KEY = 'preferred_currency_v1'

const CurrencyCtx = createContext(null)

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    try { return localStorage.getItem(PERSIST_KEY) || 'INR' } catch { return 'INR' }
  })
  const [rates, setRates] = useState(FALLBACK_USD_RATES)   // USD-based
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState('fallback')

  const setCurrency = useCallback((c) => {
    if (!c) return
    setCurrencyState(c)
    try { localStorage.setItem(PERSIST_KEY, c) } catch {}
  }, [])

  // Fetch fresh rates once on mount & every 10 minutes.
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRates('USD')
      const payload = res?.data || res || {}
      const r = payload.rates || payload.data?.rates || payload
      // Only accept if it looks valid (has USD/INR/EUR).
      if (r && typeof r === 'object' && (safeNum(r.INR) > 0 || safeNum(r.EUR) > 0)) {
        const merged = { ...FALLBACK_USD_RATES, ...r, USD: 1 }
        setRates(merged)
        setUpdatedAt(new Date())
        setSource('live')
      }
    } catch {
      // keep fallback
      setSource('fallback')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 10 * 60_000)
    return () => clearInterval(t)
  }, [refresh])

  // Convert between any two ISO currencies with USD as the pivot.
  // Case-insensitive; unknown codes fall back to identity so numbers never vanish.
  const convert = useCallback(
    (amount, from = 'USD', to = currency) => {
      const a = safeNum(amount)
      const F = String(from || 'USD').toUpperCase()
      const T = String(to   || 'USD').toUpperCase()
      if (F === T) return a
      const rFrom = safeNum(rates[F]) || safeNum(FALLBACK_USD_RATES[F])
      const rTo   = safeNum(rates[T]) || safeNum(FALLBACK_USD_RATES[T])
      if (!rFrom || !rTo) return a
      const usd = a / rFrom
      return usd * rTo
    },
    [rates, currency]
  )

  // Format a value in the user's *preferred* currency, converting from `base` if needed.
  // Never outputs NaN: any non-finite amount renders as "0".
  const format = useCallback(
    (amount, base = 'USD', opts = {}) => {
      const meta = CURRENCY_META[currency] || CURRENCY_META.USD
      const value = convert(amount, base, currency)
      const { maximumFractionDigits = 2, minimumFractionDigits = 0, compact = false } = opts
      if (compact) {
        const abs = Math.abs(value)
        let scaled = value, suffix = ''
        if (currency === 'INR') {
          if (abs >= 1e7) { scaled = value / 1e7; suffix = ' Cr' }
          else if (abs >= 1e5) { scaled = value / 1e5; suffix = ' L' }
          else if (abs >= 1e3) { scaled = value / 1e3; suffix = ' K' }
        } else {
          if (abs >= 1e12) { scaled = value / 1e12; suffix = 'T' }
          else if (abs >= 1e9) { scaled = value / 1e9; suffix = 'B' }
          else if (abs >= 1e6) { scaled = value / 1e6; suffix = 'M' }
          else if (abs >= 1e3) { scaled = value / 1e3; suffix = 'K' }
        }
        return `${meta.symbol}${scaled.toFixed(maximumFractionDigits)}${suffix}`
      }
      try {
        return new Intl.NumberFormat(meta.locale, {
          style: 'currency',
          currency,
          maximumFractionDigits,
          minimumFractionDigits,
        }).format(value)
      } catch {
        return `${meta.symbol}${value.toFixed(maximumFractionDigits)}`
      }
    },
    [convert, currency]
  )

  const symbol = CURRENCY_META[currency]?.symbol || currency

  const value = useMemo(
    () => ({
      currency, setCurrency, convert, format, symbol,
      rates, updatedAt, loading, source, refresh,
      availableCurrencies: Object.keys(CURRENCY_META),
      meta: CURRENCY_META,
    }),
    [currency, setCurrency, convert, format, symbol, rates, updatedAt, loading, source, refresh]
  )

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyCtx)
  if (!ctx) {
    // Safe shim so pages still render if provider is missing — avoids the
    // "undefined" crash that leads to NaN further downstream.
    const meta = CURRENCY_META.INR
    return {
      currency: 'INR',
      setCurrency: () => {},
      convert: (a) => safeNum(a),
      format: (a) => `${meta.symbol}${safeNum(a).toFixed(2)}`,
      symbol: meta.symbol,
      rates: FALLBACK_USD_RATES,
      updatedAt: null,
      loading: false,
      source: 'fallback',
      refresh: () => {},
      availableCurrencies: Object.keys(CURRENCY_META),
      meta: CURRENCY_META,
    }
  }
  return ctx
}
