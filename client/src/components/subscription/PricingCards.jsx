import { FaCheck } from 'react-icons/fa'
import { SUBSCRIPTION_PLANS } from '../../utils/constants'
import { formatCurrency } from '../../utils/formatters'

export default function PricingCards({ onSelectPlan }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {SUBSCRIPTION_PLANS.map((plan) => (
        <div
          key={plan.id}
          className={`relative card p-8 transition-all ${
            plan.popular ? 'ring-2 ring-primary-500 scale-105' : ''
          }`}
        >
          {plan.popular && (
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="badge badge-primary">Most Popular</span>
            </div>
          )}

          <h3 className="text-2xl font-bold text-navy-900 dark:text-navy-100 mb-2">
            {plan.name}
          </h3>

          <div className="mb-6">
            <span className="text-4xl font-bold text-navy-900 dark:text-navy-100">
              {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
            </span>
            {plan.price > 0 && (
              <span className="text-navy-600 dark:text-navy-400">/{plan.period}</span>
            )}
          </div>

          <button
            onClick={() => onSelectPlan(plan.id)}
            className={`w-full mb-8 py-3 rounded-lg font-semibold transition-all ${
              plan.popular
                ? 'btn-primary'
                : 'btn-secondary'
            }`}
          >
            {plan.price === 0 ? 'Get Started' : 'Upgrade'}
          </button>

          <div className="space-y-3">
            {plan.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <FaCheck className="text-emerald-500 mt-1 flex-shrink-0" size={14} />
                <span className="text-sm text-navy-600 dark:text-navy-400">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
