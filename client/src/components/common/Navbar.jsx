import { FaCog, FaSignOutAlt, FaMoon, FaSun } from 'react-icons/fa'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../../store/slices/authSlice'
import { toggleTheme } from '../../store/slices/uiSlice'
import { useDarkMode } from '../../hooks/useDarkMode'
import SearchBar from './SearchBar'
import NotificationPanel from './NotificationPanel'

export default function Navbar() {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { isDark } = useDarkMode()

  const handleLogout = async () => {
    await dispatch(logout())
    navigate('/')
  }

  return (
    <nav className="bg-white dark:bg-navy-800 border-b border-navy-200 dark:border-navy-700 shadow-sm">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <SearchBar />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4 ml-6">
          {/* Theme Toggle */}
          <button
            onClick={() => dispatch(toggleTheme())}
            className="p-2 hover:bg-navy-100 dark:hover:bg-navy-700 rounded-lg transition-colors text-navy-600 dark:text-navy-400"
          >
            {isDark ? <FaSun size={18} /> : <FaMoon size={18} />}
          </button>

          {/* Notifications */}
          <NotificationPanel />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 hover:bg-navy-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-400 to-emerald-400 flex items-center justify-center">
                <span className="text-xs font-bold text-navy-900">
                  {user?.name?.[0]?.toUpperCase()}
                </span>
              </div>
              <span className="hidden sm:block text-sm font-medium text-navy-900 dark:text-navy-100">
                {user?.name}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-700 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => {
                    navigate('/settings')
                    setShowUserMenu(false)
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-navy-600 dark:text-navy-300 hover:bg-navy-100 dark:hover:bg-navy-700 transition-colors border-b border-navy-200 dark:border-navy-700"
                >
                  <FaCog size={16} />
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 text-rose-600 dark:text-rose-400 hover:bg-navy-100 dark:hover:bg-navy-700 transition-colors"
                >
                  <FaSignOutAlt size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
