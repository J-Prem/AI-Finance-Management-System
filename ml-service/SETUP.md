# AI Finance ML Microservice - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Train Models

Before running the service, train the ML models:

```bash
python scripts/train_models.py
```

This will:
- Generate 5,000 synthetic transactions
- Train the categorizer (TF-IDF + Logistic Regression)
- Train the anomaly detector (Isolation Forest)
- Train the personality analyzer (KMeans clustering)
- Save models to `trained_models/` directory

### 3. Configuration

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Key configurations:
- `ENV`: development or production
- `PORT`: Default 8000
- `MONGODB_URI`: MongoDB connection (optional)
- `OPENAI_API_KEY`: For chatbot feature (optional)

### 4. Run the Service

```bash
python app.py
```

Or with uvicorn directly:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at: `http://localhost:8000`

## API Documentation

Interactive API docs: `http://localhost:8000/docs`

## Available Endpoints

### Transaction Categorization
- `POST /api/v1/categorize` - Categorize single transaction
- `POST /api/v1/categorize/bulk` - Categorize multiple transactions

### Financial Analysis
- `POST /api/v1/predict-spending` - Predict future spending (Prophet/ARIMA)
- `POST /api/v1/detect-anomalies` - Detect unusual transactions
- `POST /api/v1/spending-personality` - Analyze spending personality (clustering)
- `POST /api/v1/financial-health` - Calculate financial health score
- `POST /api/v1/spending-dna` - Generate spending DNA profile
- `POST /api/v1/detect-subscriptions` - Find recurring subscriptions
- `POST /api/v1/behavioral-patterns` - Detect behavioral patterns
- `POST /api/v1/what-if` - What-if spending simulator
- `POST /api/v1/chatbot` - AI financial chatbot
- `POST /api/v1/smart-insights` - Generate smart insights

### Status
- `GET /api/v1/health` - Health check
- `GET /api/v1/model-status` - Model status

## ML Models

### 1. Categorizer (TransactionCategorizer)
- **Algorithm**: TF-IDF + Logistic Regression
- **Categories**: 18 categories (Food, Transport, Shopping, etc.)
- **Fallback**: Keyword matching for low confidence predictions
- **Training Data**: Synthetic + keyword-based

### 2. Anomaly Detector (AnomalyDetector)
- **Algorithm**: Isolation Forest + Z-score
- **Features**: Amount, timing, merchant patterns
- **Methods**:
  - Amount anomalies (statistical outliers)
  - Timing anomalies (unusual transaction times)
  - Merchant anomalies (rare merchants)
  - ML-based anomaly scoring

### 3. Predictor (SpendingPredictor)
- **Algorithm**: Facebook Prophet + Moving Average fallback
- **Features**: Time series forecasting
- **Outputs**: 
  - Daily forecasts with confidence intervals
  - Trend detection (increasing/decreasing/stable)
  - Seasonal patterns

### 4. Personality Analyzer (SpendingPersonalityAnalyzer)
- **Algorithm**: KMeans Clustering
- **Personalities**:
  - The Saver
  - The Spender
  - The Balanced
  - The Investor
  - The Impulse Buyer
- **Features**: Spending patterns, variance, impulse score, consistency

### 5. Health Scorer (FinancialHealthScorer)
- **Components**:
  - Saving Rate (20%)
  - Debt Ratio (20%)
  - Expense Stability (15%)
  - Budget Adherence (15%)
  - Emergency Fund (15%)
  - Income Growth (15%)
- **Grades**: A (90+), B (80+), C (70+), D (60+), F (0-59)

### 6. Subscription Detector (SubscriptionDetector)
- **Detection**: Pattern matching on amounts and frequency
- **Frequencies**: Weekly, biweekly, monthly, quarterly, yearly
- **Outputs**: Subscriptions with confidence, dormant detection

