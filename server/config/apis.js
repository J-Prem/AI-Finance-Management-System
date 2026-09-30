/**
 * Central API configuration for all external services
 */

export const API_CONFIG = {
  // Currency Exchange APIs
  EXCHANGE_RATE_API: {
    primary: {
      name: 'ExchangeRate-API',
      baseUrl: 'https://v6.exchangerate-api.com/v6',
      apiKey: process.env.EXCHANGE_RATE_API_KEY,
      rateLimit: {
        requestsPerMonth: 1500, // Free tier
        requestsPerSecond: 1,
      },
      supportedCurrencies: 150,
      cacheTTL: 3600, // 1 hour
    },
    fallback: {
      name: 'Open Exchange Rates',
      baseUrl: 'https://openexchangerates.org/api',
      apiKey: process.env.OPEN_EXCHANGE_RATES_API_KEY,
      rateLimit: {
        requestsPerMonth: 1000, // Free tier
        requestsPerSecond: 10,
      },
      supportedCurrencies: 200,
      cacheTTL: 3600,
    },
  },

  // Stock Market APIs
  STOCK_API: {
    primary: {
      name: 'Alpha Vantage',
      baseUrl: 'https://www.alphavantage.co/query',
      apiKey: process.env.ALPHA_VANTAGE_API_KEY,
      rateLimit: {
        requestsPerMinute: 5, // Free tier
        requestsPerDay: 500,
      },
      cacheTTL: 300, // 5 minutes
      functions: ['GLOBAL_QUOTE', 'TIME_SERIES_DAILY', 'SYMBOL_SEARCH'],
    },
    fallback: {
      name: 'Twelve Data',
      baseUrl: 'https://api.twelvedata.com',
      apiKey: process.env.TWELVE_DATA_API_KEY,
      rateLimit: {
        requestsPerMinute: 10, // Free tier
        requestsPerDay: 800,
      },
      cacheTTL: 300,
    },
  },

  // Financial News APIs
  NEWS_API: {
    primary: {
      name: 'NewsAPI',
      baseUrl: 'https://newsapi.org/v2',
      apiKey: process.env.NEWS_API_KEY,
      rateLimit: {
        requestsPerDay: 100, // Free tier
        requestsPerSecond: 1,
      },
      cacheTTL: 900, // 15 minutes
      endpoints: ['everything', 'top-headlines'],
    },
    fallback: {
      name: 'GNews',
      baseUrl: 'https://gnews.io/api/v4',
      apiKey: process.env.GNEWS_API_KEY,
      rateLimit: {
        requestsPerDay: 150, // Free tier
        requestsPerSecond: 1,
      },
      cacheTTL: 900,
    },
  },

  // Investment APIs
  MUTUAL_FUND_API: {
    primary: {
      name: 'AMFI API',
      baseUrl: 'https://api.mfapi.in/mf',
      apiKey: null, // No auth required for AMFI
      rateLimit: {
        requestsPerSecond: 2,
      },
      cacheTTL: 86400, // 24 hours (NAV updates daily)
      region: 'IN',
    },
  },

  CRYPTO_API: {
    primary: {
      name: 'CoinGecko',
      baseUrl: 'https://api.coingecko.com/api/v3',
      apiKey: process.env.COINGECKO_API_KEY || null, // Free tier doesn't require key
      rateLimit: {
        requestsPerSecond: 10, // Free tier
      },
      cacheTTL: 300, // 5 minutes
    },
  },

  METALS_API: {
    primary: {
      name: 'Metals API',
      baseUrl: 'https://metals-api.com/api',
      apiKey: process.env.METALS_API_KEY,
      rateLimit: {
        requestsPerMonth: 250, // Free tier
      },
      cacheTTL: 3600, // 1 hour
      metals: ['gold', 'silver', 'platinum', 'palladium'],
    },
    fallback: {
      name: 'Twelve Data Metals',
      baseUrl: 'https://api.twelvedata.com/metal',
      apiKey: process.env.TWELVE_DATA_API_KEY,
      rateLimit: {
        requestsPerDay: 800,
      },
      cacheTTL: 3600,
    },
  },

  // Payment APIs
  RAZORPAY: {
    baseUrl: 'https://api.razorpay.com/v1',
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    maxRetries: 3,
    timeout: 10000,
  },

  STRIPE: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publicKey: process.env.STRIPE_PUBLIC_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    maxRetries: 3,
    timeout: 10000,
  },
};

/**
 * Global request configuration
 */
export const REQUEST_CONFIG = {
  timeout: 10000,
  retries: 3,
  backoffMultiplier: 2,
  maxBackoffDelay: 30000,
  userAgent: 'AI-Finance-Management/1.0',
};

/**
 * Error handling configuration
 */
export const ERROR_CONFIG = {
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'],
};

export default API_CONFIG;
