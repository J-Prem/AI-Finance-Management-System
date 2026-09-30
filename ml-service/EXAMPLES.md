# API Usage Examples

## Base URL
```
http://localhost:8000/api/v1
```

## 1. Transaction Categorization

### Single Transaction Categorization
```bash
curl -X POST "http://localhost:8000/api/v1/categorize" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "description": "Dinner at Restaurant ABC",
    "merchant": "Restaurant ABC"
  }'
```

**Response:**
```json
{
  "category": "Food",
  "confidence": 0.95,
  "alternatives": [
    {"category": "Entertainment", "confidence": 0.03},
    {"category": "Shopping", "confidence": 0.02}
  ]
}
```

### Bulk Categorization
```bash
curl -X POST "http://localhost:8000/api/v1/categorize/bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "amount": 500,
        "description": "Dinner at Restaurant ABC",
        "merchant": "Restaurant ABC"
      },
      {
        "amount": 2000,
        "description": "Uber ride to office",
        "merchant": "Uber"
      },
      {
        "amount": 5000,
        "description": "Amazon purchase - Laptop",
        "merchant": "Amazon"
      }
    ]
  }'
```

## 2. Spending Prediction

```bash
curl -X POST "http://localhost:8000/api/v1/predict-spending" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "amount": 500,
        "description": "Food",
        "timestamp": "2024-01-15T19:30:00",
        "merchant": "Restaurant"
      },
      {
        "amount": 600,
        "description": "Food",
        "timestamp": "2024-01-16T20:00:00",
        "merchant": "Cafe"
      }
    ],
    "forecast_days": 30,
    "category": "Food"
  }'
```

**Response:**
```json
{
  "category": "Food",
  "trend": "stable",
  "forecasts": [
    {
      "date": "2024-02-15",
      "predicted_amount": 550.00,
      "lower_bound": 450.00,
      "upper_bound": 650.00,
      "confidence": 0.95
    }
  ],
  "seasonal_pattern": null,
  "total_predicted_spend": 16500.00
}
```

## 3. Anomaly Detection

```bash
curl -X POST "http://localhost:8000/api/v1/detect-anomalies" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "amount": 500,
        "description": "Regular groceries",
        "timestamp": "2024-01-15T10:00:00",
        "merchant": "Supermarket"
      },
      {
        "amount": 50000,
        "description": "Electronics purchase",
        "timestamp": "2024-01-20T15:00:00",
        "merchant": "Electronics Store"
      }
    ],
    "sensitivity": 0.7
  }'
```

**Response:**
```json
{
  "anomalies": [
    {
      "transaction_id": "TXN00000001",
      "description": "Electronics purchase",
      "amount": 50000.00,
      "anomaly_score": 0.85,
      "is_anomaly": true,
      "reason": "Unusual amount: 50000.00 (Z-score: 3.5)",
      "severity": "high"
    }
  ],
  "total_transactions": 2,
  "anomaly_count": 1,
  "anomaly_percentage": 50.0
}
```

## 4. Spending Personality Analysis

```bash
curl -X POST "http://localhost:8000/api/v1/spending-personality" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "amount": 500,
        "description": "Food",
        "timestamp": "2024-01-15T19:30:00",
        "merchant": "Restaurant"
      },
      {
        "amount": 1000,
        "description": "Groceries",
        "timestamp": "2024-01-16T10:00:00",
        "merchant": "Supermarket"
      },
      {
        "amount": 2000,
        "description": "Savings deposit",
        "timestamp": "2024-01-17T09:00:00",
        "merchant": "Bank"
      }
    ]
  }'
```

**Response:**
```json
{
  "personality_type": "The Balanced",
  "confidence": 0.85,
  "description": "Maintains a healthy balance between spending and saving",
  "spending_habits": {
    "average_transaction": 1166.67,
    "median_transaction": 1000.00,
    "total_spent": 3500.00,
    "transaction_count": 3,
    "top_categories": {
      "Food": 500,
      "Shopping": 1000
    },
    "spending_volatility": 0.45
  },
  "tips": [
    "Maintain current spending discipline",
    "Gradually increase savings goals",
    "Consider diversifying investments"
  ],
  "similar_users_percentage": 25.5
}
```

## 5. Financial Health Score

