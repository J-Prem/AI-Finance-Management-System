import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaMagnifyingGlass, FaClock, FaArrowRight } from 'react-icons/fa6'
import { useNavigate } from 'react-router-dom'
import { globalSearch } from '../../services/searchService'

const KIND_ICON = {
  transaction: '💳',
  receipt: '🧾',
  bill: '📄',
  budget: '🎯',
}

const SEARCH_CATEGORIES = {
  transactions: { label: 'Transactions', icon: '💳', path: '/transactions' },
  merchants: { label: 'Merchants', icon: '🏪', path: '/transactions' },
  categories: { label: 'Categories', icon: '📁', path: '/transactions' },
  budgets: { label: 'Budgets', icon: '🎯', path: '/budgets' },
  analytics: { label: 'Analytics', icon: '📊', path: '/analytics' },
  investments: { label: 'Investments', icon: '📈', path: '/investments' },
  bills: { label: 'Bills', icon: '📄', path: '/bills' },
}

export default function SearchBar() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches')
    if (saved) {
      setRecentSearches(JSON.parse(saved).slice(0, 5))
    }
  }, [])

  // Keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearch = async (query = searchQuery) => {
    if (!query.trim()) return

    // Save to recent searches
    const updated = [query, ...recentSearches.filter((s) => s !== query)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))

    // Perform real search across user data + navigation match
    try {
      const data = await globalSearch(query, 6)
      const apiResults = (data?.results || []).map((r) => ({
        id: `${r.kind}-${r.id}`,
        title: r.title,
        subtitle: r.subtitle,
        icon: KIND_ICON[r.kind] || '🔎',
        path: r.path,
        category: r.kind,
        amount: r.amount,
        currency: r.currency,
      }))
      const navResults = Object.entries(SEARCH_CATEGORIES)
        .filter(([_, data]) => data.label.toLowerCase().includes(query.toLowerCase()))
        .map(([key, data]) => ({
          id: `nav-${key}`,
          title: data.label,
          icon: data.icon,
          path: data.path,
          category: 'navigation',
        }))
      setSearchResults([...apiResults, ...navResults])
    } catch (e) {
      // fall back to nav-only
      const navResults = Object.entries(SEARCH_CATEGORIES)
        .filter(([_, data]) => data.label.toLowerCase().includes(query.toLowerCase()))
        .map(([key, data]) => ({
          id: `nav-${key}`,
          title: data.label,
          icon: data.icon,
          path: data.path,
          category: 'navigation',
        }))
      setSearchResults(navResults)
    }
  }

  const handleResultClick = (result) => {
    navigate(result.path)
    setIsOpen(false)
    setSearchQuery('')
  }

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch(searchQuery)
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  return (
    <div className="relative w-full max-w-md">
      {/* Search Input */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        className={`relative rounded-lg border-2 transition-all ${
          isOpen
            ? 'border-primary-500 dark:border-primary-400 bg-navy-50 dark:bg-navy-800'
            : 'border-navy-300 dark:border-navy-700 bg-white dark:bg-navy-900 hover:border-primary-400 dark:hover:border-primary-500'
        }`}
      >
        <FaMagnifyingGlass
          size={16}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-navy-500 dark:text-navy-400"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search... (Cmd+K)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-4 py-2 bg-transparent text-navy-900 dark:text-navy-100 placeholder-navy-500 dark:placeholder-navy-400 focus:outline-none text-sm"
        />
      </motion.div>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-30"
            />

            {/* Results Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full mt-2 w-full bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-navy-200 dark:border-navy-700 z-40 overflow-hidden"
            >
              <div className="max-h-96 overflow-y-auto">
                {/* Recent Searches */}
                {!searchQuery && recentSearches.length > 0 && (
                  <div className="p-3 border-b border-navy-200 dark:border-navy-700">
                    <p className="text-xs text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold mb-2">
                      Recent Searches
                    </p>
                    <div className="space-y-1">
                      {recentSearches.map((search, idx) => (
                        <motion.button
                          key={idx}
                          onClick={() => {
                            setSearchQuery(search)
                            handleSearch(search)
                          }}
                          className="w-full text-left px-3 py-2 rounded text-sm text-navy-700 dark:text-navy-300 hover:bg-navy-100 dark:hover:bg-navy-700 flex items-center gap-2 transition-colors"
                          whileHover={{ x: 4 }}
                        >
                          <FaClock size={12} className="text-navy-400" />
                          {search}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {searchResults.length > 0 ? (
                  <div className="p-3">
                    <p className="text-xs text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold mb-2">
                      Results
                    </p>
                    <div className="space-y-1">
                      {searchResults.map((result, idx) => (
                        <motion.button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="w-full text-left px-3 py-2 rounded text-sm text-navy-900 dark:text-navy-100 hover:bg-primary-100 dark:hover:bg-primary-900/30 flex items-center justify-between gap-2 transition-colors group"
                          whileHover={{ x: 4 }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg">{result.icon}</span>
                            <div className="min-w-0">
                              <div className="truncate">{result.title}</div>
                              {result.subtitle && (
                                <div className="text-xs text-navy-500 truncate">{result.subtitle}</div>
                              )}
                            </div>
                          </div>
                          {typeof result.amount === 'number' && (
                            <span className="text-xs font-mono ml-2">{result.currency || '$'}{Number(result.amount).toFixed(2)}</span>
                          )}
                          <FaArrowRight
                            size={12}
                            className="text-navy-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
                          />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : searchQuery ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-navy-600 dark:text-navy-400">
                      No results found for "{searchQuery}"
                    </p>
                  </div>
                ) : (
                  <div className="p-4">
                    <p className="text-xs text-navy-600 dark:text-navy-400 uppercase tracking-wider font-semibold mb-3">
                      Quick Navigation
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(SEARCH_CATEGORIES).map(([key, data]) => (
                        <motion.button
                          key={key}
                          onClick={() => {
                            navigate(data.path)
                            setIsOpen(false)
                          }}
                          className="p-3 rounded-lg bg-navy-50 dark:bg-navy-700 hover:bg-navy-100 dark:hover:bg-navy-600 text-left text-sm font-medium text-navy-900 dark:text-navy-100 transition-colors"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className="text-lg mb-1">{data.icon}</span>
                          <p className="text-xs">{data.label}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
