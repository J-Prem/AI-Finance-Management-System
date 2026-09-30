import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'
import LoadingSpinner from '../common/LoadingSpinner'

export default function PredictionChart({ data, loading = false }) {
  if (loading) {
    return <LoadingSpinner size="md" fullScreen={false} />
  }

  if (!data || data.length === 0) {
    return (
      <div className="card p-8 text-center text-navy-500 dark:text-navy-400">
        No data available
      </div>
    )
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-6">
        Spending Forecast
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '12px' }} />
          <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#f1f5f9' }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="predicted"
            stroke="#0ea5e9"
            fillOpacity={1}
            fill="url(#colorPredicted)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="confidence"
            stroke="#a78bfa"
            fillOpacity={1}
            fill="url(#colorConfidence)"
            strokeWidth={1}
            strokeDasharray="5 5"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
