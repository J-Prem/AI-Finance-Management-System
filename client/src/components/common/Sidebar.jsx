import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FaBars, FaTimes, FaCog } from 'react-icons/fa'
import { motion } from 'framer-motion'
import { useSelector } from 'react-redux'
import { NAVIGATION_ITEMS, SECONDARY_NAVIGATION, ADMIN_NAVIGATION } from '../../utils/constants'

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const { user } = useSelector((state) => state.auth)
  const isAdmin = user?.role === 'admin'

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path.split('?')[0])

  const NavItem = ({ item }) => (
    <Link
      to={item.path}
      onClick={() => setIsOpen(false)}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive(item.path)
          ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-semibold'
          : 'text-navy-600 dark:text-navy-400 hover:bg-navy-100 dark:hover:bg-navy-800'
      }`}
    >
      <item.icon size={18} />
      <span className="hidden sm:block">{item.label}</span>
    </Link>
  )

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 sm:hidden bg-primary-500 text-white p-2 rounded-lg"
      >
        {isOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        className={`fixed left-0 top-0 h-screen w-64 bg-navy-900 dark:bg-navy-950 text-white overflow-y-auto z-40 sm:relative sm:translate-x-0 transition-transform border-r border-navy-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        initial={false}
      >
        <div className="p-6 border-b border-navy-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-emerald-400 bg-clip-text text-transparent">
            FinanceAI
          </h1>
          <p className="text-xs text-navy-400 mt-1">Intelligent Money Management</p>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          {NAVIGATION_ITEMS.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </nav>

        <div className="p-4 border-t border-navy-800 space-y-2">
          {SECONDARY_NAVIGATION.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>

        {isAdmin && (
          <div className="p-4 border-t border-navy-800 space-y-2">
            {ADMIN_NAVIGATION.map((item) => (
              <NavItem key={item.id} item={item} />
            ))}
          </div>
        )}

        {user && (
          <div className="p-4 border-t border-navy-800">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-navy-800 hover:bg-navy-700 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-400 to-emerald-400 flex items-center justify-center">
                <span className="text-sm font-bold text-navy-900">
                  {user.name?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-navy-400 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </motion.aside>
    </>
  )
}
