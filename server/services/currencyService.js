import axios from 'axios';
import cacheService, { cacheKeys } from './cacheService.js';
import { API_CONFIG, REQUEST_CONFIG, ERROR_CONFIG } from '../config/apis.js';
import logger from '../utils/logger.js';

class CurrencyService {
  constructor() {
    this.primaryConfig = API_CONFIG.EXCHANGE_RATE_API.primary;
    this.fallbackConfig = API_CONFIG.EXCHANGE_RATE_API.fallback;
    this.requestConfig = REQUEST_CONFIG;
  }

  /**
   * Get all currency rates for a base currency
   */
  async getCurrencyRates(base = 'USD') {
    const cacheKey = cacheKeys.currencyRates(base);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for currency rates: ${base}`);
      return cached;
    }

    try {
      // Try primary API
      if (this.primaryConfig.apiKey) {
        const rates = await this._fetchRatesFromPrimary(base);
        if (rates) {
          await cacheService.set(
            cacheKey,
            rates,
            this.primaryConfig.cacheTTL
          );
          return rates;
        }
      }

      // Try fallback API
      if (this.fallbackConfig.apiKey) {
        const rates = await this._fetchRatesFromFallback(base);
        if (rates) {
          await cacheService.set(
            cacheKey,
            rates,
            this.fallbackConfig.cacheTTL
          );
          return rates;
        }
      }

      throw new Error('All currency rate APIs are unavailable');
    } catch (error) {
      logger.error(`Error fetching currency rates for ${base}:`, error);
      throw error;
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convertCurrency(amount, from, to) {
    if (from === to) {
      return {
        amount,
        from,
        to,
        rate: 1,
        convertedAmount: amount,
        timestamp: new Date(),
      };
    }

    try {
      const rates = await this.getCurrencyRates(from);
      const rate = rates.rates[to];

      if (!rate) {
        throw new Error(`Unsupported currency pair: ${from}/${to}`);
      }

      const convertedAmount = amount * rate;

      return {
        amount,
        from,
        to,
        rate,
        convertedAmount: Math.round(convertedAmount * 100) / 100,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(`Currency conversion error (${from} to ${to}):`, error);
      throw error;
    }
  }

  /**
   * Get list of supported currencies
   */
  async getSupportedCurrencies() {
    const cacheKey = 'currency:supported';

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const rates = await this.getCurrencyRates('USD');
      const currencies = Object.keys(rates.rates).map((code) => ({
        code,
        name: this._getCurrencyName(code),
        symbol: this._getCurrencySymbol(code),
      }));

      // Cache for 24 hours
      await cacheService.set(cacheKey, currencies, 86400);
      return currencies;
    } catch (error) {
      logger.error('Error fetching supported currencies:', error);
      throw error;
    }
  }

  /**
   * Get historical exchange rate for a specific date
   */
  async getHistoricalRate(date, from, to) {
    // Note: Free tier APIs typically don't support historical data
    // This is for reference when upgrading to paid tier
    const cacheKey = cacheKeys.historicalRate(date, from, to);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // This would require a paid API like fixer.io or exchangerate-api premium
      logger.warn('Historical rates not available on free tier. Consider upgrading API.');
      throw new Error('Historical rate API not configured. Upgrade to premium tier.');
    } catch (error) {
      logger.error(
        `Error fetching historical rate for ${date} (${from}/${to}):`,
        error
      );
      throw error;
    }
  }

  /**
   * Fetch rates from primary API
   * @private
   */
  async _fetchRatesFromPrimary(base) {
    try {
      const url = `${this.primaryConfig.baseUrl}/${this.primaryConfig.apiKey}/latest/${base}`;
      const response = await axios.get(url, {
        timeout: this.requestConfig.timeout,
      });

      if (response.data.result === 'success') {
        return {
          base: response.data.base,
          rates: response.data.conversion_rates,
          timestamp: new Date(response.data.time_last_update_utc),
          source: 'ExchangeRate-API',
        };
      }

      throw new Error(`API error: ${response.data['error-type']}`);
    } catch (error) {
      logger.warn('Primary currency API failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch rates from fallback API
   * @private
   */
  async _fetchRatesFromFallback(base) {
    try {
      const url = `${this.fallbackConfig.baseUrl}/latest.json?app_id=${this.fallbackConfig.apiKey}&base=${base}`;
      const response = await axios.get(url, {
        timeout: this.requestConfig.timeout,
      });

      return {
        base: response.data.base,
        rates: response.data.rates,
        timestamp: new Date(response.data.timestamp * 1000),
        source: 'Open Exchange Rates',
      };
    } catch (error) {
      logger.warn('Fallback currency API failed:', error.message);
      return null;
    }
  }

  /**
   * Get currency name by code
   * @private
   */
  _getCurrencyName(code) {
    const names = {
      USD: 'US Dollar',
      EUR: 'Euro',
      GBP: 'British Pound',
      JPY: 'Japanese Yen',
      AUD: 'Australian Dollar',
      CAD: 'Canadian Dollar',
      CHF: 'Swiss Franc',
      CNY: 'Chinese Yuan',
      INR: 'Indian Rupee',
      MXN: 'Mexican Peso',
      BRL: 'Brazilian Real',
      ZAR: 'South African Rand',
      SGD: 'Singapore Dollar',
      HKD: 'Hong Kong Dollar',
      NZD: 'New Zealand Dollar',
    };
    return names[code] || code;
  }

  /**
   * Get currency symbol by code
   * @private
   */
  _getCurrencySymbol(code) {
    const symbols = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      AUD: 'A$',
      CAD: 'C$',
      CHF: 'Fr',
      CNY: '¥',
      INR: '₹',
      MXN: '$',
      BRL: 'R$',
      ZAR: 'R',
      SGD: 'S$',
      HKD: 'HK$',
      NZD: 'NZ$',
    };
    return symbols[code] || code;
  }
}

export default new CurrencyService();
