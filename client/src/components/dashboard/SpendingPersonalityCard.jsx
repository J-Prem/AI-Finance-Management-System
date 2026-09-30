import { useState } from 'react'
import { motion } from 'framer-motion'
import { FaChartPie } from 'react-icons/fa6'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'

const PERSONALITIES = {
  saver: {
    emoji: '🏦',
    name: 'Saver',
    description: 'You prioritize saving and are financially conservative. You build wealth through careful planning and discipline.',
    strengths: ['Disciplined', 'Long-term Focus', 'Risk-Aware'],
    weaknesses: ['Overly Conservative', 'Missed Opportunities'],
    color: 'from-emerald-500 to-teal-500',
  },
  spender: {
    emoji: '🛍️',
    name: 'Spender',
    description: 'You enjoy life\'s pleasures and tend to spend freely. You value experiences and present satisfaction.',
    strengths: ['Enjoys Life', 'Confident', 'Generous'],
    weaknesses: ['Impulse Buying', 'Low Savings Rate'],
    color: 'from-rose-500 to-pink-500',
  },
  investor: {
    emoji: '📈',
    name: 'Investor',
    description: 'You seek growth through investments and strategic spending. You\'re focused on building wealth intelligently.',
    strengths: ['Growth-Minded', 'Strategic', 'Risk-Tolerant'],
    weaknesses: ['Over-Trading', 'Complex Strategies'],
    color: 'from-blue-500 to-primary-500',
  },
  balanced: {
    emoji: '⚖️',
    name: 'Balanced',
    description: 'You maintain equilibrium between spending and saving. You enjoy a healthy mix of experiences and security.',
    strengths: ['Flexible', 'Responsible', 'Adaptive'],
    weaknesses: ['Indecisive', 'Inconsistent'],
    color: 'from-purple-500 to-indigo-500',
  },
  minimalist: {
    emoji: '🎯',
    name: 'Minimalist',
    description: 'You live efficiently with minimal unnecessary spending. You focus on essentials and avoid waste.',
    strengths: ['Efficient', 'Intentional', 'Sustainable'],
    weaknesses: ['Restrictive', 'Quality Compromise'],
    color: 'from-gray-500 to-slate-500',
  },
}

export default function SpendingPersonalityCard({
  personality = 'balanced',
  traits = {},
}) {
  const defaultTraits = {
    impulsivity: 35,
    savingness: 75,
    investmentMindset: 60,
    consumerism: 40,
    frugality: 70,
    ...traits,
  }

  const p = PERSONALITIES[personality.toLowerCase()] || PERSONALITIES.balanced
  const radarData = [
    { trait: 'Impulsivity', value: defaultTraits.impulsivity },
    { trait: 'Savingness', value: defaultTraits.savingness },
    { trait: 'Investment', value: defaultTraits.investmentMindset },
    { trait: 'Consumerism', value: defaultTraits.consumerism },
    { trait: 'Frugality', value: defaultTraits.frugality },
  ]

  return (
    <motion.div
      className="card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header with Gradient */}
      <div className={`bg-gradient-to-r ${p.color} p-6 text-white`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-4xl mb-2">{p.emoji}</p>
            <h3 className="text-2xl font-bold">{p.name}</h3>
            <p className="text-sm text-white/80 mt-2">{p.description}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Radar Chart */}
        <div className="bg-navy-50 dark:bg-navy-800 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid
                stroke="rgba(71, 85, 105, 0.2)"
                fill="transparent"
              />
              <PolarAngleAxis
                dataKey="trait"
                tick={{ fontSize: 12, fill: 'currentColor' }}
                className="text-navy-600 dark:text-navy-400"
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'currentColor' }}
                className="text-navy-600 dark:text-navy-400"
              />
              <Radar
                name="Your Profile"
                dataKey="value"
                stroke="rgb(14, 165, 233)"
                fill="rgb(14, 165, 233)"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-2 gap-4">
          {/* Strengths */}
          <div>
            <p className="text-sm font-semibold text-navy-900 dark:text-navy-100 mb-3">
              Strengths
            </p>
            <div className="flex flex-wrap gap-2">
              {p.strengths.map((strength, idx) => (
                <motion.span
                  key={strength}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full"
                >
                  {strength}
                </motion.span>
              ))}
            </div>
          </div>

          {/* Weaknesses */}
          <div>
            <p className="text-sm font-semibold text-navy-900 dark:text-navy-100 mb-3">
              Opportunities
            </p>
            <div className="flex flex-wrap gap-2">
              {p.weaknesses.map((weakness, idx) => (
                <motion.span
                  key={weakness}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full"
                >
                  {weakness}
                </motion.span>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link
            to="/analytics"
            className="block text-center py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-lg transition-all"
          >
            View Full Analysis
          </Link>
        </motion.div>
      </div>
    </motion.div>
  )
}
