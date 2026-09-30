import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts'
import LoadingSpinner from '../common/LoadingSpinner'

export default function SpendingDNARadar({ data, loading = false }) {
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
        Your Spending DNA
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          <PolarGrid stroke="#cbd5e1" />
          <PolarAngleAxis dataKey="trait" stroke="#64748b" style={{ fontSize: '12px' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#64748b" style={{ fontSize: '12px' }} />
          <Radar
            name="Your Profile"
            dataKey="value"
            stroke="#0ea5e9"
            fill="#0ea5e9"
            fillOpacity={0.5}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
