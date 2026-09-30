import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FaHeartPulse, FaLightbulb } from 'react-icons/fa6'

const HEALTH_GRADES = {
  A: { color: '#10b981', label: 'Excellent' },
  B: { color: '#06b6d4', label: 'Very Good' },
  C: { color: '#f59e0b', label: 'Good' },
  D: { color: '#f97316', label: 'Fair' },
  F: { color: '#ef4444', label: 'Poor' },
}

export default function FinancialHealthWidget({ healthScore = 75, components = {} }) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const [displayGrade, setDisplayGrade] = useState('A')

  const defaultComponents = {
    savings: 80,
    expenses: 65,
    debt: 90,
    investments: 70,
    budgeting: 75,
    ...components,
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimatedScore((prev) => {
        if (prev < healthScore) return Math.min(prev + 2, healthScore)
        return healthScore
      })
    }, 20)
    return () => clearInterval(timer)
  }, [healthScore])

  useEffect(() => {
    if (healthScore >= 90) setDisplayGrade('A')
    else if (healthScore >= 80) setDisplayGrade('B')
    else if (healthScore >= 70) setDisplayGrade('C')
    else if (healthScore >= 60) setDisplayGrade('D')
    else setDisplayGrade('F')
  }, [healthScore])

  const gradeInfo = HEALTH_GRADES[displayGrade]
  const trend = healthScore > 70 ? 'improving' : 'declining'

  const getCircumference = () => {
    const radius = 70
    return 2 * Math.PI * radius
  }

  const getStrokeDashoffset = () => {
    const circumference = getCircumference()
    return circumference - (animatedScore / 100) * circumference
  }

  return (
    <motion.div
      className="card p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-start justify-between mb-8">
        <div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
            <FaHeartPulse className="text-rose-500" size={20} />
            Financial Health Score
          </h3>
        </div>
        <motion.span
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            trend === 'improving'
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {trend === 'improving' ? '↑ Improving' : '↓ Declining'}
        </motion.span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Circular Gauge */}
        <div className="flex flex-col items-center justify-center flex-shrink-0">
          <div className="relative w-64 h-64">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
              {/* Background Circle */}
              <circle
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke="rgba(71, 85, 105, 0.1)"
                strokeWidth="12"
              />
              {/* Progress Circle */}
              <motion.circle
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke={gradeInfo.color}
                strokeWidth="12"
                strokeDasharray={getCircumference()}
                strokeDashoffset={getStrokeDashoffset()}
                strokeLinecap="round"
                transition={{ duration: 0.5 }}
              />
            </svg>

            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.p
                className="text-5xl font-bold"
                style={{ color: gradeInfo.color }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {displayGrade}
              </motion.p>
              <motion.p
                className="text-sm font-semibold text-navy-600 dark:text-navy-400 mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {gradeInfo.label}
              </motion.p>
              <motion.p
                className="text-xs text-navy-500 dark:text-navy-400 mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {animatedScore.toFixed(0)}/100
              </motion.p>
            </div>
          </div>
        </div>

        {/* Component Breakdown */}
        <div className="flex-1 space-y-4">
          <p className="text-sm font-semibold text-navy-900 dark:text-navy-100 mb-4">
            Health Components
          </p>

          {Object.entries(defaultComponents).map(([key, value], index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-navy-700 dark:text-navy-300 capitalize">
                  {key}
                </label>
                <span className="text-sm font-semibold text-navy-900 dark:text-navy-100">
                  {value}%
                </span>
              </div>
              <div className="w-full h-3 bg-navy-200 dark:bg-navy-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.8 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Tips Section */}
      <motion.div
        className="mt-8 pt-6 border-t border-navy-200 dark:border-navy-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <p className="text-sm font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2 mb-3">
          <FaLightbulb size={16} className="text-amber-500" />
          Tips to Improve Your Score
        </p>
        <ul className="space-y-2 text-sm text-navy-700 dark:text-navy-300">
          <li className="flex gap-2">
            <span className="flex-shrink-0">•</span>
            <span>Increase your emergency fund to 6 months of expenses</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">•</span>
            <span>Reduce high-interest debt and maintain credit score</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">•</span>
            <span>Start investing for long-term wealth building</span>
          </li>
        </ul>
      </motion.div>
    </motion.div>
  )
}
