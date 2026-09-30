import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import { format, getDaysInMonth, startOfMonth } from 'date-fns'

// Expand a single bill into all of its expected occurrences within the
// visible month, honouring its frequency. Returns array of day-of-month
// numbers (1..31). The bill schema stores `dueDate` as a day-of-month
// integer plus a full ISO `nextDueDate`; recurring bills repeat from
// either anchor depending on cadence.
function occurrencesInMonth(bill, year, month) {
  const days = []
  const totalDays = new Date(year, month + 1, 0).getDate()
  const freq = bill.frequency || 'monthly'
  const anchorDom = Number(bill.dueDate) || (bill.nextDueDate ? new Date(bill.nextDueDate).getDate() : 1)
  const next = bill.nextDueDate ? new Date(bill.nextDueDate) : null

  if (freq === 'daily') {
    for (let d = 1; d <= totalDays; d++) days.push(d)
    return days
  }
  if (freq === 'weekly' || freq === 'biweekly') {
    const step = freq === 'weekly' ? 7 : 14
    if (!next) return days
    // Walk back/forward from nextDueDate to cover the visible month.
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month, totalDays)
    let cursor = new Date(next)
    while (cursor > monthStart) cursor.setDate(cursor.getDate() - step)
    while (cursor < monthStart) cursor.setDate(cursor.getDate() + step)
    while (cursor <= monthEnd) {
      days.push(cursor.getDate())
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() + step)
    }
    return days
  }
  if (freq === 'monthly') {
    days.push(Math.min(anchorDom, totalDays))
    return days
  }
  if (freq === 'quarterly') {
    if (!next) return days
    // Recurs every 3 months from the nextDueDate anchor month.
    const anchorMonth = next.getMonth()
    const anchorYear = next.getFullYear()
    const monthsDiff = (year - anchorYear) * 12 + (month - anchorMonth)
    if (monthsDiff % 3 === 0) days.push(Math.min(anchorDom, totalDays))
    return days
  }
  if (freq === 'yearly') {
    if (next && next.getMonth() === month) days.push(Math.min(anchorDom, totalDays))
    return days
  }
  return days
}

export default function BillCalendar({ bills = [] }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDayOfMonth = startOfMonth(currentDate).getDay()
  const monthYear = format(currentDate, 'MMMM yyyy')

  // Group bills by day of the visible month, expanding recurring bills to
  // every occurrence. A single bill can therefore appear on multiple cells.
  const billsByDate = useMemo(() => {
    const grouped = {}
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    bills.forEach((bill) => {
      const days = occurrencesInMonth(bill, year, month)
      days.forEach((d) => {
        if (!grouped[d]) grouped[d] = []
        grouped[d].push(bill)
      })
    })
    return grouped
  }, [bills, currentDate])

  const selectedDateBills = selectedDate ? billsByDate[selectedDate] || [] : []

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
    setSelectedDate(null)
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
    setSelectedDate(null)
  }

  const getDayColor = (day) => {
    if (!billsByDate[day]) return ''
    const dayBills = billsByDate[day]
    const allPaid = dayBills.every((b) => b.status === 'paid')
    const anyOverdue = dayBills.some((b) => b.status === 'overdue')

    if (anyOverdue) return 'bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700'
    if (allPaid) return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700'
    return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
  }

  const getDayDotColor = (day) => {
    if (!billsByDate[day]) return ''
    const dayBills = billsByDate[day]
    const allPaid = dayBills.every((b) => b.status === 'paid')
    const anyOverdue = dayBills.some((b) => b.status === 'overdue')

    if (anyOverdue) return 'bg-rose-500'
    if (allPaid) return 'bg-emerald-500'
    return 'bg-amber-500'
  }

  const calendarDays = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  return (
    <motion.div
      className="card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100">{monthYear}</h3>
        <div className="flex gap-2">
          <motion.button
            onClick={prevMonth}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg bg-navy-100 dark:bg-navy-800 text-navy-900 dark:text-navy-100 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
          >
            <FaChevronLeft size={16} />
          </motion.button>
          <motion.button
            onClick={nextMonth}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg bg-navy-100 dark:bg-navy-800 text-navy-900 dark:text-navy-100 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
          >
            <FaChevronRight size={16} />
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center py-2">
            <p className="text-xs font-semibold text-navy-600 dark:text-navy-400 uppercase">
              {day}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 mb-6">
        {calendarDays.map((day, index) => (
          <motion.div
            key={index}
            className={`aspect-square flex items-center justify-center rounded-lg border-2 transition-all cursor-pointer ${
              day
                ? `border-navy-200 dark:border-navy-700 hover:border-primary-400 dark:hover:border-primary-500 ${getDayColor(day)}`
                : 'border-transparent'
            } ${selectedDate === day ? 'ring-2 ring-primary-500' : ''}`}
            onClick={() => day && setSelectedDate(selectedDate === day ? null : day)}
            whileHover={day ? { scale: 1.05 } : {}}
            whileTap={day ? { scale: 0.95 } : {}}
          >
            {day && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-semibold text-navy-900 dark:text-navy-100">
                  {day}
                </span>
                {billsByDate[day] && billsByDate[day].length > 0 && (
                  <div className={`w-1.5 h-1.5 rounded-full ${getDayDotColor(day)}`} />
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs font-medium mb-6 pb-6 border-b border-navy-200 dark:border-navy-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-navy-700 dark:text-navy-300">Paid</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-navy-700 dark:text-navy-300">Upcoming</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-navy-700 dark:text-navy-300">Overdue</span>
        </div>
      </div>

      {/* Bills for Selected Date */}
      <AnimatePresence>
        {selectedDate && selectedDateBills.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <p className="text-sm font-semibold text-navy-900 dark:text-navy-100 mb-3">
              Bills on {format(new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate), 'MMM dd')}
            </p>
            {selectedDateBills.map((bill, idx) => (
              <motion.div
                key={bill._id || bill.id || `${bill.name}-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-3 rounded-lg text-sm ${
                  bill.status === 'paid'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                    : bill.status === 'overdue'
                      ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-navy-100">
                      {bill.name}
                    </p>
                    <p className="text-xs text-navy-600 dark:text-navy-400">
                      {bill.category}
                    </p>
                  </div>
                  <p className="font-semibold text-navy-900 dark:text-navy-100">
                    ${bill.amount}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
