import { useState, useEffect } from 'react'
import { FaArrowUp, FaArrowDown } from 'react-icons/fa'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { formatNumber, formatPercentage } from '../../utils/formatters'

export default function MarketIndexCard({
  name,
  symbol,
  value,
  change,
  changePercent,
  sparklineData = [],
  loading = false,
}) {
  const [displayValue, setDisplayValue] = useState(value)
  const isPositive = change >= 0

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayValue(value)
    }, 300)
    return () => clearTimeout(timer)
  }, [value])

  if (loading) {
    return (
      <motion.div
        className="card p-6 bg-gradient-to-br from-navy-50 to-navy-100 dark:from-navy-800 dark:to-navy-900 animate-pulse"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="h-20 bg-navy-200 dark:bg-navy-700 rounded-lg" />
      </motion.div>
    )
  }

  return (
    <motion.div
      className="card p-6 hover:shadow-md transition-all"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold">
            {symbol}
          </p>
          <p className="text-sm text-navy-600 dark:text-navy-400">{name}</p>
        </div>
        <div
          className={`p-2 rounded-lg ${
            isPositive
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          {isPositive ? <FaArrowUp size={14} /> : <FaArrowDown size={14} />}
        </div>
      </div>

      <div className="mb-4">
        <motion.p className="text-3xl font-bold text-navy-900 dark:text-navy-100">
          {formatNumber(displayValue, 2)}
        </motion.p>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={`text-sm font-semibold ${
              isPositive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isPositive ? '+' : ''}{formatNumber(change, 2)}
          </span>
          <span
            className={`text-sm font-semibold ${
              isPositive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatPercentage(changePercent)}
          </span>
        </div>
      </div>

      {sparklineData.length > 0 && (
        <div className="h-12 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-navy-500 dark:text-navy-400 mt-4">
        Updated just now
      </p>
    </motion.div>
  )
}
