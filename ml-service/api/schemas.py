"""Pydantic schemas for request/response validation."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class TransactionItem(BaseModel):
    """Single transaction."""
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=1)
    timestamp: datetime
    merchant: Optional[str] = None
    transaction_id: Optional[str] = None


class CategorizationRequest(BaseModel):
    """Request to categorize a transaction."""
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=1)
    merchant: Optional[str] = None


class CategorizationResponse(BaseModel):
    """Categorization response."""
    category: str
    confidence: float = Field(..., ge=0, le=1)
    alternatives: Optional[List[Dict[str, float]]] = None


class BulkCategorizationRequest(BaseModel):
    """Request to categorize multiple transactions."""
    transactions: List[CategorizationRequest] = Field(..., max_items=1000)


class BulkCategorizationResponse(BaseModel):
    """Bulk categorization response."""
    results: List[CategorizationResponse]
    processed: int
    failed: int


class SpendingPredictionRequest(BaseModel):
    """Request for spending prediction."""
    transactions: List[TransactionItem]
    forecast_days: int = Field(default=30, ge=7, le=365)
    category: Optional[str] = None  # If specified, predict only this category


class SpendingForecast(BaseModel):
    """Forecast data point."""
    date: str
    predicted_amount: float
    lower_bound: float
    upper_bound: float
    confidence: float


class SpendingPredictionResponse(BaseModel):
    """Spending prediction response."""
    category: Optional[str]
    trend: str  # "increasing", "decreasing", "stable"
    forecasts: List[SpendingForecast]
    seasonal_pattern: Optional[Dict[str, float]] = None
    total_predicted_spend: float


class AnomalyDetectionRequest(BaseModel):
    """Request for anomaly detection."""
    transactions: List[TransactionItem]
    sensitivity: float = Field(default=0.5, ge=0, le=1)  # 0.5 = medium sensitivity


class AnomalyResult(BaseModel):
    """Single anomaly result."""
    transaction_id: Optional[str]
    description: str
    amount: float
    anomaly_score: float
    is_anomaly: bool
    reason: str
    severity: str  # "low", "medium", "high"


class AnomalyDetectionResponse(BaseModel):
    """Anomaly detection response."""
    anomalies: List[AnomalyResult]
    total_transactions: int
    anomaly_count: int
    anomaly_percentage: float


class PersonalityRequest(BaseModel):
    """Request for spending personality analysis."""
    transactions: List[TransactionItem]


class PersonalityResponse(BaseModel):
    """Spending personality response."""
    personality_type: str
    confidence: float
    description: str
    spending_habits: Dict[str, Any]
    tips: List[str]
    similar_users_percentage: float


class HealthScoreRequest(BaseModel):
    """Request for financial health score."""
    transactions: List[TransactionItem]
    income: float = Field(..., gt=0)
    debt: float = Field(default=0, ge=0)
    savings: float = Field(default=0, ge=0)
    monthly_budget: Optional[float] = None


class HealthComponent(BaseModel):
    """Single health score component."""
    name: str
    score: float
    weight: float
    description: str


class HealthScoreResponse(BaseModel):
    """Financial health score response."""
    overall_score: float = Field(..., ge=0, le=100)
    grade: str  # A, B, C, D, F
    components: List[HealthComponent]
    recommendations: List[str]


class SpendingDNARequest(BaseModel):
    """Request for spending DNA profile."""
    transactions: List[TransactionItem]


class SpendingPattern(BaseModel):
    """Spending pattern data."""
    period: str
    average_amount: float
    frequency: int


class SpendingDNAResponse(BaseModel):
    """Spending DNA response."""
    profile_id: str
    category_distribution: Dict[str, float]
    spending_velocity: float  # Avg days between transactions
    time_of_day_patterns: Dict[str, float]  # hour -> avg_spend
    day_of_week_patterns: Dict[str, float]  # day -> avg_spend
    seasonal_patterns: Optional[Dict[str, float]] = None
    top_merchants: List[Dict[str, Any]]
    total_transactions: int
    total_spent: float


class SubscriptionDetectionRequest(BaseModel):
    """Request for subscription detection."""
    transactions: List[TransactionItem]


class SubscriptionResult(BaseModel):
    """Detected subscription."""
    merchant: str
    amount: float
    frequency: str  # "weekly", "monthly", "quarterly", "yearly"
    confidence: float
    first_occurrence: datetime
    last_occurrence: datetime
    count: int
    total_spent: float
    is_active: bool


class SubscriptionDetectionResponse(BaseModel):
    """Subscription detection response."""
    subscriptions: List[SubscriptionResult]
    total_subscription_cost: float
    total_monthly_cost: float


class BehavioralPatternsRequest(BaseModel):
    """Request for behavioral pattern analysis."""
    transactions: List[TransactionItem]


class BehavioralPattern(BaseModel):
    """Single behavioral pattern."""
    pattern_type: str
    description: str
    confidence: float
    examples: List[str]


class BehavioralPatternsResponse(BaseModel):
    """Behavioral patterns response."""
    patterns: List[BehavioralPattern]
    weekend_vs_weekday: Dict[str, float]
    payday_effect: Optional[float] = None
    emotional_spending_risk: str  # "low", "medium", "high"


class WhatIfRequest(BaseModel):
    """Request for what-if simulation."""
    query: str  # e.g., "What if I reduce food spending by 20%?"
    transactions: List[TransactionItem]
    monthly_income: float
    savings_goal: Optional[float] = None


class WhatIfResponse(BaseModel):
    """What-if simulation response."""
    scenario: str
    current_spending: float
    projected_spending: float
    monthly_savings: float
    yearly_savings: float
    time_to_goal: Optional[str] = None  # e.g., "15 months"
    investment_potential: Optional[float] = None


class ChatbotRequest(BaseModel):
    """Request for chatbot."""
    message: str = Field(..., min_length=1)
    context: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None


class ChatbotResponse(BaseModel):
    """Chatbot response."""
    response: str
    insights: Optional[List[str]] = None
    confidence: float = Field(..., ge=0, le=1)


class SmartInsightsRequest(BaseModel):
    """Request for smart insights."""
    transactions: List[TransactionItem]
    period: str = "monthly"  # "weekly", "monthly", "quarterly"
    include_predictions: bool = True


class InsightItem(BaseModel):
    """Single insight."""
    title: str
    description: str
    category: str  # "spending", "saving", "pattern", "warning"
    priority: str  # "low", "medium", "high"
    action: Optional[str] = None


class SmartInsightsResponse(BaseModel):
    """Smart insights response."""
    insights: List[InsightItem]
    summary: str
    period: str


class ModelStatusResponse(BaseModel):
    """Model status response."""
    model: str
    is_loaded: bool
    last_trained: Optional[datetime] = None
    training_samples: Optional[int] = None
    accuracy: Optional[float] = None
    status: str  # "ready", "training", "not_found", "error"


class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: datetime
    version: str
    services: Dict[str, str]
