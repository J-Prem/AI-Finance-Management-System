import { FaArrowUp, FaArrowDown } from 'react-icons/fa'
import { formatCurrency, formatPercentage } from '../../utils/formatters'

export default function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendValue,
  currency = true,
  suffix = '',
  color = 'primary',
}) {
  const colorClasses = {
    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
  }

  const trendColor = trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'

  return (
    <div className="card p-6 hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-navy-600 dark:text-navy-400 font-medium mb-2">
            {label}
          </p>
          <div className="flex items-baseline gap-2 mb-4">
            <p className="text-2xl font-bold text-navy-900 dark:text-navy-100">
              {currency ? formatCurrency(value) : value}
              {suffix && <span className="text-sm">{suffix}</span>}
            </p>
            {trend && trendValue !== undefined && (
              <div className={`flex items-center gap-1 text-sm font-semibold ${trendColor}`}>
                {trend === 'up' ? <FaArrowUp size={12} /> : <FaArrowDown size={12} />}
                <span>{formatPercentage(Math.abs(trendValue))}</span>
              </div>
            )}
          </div>
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon size={24} />
          </div>
        )}
      </div>
    </div>
  )
}
