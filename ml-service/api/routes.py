"""FastAPI routes for ML microservice."""

import logging
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Optional, List
from datetime import datetime

from api.schemas import (
    CategorizationRequest, CategorizationResponse,
    BulkCategorizationRequest, BulkCategorizationResponse,
    SpendingPredictionRequest, SpendingPredictionResponse,
    AnomalyDetectionRequest, AnomalyDetectionResponse,
    PersonalityRequest, PersonalityResponse,
    HealthScoreRequest, HealthScoreResponse,
    SpendingDNARequest, SpendingDNAResponse,
    SubscriptionDetectionRequest, SubscriptionDetectionResponse,
    BehavioralPatternsRequest, BehavioralPatternsResponse,
    WhatIfRequest, WhatIfResponse,
    ChatbotRequest, ChatbotResponse,
    SmartInsightsRequest, SmartInsightsResponse,
    ModelStatusResponse, HealthCheckResponse,
)
from config import settings

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1", tags=["Finance ML"])


# ============================================================================
# Dependency functions for getting services
# ============================================================================

def get_services():
    """Get services from app state."""
    from app import app_state
    return app_state


# ============================================================================
# Health & Status Endpoints
# ============================================================================

@router.get("/health", response_model=HealthCheckResponse)
async def health_check(services: dict = Depends(get_services)):
    """Health check endpoint."""
    return HealthCheckResponse(
        status="healthy",
        timestamp=datetime.now(),
        version=settings.API_VERSION,
        services={
            'categorizer': 'ready' if services.get('categorizer') else 'unavailable',
            'anomaly_detector': 'ready' if services.get('anomaly_detector') else 'unavailable',
            'predictor': 'ready' if services.get('predictor') else 'unavailable',
            'personality_analyzer': 'ready' if services.get('personality_analyzer') else 'unavailable',
        }
    )


@router.get("/model-status", response_model=List[ModelStatusResponse])
async def model_status(services: dict = Depends(get_services)):
    """Get status of all trained models."""
    status_list = []

    models_info = {
        'categorizer': {
            'service': services.get('categorizer'),
            'trained_key': 'is_trained',
        },
        'anomaly_detector': {
            'service': services.get('anomaly_detector'),
            'trained_key': 'is_trained',
        },
        'personality_analyzer': {
            'service': services.get('personality_analyzer'),
            'trained_key': 'is_trained',
        },
    }

    for model_name, info in models_info.items():
        service = info['service']
        if service:
            is_loaded = getattr(service, info['trained_key'], False)
            status_list.append(ModelStatusResponse(
                model=model_name,
                is_loaded=is_loaded,
                status='ready' if is_loaded else 'not_found',
            ))

    return status_list


# ============================================================================
# Categorization Endpoints
# ============================================================================

