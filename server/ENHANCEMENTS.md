# AI Finance Management Backend - Enhancements

This document outlines all the new features added to the Node.js backend of the AI Finance Management SaaS application.

## Overview

The backend has been enhanced with comprehensive external API integrations, investment tracking, bill management, advanced reporting, and real-time notifications.

## New Services

### 1. Currency Service (`services/currencyService.js`)
Handles currency exchange rate operations with multiple API fallbacks.

**Features:**
- Get real-time exchange rates from ExchangeRate-API
- Convert between 150+ currencies
- List supported currencies
- Historical rate fetching (premium tier)
- Automatic caching (1 hour TTL)
- Fallback to Open Exchange Rates API

**Key Methods:**
- `getCurrencyRates(base)` - Get all rates for a base currency
- `convertCurrency(amount, from, to)` - Convert between currencies
- `getSupportedCurrencies()` - List all supported currencies
- `getHistoricalRate(date, from, to)` - Historical exchange rates

### 2. Stock Service (`services/stockService.js`)
Real-time stock market data and portfolio tracking.

**Features:**
- Real-time stock quotes via Alpha Vantage API
- Historical price data (5-minute cache)
- Stock symbol search
- Major market indices (S&P 500, NASDAQ, NIFTY, SENSEX)
- Portfolio value calculation with P&L tracking
- Fallback to Twelve Data API

**Key Methods:**
- `getStockQuote(symbol)` - Real-time stock price
- `getStockHistory(symbol, period)` - Historical data (1d, 1w, 1m, 3m, 1y)
- `searchStocks(query)` - Search for stocks/companies
- `getMarketSummary(region)` - Major indices
- `calculatePortfolioValue(holdings)` - Calculate portfolio metrics

### 3. News Service (`services/newsService.js`)
Financial news aggregation with sentiment analysis.

**Features:**
- Financial news search via NewsAPI
- Top headlines by category and country
- Market-specific news for stocks
- Personalized news based on user categories
- Simple sentiment analysis (positive/negative/neutral)
- 15-minute cache for news articles

**Key Methods:**
- `getFinancialNews(query, page, pageSize)` - Search financial news
- `getTopHeadlines(category, country, pageSize)` - Top headlines
- `getMarketNews(symbol)` - News for specific stocks
- `getPersonalizedNews(userCategories, pageSize)` - Personalized news

### 4. Investment Service (`services/investmentService.js`)
Comprehensive investment tracking and diversification analysis.

**Features:**
- Mutual fund NAV fetching (AMFI API for Indian funds)
- Cryptocurrency prices (CoinGecko - top 20+ coins)
- Precious metals prices (gold, silver, platinum, palladium)
- Portfolio diversification analysis
- Portfolio value calculation
- Fallback mechanisms for all data sources

**Key Methods:**
- `getMutualFundNAV(schemeCode)` - Get mutual fund NAV
- `searchMutualFund(query)` - Search mutual funds
- `getCryptoPrice(coinId)` - Get crypto prices in USD/INR
- `getCryptoMarketData(limit)` - Top cryptocurrencies by market cap
- `getMetalPrices()` - Precious metals prices
- `calculatePortfolioDiversification(investments)` - Analyze allocation

### 5. Banking Service (`services/bankingService.js`)
Payment integration and bank statement parsing.

**Features:**
- Razorpay payment order creation
- Payment verification with signature validation
- UPI payment status tracking
- Bank statement CSV/text parsing
- Support for SBI, HDFC, ICICI, Axis formats
- Automatic bank detection

**Key Methods:**
- `createRazorpayOrder(amount, currency, description)` - Create payment order
- `verifyRazorpayPayment(orderId, paymentId, signature)` - Verify payment
- `getUPIPaymentStatus(paymentId)` - Check UPI payment status
- `parseBankStatement(fileBuffer, bankName)` - Parse bank statements
- `detectBank(fileContent)` - Auto-detect bank

### 6. Report Service (`services/reportService.js`)
Comprehensive financial reporting and analysis.

**Features:**
- Monthly spending reports by category
- Annual tax reports with deduction tracking
- Budget vs actual analysis
- Custom date range reports
- Tax liability estimation
- Merchant and anomaly breakdowns
- Exportable as JSON/CSV

**Key Methods:**
- `generateMonthlyReport(userId, month, year)` - Monthly report
- `generateTaxReport(userId, year)` - Tax-relevant report
- `generateBudgetReport(userId)` - Budget utilization report
- `generateCustomReport(userId, startDate, endDate)` - Custom range

### 7. Notification Service (`services/notificationService.js`)
Real-time and email notifications with multiple alert types.

