"""Configuration management for the AI Finance ML microservice."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""

    # Environment
    ENV: str = os.getenv("ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"

    # API Configuration
    API_TITLE: str = "AI Finance ML Microservice"
    API_VERSION: str = "v1.0.0"
    API_DESCRIPTION: str = "Machine Learning APIs for financial analysis and insights"

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))

    # CORS
    CORS_ORIGINS: list = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://localhost:8001",
    ]
    CORS_CREDENTIALS: bool = True
    CORS_METHODS: list = ["*"]
    CORS_HEADERS: list = ["*"]

    # Database
    MONGODB_URI: str = os.getenv(
        "MONGODB_URI",
        "mongodb://localhost:27017"
    )
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "ai_finance")

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_CACHE_TTL: int = 3600  # 1 hour

    # OpenAI
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = "gpt-3.5-turbo"
    OPENAI_MAX_TOKENS: int = 500

    # Model Paths
    BASE_PATH: Path = Path(__file__).parent
    MODELS_PATH: Path = BASE_PATH / "trained_models"
    DATA_PATH: Path = BASE_PATH / "data"

    # Model files
    CATEGORIZER_MODEL_PATH: Path = MODELS_PATH / "categorizer_model.pkl"
    CATEGORIZER_VECTORIZER_PATH: Path = MODELS_PATH / "categorizer_vectorizer.pkl"
    ANOMALY_DETECTOR_PATH: Path = MODELS_PATH / "anomaly_detector.pkl"
    PERSONALITY_ANALYZER_PATH: Path = MODELS_PATH / "personality_analyzer.pkl"
    PROPHET_MODELS_PATH: Path = MODELS_PATH / "prophet_models"

    # Categories file
    CATEGORIES_FILE: Path = DATA_PATH / "categories.json"

    # Feature Flags
    ENABLE_CHATBOT: bool = True
    ENABLE_ANOMALY_DETECTION: bool = True
    ENABLE_PREDICTIONS: bool = True
    ENABLE_PERSONALITY_ANALYSIS: bool = True
    ENABLE_CACHE: bool = True
    ENABLE_ASYNC_TASKS: bool = True

    # Model Configuration
    ANOMALY_CONTAMINATION: float = 0.1  # 10% contamination rate
    PERSONALITY_CLUSTERS: int = 5
    PROPHET_INTERVAL_WIDTH: float = 0.95

    # Batch Processing
    BATCH_SIZE: int = 100
    MAX_BULK_SIZE: int = 1000

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    class Config:
        env_file = ".env"
        extra = "ignore"
        case_sensitive = True


settings = Settings()