@router.post("/categorize", response_model=CategorizationResponse)
async def categorize_transaction(
    request: CategorizationRequest,
    services: dict = Depends(get_services),
):
    """Categorize a single transaction."""
    try:
        categorizer = services.get('categorizer')
        if not categorizer:
            raise HTTPException(status_code=503, detail="Categorizer not available")

        text = f"{request.description} {request.merchant or ''}"
        category, confidence, alternatives = categorizer.predict(text)

        return CategorizationResponse(
            category=category,
            confidence=confidence,
            alternatives=alternatives,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error categorizing transaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/categorize/bulk", response_model=BulkCategorizationResponse)
async def categorize_bulk(
    request: BulkCategorizationRequest,
    services: dict = Depends(get_services),
):
    """Categorize multiple transactions."""
    try:
        categorizer = services.get('categorizer')
        if not categorizer:
            raise HTTPException(status_code=503, detail="Categorizer not available")

        results = []
        failed = 0

        for txn in request.transactions:
            try:
                text = f"{txn.description} {txn.merchant or ''}"
                category, confidence, alternatives = categorizer.predict(text)
                results.append(CategorizationResponse(
                    category=category,
                    confidence=confidence,
                    alternatives=alternatives,
                ))
            except Exception as e:
                logger.error(f"Error categorizing transaction: {e}")
                failed += 1

        return BulkCategorizationResponse(
            results=results,
            processed=len(results),
            failed=failed,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk categorization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Prediction Endpoints
# ============================================================================

@router.post("/predict-spending", response_model=SpendingPredictionResponse)
async def predict_spending(
    request: SpendingPredictionRequest,
    services: dict = Depends(get_services),
):
    """Predict future spending."""
    try:
        predictor = services.get('predictor')
        if not predictor:
            raise HTTPException(status_code=503, detail="Predictor not available")

        # Convert Pydantic models to dicts
        transactions = [t.model_dump() for t in request.transactions]

        result = predictor.predict_spending(
            transactions,
            forecast_days=request.forecast_days,
            category=request.category,
        )

        return SpendingPredictionResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error predicting spending: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Anomaly Detection Endpoint
# ============================================================================

@router.post("/detect-anomalies", response_model=AnomalyDetectionResponse)
async def detect_anomalies(
    request: AnomalyDetectionRequest,
    services: dict = Depends(get_services),
):
    """Detect anomalous transactions."""
    try:
        detector = services.get('anomaly_detector')
        if not detector:
            raise HTTPException(status_code=503, detail="Anomaly detector not available")

        transactions = [t.model_dump() for t in request.transactions]
        anomalies = detector.detect_anomalies(transactions, request.sensitivity)

        return AnomalyDetectionResponse(
            anomalies=anomalies,
            total_transactions=len(transactions),
            anomaly_count=len(anomalies),
            anomaly_percentage=len(anomalies) / len(transactions) * 100 if transactions else 0,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error detecting anomalies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Personality Analysis Endpoint
# ============================================================================

@router.post("/spending-personality", response_model=PersonalityResponse)
async def analyze_personality(
    request: PersonalityRequest,
    services: dict = Depends(get_services),
):
    """Analyze spending personality."""
    try:
        analyzer = services.get('personality_analyzer')
        if not analyzer:
            raise HTTPException(status_code=503, detail="Personality analyzer not available")

        transactions = [t.model_dump() for t in request.transactions]
        result = analyzer.analyze(transactions)

        return PersonalityResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing personality: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Health Score Endpoint
# ============================================================================

@router.post("/financial-health", response_model=HealthScoreResponse)
async def calculate_health_score(
    request: HealthScoreRequest,
    services: dict = Depends(get_services),
):
    """Calculate financial health score."""
    try:
        health_scorer = services.get('health_scorer')
        if not health_scorer:
            raise HTTPException(status_code=503, detail="Health scorer not available")

        transactions = [t.model_dump() for t in request.transactions]
        result = health_scorer.calculate_health_score(
            transactions,
            income=request.income,
            debt=request.debt,
            savings=request.savings,
            monthly_budget=request.monthly_budget,
        )

        return HealthScoreResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating health score: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Spending DNA Endpoint
# ============================================================================

@router.post("/spending-dna", response_model=SpendingDNAResponse)
async def generate_spending_dna(
    request: SpendingDNARequest,
    services: dict = Depends(get_services),
):
    """Generate spending DNA profile."""
    try:
        dna_analyzer = services.get('spending_dna')
        if not dna_analyzer:
            raise HTTPException(status_code=503, detail="DNA analyzer not available")

        transactions = [t.model_dump() for t in request.transactions]
        result = dna_analyzer.analyze(transactions)

        return SpendingDNAResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating spending DNA: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Subscription Detection Endpoint
# ============================================================================

@router.post("/detect-subscriptions", response_model=SubscriptionDetectionResponse)
async def detect_subscriptions(
    request: SubscriptionDetectionRequest,
    services: dict = Depends(get_services),
):
    """Detect recurring subscriptions."""
    try:
        detector = services.get('subscription_detector')
        if not detector:
            raise HTTPException(status_code=503, detail="Subscription detector not available")

        transactions = [t.model_dump() for t in request.transactions]
        subscriptions = detector.detect_subscriptions(transactions)
        monthly_cost = detector.calculate_monthly_cost(subscriptions)

        return SubscriptionDetectionResponse(
            subscriptions=subscriptions,
            total_subscription_cost=sum(s['total_spent'] for s in subscriptions),
            total_monthly_cost=monthly_cost,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error detecting subscriptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Behavioral Patterns Endpoint
# ============================================================================

@router.post("/behavioral-patterns", response_model=BehavioralPatternsResponse)
async def analyze_behavioral_patterns(
    request: BehavioralPatternsRequest,
    services: dict = Depends(get_services),
):
    """Detect behavioral patterns."""
    try:
        analyzer = services.get('behavioral_analyzer')
        if not analyzer:
            raise HTTPException(status_code=503, detail="Behavioral analyzer not available")

        transactions = [t.model_dump() for t in request.transactions]
        result = analyzer.analyze_patterns(transactions)

        return BehavioralPatternsResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing patterns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# What-If Simulator Endpoint
# ============================================================================

@router.post("/what-if", response_model=WhatIfResponse)
async def what_if_simulation(
    request: WhatIfRequest,
    services: dict = Depends(get_services),
):
    """Simulate what-if scenarios."""
    try:
        simulator = services.get('what_if_simulator')
        if not simulator:
            raise HTTPException(status_code=503, detail="Simulator not available")

        transactions = [t.model_dump() for t in request.transactions]
        result = simulator.simulate(
            query=request.query,
            transactions=transactions,
            monthly_income=request.monthly_income,
            savings_goal=request.savings_goal,
        )

        return WhatIfResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in what-if simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Chatbot Endpoint
# ============================================================================

@router.post("/chatbot", response_model=ChatbotResponse)
async def chat(
    request: ChatbotRequest,
    services: dict = Depends(get_services),
):
    """Financial chatbot."""
    try:
        chatbot = services.get('chatbot')
        if not chatbot:
            raise HTTPException(status_code=503, detail="Chatbot not available")

        result = chatbot.chat(message=request.message, context=request.context)

        return ChatbotResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chatbot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Smart Insights Endpoint
# ============================================================================

@router.post("/smart-insights", response_model=SmartInsightsResponse)
async def generate_insights(
    request: SmartInsightsRequest,
    services: dict = Depends(get_services),
):
    """Generate smart insights."""
    try:
        insight_gen = services.get('insight_generator')
        if not insight_gen:
            raise HTTPException(status_code=503, detail="Insight generator not available")

        transactions = [t.model_dump() for t in request.transactions]
        result = insight_gen.generate_insights(
            transactions=transactions,
            period=request.period,
            include_predictions=request.include_predictions,
        )

        return SmartInsightsResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))
