import axios from 'axios';
import cacheService, { cacheKeys } from './cacheService.js';
import { API_CONFIG, REQUEST_CONFIG } from '../config/apis.js';
import logger from '../utils/logger.js';

class InvestmentService {
  constructor() {
    this.cryptoConfig = API_CONFIG.CRYPTO_API.primary;
    this.metalsConfig = API_CONFIG.METALS_API.primary;
    this.metalsFallbackConfig = API_CONFIG.METALS_API.fallback;
    this.requestConfig = REQUEST_CONFIG;
    this.mutualFundUrl = API_CONFIG.MUTUAL_FUND_API.primary.baseUrl;
  }

  /**
   * Get mutual fund NAV by scheme code
   */
  async getMutualFundNAV(schemeCode) {
    const cacheKey = cacheKeys.mutualFundNAV(schemeCode);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for mutual fund NAV: ${schemeCode}`);
      return cached;
    }

    try {
      const url = `${this.mutualFundUrl}/${schemeCode}`;
      const response = await axios.get(url, {
        timeout: this.requestConfig.timeout,
      });

      if (response.data && response.data.data) {
        const latestData = response.data.data[0];
        const navData = {
          schemeCode,
          schemeName: response.data.meta.scheme_name,
          nav: parseFloat(latestData.nav),
          date: latestData.date,
          isin: response.data.meta.isin || null,
          source: 'AMFI',
        };

        await cacheService.set(
          cacheKey,
          navData,
          API_CONFIG.MUTUAL_FUND_API.primary.cacheTTL
        );
        return navData;
      }

      throw new Error('Invalid response from AMFI API');
    } catch (error) {
      logger.error(`Error fetching mutual fund NAV for ${schemeCode}:`, error);
      throw error;
    }
  }

  /**
   * Search mutual funds
   */
  async searchMutualFund(query) {
    const cacheKey = cacheKeys.mutualFundSearch(query);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${this.mutualFundUrl}`;
      const response = await axios.get(url, {
        timeout: this.requestConfig.timeout,
      });

      if (response.data && response.data.data) {
        const queryLower = query.toLowerCase();
        const results = response.data.data.filter((fund) =>
          fund['scheme_name'].toLowerCase().includes(queryLower)
        );

        const searchResults = {
          query,
          results: results.slice(0, 10).map((fund) => ({
            schemeCode: fund['scheme_code'],
            schemeName: fund['scheme_name'],
            type: fund['scheme_type'] || 'Unknown',
            isin: fund['isin'] || null,
          })),
        };

        await cacheService.set(cacheKey, searchResults, 86400); // Cache for 24 hours
        return searchResults;
      }

      throw new Error('Unable to fetch mutual fund list');
    } catch (error) {
      logger.error(`Error searching mutual funds for ${query}:`, error);
      throw error;
    }
  }

  /**
   * Get cryptocurrency price
   */
  async getCryptoPrice(coinId) {
    const cacheKey = cacheKeys.cryptoPrice(coinId);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${this.cryptoConfig.baseUrl}/simple/price`;
      const response = await axios.get(url, {
        params: {
          ids: coinId.toLowerCase(),
          vs_currencies: 'usd,inr',
          include_market_cap: true,
          include_24hr_vol: true,
          include_24hr_change: true,
        },
        timeout: this.requestConfig.timeout,
      });

      if (response.data[coinId.toLowerCase()]) {
        const data = response.data[coinId.toLowerCase()];
        const cryptoData = {
          coinId,
          priceUSD: data.usd,
          priceINR: data.inr || null,
          marketCapUSD: data.usd_market_cap,
          volume24hUSD: data.usd_24h_vol,
          change24h: data.usd_24h_change,
          timestamp: new Date(),
          source: 'CoinGecko',
        };

        await cacheService.set(
          cacheKey,
          cryptoData,
          this.cryptoConfig.cacheTTL
        );
        return cryptoData;
      }

      throw new Error(`Cryptocurrency ${coinId} not found`);
    } catch (error) {
      logger.error(`Error fetching crypto price for ${coinId}:`, error);
      throw error;
    }
  }

  /**
   * Get top cryptocurrencies by market cap
   */
  async getCryptoMarketData(limit = 20) {
    const cacheKey = cacheKeys.cryptoMarket(limit);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `${this.cryptoConfig.baseUrl}/markets`;
      const response = await axios.get(url, {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: limit,
          page: 1,
          sparkline: false,
        },
        timeout: this.requestConfig.timeout,
      });

      const marketData = {
        topCryptos: response.data.map((coin) => ({
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          currentPrice: coin.current_price,
          marketCap: coin.market_cap,
          marketCapRank: coin.market_cap_rank,
          totalVolume: coin.total_volume,
          change24h: coin.price_change_percentage_24h,
          changeMarketCap24h: coin.market_cap_change_percentage_24h,
          ath: coin.ath,
          atl: coin.atl,
        })),
        timestamp: new Date(),
        source: 'CoinGecko',
      };

      await cacheService.set(
        cacheKey,
        marketData,
        this.cryptoConfig.cacheTTL
      );
      return marketData;
    } catch (error) {
      logger.error('Error fetching crypto market data:', error);
      throw error;
    }
  }

  /**
   * Get precious metals prices
   */
  async getMetalPrices() {
    const cacheKey = cacheKeys.metalPrices();

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Try primary API
      if (this.metalsConfig.apiKey) {
        const prices = await this._fetchMetalsFromPrimary();
        if (prices) {
          await cacheService.set(
            cacheKey,
            prices,
            this.metalsConfig.cacheTTL
          );
          return prices;
        }
      }

      // Try fallback API
      if (this.metalsFallbackConfig.apiKey) {
        const prices = await this._fetchMetalsFromFallback();
        if (prices) {
          await cacheService.set(
            cacheKey,
            prices,
            this.metalsFallbackConfig.cacheTTL
          );
          return prices;
        }
      }

      throw new Error('All metals price APIs are unavailable');
    } catch (error) {
      logger.error('Error fetching metals prices:', error);
      throw error;
    }
  }

  /**
   * Calculate portfolio diversification
   */
  async calculatePortfolioDiversification(investments) {
    try {
      let totalValue = 0;
      const assetClassBreakdown = {};

      for (const investment of investments) {
        try {
          let value = investment.currentValue || 0;

          if (!value && investment.quantity && investment.currentPrice) {
            value = investment.quantity * investment.currentPrice;
          }

          totalValue += value;

          const assetClass = investment.type || 'other';
          if (!assetClassBreakdown[assetClass]) {
            assetClassBreakdown[assetClass] = {
              value: 0,
              count: 0,
              investments: [],
            };
          }

          assetClassBreakdown[assetClass].value += value;
          assetClassBreakdown[assetClass].count += 1;
          assetClassBreakdown[assetClass].investments.push({
            name: investment.name,
            symbol: investment.symbol,
            value,
          });
        } catch (error) {
          logger.warn(`Error processing investment:`, error.message);
        }
      }

      const breakdown = {};
      for (const [assetClass, data] of Object.entries(assetClassBreakdown)) {
        breakdown[assetClass] = {
          value: data.value,
          percentage: ((data.value / totalValue) * 100).toFixed(2),
          count: data.count,
          investments: data.investments,
        };
      }

      return {
        totalValue,
        breakdown,
        recommendations: this._generateDiversificationRecommendations(breakdown),
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Error calculating portfolio diversification:', error);
      throw error;
    }
  }

  /**
   * Fetch metals prices from primary API
   * @private
   */
  async _fetchMetalsFromPrimary() {
    try {
      const url = `${this.metalsConfig.baseUrl}/latest`;
      const response = await axios.get(url, {
        params: {
          api_key: this.metalsConfig.apiKey,
          base: 'USD',
          symbols: 'XAU,XAG,XPT,XPD',
        },
        timeout: this.requestConfig.timeout,
      });

      if (response.data.success) {
        return {
          gold: response.data.rates.XAU,
          silver: response.data.rates.XAG,
          platinum: response.data.rates.XPT,
          palladium: response.data.rates.XPD,
          baseCurrency: 'USD',
          timestamp: new Date(response.data.date),
          source: 'Metals API',
        };
      }

      return null;
    } catch (error) {
      logger.warn('Primary metals API failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch metals prices from fallback API
   * @private
   */
  async _fetchMetalsFromFallback() {
    try {
      // Fallback uses simple in-memory rates or would need another service
      logger.warn('Metals fallback API requires additional configuration');
      throw new Error('Fallback metals API not configured');
    } catch (error) {
      logger.warn('Fallback metals API failed:', error.message);
      return null;
    }
  }

  /**
   * Generate diversification recommendations
   * @private
   */
  _generateDiversificationRecommendations(breakdown) {
    const recommendations = [];

    // Check for over-concentration
    for (const [assetClass, data] of Object.entries(breakdown)) {
      const percentage = parseFloat(data.percentage);

      if (percentage > 60) {
        recommendations.push({
          severity: 'high',
          message: `Your ${assetClass} allocation (${percentage.toFixed(1)}%) is very high. Consider diversifying.`,
        });
      } else if (percentage > 40) {
        recommendations.push({
          severity: 'medium',
          message: `Your ${assetClass} allocation (${percentage.toFixed(1)}%) is relatively concentrated.`,
        });
      }
    }

    if (recommendations.length === 0) {
      recommendations.push({
        severity: 'low',
        message: 'Your portfolio appears well-diversified.',
      });
    }

    return recommendations;
  }
}

export default new InvestmentService();
