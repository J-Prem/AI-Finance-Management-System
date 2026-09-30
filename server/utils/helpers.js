import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Format currency value
 */
export const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Calculate percentage
 */
export const calculatePercentage = (part, whole) => {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
};

/**
 * Generate API key
 */
export const generateApiKey = () => {
  return `sk_${uuidv4()}`;
};

/**
 * Generate random token
 */
export const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash string (SHA256)
 */
export const hashString = (str) => {
  return crypto.createHash('sha256').update(str).digest('hex');
};

/**
 * Generate UUID
 */
export const generateUUID = () => {
  return uuidv4();
};

/**
 * Parse CSV string to JSON
 */
export const parseCSVHeaders = (csvContent) => {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) return null;

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    rows.push(row);
  }

  return { headers, rows };
};

/**
 * Convert date to start of day
 */
export const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Convert date to end of day
 */
export const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Get start of month
 */
export const startOfMonth = (date = new Date()) => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get end of month
 */
export const endOfMonth = (date = new Date()) => {
  const d = new Date(date);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Get date range for period
 */
export const getDateRange = (period = 'monthly') => {
  const today = new Date();
  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = startOfDay(today);
      endDate = endOfDay(today);
      break;
    case 'weekly':
      startDate = new Date(today.setDate(today.getDate() - today.getDay()));
      startDate = startOfDay(startDate);
      endDate = endOfDay();
      break;
    case 'monthly':
      startDate = startOfMonth();
      endDate = endOfDay();
      break;
    case 'yearly':
      startDate = new Date(new Date().getFullYear(), 0, 1);
      endDate = endOfDay();
      break;
    default:
      startDate = startOfMonth();
      endDate = endOfDay();
  }

  return { startDate, endDate };
};

/**
 * Validate email
 */
export const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Validate URL
 */
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Truncate string
 */
export const truncateString = (str, length = 100) => {
  if (str.length > length) {
    return str.substring(0, length) + '...';
  }
  return str;
};

/**
 * Capitalize string
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Group array by key
 */
export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const groupKey = item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
};

/**
 * Sum array values by key
 */
export const sumBy = (array, key) => {
  return array.reduce((sum, item) => sum + (item[key] || 0), 0);
};

/**
 * Average array values by key
 */
export const averageBy = (array, key) => {
  if (array.length === 0) return 0;
  return sumBy(array, key) / array.length;
};

/**
 * Remove duplicates from array
 */
export const uniqueBy = (array, key) => {
  const seen = new Set();
  return array.filter((item) => {
    const k = item[key];
    if (seen.has(k)) {
      return false;
    }
    seen.add(k);
    return true;
  });
};

/**
 * Sleep async function
 */
export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Paginate array
 */
export const paginate = (array, page = 1, limit = 10) => {
  const start = (page - 1) * limit;
  const end = start + limit;
  return {
    data: array.slice(start, end),
    pagination: {
      page,
      limit,
      total: array.length,
      pages: Math.ceil(array.length / limit),
    },
  };
};

/**
 * Convert object to query string
 */
export const objectToQueryString = (obj) => {
  return Object.keys(obj)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
    .join('&');
};

/**
 * Parse query string to object
 */
export const queryStringToObject = (queryString) => {
  const params = new URLSearchParams(queryString);
  const obj = {};
  for (const [key, value] of params) {
    obj[key] = value;
  }
  return obj;
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Merge objects
 */
export const mergeObjects = (target, source) => {
  return { ...target, ...source };
};

/**
 * Check if object is empty
 */
export const isEmpty = (obj) => {
  return Object.keys(obj).length === 0;
};

/**
 * Format file size
 */
export const formatFileSize = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * Calculate percentage change
 */
export const calculatePercentageChange = (current, previous) => {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
};

/**
 * Format large number with abbreviations
 */
export const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num;
};

/**
 * Validate strong password
 */
export const isStrongPassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChar
  );
};