```bash
curl -X POST "http://localhost:8000/api/v1/financial-health" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "amount": 100000,
        "description": "Monthly salary",
        "timestamp": "2024-01-01T09:00:00",
        "type": "income"
      },
      {
        "amount": 30000,
        "description": "Rent",
        "timestamp": "2024-01-05T10:00:00",
        "type": "expense"
      },
      {
        "amount": 15000,
        "description": "Groceries and food",
        "timestamp": "2024-01-15T10:00:00",
        "type": "expense"
      }
    ],
    "income": 100000,
    "debt": 200000,
    "savings": 50000,
    "monthly_budget": 60000
  }'
```

**Response:**
```json
{
  "overall_score": 78.5,
  "grade": "B",
  "components": [
    {
      "name": "Saving Rate",
      "score": 85.0,
      "weight": 0.2,
      "description": "You save 55.0% of income"
    },
    {
      "name": "Debt Ratio",
      "score": 70.0,
      "weight": 0.2,
      "description": "Debt is 200.0% of annual income"
    }
  ],
  "recommendations": [
    "Excellent work! Maintain your financial discipline",
    "Focus on paying down debt to improve your debt-to-income ratio"
  ]
}
```

## 6. Spending DNA Profile

```bash
curl -X POST "http://localhost:8000/api/v1/spending-dna" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "amount": 500,
        "description": "Food",
        "timestamp": "2024-01-15T19:30:00",
        "merchant": "Restaurant",
        "category": "Food"
      },
      {
        "amount": 3000,
        "description": "Groceries",
        "timestamp": "2024-01-16T10:00:00",
        "merchant": "Supermarket",
        "category": "Groceries"
      }
    ]
  }'
```

**Response:**
```json
{
  "profile_id": "DNA_A1B2C3D4E5F6",
  "category_distribution": {
    "Food": 50.0,
    "Groceries": 50.0
  },
  "spending_velocity": 1.0,
  "time_of_day_patterns": {
    "10": 3000.0,
    "19": 500.0
  },
  "day_of_week_patterns": {
    "Monday": 500.0,
    "Tuesday": 3000.0,
    "Wednesday": 0.0
  },
  "seasonal_patterns": null,
  "top_merchants": [
    {
      "merchant": "Supermarket",
      "transactions": 1,
      "total_spent": 3000.0,
      "average_transaction": 3000.0
    }
  ],
  "total_transactions": 2,
  "total_spent": 3500.0
}
```

## 7. Subscription Detection

```bash
curl -X POST "http://localhost:8000/api/v1/detect-subscriptions" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "amount": 199,
        "description": "Netflix monthly subscription",
        "timestamp": "2024-01-01T09:00:00",
        "merchant": "Netflix"
      },
      {
        "amount": 199,
        "description": "Netflix monthly subscription",
        "timestamp": "2024-02-01T09:00:00",
        "merchant": "Netflix"
      },
      {
        "amount": 199,
        "description": "Netflix monthly subscription",
        "timestamp": "2024-03-01T09:00:00",
        "merchant": "Netflix"
      }
    ]
  }'
```

**Response:**
```json
{
  "subscriptions": [
    {
      "merchant": "Netflix",
      "amount": 199.0,
      "frequency": "monthly",
      "confidence": 0.95,
      "first_occurrence": "2024-01-01T09:00:00",
      "last_occurrence": "2024-03-01T09:00:00",
      "count": 3,
      "total_spent": 597.0,
      "is_active": true
    }
  ],
  "total_subscription_cost": 597.0,
  "total_monthly_cost": 199.0
}
```

## 8. Behavioral Pattern Analysis

```bash
curl -X POST "http://localhost:8000/api/v1/behavioral-patterns" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "amount": 500,
        "description": "Lunch",
        "timestamp": "2024-01-15T12:30:00",
        "merchant": "Restaurant"
      },
      {
        "amount": 2000,
        "description": "Shopping",
        "timestamp": "2024-01-20T18:00:00",
        "merchant": "Mall"
      },
      {
        "amount": 300,
        "description": "Dinner",
        "timestamp": "2024-01-21T21:00:00",
        "merchant": "Cafe"
      }
    ]
  }'
```

**Response:**
```json
{
  "patterns": [
    {
      "pattern_type": "Late Night Spending",
      "description": "Higher activity during late night/early morning hours",
      "confidence": 0.7,
      "examples": ["Online shopping", "Impulse purchases", "Entertainment spending"]
    }
  ],
  "weekend_vs_weekday": {
    "weekday_avg": 400.0,
    "weekend_avg": 2000.0
  },
  "payday_effect": 0.0,
  "emotional_spending_risk": "low"
}
```

