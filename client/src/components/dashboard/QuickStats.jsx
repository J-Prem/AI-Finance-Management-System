import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FaFire, FaCalendarWeek, FaCalendarDays, FaWallet } from 'react-icons/fa6'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatShortNumber } from '../../utils/formatters'

const StatItem = ({ icon: Icon, label, value, sparkData, color = 'primary' }) => {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayValue(value)
    }, 100)
    return () => clearTimeout(timer)
  }, [value])

  const colorClasses = {
    primary: 'from-primary-500 to-primary-600 bg-primary-50 dark:bg-primary-900/20',
    emerald: 'from-emerald-500 to-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    amber: 'from-amber-500 to-amber-600 bg-amber-50 dark:bg-amber-900/20',
    rose: 'from-rose-500 to-rose-600 bg-rose-50 dark:bg-rose-900/20',
  }

  const [colorFrom, colorTo, bgColor] = colorClasses[color].split(' ')

  return (
    <motion.div
      className={`rounded-lg p-4 h-full ${bgColor} border border-opacity-20 dark:border-opacity-20`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-navy-600 dark:text-navy-400 font-medium uppercase tracking-wider mb-1">
            {label}
          </p>
          <motion.p
            className="text-2xl font-bold text-navy-900 dark:text-navy-100"
            key={displayValue}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {formatCurrency(displayValue)}
          </motion.p>
        </div>
        <div className={`bg-gradient-to-br ${colorFrom} ${colorTo} p-3 rounded-lg text-white`}>
          <Icon size={20} />
        </div>
      </div>

      {sparkData && sparkData.length > 0 && (
        <div className="h-12 -mx-4 -mb-4 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={`hsl(${color === 'primary' ? '201' : color === 'emerald' ? '160' : '45'}, 100%, 50%)`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  )
}

export default function QuickStats({ stats = {} }) {
  const defaultStats = {
    todaySpending: 0,
    weekSpending: 0,
    monthSpending: 0,
    budgetRemaining: 0,
    ...stats,
  }

  const sparkData = [
    { value: 100 },
    { value: 120 },
    { value: 110 },
    { value: 140 },
    { value: 130 },
    { value: 150 },
    { value: 145 },
  ]

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
    >
      <StatItem
        icon={FaFire}
        label="Today's Spending"
        value={defaultStats.todaySpending}
        sparkData={sparkData}
        color="rose"
      />
      <StatItem
        icon={FaCalendarWeek}
        label="This Week"
        value={defaultStats.weekSpending}
        sparkData={sparkData}
        color="amber"
      />
      <StatItem
        icon={FaCalendarDays}
        label="This Month"
        value={defaultStats.monthSpending}
        sparkData={sparkData}
        color="primary"
      />
      <StatItem
        icon={FaWallet}
        label="Budget Remaining"
        value={defaultStats.budgetRemaining}
        sparkData={sparkData}
        color="emerald"
      />
    </motion.div>
  )
}
