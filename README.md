<div align="center">

# 🏦 AI Finance Management System

### *The Intelligent Finance OS for Modern Households & Founders*

<br/>

> A production-grade, full-stack **SaaS finance platform** combining a React dashboard, Node.js/Express API, and Python ML microservice — with real-time market data, receipt OCR, conversational AI advisor, and enterprise-grade security.

<br/>

[🚀 Quick Start](#-quick-start) · [✨ Features](#-features) · [🏗️ Architecture](#%EF%B8%8F-architecture) · [📡 API Reference](#-api-reference) · [🐳 Docker](#-docker-deployment) · [🤝 Contributing](#-contributing)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📊 Smart Dashboard
- Net worth tracking across all accounts
- Real-time cash flow visualization
- Category-wise spending breakdown
- Monthly / annual trend analysis
- Customizable widgets & dark mode

### 🤖 AI-Powered Advisor (FinSight)
- Plain-English chatbot using your real transactions
- Multi-LLM routing (Gemini, Claude, HuggingFace)
- Automatic offline fallback to rule-based engine
- Spending DNA personality analysis
- What-if scenario simulator

### 🧾 Receipt OCR & Storage
- Snap a receipt → AI extracts merchant, items, totals
- Multi-engine parsing (Gemini Vision + HuggingFace + offline)
- Automatic category assignment (93% first-pass accuracy)
- Permanent cloud storage with full-text search

</td>
<td width="50%">

### 💰 Investment Portfolio
- Stocks, mutual funds, crypto, gold, FD, PPF, bonds
- Real-time prices via Yahoo Finance & CoinGecko
- P&L calculations with unrealized/realized gains
- Diversification analysis & asset allocation charts
- Sell tracking with transaction history

### 📋 Bill Intelligence
- Auto-detect recurring payments from transaction history
- Smart reminders with customizable lead times
- Overdue tracking & autopay configuration
- Bill calendar with monthly/weekly views
- Payment history & statistics dashboard

### 📈 Market Data Hub
- Currency exchange for 150+ currencies with live FX rates
- Stock quotes, historical charts, and market indices
- Financial news feed with AI sentiment analysis
- Personalized news based on portfolio holdings

</td>
</tr>
</table>

### More Capabilities

| Feature | Description |
|---------|-------------|
| 🎯 **Budget Management** | Category budgets with 50/75/90/100% threshold alerts |
| 📊 **Financial Reports** | Monthly, annual, tax, budget-vs-actual, custom date range |
| 🔔 **Smart Notifications** | Real-time via Socket.IO + email via SMTP |
| 👥 **Team Collaboration** | Share finances with family or business partners |
| 🔑 **API Key Management** | Developer portal with rate-limited API access |
| 💳 **Payment Integration** | Razorpay + Stripe subscription billing |
| 🛡️ **Anomaly Detection** | ML-powered duplicate charge & fraud detection |
| 🏷️ **Auto Categorization** | ML model categorizes transactions with 95%+ accuracy |
| 📤 **Export Engine** | CSV / JSON / PDF export for all reports |
| 🔍 **Global Search** | Full-text search across transactions, receipts, bills |
| 🧠 **Financial Health Score** | AI-computed score based on spending, saving, debt ratios |
| 🧬 **Spending DNA** | Unique financial personality profile with behavioral insights |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Dashboard │ │Portfolio │ │  Bills   │ │ Chatbot  │  ...more   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       └─────────────┴────────────┴─────────────┘                │
│                          │  Axios + Socket.IO                    │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│                    SERVER (Node.js + Express)                     │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │  Auth   │ │  Routes  │ │ Services │ │   Middleware      │    │
│  │  JWT    │ │  22 APIs │ │  20 svcs │ │ Auth│Rate│Helmet  │    │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────────────────┘    │
│       └───────────┴────────────┴─────────────┐                   │
│                    │                          │                   │
│              ┌─────┴──────┐          ┌───────┴────────┐         │
│              │  MongoDB   │          │     Redis      │         │
│              │  (Atlas)   │          │  (Cache/Queue) │         │
│              └────────────┘          └────────────────┘         │
└──────────────────────────┬───────────────────────────────────────┘
                           │  HTTP
┌──────────────────────────┼───────────────────────────────────────┐
│                  ML SERVICE (Python + FastAPI)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │Predictor │ │Anomaly   │ │ Categorizer  │ │  Personality │   │
│  │(Prophet) │ │Detector  │ │ (Sklearn)    │ │  Analyzer    │   │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Chatbot  │ │Health    │ │ What-If Sim  │ │  Spending    │   │
│  │ (Multi-  │ │Scorer    │ │              │ │  DNA Engine  │   │
│  │  LLM)    │ │          │ │              │ │              │   │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework with hooks & functional components |
| **Vite 5** | Lightning-fast dev server & build tool |
| **TailwindCSS 3** | Utility-first CSS framework |
| **Redux Toolkit** | Global state management |
| **React Query** | Server state & data fetching |
| **Recharts** | Interactive data visualization |
| **Framer Motion** | Smooth animations & transitions |
| **Socket.IO Client** | Real-time notifications |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js 18+** | Runtime environment |
| **Express 4** | REST API framework |
| **MongoDB + Mongoose** | NoSQL database with ODM |
| **Redis** | Caching & job queues |
| **JWT** | Stateless authentication |
| **Socket.IO** | WebSocket real-time events |
| **Bull** | Background job processing |
| **Winston** | Structured logging |
| **Helmet + CORS** | Security middleware |
| **Swagger** | Auto-generated API documentation |

### ML Service
| Technology | Purpose |
|------------|---------|
| **Python 3.10+** | Runtime |
| **FastAPI** | High-performance async API |
| **scikit-learn** | Classification & regression models |
| **Prophet** | Time-series forecasting |
| **PyOD** | Outlier / anomaly detection |
| **Transformers + PyTorch** | NLP & text classification |
| **OpenAI / Gemini / HF** | Multi-LLM chatbot routing |
| **Pandas + NumPy** | Data processing |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Docker + Docker Compose** | Containerized deployment |
| **Nginx** | Reverse proxy for frontend |
| **Redis 7** | Session cache & rate limiting |
| **MongoDB Atlas** | Managed cloud database |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0
- **Python** ≥ 3.10
- **MongoDB** (local or [Atlas](https://www.mongodb.com/cloud/atlas))
- **Redis** (local or cloud)

### 1. Clone the Repository

```bash
git clone https://github.com/akash02062005/AI-FINANCE-MANAGEMENT-SYSTEM.git
cd AI-FINANCE-MANAGEMENT-SYSTEM
```

### 2. Setup Environment Variables

```bash
# Copy example env files
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env
cp ml-service/.env.example ml-service/.env
```

Edit each `.env` file with your credentials (MongoDB URI, API keys, JWT secrets, etc.). See [`.env.example`](.env.example) for all available options.

### 3. Install Dependencies & Run

#### Option A — Run All Services Manually

```bash
# Terminal 1: Backend Server
cd server
npm install
npm run dev          # starts on http://localhost:5000

# Terminal 2: ML Service
cd ml-service
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3: Frontend Client
cd client
npm install
npm run dev          # starts on http://localhost:3000
```

#### Option B — Docker Compose (Recommended)

```bash
docker-compose up --build
# Client → http://localhost:8080
# Server → http://localhost:5000
# ML API → http://localhost:8001
```

### 4. Seed Admin User (Optional)

```bash
cd server
node scripts/seed-admin.js
```

---

## 📡 API Reference

The server exposes **22 route modules** with RESTful endpoints. Full Swagger documentation is available at `/api-docs` when the server is running.

<details>
<summary><b>🔐 Authentication</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login & receive JWT |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Invalidate session |
| `GET` | `/api/auth/me` | Get current user profile |

</details>

<details>
<summary><b>💳 Transactions</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/transactions` | Create transaction |
| `GET` | `/api/transactions` | List with filters & pagination |
| `PUT` | `/api/transactions/:id` | Update transaction |
| `DELETE` | `/api/transactions/:id` | Delete transaction |

</details>

<details>
<summary><b>🎯 Budgets</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/budgets` | Create budget |
| `GET` | `/api/budgets` | Get all budgets |
| `PUT` | `/api/budgets/:id` | Update budget |
| `DELETE` | `/api/budgets/:id` | Delete budget |

</details>

<details>
<summary><b>💰 Investments</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/investments` | Create investment |
| `GET` | `/api/investments` | Get all investments |
| `GET` | `/api/investments/portfolio/summary` | Portfolio totals |
| `GET` | `/api/investments/portfolio/diversification` | Asset allocation |
| `PUT` | `/api/investments/:id/price` | Update current price |
| `POST` | `/api/investments/:id/sell` | Sell holdings |

</details>

<details>
<summary><b>📋 Bills</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bills` | Create bill |
| `GET` | `/api/bills/upcoming` | Upcoming bills |
| `GET` | `/api/bills/overdue` | Overdue bills |
| `POST` | `/api/bills/:id/mark-paid` | Mark as paid |
| `GET` | `/api/bills/calendar` | Bill calendar view |
| `GET` | `/api/bills/statistics` | Bill statistics |

</details>

<details>
<summary><b>💱 Currency Exchange</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/external/currency/rates` | Exchange rates |
| `GET` | `/api/external/currency/convert` | Convert currencies |
| `GET` | `/api/external/currency/supported` | Supported currencies |
| `GET` | `/api/external/currency/history` | Historical rates |

</details>

<details>
<summary><b>📈 Stock Market</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/external/stocks/quote/:symbol` | Real-time quote |
| `GET` | `/api/external/stocks/history/:symbol` | Historical data |
| `GET` | `/api/external/stocks/search` | Search stocks |
| `GET` | `/api/external/stocks/market-summary` | Market indices |

</details>

<details>
<summary><b>📊 Reports</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reports/monthly/:year/:month` | Monthly report |
| `GET` | `/api/reports/annual/:year` | Annual report |
| `GET` | `/api/reports/tax/:year` | Tax report |
| `GET` | `/api/reports/budget` | Budget vs actual |
| `POST` | `/api/reports/export` | Export (CSV/JSON) |

</details>

<details>
<summary><b>🤖 AI & ML</b></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ml/predict` | Spending prediction |
| `POST` | `/api/ml/anomalies` | Anomaly detection |
| `POST` | `/api/ml/categorize` | Auto-categorize transactions |
| `POST` | `/api/llm/chat` | AI chatbot advisor |
| `GET` | `/api/personality` | Financial personality analysis |

</details>

---

## 📂 Project Structure

```
AI-FINANCE-MANAGEMENT-SYSTEM/
│
├── client/                          # React Frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/               # Admin panel components
│   │   │   ├── auth/                # Login / Register forms
│   │   │   ├── charts/              # Recharts visualizations
│   │   │   ├── chatbot/             # AI advisor chat UI
│   │   │   ├── common/              # Shared UI components
│   │   │   ├── dashboard/           # Dashboard widgets
│   │   │   ├── finance/             # Transaction & budget components
│   │   │   └── subscription/        # Billing & plan components
│   │   ├── pages/                   # 20 page-level components
│   │   ├── services/                # Axios API client layer
│   │   ├── store/                   # Redux slices
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── contexts/                # React context providers
│   │   ├── styles/                  # Global CSS & Tailwind config
│   │   └── utils/                   # Utility functions
│   ├── package.json
│   └── vite.config.js
│
├── server/                          # Node.js Backend (Express)
│   ├── config/                      # Database & API configuration
│   ├── controllers/                 # 19 route controllers
│   ├── middleware/                   # Auth, rate-limit, validation
│   ├── models/                      # 14 Mongoose schemas
│   ├── routes/                      # 22 Express route modules
│   ├── services/                    # 20 business logic services
│   ├── jobs/                        # Cron & background jobs
│   ├── validators/                  # Input validation schemas
│   ├── utils/                       # Helper utilities
│   ├── app.js                       # Express app setup
│   ├── server.js                    # Entry point
│   └── package.json
│
├── ml-service/                      # Python ML Microservice (FastAPI)
│   ├── services/
│   │   ├── predictor.py             # Time-series forecasting (Prophet)
│   │   ├── anomaly_detector.py      # Outlier detection (PyOD)
│   │   ├── categorizer.py           # Transaction classifier (sklearn)
│   │   ├── chatbot.py               # Multi-LLM conversational AI
│   │   ├── health_scorer.py         # Financial health scoring
│   │   ├── personality_analyzer.py  # Spending personality engine
│   │   ├── spending_dna.py          # Behavioral pattern analysis
│   │   ├── what_if_simulator.py     # Scenario simulation
│   │   ├── insight_generator.py     # Automated insight generation
│   │   └── subscription_detector.py # Recurring payment detection
│   ├── api/                         # FastAPI route handlers
│   ├── models/                      # ML model definitions
│   ├── data/                        # Sample datasets
│   ├── app.py                       # FastAPI entry point
│   ├── config.py                    # Configuration
│   └── requirements.txt
│
├── docs/                            # Additional documentation
├── scripts/                         # Admin & utility scripts
├── docker-compose.yml               # Multi-service orchestration
├── .env.example                     # Environment variable template
└── README.md
```

---

## 🔒 Security

| Layer | Implementation |
|-------|---------------|
| **Authentication** | JWT access + refresh tokens with configurable expiry |
| **Authorization** | Role-based access control (User, Admin, Superadmin) |
| **API Security** | Helmet headers, CORS, rate limiting per subscription tier |
| **Data Protection** | AES-256 encryption at rest, TLS 1.3 in transit |
| **Payment Security** | HMAC-SHA256 webhook signature verification |
| **Input Validation** | Express-validator on all endpoints |
| **API Keys** | Scoped developer API keys with usage tracking |
| **Audit Trail** | Full audit log of all mutations and API calls |

---

## ⚡ Performance

- **Redis caching** with intelligent TTLs (5 min for stock quotes → 24 hours for mutual fund NAV)
- **Database indexes** on all frequently queried fields
- **Pagination** on all list endpoints (default: 20 items)
- **MongoDB aggregation pipelines** for portfolio calculations
- **Request timeout handling** with 10-second defaults
- **Connection pooling** for external API calls
- **Gzip compression** via Express middleware
- **API fallback chains** — primary → secondary → cache → graceful error

---

## 🔄 Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Bill Reminders | 9:00 AM daily | Send upcoming bill due notifications |
| Overdue Check | Every 6 hours | Flag and notify overdue bills |
| Subscription Alerts | 8:00 AM daily | Renewal reminder notifications |
| Budget Alerts | Real-time | Triggered at 50%, 75%, 90%, 100% thresholds |
| Anomaly Alerts | Real-time | Triggered on suspicious transaction patterns |

---

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

| Service | Port | Description |
|---------|------|-------------|
| **Client** | `8080` | React frontend via Nginx |
| **Server** | `5000` | Node.js REST API |
| **ML Service** | `8001` | Python FastAPI ML endpoints |
| **Redis** | `6379` | Cache & job queue |

---

## 🌐 External Integrations

| Integration | Type | Purpose |
|-------------|------|---------|
| **MongoDB Atlas** | Database | Primary data store |
| **Yahoo Finance** | Market Data | Stock quotes & history |
| **CoinGecko** | Market Data | Cryptocurrency prices |
| **Alpha Vantage** | Market Data | Stock market data (fallback) |
| **Open Exchange Rates** | FX Data | Currency exchange rates |
| **Razorpay** | Payments | Indian payment gateway |
| **Stripe** | Payments | Global payment processing |
| **Gemini AI** | LLM | Primary AI advisor engine |
| **Anthropic Claude** | LLM | Fallback AI provider |
| **HuggingFace** | ML/NLP | Text classification & OCR |
| **SMTP (Gmail)** | Email | Notification delivery |
| **Redis** | Cache | Response caching & rate limiting |

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request



