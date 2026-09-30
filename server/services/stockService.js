import axios from 'axios';
import cacheService, { cacheKeys } from './cacheService.js';
import { API_CONFIG, REQUEST_CONFIG, ERROR_CONFIG } from '../config/apis.js';
import logger from '../utils/logger.js';

class StockService {
  constructor() {
    this.primaryConfig = API_CONFIG.STOCK_API.primary;
    this.fallbackConfig = API_CONFIG.STOCK_API.fallback;
    this.requestConfig = REQUEST_CONFIG;
    this.majorIndices = {
      US: ['GSPC', 'IXIC', 'DJI'], // S&P 500, NASDAQ, Dow Jones
      IN: ['SENSEX', 'NIFTY'], // Indian indices
    };
  }

  /**
   * Get real-time stock quote
   */
  async getStockQuote(symbol) {
    const cacheKey = cacheKeys.stockQuote(symbol);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for stock quote: ${symbol}`);
      return cached;
    }

    try {
      // Try primary API
      if (this.primaryConfig.apiKey) {
        const quote = await this._fetchQuoteFromPrimary(symbol);
        if (quote) {
          await cacheService.set(
            cacheKey,
            quote,
            this.primaryConfig.cacheTTL
          );
          return quote;
        }
      }

      // Try fallback API
      if (this.fallbackConfig.apiKey) {
        const quote = await this._fetchQuoteFromFallback(symbol);
        if (quote) {
          await cacheService.set(
            cacheKey,
            quote,
            this.fallbackConfig.cacheTTL
          );
          return quote;
        }
      }

      throw new Error(`Unable to fetch quote for ${symbol}`);
    } catch (error) {
      logger.error(`Error fetching stock quote for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get historical stock prices
   */
  async getStockHistory(symbol, period = '1m') {
    const cacheKey = cacheKeys.stockHistory(symbol, period);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Map period to API parameters
      const timeSeriesFunction = this._mapPeriodToFunction(period);

      if (this.primaryConfig.apiKey) {
        const history = await this._fetchHistoryFromPrimary(
          symbol,
          timeSeriesFunction
        );
        if (history) {
          await cacheService.set(
            cacheKey,
            history,
            this.primaryConfig.cacheTTL
          );
          return history;
        }
      }

      throw new Error(`Unable to fetch history for ${symbol}`);
    } catch (error) {
      logger.error(
        `Error fetching stock history for ${symbol} (${period}):`,
        error
      );
      throw error;
    }
  }