### 7. Behavioral Analyzer (BehavioralAnalyzer)
- **Patterns**:
  - Weekend vs weekday spending
  - Payday effects
  - Emotional spending
  - Late-night transactions
  - Category switching
  - Seasonal changes

### 8. What-If Simulator (WhatIfSimulator)
- **Scenarios**:
  - Category spending reduction/increase
  - Overall spending reduction
  - Savings goal analysis
  - Time to achieve savings goals

### 9. Chatbot (FinancialChatbot)
- **Provider**: OpenAI (GPT-3.5-turbo) or rule-based fallback
- **Features**: Context-aware responses, insight extraction
- **Context**: Spending data, income, categories, health score

### 10. Insight Generator (InsightGenerator)
- **Types**:
  - Spending changes
  - Category analysis
  - Anomaly highlights
  - Pattern insights
  - Optimization suggestions

## Data Format

All endpoints accept transactions in this format:

```json
{
  "transactions": [
    {
      "amount": 500.00,
      "description": "Restaurant XYZ",
      "timestamp": "2024-01-15T19:30:00",
      "merchant": "Restaurant XYZ",
      "transaction_id": "TXN123456",
      "category": "Food",
      "type": "expense"
    }
  ]
}
```

## Project Structure

```
ml-service/
├── app.py                 # Main FastAPI application
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── api/
│   ├── routes.py         # API endpoints
│   └── schemas.py        # Pydantic models
├── services/
│   ├── categorizer.py               # Transaction categorization
│   ├── anomaly_detector.py          # Anomaly detection
│   ├── predictor.py                 # Spending prediction
│   ├── personality_analyzer.py      # Personality clustering
│   ├── health_scorer.py             # Health scoring
│   ├── spending_dna.py              # DNA profile generation
│   ├── subscription_detector.py     # Subscription detection
│   ├── behavioral_analyzer.py       # Pattern detection
│   ├── what_if_simulator.py         # What-if scenarios
│   ├── chatbot.py                   # Financial chatbot
│   └── insight_generator.py         # Insight generation
├── models/
│   └── ml_models.py      # Model registry and training
├── utils/
│   ├── helpers.py                   # Utility functions
│   ├── feature_engineering.py       # Feature extraction
│   └── data_generator.py            # Synthetic data generation
├── data/
│   └── categories.json   # Category taxonomy
├── scripts/
│   └── train_models.py   # Model training script
└── trained_models/       # Saved trained models
    ├── categorizer_model.pkl
    ├── categorizer_vectorizer.pkl
    ├── anomaly_detector.pkl
    └── personality_analyzer.pkl
```

## Dependencies

- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **Pydantic**: Data validation
- **scikit-learn**: ML algorithms
- **pandas**: Data manipulation
- **numpy**: Numerical computing
- **Prophet**: Time series forecasting
- **OpenAI**: GPT integration (optional)
- **Faker**: Synthetic data generation

## Performance

- All services are async-ready
- Models are loaded at startup
- Inference typically <100ms per request
- Bulk operations supported (up to 1000 transactions)

## Testing

Run tests:

```bash
pytest
```

## Monitoring

Check model status:

```bash
curl http://localhost:8000/api/v1/model-status
```

Health check:

```bash
curl http://localhost:8000/api/v1/health
```

## Production Deployment

For production:

1. Set `ENV=production` in `.env`
2. Set `DEBUG=False`
3. Use environment-specific database configurations
4. Implement API authentication
5. Set up monitoring and logging
6. Configure SSL/TLS certificates
7. Use production ASGI server (Gunicorn + Uvicorn)

Example:

```bash
gunicorn app:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Troubleshooting

### Models not loaded
- Run `python scripts/train_models.py` first
- Check `trained_models/` directory exists

### OpenAI errors
- Set `OPENAI_API_KEY` in `.env` or chatbot will use fallback
- Check API key validity

### Import errors
- Ensure all requirements installed: `pip install -r requirements.txt`
- Check Python version (3.10+)

## License

Proprietary - AI Finance Management SaaS
