import { motion, AnimatePresence } from 'framer-motion'
import {
  FaLightbulb,
  FaArrowTrendDown,
  FaShieldHalved,
  FaArrowTrendUp,
  FaCircleCheck,
} from 'react-icons/fa6'
import toast from 'react-hot-toast'

const INSIGHT_ICONS = {
  savings: FaArrowTrendDown,
  budget: FaShieldHalved,
  spending: FaArrowTrendUp,
  insight: FaLightbulb,
}

const PRIORITY_COLORS = {
  high: 'bg-rose-100 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
  medium: 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
  low: 'bg-emerald-100 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
}

export default function AIInsightsPanel({ insights = [] }) {
  const defaultInsights = insights.length > 0 ? insights : [
    {
      id: 1,
      title: 'Reduce Dining Expenses',
      description: 'You spent 40% more on dining this month compared to last month.',
      priority: 'high',
      savings: 250,
      category: 'spending',
    },
    {
      id: 2,
      title: 'Set Emergency Fund Goal',
      description: 'Consider building an emergency fund with 3-6 months of expenses.',
      priority: 'high',
      savings: 0,
      category: 'savings',
    },
    {
      id: 3,
      title: 'Review Subscriptions',
      description: 'You have 5 unused subscriptions. Cancel to save $85/month.',
      priority: 'medium',
      savings: 85,
      category: 'budget',
    },
    {
      id: 4,
      title: 'Optimize Energy Usage',
      description: 'Your utility bills are 15% higher than neighbors. Check HVAC settings.',
      priority: 'medium',
      savings: 45,
      category: 'budget',
    },
  ]

  const handleApply = (insight) => {
    toast.success(`Applied suggestion: ${insight.title}`)
  }

  return (
    <motion.div
      className="card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
          <FaLightbulb className="text-amber-500" size={20} />
          AI Insights & Recommendations
        </h3>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {defaultInsights.map((insight, index) => {
            const Icon = INSIGHT_ICONS[insight.category] || FaLightbulb
            const priorityColor = PRIORITY_COLORS[insight.priority]

            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${priorityColor}`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    <Icon size={20} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      <span className={`text-xs font-bold px-2 py-1 rounded bg-opacity-20 whitespace-nowrap ${
                        insight.priority === 'high'
                          ? 'bg-rose-700 text-rose-700'
                          : insight.priority === 'medium'
                            ? 'bg-amber-700 text-amber-700'
                            : 'bg-emerald-700 text-emerald-700'
                      }`}>
                        {insight.priority.charAt(0).toUpperCase() + insight.priority.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm opacity-90">{insight.description}</p>

                    {insight.savings > 0 && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-current border-opacity-20">
                        <span className="text-xs font-semibold">Est. savings:</span>
                        <span className="font-bold">${insight.savings.toLocaleString()}</span>
                        {insight.category === 'budget' && <span className="text-xs">/month</span>}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <motion.button
                    onClick={() => handleApply(insight)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-shrink-0 p-2 rounded-lg bg-current bg-opacity-10 hover:bg-opacity-20 text-current transition-all"
                  >
                    <FaCircleCheck size={18} />
                  </motion.button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {defaultInsights.length === 0 && (
        <div className="text-center py-8">
          <p className="text-navy-500 dark:text-navy-400">No insights available right now</p>
          <p className="text-sm text-navy-500 dark:text-navy-400 mt-2">
            Keep tracking your spending to get personalized recommendations
          </p>
        </div>
      )}
    </motion.div>
  )
}
