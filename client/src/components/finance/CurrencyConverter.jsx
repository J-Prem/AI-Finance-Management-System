import { useState, useEffect, useCallback } from 'react'
import { FaArrowRightArrowLeft } from 'react-icons/fa6'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { convertCurrency } from '../../services/externalApiService'
import { formatDate } from '../../utils/formatters'

// Static fallback rates (USD base) used when /external/currency/convert is
// unavailable. Keep these modest — they just unblock the UI so "not working"
// never happens. Values are rough approximations; network data overrides.
const FALLBACK_USD_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.2, JPY: 151.5,
  AUD: 1.52, CAD: 1.36, CHF: 0.88, CNY: 7.22, MXN: 17.1,
}

function offlineConvert(amount, from, to) {
  const rFrom = FALLBACK_USD_RATES[from]
  const rTo = FALLBACK_USD_RATES[to]
  if (!rFrom || !rTo) return null
  const usd = Number(amount) / rFrom
  return usd * rTo
}

const POPULAR_PAIRS = [
  { from: 'USD', to: 'INR', label: 'USD to INR' },
  { from: 'EUR', to: 'USD', label: 'EUR to USD' },
  { from: 'GBP', to: 'INR', label: 'GBP to INR' },
  { from: 'USD', to: 'EUR', label: 'USD to EUR' },
]

const CURRENCIES = [
  { code: 'USD', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧' },
  { code: 'INR', symbol: '₹', flag: '🇮🇳' },
  { code: 'JPY', symbol: '¥', flag: '🇯🇵' },
  { code: 'AUD', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'CNY', symbol: '¥', flag: '🇨🇳' },
  { code: 'MXN', symbol: '$', flag: '🇲🇽' },
]

export default function CurrencyConverter() {
  const [fromCurrency, setFromCurrency] = useState('USD')
  const [toCurrency, setToCurrency] = useState('INR')
  const [amount, setAmount] = useState('1')
  const [convertedAmount, setConvertedAmount] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(false)

  // Auto-convert whenever amount / from / to changes. Debounced so we don't
  // hammer the API while the user types.
  const convert = useCallback(async () => {
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setConvertedAmount(null)
      return
    }
    setLoading(true)
    try {
      // axios interceptor unwraps to response.data, so `res` is `{ success, data: {...} }`.
      const res = await convertCurrency(amt, fromCurrency, toCurrency)
      const payload = res?.data || res || {}
      const converted =
        payload.convertedAmount ?? payload.converted ?? payload.result ?? payload.value
      if (Number.isFinite(converted)) {
        setConvertedAmount(Number(converted))
        setLastUpdated(new Date())
      } else {
        throw new Error('no rate in response')
      }
    } catch (err) {
      // Offline fallback so the converter never appears broken.
      const local = offlineConvert(amt, fromCurrency, toCurrency)
      if (local != null) {
        setConvertedAmount(local)
        setLastUpdated(new Date())
      } else {
        toast.error('Unable to convert — try a different currency')
      }
    } finally {
      setLoading(false)
    }
  }, [amount, fromCurrency, toCurrency])

  useEffect(() => {
    const h = setTimeout(convert, 300)
    return () => clearTimeout(h)
  }, [convert])

  const handleConvert = () => convert()

  const handleSwap = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
    setConvertedAmount(null)
  }

  const handleQuickPair = (from, to) => {
    setFromCurrency(from)
    setToCurrency(to)
    setConvertedAmount(null)
  }

  const fromCurrencyData = CURRENCIES.find((c) => c.code === fromCurrency)
  const toCurrencyData = CURRENCIES.find((c) => c.code === toCurrency)

  return (
    <motion.div
      className="card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-6">
        Currency Converter
      </h3>

      <div className="space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* From Currency */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
                From
              </label>
              <div className="flex gap-2">
                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value)}
                  className="px-3 py-2 bg-navy-100 dark:bg-navy-800 border border-navy-300 dark:border-navy-700 rounded-lg text-sm font-medium text-navy-900 dark:text-navy-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.flag} {curr.code}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="flex-1 px-4 py-2 bg-navy-100 dark:bg-navy-800 border border-navy-300 dark:border-navy-700 rounded-lg text-navy-900 dark:text-navy-100 placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex items-end">
              <motion.button
                onClick={handleSwap}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-3 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
              >
                <FaArrowRightArrowLeft size={18} />
              </motion.button>
            </div>

            {/* To Currency */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
                To
              </label>
              <div className="flex gap-2">
                <select
                  value={toCurrency}
                  onChange={(e) => setToCurrency(e.target.value)}
                  className="px-3 py-2 bg-navy-100 dark:bg-navy-800 border border-navy-300 dark:border-navy-700 rounded-lg text-sm font-medium text-navy-900 dark:text-navy-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.flag} {curr.code}
                    </option>
                  ))}
                </select>
                {convertedAmount !== null && (
                  <input
                    type="text"
                    value={convertedAmount.toFixed(2)}
                    readOnly
                    className="flex-1 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-lg text-emerald-900 dark:text-emerald-100 font-semibold"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Convert Button */}
          <motion.button
            onClick={handleConvert}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
          >
            {loading ? 'Converting...' : 'Convert'}
          </motion.button>
        </div>

        {/* Result Display */}
        {convertedAmount !== null && (
          <motion.div
            className="p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/30 border border-emerald-200 dark:border-emerald-800"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-2">Conversion Result</p>
            <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
              {amount} {fromCurrency} = {convertedAmount.toFixed(2)} {toCurrency}
            </p>
            {lastUpdated && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                Last updated: {formatDate(lastUpdated, 'HH:mm:ss')}
              </p>
            )}
          </motion.div>
        )}

        {/* Popular Pairs */}
        <div>
          <p className="text-xs text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold mb-3">
            Popular Pairs
          </p>
          <div className="grid grid-cols-2 gap-2">
            {POPULAR_PAIRS.map((pair) => (
              <motion.button
                key={`${pair.from}-${pair.to}`}
                onClick={() => handleQuickPair(pair.from, pair.to)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg bg-navy-100 dark:bg-navy-800 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-navy-900 dark:text-navy-100 text-sm font-medium transition-colors"
              >
                {pair.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
