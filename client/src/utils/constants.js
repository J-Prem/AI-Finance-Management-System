import {
  FaHome,
  FaExchangeAlt,
  FaChartLine,
  FaRobot,
  FaCog,
  FaCreditCard,
  FaUsers,
  FaChartBar,
  FaKey,
  FaLock,
  FaArrowUp,
  FaReceipt,
  FaFileAlt,
} from 'react-icons/fa'

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer']

export const TRANSACTION_CATEGORIES = {
  income: [
    { id: 'salary', label: 'Salary', icon: '💼' },
    { id: 'freelance', label: 'Freelance', icon: '🎯' },
    { id: 'investment', label: 'Investment', icon: '📈' },
    { id: 'bonus', label: 'Bonus', icon: '🎁' },
    { id: 'other_income', label: 'Other', icon: '💰' },
  ],
  expense: [
    { id: 'food', label: 'Food & Dining', icon: '🍔' },
    { id: 'transport', label: 'Transportation', icon: '🚗' },
    { id: 'utilities', label: 'Utilities', icon: '⚡' },
    { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
    { id: 'healthcare', label: 'Healthcare', icon: '🏥' },
    { id: 'shopping', label: 'Shopping', icon: '🛍️' },
    { id: 'subscriptions', label: 'Subscriptions', icon: '📱' },
    { id: 'insurance', label: 'Insurance', icon: '🛡️' },
    { id: 'education', label: 'Education', icon: '📚' },
    { id: 'travel', label: 'Travel', icon: '✈️' },
    { id: 'other_expense', label: 'Other', icon: '💸' },
  ],
}

export const CATEGORY_COLORS = {
  food: '#FF6B6B',
  transport: '#4ECDC4',
  utilities: '#45B7D1',
  entertainment: '#FFA07A',
  healthcare: '#98D8C8',
  shopping: '#F7DC6F',
  subscriptions: '#BB8FCE',
  insurance: '#85C1E2',
  education: '#F8B88B',
  travel: '#52C77C',
  salary: '#52C77C',
  freelance: '#3498DB',
  investment: '#E74C3C',
  bonus: '#F39C12',
  other_income: '#95A5A6',
  other_expense: '#BDC3C7',
}

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'month',
    features: [
      'Up to 100 transactions',
      'Basic analytics',
      'Manual categorization',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    period: 'month',
    features: [
      'Unlimited transactions',
      'Advanced analytics',
      'AI categorization',
      'Spending predictions',
      'Budget management',
      'Priority email support',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 29.99,
    period: 'month',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Custom reports',
      'API access',
      'Spending DNA analysis',
      'Subscription insights',
      'Dedicated support',
    ],
  },
]

export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: FaHome },
  { id: 'monitoring', label: 'Ops Console', path: '/monitoring', icon: FaChartLine },
  { id: 'transactions', label: 'Transactions', path: '/transactions', icon: FaExchangeAlt },
  { id: 'receipts', label: 'Receipts (OCR)', path: '/receipts', icon: FaReceipt },
  { id: 'personality', label: 'Spender DNA', path: '/personality', icon: FaRobot },
  { id: 'budgets', label: 'Budgets', path: '/budgets', icon: FaChartBar },
  { id: 'investments', label: 'Investments', path: '/investments', icon: FaArrowUp },
  { id: 'bills', label: 'Bills', path: '/bills', icon: FaReceipt },
  { id: 'analytics', label: 'Analytics', path: '/analytics', icon: FaChartLine },
  { id: 'market', label: 'Market', path: '/market', icon: FaChartLine },
  { id: 'reports', label: 'Reports', path: '/reports', icon: FaFileAlt },
  { id: 'chatbot', label: 'AI Advisor', path: '/chatbot', icon: FaRobot },
]

export const SECONDARY_NAVIGATION = [
  { id: 'subscription', label: 'Subscription', path: '/subscription', icon: FaCreditCard },
  { id: 'team', label: 'Team', path: '/team', icon: FaUsers },
  { id: 'api-keys', label: 'API Keys', path: '/api-keys', icon: FaKey },
  { id: 'settings', label: 'Settings', path: '/settings', icon: FaCog },
]

