import { format, formatDistance, parseISO } from 'date-fns'

export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatNumber = (num, decimals = 2) => {
  return parseFloat(num).toFixed(decimals)
}

export const formatPercentage = (num, decimals = 1) => {
  return `${parseFloat(num).toFixed(decimals)}%`
}

export const formatDate = (date, formatStr = 'MMM dd, yyyy') => {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date
    return format(parsedDate, formatStr)
  } catch (error) {
    return '-'
  }
}

export const formatTime = (date, formatStr = 'HH:mm') => {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date
    return format(parsedDate, formatStr)
  } catch (error) {
    return '-'
  }
}

export const formatDateRange = (startDate, endDate) => {
  try {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate
    return `${format(start, 'MMM dd')} - ${format(end, 'MMM dd, yyyy')}`
  } catch (error) {
    return '-'
  }
}

export const formatRelativeTime = (date) => {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date
    return formatDistance(parsedDate, new Date(), { addSuffix: true })
  } catch (error) {
    return '-'
  }
}

export const formatShortNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toFixed(0)
}

export const truncateText = (text, length = 50) => {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

export const capitalizeFirst = (str) => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const toTitleCase = (str) => {
  if (!str) return ''
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

export const sanitizeInput = (input) => {
  return input.trim().replace(/[^\w\s\-\.@]/g, '')
}
