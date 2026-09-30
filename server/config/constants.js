export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free',
    displayName: 'Free Plan',
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: {
      transactionsPerMonth: 100,
      apiCallsPerDay: 5,
      mlPredictionsPerMonth: 10,
      teamMembers: 1,
      budgets: 5,
      exportFormats: ['csv'],
    },
    features: [
      'Basic transaction tracking',
      'Budget creation',
      'Manual categorization',
      'Basic analytics',
    ],
  },
  PRO: {
    name: 'Pro',
    displayName: 'Pro Plan',
    monthlyPrice: 2999, // $29.99 in cents
    yearlyPrice: 29999, // $299.99 in cents
    limits: {
      transactionsPerMonth: 10000,
      apiCallsPerDay: 1000,
      mlPredictionsPerMonth: 5000,
      teamMembers: 10,
      budgets: 100,
      exportFormats: ['csv', 'json', 'pdf'],
    },
    features: [
      'All Free features',
      'AI categorization',
      'Advanced analytics',
      'Spending predictions',
      'Anomaly detection',
      'API access',
      'Team collaboration',
      'Custom budgets',
      'Receipt OCR scanning',
      'Receipt-based personality analysis',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    displayName: 'Enterprise Plan',
    monthlyPrice: 9999, // $99.99 in cents
    yearlyPrice: 99999, // $999.99 in cents
    limits: {
      transactionsPerMonth: null, // unlimited
      apiCallsPerDay: null, // unlimited
      mlPredictionsPerMonth: null, // unlimited
      teamMembers: null, // unlimited
      budgets: null, // unlimited
      exportFormats: ['csv', 'json', 'pdf', 'xml'],
    },
    features: [
      'All Pro features',
      'Unlimited everything',
      'Advanced API features',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
      'Advanced security',
      'White-label options',
      'Custom reporting',
    ],
  },
};

export const TRANSACTION_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Travel',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Education',
  'Personal Care',
  'Home & Garden',
  'Investment',
  'Transfer',
  'Income',
  'Gifts & Donations',
  'Business Services',
  'Financial Charges',
  'Taxes',
  'Uncategorized',
];

export const TRANSACTION_SUBCATEGORIES = {
  'Food & Dining': ['Restaurants', 'Groceries', 'Coffee Shops', 'Fast Food', 'Bars'],
  'Transportation': ['Gas', 'Parking', 'Public Transit', 'Taxi/Rideshare', 'Car Maintenance', 'Insurance'],
  'Travel': ['Flights', 'Hotels', 'Rail', 'Car Rentals', 'Vacation'],
  'Shopping': ['Clothing', 'Electronics', 'Home', 'Books', 'Sports', 'Jewelry'],
  'Entertainment': ['Movies', 'Games', 'Music', 'Hobbies', 'Events'],
  'Bills & Utilities': ['Electric', 'Water', 'Gas', 'Internet', 'Phone', 'Rent'],
  'Healthcare': ['Doctors', 'Dentist', 'Pharmacy', 'Hospital', 'Medical Supplies'],
  'Education': ['Tuition', 'Books', 'Courses', 'School Supplies'],
  'Personal Care': ['Haircut', 'Gym', 'Spa', 'Beauty'],
  'Home & Garden': ['Furniture', 'Garden', 'Repairs', 'Cleaning'],
  'Investment': ['Stocks', 'Crypto', 'Bonds', 'Mutual Funds'],
  'Transfer': ['Bank Transfer', 'Peer to Peer'],
  'Income': ['Salary', 'Freelance', 'Business', 'Bonus', 'Investment Returns'],
  'Gifts & Donations': ['Gifts', 'Charity', 'Donations'],
  'Business Services': ['Software', 'Consulting', 'Legal', 'Accounting'],
  'Financial Charges': ['Fees', 'Interest', 'Bank Charges'],
  'Taxes': ['Federal', 'State', 'Local', 'Sales Tax'],
};

export const CURRENCY_CODES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'ZAR', 'SGD', 'HKD', 'NZD',
];

export const NOTIFICATION_TYPES = {
  BUDGET_ALERT: 'budget_alert',
  ANOMALY_DETECTED: 'anomaly',
  SUBSCRIPTION_UPDATE: 'subscription',
  INSIGHT_GENERATED: 'insight',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_SUCCESS: 'payment_success',
  TEAM_INVITE: 'team_invite',
  TRANSACTION_ADDED: 'transaction_added',
};

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
};

export const TEAM_MEMBER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
};

export const BUDGET_PERIODS = ['weekly', 'monthly', 'yearly'];

export const RECURRING_PATTERNS = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
];

export const PAYMENT_METHODS = [
  'credit_card',
  'debit_card',
  'bank_transfer',
  'paypal',
  'apple_pay',
  'google_pay',
  'crypto',
  'cash',
  'check',
];

export const API_RATE_LIMITS = {
  [SUBSCRIPTION_TIERS.FREE.name]: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 500,
  },
  [SUBSCRIPTION_TIERS.PRO.name]: {
    requestsPerMinute: 100,
    requestsPerHour: 5000,
    requestsPerDay: 50000,
  },
  [SUBSCRIPTION_TIERS.ENTERPRISE.name]: {
    requestsPerMinute: 1000,
    requestsPerHour: 50000,
    requestsPerDay: null, // unlimited
  },
};

export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFICATION: 'email_verification',
  BUDGET_ALERT: 'budget_alert',
  ANOMALY_DETECTED: 'anomaly_detected',
  WEEKLY_DIGEST: 'weekly_digest',
  TEAM_INVITE: 'team_invite',
  PAYMENT_FAILED: 'payment_failed',
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_EXISTS: 'Email already registered',
  USER_NOT_FOUND: 'User not found',
  UNAUTHORIZED: 'Unauthorized access',
  INVALID_TOKEN: 'Invalid or expired token',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  SUBSCRIPTION_LIMIT_EXCEEDED: 'Subscription limit exceeded',
  INVALID_API_KEY: 'Invalid API key',
  RESOURCE_NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_SERVER_ERROR: 'Internal server error',
};

export const SUCCESS_MESSAGES = {
  REGISTRATION_SUCCESS: 'Account created successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_RESET_SUCCESS: 'Password reset successful',
  EMAIL_VERIFIED: 'Email verified successfully',
  TRANSACTION_CREATED: 'Transaction created successfully',
  TRANSACTION_UPDATED: 'Transaction updated successfully',
  TRANSACTION_DELETED: 'Transaction deleted successfully',
  BUDGET_CREATED: 'Budget created successfully',
  SUBSCRIPTION_UPDATED: 'Subscription updated successfully',
};
