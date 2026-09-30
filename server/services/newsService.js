import axios from 'axios';
import cacheService, { cacheKeys } from './cacheService.js';
import { API_CONFIG, REQUEST_CONFIG } from '../config/apis.js';
import logger from '../utils/logger.js';

class NewsService {
  constructor() {
    this.primaryConfig = API_CONFIG.NEWS_API.primary;
    this.fallbackConfig = API_CONFIG.NEWS_API.fallback;
    this.requestConfig = REQUEST_CONFIG;
    this.sentimentKeywords = {
      positive: [
        'bull',
        'surge',
        'gain',
        'profit',
        'recovery',
        'growth',
        'jump',
        'rally',
        'strong',
        'beat',
      ],
      negative: [
        'bear',
        'crash',
        'loss',
        'decline',
        'fall',
        'slump',
        'weak',
        'miss',
        'plunge',
        'drop',
      ],
    };
  }

  /**
   * Get financial news by search query
   */
  async getFinancialNews(query, page = 1, pageSize = 20) {
    const cacheKey = cacheKeys.news(query, page);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for financial news: ${query}`);
      return cached;
    }

    try {
      // Try primary API
      if (this.primaryConfig.apiKey) {
        const news = await this._fetchNewsFromPrimary(
          query,
          page,
          pageSize
        );
        if (news) {
          await cacheService.set(
            cacheKey,
            news,
            this.primaryConfig.cacheTTL
          );
          return news;
        }
      }

      // Try fallback API
      if (this.fallbackConfig.apiKey) {
        const news = await this._fetchNewsFromFallback(
          query,
          page,
          pageSize
        );
        if (news) {
          await cacheService.set(
            cacheKey,
            news,
            this.fallbackConfig.cacheTTL
          );
          return news;
        }
      }

      // KEYLESS RSS FALLBACK — Google News / Yahoo Finance — keeps the wire
      // populated even when no paid API keys are configured.
      const rss = await this._fetchNewsFromRSS(query, pageSize);
      if (rss && rss.articles.length) {
        await cacheService.set(cacheKey, rss, 600);
        return rss;
      }

      throw new Error(`Unable to fetch financial news for ${query}`);
    } catch (error) {
      logger.error(`Error fetching financial news for ${query}:`, error);
      // Return an empty but well-shaped payload rather than throwing — the UI
      // will then degrade gracefully to "no news" rather than showing a 500.
      return { query, totalResults: 0, articles: [], source: 'empty' };
    }
  }

  /**
   * Keyless RSS fallback — parses Google News RSS for the given query.
   * @private
   */
  async _fetchNewsFromRSS(query, pageSize = 20) {
    try {
      const axios = (await import('axios')).default;
      const q = encodeURIComponent(query || 'finance OR markets OR stocks OR economy');
      const url = `https://news.google.com/rss/search?q=${q}+when:2d&hl=en-IN&gl=IN&ceid=IN:en`;
      const { data } = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, text/xml, */*',
        },
      });
      const xml = String(data || '');
      const items = [];
      const itemRe = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRe.exec(xml)) && items.length < pageSize) {
        const body = match[1];
        const pick = (tag) => {
          const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(body);
          if (!m) return '';
          return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
        };
        const title = pick('title');
        const link = pick('link');
        const pubDate = pick('pubDate');
        const description = pick('description');
        const source = pick('source') || 'Google News';
        if (!title) continue;
        items.push({
          title,
          description,
          url: link,
          imageUrl: null,
          source,
          author: null,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          content: null,
          sentiment: this._analyzeSentiment(`${title} ${description}`),
        });
      }
      return {
        query,
        totalResults: items.length,
        articles: items,
        source: 'GoogleNewsRSS',
      };
    } catch (err) {
      logger.warn('RSS news fallback failed:', err.message);
      return { query, totalResults: 0, articles: [], source: 'rss-empty' };
    }
  }

  /**
   * Get top business headlines
   */
  async getTopHeadlines(category = 'business', country = 'us', pageSize = 20) {
    const cacheKey = cacheKeys.newsHeadlines(category, country);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      if (this.primaryConfig.apiKey) {
        const headlines = await this._fetchHeadlinesFromPrimary(
          category,
          country,
          pageSize
        );
        if (headlines) {
          await cacheService.set(
            cacheKey,
            headlines,
            this.primaryConfig.cacheTTL
          );
          return headlines;
        }
      }

      throw new Error('Unable to fetch top headlines');
    } catch (error) {
      logger.error('Error fetching top headlines:', error);
      throw error;
    }
  }

