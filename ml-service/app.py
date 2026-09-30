"""Main FastAPI application for AI Finance ML Microservice."""

import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn

from config import settings
from api.routes import router as api_router
from api.advanced_routes import router as advanced_router
from services.categorizer import TransactionCategorizer
from services.anomaly_detector import AnomalyDetector
from services.predictor import SpendingPredictor
from services.personality_analyzer import SpendingPersonalityAnalyzer
from services.health_scorer import FinancialHealthScorer
from services.spending_dna import SpendingDNAAnalyzer
from services.subscription_detector import SubscriptionDetector
from services.behavioral_analyzer import BehavioralAnalyzer
from services.what_if_simulator import WhatIfSimulator
from services.chatbot import FinancialChatbot
from services.insight_generator import InsightGenerator

logger = logging.getLogger(__name__)

# ============================================================================
# Application State
# ============================================================================

app_state = {}


# ============================================================================
# Lifespan Events
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    logger.info("Starting up AI Finance ML Microservice...")

    # Startup
    try:
        # Initialize services
        _initialize_services()
        logger.info("All services initialized successfully")
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        sys.exit(1)

    yield

    # Shutdown
    logger.info("Shutting down AI Finance ML Microservice...")
    app_state.clear()


def _initialize_services():
    """Initialize all ML services."""
    try:
        # Categorizer
        logger.info("Loading categorizer...")
        categorizer = TransactionCategorizer(
            model_path=settings.CATEGORIZER_MODEL_PATH,
            vectorizer_path=settings.CATEGORIZER_VECTORIZER_PATH,
        )
        app_state['categorizer'] = categorizer

        # Anomaly Detector
        logger.info("Loading anomaly detector...")
        anomaly_detector = AnomalyDetector(
            model_path=settings.ANOMALY_DETECTOR_PATH,
            contamination=settings.ANOMALY_CONTAMINATION,
        )
        app_state['anomaly_detector'] = anomaly_detector

        # Predictor
        logger.info("Loading predictor...")
        predictor = SpendingPredictor(
            models_dir=settings.PROPHET_MODELS_PATH,
        )
        app_state['predictor'] = predictor

        # Personality Analyzer
        logger.info("Loading personality analyzer...")
        personality_analyzer = SpendingPersonalityAnalyzer(
            model_path=settings.PERSONALITY_ANALYZER_PATH,
            n_clusters=settings.PERSONALITY_CLUSTERS,
        )
        app_state['personality_analyzer'] = personality_analyzer

        # Health Scorer
        logger.info("Loading health scorer...")
        health_scorer = FinancialHealthScorer()
        app_state['health_scorer'] = health_scorer

        # Spending DNA Analyzer
        logger.info("Loading spending DNA analyzer...")
        spending_dna = SpendingDNAAnalyzer()
        app_state['spending_dna'] = spending_dna

        # Subscription Detector
        logger.info("Loading subscription detector...")
        subscription_detector = SubscriptionDetector()
        app_state['subscription_detector'] = subscription_detector

        # Behavioral Analyzer
        logger.info("Loading behavioral analyzer...")
        behavioral_analyzer = BehavioralAnalyzer()
        app_state['behavioral_analyzer'] = behavioral_analyzer

        # What-If Simulator
        logger.info("Loading what-if simulator...")
        what_if_simulator = WhatIfSimulator()
        app_state['what_if_simulator'] = what_if_simulator

        # Chatbot
        logger.info("Loading chatbot...")
        chatbot = FinancialChatbot(
            openai_key=settings.OPENAI_API_KEY if settings.ENABLE_CHATBOT else None
        )
        app_state['chatbot'] = chatbot

        # Insight Generator
        logger.info("Loading insight generator...")
        insight_generator = InsightGenerator()
        app_state['insight_generator'] = insight_generator

        logger.info(f"Services initialized: {list(app_state.keys())}")

    except Exception as e:
        logger.error(f"Error initializing services: {e}")
        raise


# ============================================================================
# FastAPI Application
# ============================================================================

def create_app() -> FastAPI:
    """Create FastAPI application."""

    app = FastAPI(
        title=settings.API_TITLE,
        description=settings.API_DESCRIPTION,
        version=settings.API_VERSION,
        lifespan=lifespan,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
    )

    # ========================================================================
    # Middleware
    # ========================================================================

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_CREDENTIALS,
        allow_methods=settings.CORS_METHODS,
        allow_headers=settings.CORS_HEADERS,
    )

    # Trusted Host Middleware (security)
    if not settings.DEBUG:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["localhost", "127.0.0.1"],
        )

    # ========================================================================
    # Routes
    # ========================================================================

    # API Routes
    app.include_router(api_router)

    # Advanced Routes (training, analytics, etc.)
    app.include_router(advanced_router)

    # ========================================================================
    # Exception Handlers
    # ========================================================================

    @app.exception_handler(Exception)
    async def general_exception_handler(request, exc):
        """Handle general exceptions."""
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return {
            "detail": "Internal server error",
            "status": 500,
        }

    return app


# ============================================================================
# Application Instance
# ============================================================================

app = create_app()


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=settings.LOG_LEVEL,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    uvicorn.run(
        "app:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )