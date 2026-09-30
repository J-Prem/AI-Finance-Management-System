# AI Finance Management SaaS - Backend Setup

Complete Node.js + Express backend for AI Finance Management SaaS application with AI categorization, anomaly detection, budgeting, and subscription management.

## Architecture Overview

### Core Components

**Models** (`server/models/`)
- `User.js` - User authentication and preferences
- `Transaction.js` - Financial transactions with ML categorization
- `Budget.js` - Budget tracking and alerts
- `Team.js` - Team collaboration and management
- `Subscription.js` - Billing and subscription management
- `ApiKey.js` - API key management with permissions
- `Notification.js` - Notification system with TTL

**Controllers** (`server/controllers/`)
- `authController.js` - Registration, login, password reset
- `transactionController.js` - CRUD, bulk import, export, summary
- `budgetController.js` - Budget management and alerts
- `analyticsController.js` - Spending trends, predictions, insights
- `subscriptionController.js` - Stripe integration, billing
- `teamController.js` - Team collaboration
- `apiKeyController.js` - API key lifecycle management
- `notificationController.js` - Notification management
- `mlController.js` - ML service proxy

**Middleware** (`server/middleware/`)
- `auth.js` - JWT and API key authentication with role-based access
- `rateLimiter.js` - Tiered rate limiting based on subscription
- `usageTracker.js` - Subscription limit enforcement
- `errorHandler.js` - Global error handling

**Services** (`server/services/`)
- `emailService.js` - Transactional emails (welcome, reset, alerts, digest)
- `cacheService.js` - Redis caching with TTL
- `mlProxyService.js` - Communication with Python ML microservice

**Routes** (`server/routes/`)
- `auth.js` - Authentication endpoints
- `transactions.js` - Transaction management
- `budgets.js` - Budget management
- `analytics.js` - Analytics and insights
- `subscriptions.js` - Billing and subscription
- `teams.js` - Team collaboration
- `apiKeys.js` - API key management
- `notifications.js` - Notification preferences
- `ml.js` - ML feature endpoints
- `webhooks.js` - Stripe webhook handling
- `admin.js` - Admin dashboard

## Installation

### Prerequisites
- Node.js 18+
- MongoDB
- Redis
- Stripe account (for payments)
- SMTP server (or use Ethereal for testing)

### Setup Steps

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start MongoDB**
```bash
mongod
```

4. **Start Redis**
```bash
redis-server
```

5. **Start the server**
```bash
npm run dev  # Development with hot reload
npm start   # Production
```

Server will run on `http://localhost:3000`

## API Documentation

Swagger/OpenAPI docs available at: `/api/docs`

## Key Features

### Authentication & Security
- JWT-based authentication
- Refresh token support
- API key authentication with permissions
- Role-based access control (user, admin, superadmin)
- Rate limiting (tiered by subscription)
- Password hashing with bcrypt

### Transaction Management
- Create, read, update, delete transactions
- Bulk CSV import
- Export to CSV/JSON/PDF
- Spending summary and category breakdown
- Recurring transaction detection

### AI Features (via ML Microservice)
- Automatic transaction categorization with confidence scores
- Anomaly detection with anomaly scores
- Spending predictions
- Spending personality analysis
- Financial health scoring
- Behavioral pattern analysis
- Saving opportunities detection
- Subscription detection
- Budget optimization

### Budget & Alerts
- Create budgets by category
- Weekly, monthly, yearly periods
- Threshold-based alerts (email, push, SMS, in-app)
- Budget vs actual comparison
- Shared team budgets

### Analytics
- Spending trends (daily, weekly, monthly)
- Category breakdown
- Monthly comparison
- Income vs expense analysis
- Savings rate calculation
- Dashboard overview

### Subscription Management
- FREE, PRO, ENTERPRISE tiers
- FREE: 100 transactions/month, 5 API calls/day
- PRO: 10,000 transactions/month, 1,000 API calls/day
- ENTERPRISE: Unlimited
- Stripe integration for payments
- Webhook handling
- Usage tracking and limits

### Team Collaboration
- Create teams
- Invite members with email
- Role-based permissions (owner, admin, member, viewer)
- Shared budgets
- Team analytics

### API Keys
- Generate/revoke API keys
- Permission-based access control
- IP whitelisting
- Rate limiting per key
- Usage tracking

### Notifications
- Budget alerts
- Anomaly detection alerts
- Subscription updates
- Email, push, SMS, in-app channels
- Notification preferences
- Auto-expiration

## Subscription Tiers

### FREE
- 100 transactions/month
- 5 API calls/day
- 10 ML predictions/month
- 1 team member
- 5 budgets
- CSV export only

### PRO ($29.99/month)
- 10,000 transactions/month
- 1,000 API calls/day
- 5,000 ML predictions/month
- 10 team members
- 100 budgets
- CSV, JSON, PDF export
- AI categorization
- Advanced analytics
- Anomaly detection

### ENTERPRISE ($99.99/month)
- Unlimited everything
- Unlimited team members
- Unlimited budgets
- All export formats
- Advanced API features
- Custom integrations
- Dedicated support

## Database Schema

### Key Collections
- **users** - User accounts with auth
- **transactions** - Financial transactions
- **budgets** - User budgets
- **teams** - Team information
- **subscriptions** - Billing information
- **apikeys** - API key records
- **notifications** - User notifications

## API Examples

### Register
```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

### Create Transaction
```bash
POST /api/transactions
Authorization: Bearer {token}
{
  "amount": 50.00,
  "category": "Food & Dining",
  "type": "expense",
  "description": "Lunch at cafe",
  "date": "2024-01-15"
}
```

### Get Analytics
```bash
GET /api/analytics/trends?period=monthly&months=12
Authorization: Bearer {token}
```

### Get AI Insights
```bash
GET /api/ml/health
Authorization: Bearer {token}
```

### Create API Key
```bash
POST /api/api-keys
Authorization: Bearer {token}
{
  "name": "Mobile App",
  "permissions": ["transactions:read", "analytics:read"]
}
```

## Environment Variables

See `.env.example` for complete list. Key variables:

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `STRIPE_SECRET_KEY` - Stripe API key
- `REDIS_HOST/PORT` - Redis configuration
- `SMTP_*` - Email configuration
- `ML_SERVICE_URL` - ML microservice URL

## Development

### Code Structure
- Async/await throughout
- ES modules (import/export)
- Error handling with custom error classes
- Comprehensive logging with Winston
- Input validation with express-validator
- Request/response caching

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Update JWT secrets
3. Configure real SMTP server
4. Update Stripe keys to production
5. Set up proper MongoDB authentication
6. Enable HTTPS
7. Configure CORS properly
8. Set up SSL certificates
9. Use environment variables from .env

## WebSocket Events (Socket.IO)

Real-time updates for:
- New transactions: `transaction:created`
- Budget alerts: `budget:alert`
- Anomaly detection: `anomaly:detected`
- Notifications: `notification:*`

## Monitoring

Uses Winston logger for:
- Error logging with stack traces
- Request logging with Morgan
- Application events
- Debug information in development

Logs stored in: `logs/` directory

## Error Handling

Custom error classes:
- `AppError` - General application error
- `ValidationError` - Input validation error
- `AuthError` - Authentication error
- `NotFoundError` - Resource not found
- `ConflictError` - Conflict error
- `RateLimitError` - Rate limit exceeded
- `ForbiddenError` - Authorization error

## Performance

- Redis caching for frequently accessed data
- Database indexes on common queries
- Request/response compression
- Connection pooling for MongoDB
- Rate limiting to prevent abuse
- Efficient aggregation pipelines

## Security

- CORS protection
- Helmet for security headers
- JWT token validation
- API key signing with SHA256
- Password hashing with bcrypt
- SQL injection prevention (using Mongoose)
- XSS protection
- Rate limiting
- Input validation

## Support

For issues or questions, refer to:
- API Documentation: `/api/docs`
- Database models: `server/models/`
- Controllers: `server/controllers/`
- Routes: `server/routes/`
