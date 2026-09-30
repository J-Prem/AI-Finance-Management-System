import { FaWallet, FaArrowDown, FaArrowUp, FaPiggyBank } from 'react-icons/fa'
import { useDashboardStats } from '../../hooks/useAnalytics'
import StatCard from '../common/StatCard'
import SpendingTrendChart from '../charts/SpendingTrendChart'
import CategoryPieChart from '../charts/CategoryPieChart'
import HealthScoreGauge from '../charts/HealthScoreGauge'
import LoadingSpinner from '../common/LoadingSpinner'

export default function DashboardOverview() {
  const { data: stats, loading } = useDashboardStats()

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FaWallet}
          label="Total Income"
          value={stats?.totalIncome || 0}
          trend="up"
          trendValue={12.5}
          color="emerald"
        />
        <StatCard
          icon={FaArrowDown}
          label="Total Expenses"
          value={stats?.totalExpenses || 0}
          trend="down"
          trendValue={-8.3}
          color="rose"
        />
        <StatCard
          icon={FaPiggyBank}
          label="Total Savings"
          value={stats?.totalSavings || 0}
          trend="up"
          trendValue={15.2}
          color="primary"
        />
        <StatCard
          icon={FaArrowUp}
          label="Budget Usage"
          value={stats?.budgetUsagePercent || 0}
          currency={false}
          suffix="%"
          color="amber"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SpendingTrendChart data={stats?.spendingTrend} loading={loading} />
        </div>
        <div>
          <HealthScoreGauge score={stats?.healthScore} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryPieChart data={stats?.categoryBreakdown} loading={loading} />
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-6">
            Budget Status
          </h3>
          <div className="space-y-4">
            {stats?.budgets?.map((budget) => (
              <div key={budget.id}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-navy-700 dark:text-navy-300">
                    {budget.name}
                  </span>
                  <span className="text-sm text-navy-600 dark:text-navy-400">
                    {budget.spent} / {budget.limit}
                  </span>
                </div>
                <div className="w-full bg-navy-200 dark:bg-navy-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budget.percent > 80
                        ? 'bg-rose-500'
                        : budget.percent > 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(budget.percent, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100">
            Recent Transactions
          </h3>
          <a href="/transactions" className="text-primary-500 hover:text-primary-600 text-sm font-medium">
            View All
          </a>
        </div>
        <div className="space-y-3">
          {stats?.recentTransactions?.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-3 hover:bg-navy-50 dark:hover:bg-navy-800 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{transaction.categoryIcon}</div>
                <div>
                  <p className="text-sm font-medium text-navy-900 dark:text-navy-100">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-navy-600 dark:text-navy-400">
                    {transaction.date}
                  </p>
                </div>
              </div>
              <div className={`font-semibold ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-navy-900 dark:text-navy-100'}`}>
                {transaction.type === 'income' ? '+' : '-'} {transaction.amount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
