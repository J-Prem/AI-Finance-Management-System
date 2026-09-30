import api from './api'

// Currency API Calls
export const getRates = async (baseCurrency = 'USD') => {
  return api.get(`/external/currency/rates?base=${baseCurrency}`)
}

export const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  return api.get(`/external/currency/convert`, {
    params: {
      amount,
      from: fromCurrency,
      to: toCurrency,
    },
  })
}

export const getHistoricalRate = async (fromCurrency, toCurrency, days = 30) => {
  return api.get(`/external/currency/historical`, {
    params: {
      from: fromCurrency,
      to: toCurrency,
      days,
    },
  })
}

// Stock API Calls
export const getStockQuote = async (symbol) => {
  return api.get(`/external/stocks/quote/${symbol}`)
}

export const getStockHistory = async (symbol, days = 30) => {
  return api.get(`/external/stocks/history/${symbol}`, {
    params: { days },
  })
}

export const searchStocks = async (query) => {
  return api.get(`/external/stocks/search`, {
    params: { q: query },
  })
}

export const getMarketSummary = async () => {
  return api.get(`/external/stocks/market-summary`)
}

export const getMarketIndices = async () => {
  return api.get(`/external/stocks/indices`)
}

// News API Calls
export const getFinancialNews = async (page = 1, limit = 20) => {
  return api.get(`/external/news/financial`, {
    params: { page, limit },
  })
}

export const getHeadlines = async () => {
  return api.get(`/external/news/headlines`)
}

export const getPersonalizedNews = async (categories = []) => {
  return api.get(`/external/news/personalized`, {
    params: { categories: categories.join(',') },
  })
}

// Investments API Calls
export const searchMutualFunds = async (query) => {
  return api.get(`/external/investments/mf/search`, {
    params: { q: query },
  })
}

export const getMutualFundNAV = async (fundId) => {
  return api.get(`/external/investments/mf/${fundId}/nav`)
}

export const getCryptoPrice = async (cryptoId) => {
  return api.get(`/external/investments/crypto/${cryptoId}`)
}

export const getCryptoMarket = async (limit = 10) => {
  return api.get(`/external/investments/crypto/market`, {
    params: { limit },
  })
}

export const getMetalPrices = async () => {
  return api.get(`/external/investments/metals`)
}

// Reports API Calls
export const getMonthlyReport = async (month, year) => {
  return api.get(`/external/reports/monthly`, {
    params: { month, year },
  })
}

export const getAnnualReport = async (year) => {
  return api.get(`/external/reports/annual`, {
    params: { year },
  })
}

export const exportReport = async (type, format = 'pdf', filters = {}) => {
  const params = new URLSearchParams({ type, format })
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  return api.get(`/external/reports/export?${params.toString()}`, {
    responseType: 'blob',
  })
}

export const getTaxReport = async (year) => {
  return api.get(`/external/reports/tax`, {
    params: { year },
  })
}
