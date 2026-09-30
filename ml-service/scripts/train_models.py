"""Complete ML training pipeline with epoch tracking and cross-validation."""

import logging
import sys
import json
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import settings
from utils.data_generator import FinancialDataGenerator
from services.categorizer import TransactionCategorizer
from services.anomaly_detector import AnomalyDetector
from services.predictor import SpendingPredictor
from services.personality_analyzer import SpendingPersonalityAnalyzer
from services.health_scorer import FinancialHealthScorer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def generate_training_data(num_transactions: int = 50000):
    """Generate large-scale synthetic training data."""
    logger.info(f"Generating {num_transactions} synthetic transactions...")
    generator = FinancialDataGenerator(seed=42)

    transactions = generator.generate_transactions(
        num_transactions=num_transactions,
        days=730,  # 2 years
        user_profile='professional',
    )

    logger.info(f"Generated {len(transactions)} transactions across {730} days")
    return transactions


def train_categorizer(transactions: list) -> dict:
    """Train NLP categorizer with ensemble voting."""
    logger.info("="*60)
    logger.info("Training Categorizer (40 epochs)")
    logger.info("="*60)

    try:
        # Prepare training data
        training_data = [
            {
                'text': f"{t['description']} {t.get('merchant', '')}",
                'category': t.get('category', 'Other'),
            }
            for t in transactions
            if t.get('type') == 'expense'  # Only expenses
        ]

        logger.info(f"Training data: {len(training_data)} samples")

        settings.CATEGORIZER_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        settings.CATEGORIZER_VECTORIZER_PATH.parent.mkdir(parents=True, exist_ok=True)

        categorizer = TransactionCategorizer(
            model_path=settings.CATEGORIZER_MODEL_PATH,
            vectorizer_path=settings.CATEGORIZER_VECTORIZER_PATH,
        )

        result = categorizer.train(training_data, epochs=40)

        if result.get('success'):
            categorizer.save()
            logger.info(f"Categorizer Training Summary:")
            logger.info(f"  Accuracy: {result['metrics'].get('accuracy', 0):.4f}")
            logger.info(f"  Precision: {result['metrics'].get('precision', 0):.4f}")
            logger.info(f"  Recall: {result['metrics'].get('recall', 0):.4f}")
            logger.info(f"  F1-Score: {result['metrics'].get('f1_score', 0):.4f}")
            return {'success': True, 'metrics': result['metrics']}
        else:
            logger.error(f"Categorizer training failed: {result.get('error')}")
            return {'success': False, 'error': result.get('error')}

    except Exception as e:
        logger.error(f"Error training categorizer: {e}", exc_info=True)
        return {'success': False, 'error': str(e)}


def train_anomaly_detector(transactions: list) -> dict:
    """Train ensemble anomaly detection models."""
    logger.info("="*60)
    logger.info("Training Anomaly Detector (35 epochs)")
    logger.info("="*60)

    try:
        settings.ANOMALY_DETECTOR_PATH.parent.mkdir(parents=True, exist_ok=True)

        detector = AnomalyDetector(
            model_path=settings.ANOMALY_DETECTOR_PATH,
            contamination=0.05,
        )

        result = detector.train(transactions, epochs=35)

        if result.get('success'):
            detector.save()
            logger.info(f"Anomaly Detector Training Summary:")
            logger.info(f"  Total samples: {result['metrics'].get('total_samples', 0)}")
            logger.info(f"  Anomalies detected: {result['metrics'].get('final_anomalies', 0)}")
            logger.info(f"  Contamination rate: {result['metrics'].get('contamination', 0):.4f}")
            return {'success': True, 'metrics': result['metrics']}
        else:
            logger.error(f"Anomaly detector training failed: {result.get('error')}")
            return {'success': False, 'error': result.get('error')}

    except Exception as e:
        logger.error(f"Error training anomaly detector: {e}", exc_info=True)
        return {'success': False, 'error': str(e)}


def train_predictor(transactions: list) -> dict:
    """Train time series prediction ensemble."""
    logger.info("="*60)
    logger.info("Training Spending Predictor (30 CV folds)")
    logger.info("="*60)

    try:
        predictor = SpendingPredictor(
            models_dir=settings.PROPHET_MODELS_PATH,
        )

        result = predictor.train_ensemble_models(transactions, epochs=30)

        if result.get('success'):
            logger.info(f"Predictor Training Summary:")
            logger.info(f"  Prophet MAPE: {result['metrics'].get('prophet', 'N/A')}")
            logger.info(f"  LSTM MAPE: {result['metrics'].get('lstm', 'N/A')}")
            logger.info(f"  Exponential MAPE: {result['metrics'].get('exponential', 'N/A')}")
            logger.info(f"  CV Folds: {result['metrics'].get('num_folds', 30)}")
            return {'success': True, 'metrics': result['metrics']}
        else:
            logger.error(f"Predictor training failed: {result.get('error')}")
            return {'success': False, 'error': result.get('error')}

    except Exception as e:
        logger.error(f"Error training predictor: {e}")
        return {'success': False, 'error': str(e)}


