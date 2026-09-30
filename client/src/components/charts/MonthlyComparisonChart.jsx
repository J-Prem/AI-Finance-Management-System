import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { motion } from 'framer-motion'
import { formatCurrency, formatShortNumber } from '../../utils/formatters'

export default function MonthlyComparisonChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-8 flex items-center justify-center h-96">
        <p className="text-navy-500 dark:text-navy-400">No data available</p>
      </div>
    )
  }

  return (
    <motion.div
      className="card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-6">
        Monthly Comparison (Last 6 Months)
      </h3>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(71, 85, 105, 0.1)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-navy-600 dark:text-navy-400"
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-navy-600 dark:text-navy-400"
            tickFormatter={(value) => formatShortNumber(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value) => formatCurrency(value)}
          />
          <Legend
            wrapperStyle={{
              paddingTop: '20px',
              color: 'currentColor',
            }}
            contentStyle={{
              color: 'currentColor',
            }}
          />

          <Bar dataKey="income" fill="#10b981" name="Income" radius={[8, 8, 0, 0]} />
          <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[8, 8, 0, 0]} />
          <Line
            type="monotone"
            dataKey="savings"
            stroke="#0ea5e9"
            name="Savings"
            strokeWidth={3}
            dot={{ fill: '#0ea5e9', r: 5 }}
            activeDot={{ r: 7 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-navy-200 dark:border-navy-700">
        {data.length > 0 && (
          <>
            <div>
              <p className="text-xs text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold mb-2">
                Average Income
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(
                  data.reduce((sum, item) => sum + item.income, 0) / data.length
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold mb-2">
                Average Expense
              </p>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(
                  data.reduce((sum, item) => sum + item.expense, 0) / data.length
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold mb-2">
                Average Savings
              </p>
              <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                {formatCurrency(
                  data.reduce((sum, item) => sum + (item.savings || 0), 0) / data.length
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
