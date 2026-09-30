import { useState } from 'react'
import { useCreateTransaction, useUpdateTransaction } from '../../hooks/useTransactions'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

// Use the server-side canonical names so creates never 400. See
// server/config/constants.js -> TRANSACTION_CATEGORIES.
const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Transportation', 'Travel', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Healthcare', 'Education', 'Personal Care',
  'Home & Garden', 'Gifts & Donations', 'Business Services',
  'Financial Charges', 'Taxes', 'Uncategorized',
]
const INCOME_CATEGORIES = ['Income', 'Investment', 'Transfer']
const TRANSACTION_TYPES = ['income', 'expense']

export default function TransactionForm({ isOpen, onClose, transaction = null, onSuccess }) {
  const [formData, setFormData] = useState(
    transaction || {
      type: 'expense',
      category: 'Food & Dining',
      amount: '',
      description: '',
      merchant: '',
      paymentMethod: 'credit_card',
      date: new Date().toISOString().split('T')[0],
    }
  )

  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error('Enter a positive amount')
      return
    }
    if (!formData.category) {
      toast.error('Choose a category')
      return
    }

    try {
      const id = transaction?.id || transaction?._id
      if (id) {
        await updateMutation.mutateAsync({ id, data: formData })
        toast.success('Transaction updated')
      } else {
        await createMutation.mutateAsync(formData)
        toast.success('Transaction created')
      }
      onSuccess?.()
      onClose()
    } catch (error) {
      const msg = error?.response?.data?.message || error?.response?.data?.errors?.[0]?.message || error?.message
      toast.error(msg || 'An error occurred')
    }
  }

  const categories = formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={transaction ? 'Edit Transaction' : 'Add Transaction'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => {
                const t = e.target.value
                setFormData({
                  ...formData,
                  type: t,
                  category: t === 'income' ? 'Income' : 'Food & Dining',
                })
              }}
              className="input-base w-full"
            >
              {TRANSACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input-base w-full"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
            Amount
          </label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
            placeholder="0.00"
            className="input-base w-full"
            step="0.01"
            min="0"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
            Description
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What was this for?"
            className="input-base w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
            Merchant (optional)
          </label>
          <input
            type="text"
            value={formData.merchant || ''}
            onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
            placeholder="e.g. Starbucks, Uber, Amazon"
            className="input-base w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
            Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="input-base w-full"
            required
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button type="submit" className="btn-primary flex-1">
            {transaction ? 'Update' : 'Create'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
