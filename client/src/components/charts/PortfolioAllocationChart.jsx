import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { formatCurrency } from '../../utils/formatters'

const COLORS = {
  stocks: '#0ea5e9',
  mutualFunds: '#8b5cf6',
  crypto: '#f97316',
  gold: '#f59e0b',
  bonds: '#06b6d4',
  cash: '#10b981',
}

export default function PortfolioAllocationChart({ data = [] }) {
  const [chartData, setChartData] = useState([])
  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0)

  useEffect(() => {
    if (data.length > 0) {
      const formatted = data.map((item) => ({
        name: item.type,
        value: item.value,
        percentage: ((item.value / data.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1),
      }))
      setChartData(formatted)
    }
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="card p-8 flex items-center justify-center h-96">
        <p className="text-navy-500 dark:text-navy-400">No portfolio data available</p>
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
        Portfolio Allocation
      </h3>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 relative" style={{ minHeight: 300 }}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.name.toLowerCase()] || '#0ea5e9'}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center Text — absolute inside the relative chart container so it
              overlays the donut hole instead of escaping to the page. */}
          <div className="absolute left-0 right-0 top-[40%] -translate-y-1/2 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-xs text-navy-600 dark:text-navy-400">Total Portfolio</p>
              <p className="text-xl font-bold text-navy-900 dark:text-navy-100">
                {formatCurrency(totalValue)}
              </p>
            </div>
          </div>
        </div>

        {/* Legend with Details */}
        <div className="flex-1 space-y-3">
          {chartData.map((item, index) => (
            <motion.div
              key={item.name}
              className="flex items-center justify-between p-3 rounded-lg bg-navy-50 dark:bg-navy-800 hover:bg-navy-100 dark:hover:bg-navy-700 transition-colors"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[item.name.toLowerCase()] || '#0ea5e9' }}
                />
                <div>
                  <p className="text-sm font-medium text-navy-900 dark:text-navy-100">
                    {item.name}
                  </p>
                  <p className="text-xs text-navy-500 dark:text-navy-400">{item.percentage}%</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-navy-900 dark:text-navy-100">
                {formatCurrency(item.value)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