  /**
   * Get market-specific news
   */
  async getMarketNews(symbol) {
    const cacheKey = cacheKeys.marketNews(symbol);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const query = `${symbol} stock market`;
      const news = await this.getFinancialNews(query, 1, 10);

      const marketNews = {
        symbol,
        news: news.articles.slice(0, 10),
        timestamp: new Date(),
      };

      await cacheService.set(
        cacheKey,
        marketNews,
        this.primaryConfig.cacheTTL
      );
      return marketNews;
    } catch (error) {
      logger.error(`Error fetching market news for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get personalized news based on user categories
   */
  async getPersonalizedNews(userCategories = [], pageSize = 20) {
    try {
      const categoryQueries = userCategories.slice(0, 5); // Limit to 5 categories
      const allArticles = [];

      for (const category of categoryQueries) {
        try {
          const news = await this.getFinancialNews(category, 1, 5);
          allArticles.push(...news.articles);
        } catch (error) {
          logger.warn(`Error fetching news for category ${category}:`, error.message);
        }
      }

      // Remove duplicates
      const unique = Array.from(
        new Map(allArticles.map((item) => [item.url, item])).values()
      );

      // Sort by date
      const sorted = unique.sort(
        (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
      );

      return {
        categories: userCategories,
        articles: sorted.slice(0, pageSize),
        totalResults: sorted.length,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Error fetching personalized news:', error);
      throw error;
    }
  }

  /**
   * Fetch news from primary API
   * @private
   */
  async _fetchNewsFromPrimary(query, page, pageSize) {
    try {
      const url = `${this.primaryConfig.baseUrl}/everything`;
      const response = await axios.get(url, {
        params: {
          q: query,
          sortBy: 'publishedAt',
          language: 'en',
          page,
          pageSize,
          apiKey: this.primaryConfig.apiKey,
        },
        timeout: this.requestConfig.timeout,
      });

      if (response.data.articles) {
        return {
          query,
          totalResults: response.data.totalResults,
          articles: response.data.articles.map((article) => ({
            title: article.title,
            description: article.description,
            url: article.url,
            imageUrl: article.urlToImage,
            source: article.source.name,
            author: article.author,
            publishedAt: article.publishedAt,
            content: article.content,
            sentiment: this._analyzeSentiment(
              article.title + ' ' + (article.description || '')
            ),
          })),
          source: 'NewsAPI',
        };
      }

      return null;
    } catch (error) {
      logger.warn('Primary news API failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch news from fallback API
   * @private
   */
  async _fetchNewsFromFallback(query, page, pageSize) {
    try {
      const url = `${this.fallbackConfig.baseUrl}/search`;
      const response = await axios.get(url, {
        params: {
          q: query,
          lang: 'en',
          max: pageSize,
          token: this.fallbackConfig.apiKey,
        },
        timeout: this.requestConfig.timeout,
      });

      if (response.data.articles) {
        return {
          query,
          totalResults: response.data.articles.length,
          articles: response.data.articles.map((article) => ({
            title: article.title,
            description: article.description,
            url: article.url,
            imageUrl: article.image,
            source: article.source,
            author: null,
            publishedAt: article.publishedAt,
            content: null,
            sentiment: this._analyzeSentiment(
              article.title + ' ' + (article.description || '')
            ),
          })),
          source: 'GNews',
        };
      }

      return null;
    } catch (error) {
      logger.warn('Fallback news API failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch headlines from primary API
   * @private
   */
  async _fetchHeadlinesFromPrimary(category, country, pageSize) {
    try {
      const url = `${this.primaryConfig.baseUrl}/top-headlines`;
      const response = await axios.get(url, {
        params: {
          category,
          country,
          pageSize,
          apiKey: this.primaryConfig.apiKey,
        },
        timeout: this.requestConfig.timeout,
      });

      if (response.data.articles) {
        return {
          category,
          country,
          totalResults: response.data.totalResults,
          articles: response.data.articles.map((article) => ({
            title: article.title,
            description: article.description,
            url: article.url,
            imageUrl: article.urlToImage,
            source: article.source.name,
            author: article.author,
            publishedAt: article.publishedAt,
            sentiment: this._analyzeSentiment(
              article.title + ' ' + (article.description || '')
            ),
          })),
          source: 'NewsAPI',
        };
      }

      return null;
    } catch (error) {
      logger.warn('Headlines fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Analyze sentiment of text
   * @private
   */
  _analyzeSentiment(text) {
    const lowerText = String(text || '').toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;
    this.sentimentKeywords.positive.forEach((k) => {
      if (lowerText.includes(k)) positiveScore++;
    });
    this.sentimentKeywords.negative.forEach((k) => {
      if (lowerText.includes(k)) negativeScore++;
    });
    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }
}

export default new NewsService();