  /**
   * Search for stocks/companies
   */
  async searchStocks(query) {
    const cacheKey = cacheKeys.stockSearch(query);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      if (this.primaryConfig.apiKey) {
        const results = await this._searchFromPrimary(query);
        if (results) {
          await cacheService.set(cacheKey, results, 3600); // Cache for 1 hour
          return results;
        }
      }

      throw new Error(`Search failed for ${query}`);
    } catch (error) {
      logger.error(`Error searching stocks for ${query}:`, error);
      throw error;
    }
  }

  /**
   * Get major market indices summary
   */
  async getMarketSummary(region = 'US') {
    const cacheKey = cacheKeys.marketSummary(region);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const symbols = this.majorIndices[region] || this.majorIndices.US;
      const quotes = [];

      for (const symbol of symbols) {
        try {
          const quote = await this.getStockQuote(`^${symbol}`);
          quotes.push(quote);
        } catch (error) {
          logger.warn(`Failed to get quote for index ${symbol}:`, error.message);
        }
      }

      const summary = {
        region,
        indices: quotes,
        timestamp: new Date(),
      };

      await cacheService.set(
        cacheKey,
        summary,
        this.primaryConfig.cacheTTL
      );
      return summary;
    } catch (error) {
      logger.error(`Error fetching market summary for ${region}:`, error);
      throw error;
    }
  }

  /**
   * Get top gaining stocks
   */
  async getTopGainers(limit = 10) {
    // This requires premium API or third-party data
    logger.warn('Top gainers endpoint requires premium API');
    throw new Error('Top gainers feature requires premium API subscription');
  }

  /**
   * Get top losing stocks
   */
  async getTopLosers(limit = 10) {
    // This requires premium API or third-party data
    logger.warn('Top losers endpoint requires premium API');
    throw new Error('Top losers feature requires premium API subscription');
  }

  /**
   * Calculate portfolio value
   */
  async calculatePortfolioValue(holdings) {
    try {
      const portfolio = {
        totalValue: 0,
        totalCost: 0,
        holdings: [],
        timestamp: new Date(),
      };

      for (const holding of holdings) {
        try {
          const quote = await this.getStockQuote(holding.symbol);

          const currentValue = holding.quantity * quote.price;
          const costBasis = holding.quantity * holding.buyPrice;
          const pnl = currentValue - costBasis;
          const pnlPercent = (pnl / costBasis) * 100;

          portfolio.holdings.push({
            ...holding,
            currentPrice: quote.price,
            currentValue,
            pnl,
            pnlPercent: Math.round(pnlPercent * 100) / 100,
            lastUpdated: quote.timestamp,
          });

          portfolio.totalValue += currentValue;
          portfolio.totalCost += costBasis;
        } catch (error) {
          logger.error(`Error calculating value for ${holding.symbol}:`, error.message);
        }
      }

      portfolio.totalPnl = portfolio.totalValue - portfolio.totalCost;
      portfolio.totalPnlPercent =
        (portfolio.totalPnl / portfolio.totalCost) * 100;

      return portfolio;
    } catch (error) {
      logger.error('Error calculating portfolio value:', error);
      throw error;
    }
  }

  /**
   * Fetch quote from primary API
   * @private
   */
  async _fetchQuoteFromPrimary(symbol) {
    try {
      const url = this.primaryConfig.baseUrl;
      const response = await axios.get(url, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol,
          apikey: this.primaryConfig.apiKey,
        },
        timeout: this.requestConfig.timeout,
      });

      if (response.data['Global Quote']) {
        const data = response.data['Global Quote'];
        return {
          symbol,
          price: parseFloat(data['05. price']),
          change: parseFloat(data['09. change']),
          changePercent: parseFloat(data['10. change percent']),
          open: parseFloat(data['02. open']),
          high: parseFloat(data['03. high']),
          low: parseFloat(data['04. low']),
          volume: parseInt(data['06. volume']),
          timestamp: new Date(data['07. latest trading day']),
          source: 'Alpha Vantage',
        };
      }

      return null;
    } catch (error) {
      logger.warn('Primary stock API failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch quote from fallback API
   * @private
   */
  async _fetchQuoteFromFallback(symbol) {
    try {
      const url = `${this.fallbackConfig.baseUrl}/quote`;
      const response = await axios.get(url, {
        params: {
          symbol,
          apikey: this.fallbackConfig.apiKey,
        },
        timeout: this.requestConfig.timeout,
      });

      if (response.data.status === 'ok' && response.data.data) {
        const data = response.data.data[0];
        return {
          symbol,
          price: parseFloat(data.close),
          change: parseFloat(data.close) - parseFloat(data.open),
          changePercent:
            ((parseFloat(data.close) - parseFloat(data.open)) /
              parseFloat(data.open)) *
            100,
          open: parseFloat(data.open),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          volume: parseInt(data.volume),
          timestamp: new Date(data.datetime),
          source: 'Twelve Data',
        };
      }

      return null;
    } catch (error) {
      logger.warn('Fallback stock API failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch history from primary API
   * @private
   */
  async _fetchHistoryFromPrimary(symbol, timeSeriesFunction) {
    try {
      const url = this.primaryConfig.baseUrl;
      const response = await axios.get(url, {
        params: {
          function: timeSeriesFunction,
          symbol,
          apikey: this.primaryConfig.apiKey,
        },
        timeout: this.requestConfig.timeout,
      });

      const timeSeries = response.data[
        Object.keys(response.data).find((key) => key.includes('Time Series'))
      ];

      if (!timeSeries) {
        return null;
      }

      const history = Object.entries(timeSeries).map(([date, data]) => ({
        date,
        open: parseFloat(data['1. open']),
        high: parseFloat(data['2. high']),
        low: parseFloat(data['3. low']),
        close: parseFloat(data['4. close']),
        volume: parseInt(data['5. volume']),
      }));

      return {
        symbol,
        history: history.slice(0, 252), // Last ~1 year of trading days
        source: 'Alpha Vantage',
      };
    } catch (error) {
      logger.warn('Primary stock history API failed:', error.message);
      return null;
    }
  }

  /**
   * Search stocks from primary API
   * @private
   */
  async _searchFromPrimary(query) {
    try {
      const url = this.primaryConfig.baseUrl;
      const response = await axios.get(url, {
        params: {
          function: 'SYMBOL_SEARCH',
          keywords: query,
          apikey: this.primaryConfig.apiKey,
        },
        timeout: this.requestConfig.timeout,
      });

      if (response.data.bestMatches) {
        return {
          query,
          results: response.data.bestMatches.map((match) => ({
            symbol: match['1. symbol'],
            name: match['2. name'],
            type: match['3. type'],
            region: match['4. region'],
            currency: match['8. currency'],
            matchScore: parseFloat(match['9. matchScore']),
          })),
        };
      }

      return null;
    } catch (error) {
      logger.warn('Stock search failed:', error.message);
      return null;
    }
  }

  /**
   * Map period to API function name
   * @private
   */
  _mapPeriodToFunction(period) {
    const mapping = {
      '1d': 'TIME_SERIES_DAILY',
      '1w': 'TIME_SERIES_DAILY',
      '1m': 'TIME_SERIES_DAILY',
      '3m': 'TIME_SERIES_DAILY',
      '1y': 'TIME_SERIES_DAILY',
    };
    return mapping[period] || 'TIME_SERIES_DAILY';
  }
}

export default new StockService();
