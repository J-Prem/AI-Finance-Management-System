import { useCurrency, CURRENCY_META } from '../../contexts/CurrencyContext'
import { FaArrowsRotate } from 'react-icons/fa6'

// Small header control: lets the user switch the display currency for a whole
// page. Every page that shows money passes its values through `format(...)`,
// so flipping this updates every number instantly (Budgets, Investments,
// Analytics, Market). Also shows a live/fallback badge + manual refresh.
export default function CurrencySwitcher({ compact = false, className = '' }) {
  const { currency, setCurrency, source, updatedAt, refresh, loading, availableCurrencies } =
    useCurrency()

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="inline-flex items-center rounded-lg bg-navy-100 dark:bg-navy-800 border border-navy-200 dark:border-navy-700 overflow-hidden">
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="bg-transparent px-3 py-1.5 text-sm font-semibold text-navy-900 dark:text-navy-100 focus:outline-none cursor-pointer"
          aria-label="Display currency"
        >
          {availableCurrencies.map((c) => (
            <option key={c} value={c}>
              {CURRENCY_META[c].flag} {c}
            </option>
          ))}
        </select>
        <button
          onClick={refresh}
          className="px-2 py-1.5 border-l border-navy-200 dark:border-navy-700 text-navy-600 dark:text-navy-400 hover:text-primary-600"
          title="Refresh exchange rates"
        >
          <FaArrowsRotate size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {!compact && (
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
            source === 'live'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
          title={updatedAt ? `Rates updated ${updatedAt.toLocaleTimeString()}` : 'Using cached rates'}
        >
          {source === 'live' ? '● Live FX' : '● Cached FX'}
        </span>
      )}
    </div>
  )
}