**Features:**
- Budget threshold alerts (50%, 75%, 90%, 100%)
- Anomaly detection alerts
- Weekly spending digest
- Bill reminder notifications
- Subscription renewal reminders
- Price drop alerts
- In-app notifications via Socket.IO
- Email notifications (integrated with existing emailService)

**Key Methods:**
- `sendBudgetAlert(userId, budget, percentUsed, io)` - Budget alerts
- `sendAnomalyAlert(userId, transaction, details, io)` - Anomaly alerts
- `sendWeeklyDigest(userId, weeklyData, io)` - Weekly summary
- `sendBillReminder(userId, bill, daysUntilDue, io)` - Bill reminders
- `sendSubscriptionReminder(userId, subscription, daysUntilRenewal, io)` - Renewal alerts
- `sendPriceDropAlert(userId, subscription, savings, io)` - Price alerts

## New Models

### Investment Model (`models/Investment.js`)
Tracks user investments across multiple asset classes.

**Fields:**
- userId, type (stock/mutual_fund/crypto/gold/fd/ppf/bond)
- name, symbol, schemeCode
- quantity, buyPrice, buyDate
- currentPrice, currentValue, pnl, pnlPercentage
- currency, notes, tags, portfolio, broker
- Calculated fields: totalCost, pnlPercentage
- Timestamps: createdAt, updatedAt, lastPriceUpdate, sellDate

**Methods:**
- `updatePrice(newPrice)` - Update current price
- `sell(quantity, sellPrice)` - Record sale
- `getPortfolioSummary()` - Static method for portfolio totals
- `getByTypeBreakdown()` - Static method for asset class breakdown

### Bill Model (`models/Bill.js`)
Manages recurring bills and payment reminders.

**Fields:**
- userId, name, description, amount, currency, category
- frequency (daily/weekly/monthly/quarterly/yearly), dueDate
- nextDueDate, lastPaidDate, merchant
- autopay (enabled, method, accountId)
- paymentHistory (array of past payments)
- alerts tracking (reminders sent)

**Methods:**
- `markAsPaid(paymentMethod)` - Record payment
- `addAlert(type)` - Log alert sent
- `hasAlertBeenSent(type)` - Check if alert was sent today
- `_calculateNextDueDate()` - Compute next due date
- `findUpcoming(daysAhead)` - Static method
- `findOverdue()` - Static method
- `getTotalMonthlyCost()` - Static method

## New Controllers

### External API Controller (`controllers/externalApiController.js`)
Endpoints for all external API integrations.

**Endpoints:**
- GET `/currency/rates` - Exchange rates
- GET `/currency/convert` - Currency conversion
- GET `/currency/supported` - Supported currencies
- GET `/stocks/quote/{symbol}` - Stock quote
- GET `/stocks/history/{symbol}` - Historical prices
- GET `/stocks/search` - Search stocks
- GET `/stocks/market-summary` - Market indices
- GET `/news/financial` - Financial news
- GET `/news/headlines` - Top headlines
- GET `/investments/mutual-funds/search` - Search MFs
- GET `/investments/crypto/{coinId}` - Crypto price
- GET `/investments/metals` - Metal prices

### Report Controller (`controllers/reportController.js`)
Financial reporting endpoints.

**Endpoints:**
- GET `/monthly/{year}/{month}` - Monthly report
- GET `/annual/{year}` - Annual report
- GET `/budget` - Budget report
- GET `/tax/{year}` - Tax report
- GET `/custom` - Custom date range
- POST `/export` - Export as JSON/CSV

### Investment Controller (`controllers/investmentController.js`)
Investment management CRUD and analysis.

**Endpoints:**
- POST/GET/PUT/DELETE `/` - Investment CRUD
- GET `/portfolio/summary` - Portfolio totals
- GET `/portfolio/diversification` - Asset allocation
- GET `/portfolio/value` - Current value
- PUT `/{id}/price` - Update price
- POST `/{id}/sell` - Record sale

### Bill Controller (`controllers/billController.js`)
Bill management and reminders.

**Endpoints:**
- POST/GET/PUT/DELETE `/` - Bill CRUD
- GET `/upcoming` - Upcoming bills (next 7 days)
- GET `/overdue` - Overdue bills
- POST `/{id}/mark-paid` - Record payment
- GET `/calendar` - Bill calendar view
- GET `/statistics` - Bill statistics

## New Routes

### External APIs Route (`routes/external.js`)
All external API endpoints under `/api/external/*`

### Reports Route (`routes/reports.js`)
All report endpoints under `/api/reports/*`
- Requires authentication
- Some endpoints require Pro+ tier

### Investments Route (`routes/investments.js`)
All investment endpoints under `/api/investments/*`
- Requires authentication

### Bills Route (`routes/bills.js`)
All bill endpoints under `/api/bills/*`
- Requires authentication

## New Cron Jobs

