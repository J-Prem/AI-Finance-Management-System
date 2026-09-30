import { motion } from 'framer-motion'

export default function LoadingSpinner({ size = 'md', fullScreen = true }) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }

  const spinnerVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      },
    },
  }

  const spinner = (
    <motion.div
      className={`${sizes[size]} border-4 border-navy-200 dark:border-navy-700 border-t-primary-500 dark:border-t-primary-400 rounded-full`}
      variants={spinnerVariants}
      animate="animate"
    />
  )

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-navy-950">
        {spinner}
      </div>
    )
  }

  return spinner
}