def train_personality_analyzer(transactions: list) -> dict:
    """Train personality clustering with 8 types."""
    logger.info("="*60)
    logger.info("Training Personality Analyzer (30 iterations)")
    logger.info("="*60)

    try:
        settings.PERSONALITY_ANALYZER_PATH.parent.mkdir(parents=True, exist_ok=True)

        # Create user profiles from transactions
        users_data = []
        chunk_size = len(transactions) // 20  # 20 synthetic users
        for i in range(20):
            start = i * chunk_size
            end = (i + 1) * chunk_size if i < 19 else len(transactions)
            users_data.append(transactions[start:end])

        logger.info(f"Created {len(users_data)} user profiles for clustering")

        analyzer = SpendingPersonalityAnalyzer(
            model_path=settings.PERSONALITY_ANALYZER_PATH,
            n_clusters=8,
        )

        result = analyzer.train(users_data, epochs=30)

        if result.get('success'):
            analyzer.save()
            logger.info(f"Personality Analyzer Training Summary:")
            logger.info(f"  Users: {result['metrics'].get('n_users', 0)}")
            logger.info(f"  Features: {result['metrics'].get('n_features', 0)}")
            logger.info(f"  Clusters: {result['metrics'].get('n_clusters', 8)}")
            logger.info(f"  Final Silhouette: {result['metrics'].get('final_silhouette', 0):.4f}")
            return {'success': True, 'metrics': result['metrics']}
        else:
            logger.error(f"Personality analyzer training failed: {result.get('error')}")
            return {'success': False, 'error': result.get('error')}

    except Exception as e:
        logger.error(f"Error training personality analyzer: {e}", exc_info=True)
        return {'success': False, 'error': str(e)}


def create_sample_config():
    """Create sample .env file."""
    logger.info("Creating sample configuration files...")

    env_content = """# AI Finance ML Microservice Configuration

# Environment
ENV=development
DEBUG=True

# API Configuration
HOST=0.0.0.0
PORT=8000

# MongoDB
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=ai_finance_db

# Redis
REDIS_URL=redis://localhost:6379/0

# Logging
LOG_LEVEL=INFO
"""

    env_file = Path(__file__).parent.parent / ".env.example"
    with open(env_file, 'w') as f:
        f.write(env_content)

    logger.info(f"Sample .env file created: {env_file}")


def main():
    """Main training pipeline."""
    start_time = datetime.now()
    logger.info("="*60)
    logger.info("AI Finance ML Microservice - Model Training Pipeline")
    logger.info("="*60)

    try:
        # Generate large-scale training data
        transactions = generate_training_data(num_transactions=50000)

        # Train all models
        results = {
            'timestamp': start_time.isoformat(),
            'total_transactions': len(transactions),
            'models': {}
        }

        logger.info("\nStarting model training...")

        results['models']['categorizer'] = train_categorizer(transactions)
        results['models']['anomaly_detector'] = train_anomaly_detector(transactions)
        results['models']['predictor'] = train_predictor(transactions)
        results['models']['personality_analyzer'] = train_personality_analyzer(transactions)

        create_sample_config()

        # Training summary
        logger.info("\n" + "="*60)
        logger.info("Training Summary")
        logger.info("="*60)

        success_count = 0
        for model_name, result in results['models'].items():
            status = "SUCCESS" if result.get('success') else "FAILED"
            logger.info(f"{model_name.upper()}: {status}")
            if result.get('success'):
                success_count += 1
                if result.get('metrics'):
                    for key, value in result['metrics'].items():
                        if isinstance(value, float):
                            logger.info(f"  {key}: {value:.4f}")
                        elif not isinstance(value, list):
                            logger.info(f"  {key}: {value}")

        # Save results to file
        results_file = Path(__file__).parent.parent / "training_results.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info("="*60)
        logger.info(f"Training completed in {elapsed:.2f} seconds")
        logger.info(f"Success rate: {success_count}/4 models")
        logger.info("="*60)

        return 0 if success_count == 4 else 1

    except Exception as e:
        logger.error(f"Fatal error during training: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
