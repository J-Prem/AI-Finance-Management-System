import express from 'express';
import * as externalApiController from '../controllers/externalApiController.js';
import { optionalAuth, authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: External APIs
 *   description: Real-time market data — Yahoo Finance, CoinGecko, AMFI, exchangerate.host
 */

// ---------------------------- Currency -----------------------------
router.get('/currency/rates', externalApiController.getCurrencyRates);
router.get('/currency/convert', externalApiController.convertCurrency);
router.get('/currency/supported', externalApiController.getSupportedCurrencies);
router.get('/currency/history', externalApiController.getHistoricalRate);
router.get('/currency/historical', externalApiController.getHistoricalRate); // alias

// ----------------------------- Stocks ------------------------------
router.get('/stocks/quote/:symbol', externalApiController.getStockQuote);
router.get('/stocks/history/:symbol', externalApiController.getStockHistory);
router.get('/stocks/search', externalApiController.searchStocks);
router.get('/stocks/market-summary', externalApiController.getMarketSummary);
router.get('/stocks/indices', externalApiController.getMarketIndices);
router.get('/stocks/gainers', externalApiController.getTopGainers);
router.get('/stocks/losers', externalApiController.getTopLosers);
router.get('/stocks/watchlist', externalApiController.getWatchlistQuotes);

// ------------------------------ News -------------------------------
router.get('/news/financial', externalApiController.getFinancialNews);
router.get('/news/headlines', externalApiController.getTopHeadlines);
router.get('/news/market', externalApiController.getMarketNews);
router.post('/news/personalized', optionalAuth, externalApiController.getPersonalizedNews);

// -------------------------- Investments ----------------------------
router.get('/investments/mutual-funds/search', externalApiController.searchMutualFunds);
router.get('/investments/mf/search', externalApiController.searchMutualFunds); // client alias
router.get('/investments/mutual-funds/:schemeCode', externalApiController.getMutualFundNAV);
router.get('/investments/mf/:schemeCode/nav', externalApiController.getMutualFundNAV); // client alias

router.get('/investments/crypto/market', externalApiController.getCryptoMarketData);
router.get('/investments/crypto/:coinId', externalApiController.getCryptoPrice);
router.get('/investments/metals', externalApiController.getMetalPrices);

router.post('/investments/price-holdings', optionalAuth, externalApiController.priceHoldings);

// ----------------------------- Economy -----------------------------
router.get('/economy/inflation', externalApiController.getEconomy);
router.get('/economy', externalApiController.getEconomy);

export default router;
