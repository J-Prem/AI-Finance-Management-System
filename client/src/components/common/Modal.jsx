import { motion, AnimatePresence } from 'framer-motion'
import { FaTimes } from 'react-icons/fa'

export default function Modal({ isOpen, onClose, title, children, size = 'md', closeButton = true }) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-4xl',
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`card ${sizes[size]} w-full`}>
              {(title || closeButton) && (
                <div className="flex items-center justify-between border-b border-navy-200 dark:border-navy-700 p-6">
                  <h2 className="text-xl font-semibold text-navy-900 dark:text-navy-100">
                    {title}
                  </h2>
                  {closeButton && (
                    <button
                      onClick={onClose}
                      className="p-1 hover:bg-navy-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                    >
                      <FaTimes className="text-navy-500 dark:text-navy-400" />
                    </button>
                  )}
                </div>
              )}
              <div className="p-6">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
