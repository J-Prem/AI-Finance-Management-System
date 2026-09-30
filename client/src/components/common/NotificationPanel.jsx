import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaBell, FaTimes, FaCheck } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { formatRelativeTime } from '../../utils/formatters'

const NOTIFICATION_ICONS = {
  budget: '🏦',
  anomaly: '⚠️',
  insight: '💡',
  bill: '📄',
  transaction: '💳',
  goal: '🎯',
  alert: '🔔',
}

export default function NotificationPanel({ notifications = [] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [readNotifications, setReadNotifications] = useState(new Set())
  const navigate = useNavigate()

  const defaultNotifications = notifications.length > 0 ? notifications : [
    {
      id: 1,
      type: 'budget',
      title: 'Budget Alert',
      message: 'You\'ve reached 85% of your entertainment budget',
      time: new Date(Date.now() - 10 * 60000),
      read: false,
      action: { label: 'View Budget', path: '/budgets' },
    },
    {
      id: 2,
      type: 'insight',
      title: 'AI Insight',
      message: 'You spent 40% more on dining this month',
      time: new Date(Date.now() - 60 * 60000),
      read: false,
      action: { label: 'View Details', path: '/analytics' },
    },
    {
      id: 3,
      type: 'bill',
      title: 'Bill Due',
      message: 'Internet bill is due in 2 days',
      time: new Date(Date.now() - 2 * 60 * 60000),
      read: true,
      action: { label: 'View Bills', path: '/bills' },
    },
    {
      id: 4,
      type: 'anomaly',
      title: 'Anomaly Detected',
      message: 'Unusual spending pattern detected on your card',
      time: new Date(Date.now() - 5 * 60 * 60000),
      read: true,
      action: { label: 'View Details', path: '/transactions' },
    },
  ]

  const unreadCount = defaultNotifications.filter(
    (n) => !readNotifications.has(n.id) && !n.read
  ).length

  const handleMarkAsRead = (id) => {
    setReadNotifications((prev) => new Set([...prev, id]))
  }

  const handleMarkAllAsRead = () => {
    const allIds = new Set(defaultNotifications.map((n) => n.id))
    setReadNotifications(allIds)
  }

  const handleNotificationClick = (notification) => {
    handleMarkAsRead(notification.id)
    if (notification.action) {
      navigate(notification.action.path)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="relative p-2 rounded-lg bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
      >
        <FaBell size={20} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0 right-0 w-5 h-5 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 top-12 w-96 max-h-96 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-navy-200 dark:border-navy-700 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="p-4 border-b border-navy-200 dark:border-navy-700 flex items-center justify-between sticky top-0 bg-white dark:bg-navy-800">
              <h3 className="font-semibold text-navy-900 dark:text-navy-100">Notifications</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <motion.button
                    onClick={handleMarkAllAsRead}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                  >
                    Mark all as read
                  </motion.button>
                )}
                <motion.button
                  onClick={() => setIsOpen(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-1 hover:bg-navy-100 dark:hover:bg-navy-700 rounded"
                >
                  <FaTimes size={16} className="text-navy-600 dark:text-navy-400" />
                </motion.button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-80">
              {defaultNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-navy-600 dark:text-navy-400">No notifications yet</p>
                </div>
              ) : (
                defaultNotifications.map((notification, idx) => {
                  const isRead = readNotifications.has(notification.id) || notification.read
                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 border-b border-navy-100 dark:border-navy-700 cursor-pointer hover:bg-navy-50 dark:hover:bg-navy-700/50 transition-colors ${
                        isRead ? '' : 'bg-primary-50 dark:bg-primary-900/10'
                      }`}
                    >
                      <div className="flex gap-3">
                        <span className="text-2xl flex-shrink-0">
                          {NOTIFICATION_ICONS[notification.type] || '🔔'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-navy-900 dark:text-navy-100 text-sm">
                              {notification.title}
                            </p>
                            {!isRead && (
                              <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-navy-600 dark:text-navy-400 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-navy-500 dark:text-navy-500">
                              {formatRelativeTime(notification.time)}
                            </p>
                            {notification.action && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleNotificationClick(notification)
                                }}
                                className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline"
                              >
                                {notification.action.label}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40"
        />
      )}
    </div>
  )
}
