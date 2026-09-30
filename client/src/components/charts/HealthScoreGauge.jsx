import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FINANCIAL_HEALTH_RANGES } from '../../utils/constants'

export default function HealthScoreGauge({ score = 75, loading = false }) {
  const getHealthColor = (score) => {
    const range = FINANCIAL_HEALTH_RANGES.find((r) => score >= r.min && score <= r.max)
    return range ? range.color : '#8884d8'
  }

  const getHealthLabel = (score) => {
    const range = FINANCIAL_HEALTH_RANGES.find((r) => score >= r.min && score <= r.max)
    return range ? range.label : 'Unknown'
  }

  const data = [{ value: score }, { value: 100 - score }]

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-6 text-center">
        Financial Health Score
      </h3>
      <div className="flex flex-col items-center">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              startAngle={180}
              endAngle={0}
              dataKey="value"
            >
              <Cell fill={getHealthColor(score)} />
              <Cell fill="#e2e8f0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="text-center mt-4">
          <div className="text-4xl font-bold text-navy-900 dark:text-navy-100">
            {Math.round(score)}
          </div>
          <div className="text-sm text-navy-600 dark:text-navy-400 mt-1">
            {getHealthLabel(score)}
          </div>
        </div>
      </div>
    </div>
  )
}