### Bill Reminder Job (`jobs/billReminderJob.js`)
Automated bill reminders and overdue tracking.

**Jobs:**
- `initializeBillReminderJob()` - Runs daily at 9:00 AM
  - Checks upcoming bills (next 30 days)
  - Sends reminders based on remindDaysBefore setting
  - Tracks sent alerts to avoid duplicates

- `initializeOverdueBillJob()` - Runs every 6 hours
  - Checks for overdue bills
  - Sends urgent notifications
  - Tracks overdue status

- `initializeSubscriptionReminderJob()` - Runs daily at 8:00 AM
  - Checks subscriptions renewing within 7 days
  - Sends renewal reminders

## Configuration

### API Configuration (`config/apis.js`)
Central configuration for all external APIs with:
- Base URLs
- API keys (from environment)
- Rate limits
- Cache TTLs
- Fallback configurations

**Configured APIs:**
- ExchangeRate-API (primary), Open Exchange Rates (fallback)
- Alpha Vantage (primary), Twelve Data (fallback)
- NewsAPI (primary), GNews (fallback)
- CoinGecko (cryptocurrency)
- AMFI (mutual funds)
- Metals API
- Razorpay, Stripe

## Environment Variables

New variables required in `.env`:

```
# Currency APIs
EXCHANGE_RATE_API_KEY=your_key
OPEN_EXCHANGE_RATES_API_KEY=your_key

# Stock APIs
ALPHA_VANTAGE_API_KEY=your_key
TWELVE_DATA_API_KEY=your_key

# News APIs
NEWS_API_KEY=your_key
GNEWS_API_KEY=your_key

# Investment APIs
COINGECKO_API_KEY=optional
METALS_API_KEY=your_key

# Payment APIs
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_key
```

## Caching Strategy

All external API responses are cached in Redis with tier-specific TTLs:

- **Currency rates**: 1 hour
- **Stock quotes**: 5 minutes
- **News articles**: 15 minutes
- **Mutual fund NAV**: 24 hours
- **Cryptocurrency data**: 5 minutes
- **Precious metals**: 1 hour

Cache keys are centralized in `services/cacheService.js` for consistency.

## Error Handling

All services implement:
- Try-catch error handling
- Fallback APIs when primary fails
- Graceful degradation
- Detailed error logging
- Meaningful error messages to clients

## Production Readiness

**Features implemented:**
- Request timeout handling (10 seconds default)
- Automatic retries with exponential backoff
- Rate limiting awareness per API tier
- Input validation on all endpoints
- Authentication/authorization checks
- Comprehensive logging (Winston)
- Swagger API documentation
- Pagination support
- Comprehensive error responses

## API Rate Limits (Free Tier)

- ExchangeRate-API: 1,500 requests/month
- Alpha Vantage: 5 requests/minute, 500/day
- NewsAPI: 100 requests/day
- CoinGecko: 10-50 requests/second
- AMFI: 2 requests/second

Paid tiers have higher limits. Consider implementing distributed rate limiting for production.

## Testing Recommendations

1. **Unit Tests**: Test each service independently
2. **Integration Tests**: Test API endpoints with mocked external services
3. **E2E Tests**: Test complete workflows (create investment → get portfolio value)
4. **Load Tests**: Verify caching efficiency under high load
5. **Failover Tests**: Test fallback APIs when primary is unavailable

## Security Considerations

1. API keys stored in `.env` (never committed)
2. Rate limiting applied to sensitive endpoints
3. Authentication required for protected routes
4. Signature verification for payment callbacks
5. Input validation on all endpoints
6. CORS configuration for cross-origin requests

## Future Enhancements

1. Advanced portfolio analytics and benchmarking
2. Machine learning for investment recommendations
3. Tax optimization suggestions
4. Integration with more investment platforms
5. Real-time portfolio alerts via WebSocket
6. Multi-currency portfolio valuation
7. Invoice generation for business users
8. Advanced bill scheduling and automation

## Dependencies Added

```json
{
  "razorpay": "^2.9.1"
}
```

Note: `axios` and `cron` already present in package.json.

## File Structure

```
server/
├── services/
│   ├── currencyService.js
│   ├── stockService.js
│   ├── newsService.js
│   ├── investmentService.js
│   ├── bankingService.js
│   ├── reportService.js
│   └── notificationService.js
├── models/
│   ├── Investment.js
│   └── Bill.js
├── controllers/
│   ├── externalApiController.js
│   ├── reportController.js
│   ├── investmentController.js
│   └── billController.js
├── routes/
│   ├── external.js
│   ├── reports.js
│   ├── investments.js
│   └── bills.js
├── jobs/
│   └── billReminderJob.js
├── config/
│   └── apis.js
└── app.js (updated)
```

---

**Last Updated**: April 2026
**Version**: 1.0.0