## 9. What-If Simulator

```bash
curl -X POST "http://localhost:8000/api/v1/what-if" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What if I reduce food spending by 20%?",
    "transactions": [
      {
        "amount": 500,
        "description": "Food",
        "timestamp": "2024-01-15T19:30:00",
        "merchant": "Restaurant",
        "type": "expense"
      },
      {
        "amount": 3000,
        "description": "Groceries",
        "timestamp": "2024-01-16T10:00:00",
        "merchant": "Supermarket",
        "type": "expense"
      }
    ],
    "monthly_income": 100000,
    "savings_goal": 50000
  }'
```

**Response:**
```json
{
  "scenario": "Reduce Food spending by 20%",
  "current_spending": 3500.0,
  "projected_spending": 3100.0,
  "monthly_savings": 400.0,
  "yearly_savings": 4800.0,
  "time_to_goal": "156 months",
  "investment_potential": 336.0
}
```

## 10. Chatbot

```bash
curl -X POST "http://localhost:8000/api/v1/chatbot" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How can I save more money?",
    "context": {
      "current_spending": 60000,
      "income": 100000,
      "savings": 50000,
      "health_score": 78,
      "top_categories": ["Food", "Transport", "Shopping"]
    }
  }'
```

**Response:**
```json
{
  "response": "Based on your financial data, I recommend reviewing your Food and Transport spending. You could potentially save 10-15% by meal planning and using public transport more often.",
  "insights": [
    "Your spending is at 60% of income. This is within normal range.",
    "Focus on reducing discretionary spending"
  ],
  "confidence": 0.85
}
```

## 11. Smart Insights

```bash
curl -X POST "http://localhost:8000/api/v1/smart-insights" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "amount": 500,
        "description": "Food",
        "timestamp": "2024-01-15T19:30:00",
        "merchant": "Restaurant",
        "category": "Food",
        "type": "expense"
      }
    ],
    "period": "monthly",
    "include_predictions": true
  }'
```

**Response:**
```json
{
  "insights": [
    {
      "title": "Spending Increased",
      "description": "Your spending has increased by ₹500.00 (50%) this month.",
      "category": "spending",
      "priority": "medium",
      "action": "Review discretionary spending"
    }
  ],
  "summary": "You have 1 important financial item to address: Spending Increased. Total spending this period: ₹500.00",
  "period": "monthly"
}
```

## 12. Health Check

```bash
curl "http://localhost:8000/api/v1/health"
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T15:30:00",
  "version": "v1.0.0",
  "services": {
    "categorizer": "ready",
    "anomaly_detector": "ready",
    "predictor": "ready",
    "personality_analyzer": "ready"
  }
}
```

## 13. Model Status

```bash
curl "http://localhost:8000/api/v1/model-status"
```

**Response:**
```json
[
  {
    "model": "categorizer",
    "is_loaded": true,
    "last_trained": "2024-01-15T10:00:00",
    "training_samples": 5000,
    "accuracy": 0.92,
    "status": "ready"
  },
  {
    "model": "anomaly_detector",
    "is_loaded": true,
    "status": "ready"
  }
]
```

## Python Client Example

```python
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

# Categorize transaction
response = requests.post(
    f"{BASE_URL}/categorize",
    json={
        "amount": 500,
        "description": "Dinner at Restaurant",
        "merchant": "Restaurant ABC"
    }
)
print(response.json())

# Detect anomalies
response = requests.post(
    f"{BASE_URL}/detect-anomalies",
    json={
        "transactions": [
            {
                "amount": 500,
                "description": "Regular purchase",
                "timestamp": "2024-01-15T10:00:00",
                "merchant": "Store"
            },
            {
                "amount": 50000,
                "description": "Large purchase",
                "timestamp": "2024-01-16T10:00:00",
                "merchant": "Store"
            }
        ],
        "sensitivity": 0.7
    }
)
print(response.json())
```

## JavaScript Client Example

```javascript
const BASE_URL = "http://localhost:8000/api/v1";

async function categorizeTransaction() {
  const response = await fetch(`${BASE_URL}/categorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: 500,
      description: 'Dinner at Restaurant',
      merchant: 'Restaurant ABC'
    })
  });
  
  const data = await response.json();
  console.log(data);
}

categorizeTransaction();
```
