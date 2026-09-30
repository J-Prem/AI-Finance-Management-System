import { FaChevronLeft, FaChevronRight, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa'
import { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'

export default function DataTable({
  columns,
  data,
  loading = false,
  pagination = true,
  pageSize = 10,
  onRowClick,
  searchable = false,
  searchValue = '',
  onSearchChange,
  sortable = true,
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState(null)

  let sortedData = [...data]

  if (sortConfig) {
    sortedData.sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }

  const totalPages = Math.ceil(sortedData.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedData = pagination ? sortedData.slice(startIndex, startIndex + pageSize) : sortedData

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig?.key === key && sortConfig?.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key) => {
    if (sortConfig?.key !== key) return <FaSort className="text-navy-400" />
    return sortConfig.direction === 'asc' ? <FaSortUp className="text-primary-500" /> : <FaSortDown className="text-primary-500" />
  }

  if (loading) {
    return <LoadingSpinner size="md" fullScreen={false} />
  }

  return (
    <div className="card">
      {searchable && (
        <div className="p-4 border-b border-navy-200 dark:border-navy-700">
          <input
            type="text"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="input-base w-full"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-navy-200 dark:border-navy-700">
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => sortable && handleSort(column.key)}
                  className={`px-6 py-4 text-left text-sm font-semibold text-navy-700 dark:text-navy-300 bg-navy-50 dark:bg-navy-800/50 ${
                    sortable ? 'cursor-pointer hover:bg-navy-100 dark:hover:bg-navy-700/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {sortable && getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  className="border-b border-navy-200 dark:border-navy-700 hover:bg-navy-50 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 text-sm text-navy-600 dark:text-navy-400">
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-navy-500 dark:text-navy-400">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="px-6 py-4 flex items-center justify-between border-t border-navy-200 dark:border-navy-700">
          <div className="text-sm text-navy-600 dark:text-navy-400">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 hover:bg-navy-100 dark:hover:bg-navy-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FaChevronLeft />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 hover:bg-navy-100 dark:hover:bg-navy-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FaChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