export const ADMIN_NAVIGATION = [
  { id: 'admin', label: 'Admin Panel', path: '/admin', icon: FaCog },
]

export const BUDGET_PERIODS = ['weekly', 'monthly', 'quarterly', 'yearly']

export const DATE_RANGES = [
  { id: 'week', label: 'This Week', days: 7 },
  { id: 'month', label: 'This Month', days: 30 },
  { id: 'quarter', label: 'This Quarter', days: 90 },
  { id: 'year', label: 'This Year', days: 365 },
  { id: 'all', label: 'All Time', days: null },
]

export const FINANCIAL_HEALTH_RANGES = [
  { min: 0, max: 20, label: 'Poor', color: '#E74C3C' },
  { min: 20, max: 40, label: 'Fair', color: '#F39C12' },
  { min: 40, max: 60, label: 'Good', color: '#F1C40F' },
  { min: 60, max: 80, label: 'Very Good', color: '#27AE60' },
  { min: 80, max: 100, label: 'Excellent', color: '#16A085' },
]

export const API_ERROR_MESSAGES = {
  401: 'Authentication failed. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  500: 'An error occurred on the server. Please try again later.',
  503: 'Service is temporarily unavailable. Please try again later.',
}

export const SPENDING_PERSONALITY_TYPES = [
  'Saver',
  'Spender',
  'Investor',
  'Balanced',
  'Minimalist',
]

export const ML_FEATURES = [
  'categorize',
  'predict',
  'anomalies',
  'personality',
  'health',
  'dna',
  'subscriptions',
  'patterns',
  'what-if',
  'chatbot',
]

// New constants for enhanced features
export const MARKET_INDICES = [
  { id: 'sensex', name: 'Sensex', symbol: 'SENSEX', country: 'India' },
  { id: 'nifty', name: 'Nifty 50', symbol: 'NIFTY', country: 'India' },
  { id: 'sp500', name: 'S&P 500', symbol: 'SPX', country: 'USA' },
  { id: 'nasdaq', name: 'Nasdaq', symbol: 'IXIC', country: 'USA' },
  { id: 'dax', name: 'DAX', symbol: 'DAX', country: 'Germany' },
  { id: 'ftse', name: 'FTSE 100', symbol: 'FTSE', country: 'UK' },
]

export const CRYPTO_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', icon: '₿' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', icon: 'Ξ' },
  { id: 'binance', symbol: 'BNB', name: 'Binance Coin', icon: '🪙' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', icon: '🪙' },
  { id: 'ripple', symbol: 'XRP', name: 'Ripple', icon: '🪙' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', icon: '🪙' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', icon: '🪙' },
]

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso', flag: '🇲🇽' },
]

export const INVESTMENT_TYPES = [
  { id: 'stocks', label: 'Stocks', icon: '📈' },
  { id: 'mutualFunds', label: 'Mutual Funds', icon: '🏦' },
  { id: 'crypto', label: 'Cryptocurrency', icon: '₿' },
  { id: 'gold', label: 'Gold/Metals', icon: '🪙' },
  { id: 'bonds', label: 'Bonds', icon: '📊' },
  { id: 'etf', label: 'ETF', icon: '📑' },
]

export const BILL_CATEGORIES = [
  { id: 'utilities', label: 'Utilities', icon: '⚡' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📱' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️' },
  { id: 'healthcare', label: 'Healthcare', icon: '🏥' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'transport', label: 'Transportation', icon: '🚗' },
  { id: 'finance', label: 'Financial', icon: '💳' },
  { id: 'other', label: 'Other', icon: '📋' },
]

export const BILL_FREQUENCY = [
  { id: 'once', label: 'One-time' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
]

export const REPORT_TYPES = [
  { id: 'monthly', label: 'Monthly Report' },
  { id: 'quarterly', label: 'Quarterly Report' },
  { id: 'annual', label: 'Annual Report' },
  { id: 'tax', label: 'Tax Report' },
  { id: 'custom', label: 'Custom Report' },
]
