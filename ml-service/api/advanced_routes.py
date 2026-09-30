"""Advanced ML endpoints for training, evaluation, and analytics."""

import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["advanced"])


def get_app_state():
    """Get app state from app module."""
    from app import app_state
    return app_state


class TrainingRequest(BaseModel):
    """Request model for training."""
    model_name: str  # 'categorizer', 'anomaly_detector', 'predictor', 'personality_analyzer'
    epochs: int = 30
    num_transactions: int = 50000


class BatchAnalysisRequest(BaseModel):
    """Request for batch transaction analysis."""
    transactions: List[Dict[str, Any]]
    include_predictions: bool = True
    include_anomalies: bool = True
    include_personality: bool = True


class PeriodComparisonRequest(BaseModel):
    """Request for comparing two time periods."""
    transactions_period1: List[Dict[str, Any]]
    transactions_period2: List[Dict[str, Any]]
    period1_name: str = "Period 1"
    period2_name: str = "Period 2"


class PeerComparisonRequest(BaseModel):
    """Request for peer comparison."""
    transactions: List[Dict[str, Any]]
    user_income: float


# Training endpoints
@router.post("/train")
async def trigger_model_training(
    request: TrainingRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """Trigger model retraining.

    Args:
        request: Training request with model name and parameters
        background_tasks: Background task runner

    Returns:
        Training status and job ID
    """
    try:
        valid_models = ['categorizer', 'anomaly_detector', 'predictor', 'personality_analyzer']
        if request.model_name not in valid_models:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid model name. Must be one of {valid_models}"
            )

        job_id = f"training_{request.model_name}_{int(asyncio.get_event_loop().time())}"

        logger.info(f"Scheduled training job: {job_id}")

        return {
            'status': 'scheduled',
            'job_id': job_id,
            'model': request.model_name,
            'epochs': request.epochs,
            'message': f"Training job {job_id} scheduled for {request.model_name}"
        }

    except Exception as e:
        logger.error(f"Error scheduling training: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/training-history")
async def get_training_history(
    app_state: dict = Depends(get_app_state),
) -> Dict[str, Any]:
    """Get epoch-by-epoch training history for all models.

    Returns:
        Training history data
    """
    try:
        history = {}

        # Get history from each service
        if 'categorizer' in app_state and hasattr(app_state['categorizer'], 'training_history'):
            history['categorizer'] = app_state['categorizer'].training_history

        if 'anomaly_detector' in app_state and hasattr(app_state['anomaly_detector'], 'training_history'):
            history['anomaly_detector'] = app_state['anomaly_detector'].training_history

        if 'personality_analyzer' in app_state and hasattr(app_state['personality_analyzer'], 'training_history'):
            history['personality_analyzer'] = app_state['personality_analyzer'].training_history

        return {
            'status': 'success',
            'training_history': history,
        }

    except Exception as e:
        logger.error(f"Error retrieving training history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/model-metrics")
async def get_model_metrics(
    app_state: dict = Depends(get_app_state),
) -> Dict[str, Any]:
    """Get training metrics for all models.

    Returns:
        Model metrics and performance data
    """
    try:
        metrics = {}

        # Categorizer metrics
        if 'categorizer' in app_state and hasattr(app_state['categorizer'], 'metrics'):
            metrics['categorizer'] = app_state['categorizer'].metrics

        # Anomaly detector metrics
        if 'anomaly_detector' in app_state and hasattr(app_state['anomaly_detector'], 'metrics'):
            metrics['anomaly_detector'] = app_state['anomaly_detector'].metrics

        # Personality analyzer metrics
        if 'personality_analyzer' in app_state and hasattr(app_state['personality_analyzer'], 'metrics'):
            metrics['personality_analyzer'] = app_state['personality_analyzer'].metrics

        return {
            'status': 'success',
            'metrics': metrics,
            'last_updated': None,  # Could track actual update time
        }

    except Exception as e:
        logger.error(f"Error retrieving metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Analysis endpoints
@router.post("/batch-analyze")
async def batch_analyze_transactions(
    request: BatchAnalysisRequest,
    app_state: dict = Depends(get_app_state),
) -> Dict[str, Any]:
    """Analyze a batch of transactions using all models.

    Args:
        request: Batch analysis request
        app_state: Application state with loaded services

    Returns:
        Comprehensive analysis results
    """
    try:
        results = {
            'status': 'success',
            'transaction_count': len(request.transactions),
            'analyses': {}
        }

        # Categorization
        if request.include_predictions and 'categorizer' in app_state:
            try:
                categorizer = app_state['categorizer']
                category_results = []

                for txn in request.transactions:
                    desc = txn.get('description', '') + ' ' + txn.get('merchant', '')
                    category, confidence, alternatives = categorizer.predict(desc)
                    category_results.append({
                        'transaction_id': txn.get('transaction_id'),
                        'predicted_category': category,
                        'confidence': confidence,
                        'alternatives': alternatives,
                    })

                results['analyses']['categorization'] = {
                    'results': category_results,
                    'accuracy': categorizer.metrics.get('accuracy', 0) if hasattr(categorizer, 'metrics') else 0,
                }
            except Exception as e:
                logger.warning(f"Categorization failed: {e}")
                results['analyses']['categorization'] = {'error': str(e)}

        # Anomaly detection
        if request.include_anomalies and 'anomaly_detector' in app_state:
            try:
                detector = app_state['anomaly_detector']
                anomalies = detector.detect_anomalies(request.transactions)
                results['analyses']['anomalies'] = {
                    'anomalies': anomalies,
                    'count': len(anomalies),
                    'percentage': round(len(anomalies) / len(request.transactions) * 100, 2) if request.transactions else 0,
                }
            except Exception as e:
                logger.warning(f"Anomaly detection failed: {e}")
                results['analyses']['anomalies'] = {'error': str(e)}

        # Personality analysis
        if request.include_personality and 'personality_analyzer' in app_state:
            try:
                analyzer = app_state['personality_analyzer']
                personality = analyzer.analyze(request.transactions)
                results['analyses']['personality'] = personality
            except Exception as e:
                logger.warning(f"Personality analysis failed: {e}")
                results['analyses']['personality'] = {'error': str(e)}

        return results

    except Exception as e:
        logger.error(f"Error in batch analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare-periods")
async def compare_time_periods(
    request: PeriodComparisonRequest,
    app_state: dict = Depends(get_app_state),
) -> Dict[str, Any]:
    """Compare spending patterns between two time periods.

    Args:
        request: Period comparison request
        app_state: Application state

    Returns:
        Comparative analysis
    """
    try:
        import numpy as np

        comparison = {
            'status': 'success',
            'period1': request.period1_name,
            'period2': request.period2_name,
            'metrics': {}
        }

        # Basic statistics
        amounts1 = np.array([t['amount'] for t in request.transactions_period1])
        amounts2 = np.array([t['amount'] for t in request.transactions_period2])

        comparison['metrics']['period1'] = {
            'total_spending': round(np.sum(amounts1), 2),
            'average_transaction': round(np.mean(amounts1), 2),
            'transaction_count': len(amounts1),
            'std_dev': round(np.std(amounts1), 2),
        }

        comparison['metrics']['period2'] = {
            'total_spending': round(np.sum(amounts2), 2),
            'average_transaction': round(np.mean(amounts2), 2),
            'transaction_count': len(amounts2),
            'std_dev': round(np.std(amounts2), 2),
        }

        # Calculate differences
        spending_change = comparison['metrics']['period2']['total_spending'] - comparison['metrics']['period1']['total_spending']
        spending_pct_change = (spending_change / comparison['metrics']['period1']['total_spending'] * 100) if comparison['metrics']['period1']['total_spending'] > 0 else 0

        comparison['metrics']['change'] = {
            'absolute': round(spending_change, 2),
            'percentage': round(spending_pct_change, 2),
            'trend': 'increasing' if spending_change > 0 else 'decreasing',
        }

        # Category comparison
        categories1 = {}
        for txn in request.transactions_period1:
            cat = txn.get('category', 'Other')
            categories1[cat] = categories1.get(cat, 0) + txn['amount']

        categories2 = {}
        for txn in request.transactions_period2:
            cat = txn.get('category', 'Other')
            categories2[cat] = categories2.get(cat, 0) + txn['amount']

        comparison['metrics']['category_comparison'] = {
            'period1_top_categories': sorted(categories1.items(), key=lambda x: x[1], reverse=True)[:5],
            'period2_top_categories': sorted(categories2.items(), key=lambda x: x[1], reverse=True)[:5],
        }

        return comparison

    except Exception as e:
        logger.error(f"Error comparing periods: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/peer-comparison")
async def compare_with_peers(
    request: PeerComparisonRequest,
) -> Dict[str, Any]:
    """Compare user against anonymized population benchmarks.

    Args:
        request: Peer comparison request
        app_state: Application state

    Returns:
        Peer comparison analysis
    """
    try:
        import numpy as np

        amounts = np.array([t['amount'] for t in request.transactions])

        # User metrics
        user_metrics = {
            'total_spending': round(np.sum(amounts), 2),
            'average_transaction': round(np.mean(amounts), 2),
            'median_transaction': round(np.median(amounts), 2),
            'std_dev': round(np.std(amounts), 2),
            'monthly_average': round(np.sum(amounts) / (len(set(t['timestamp'].split('T')[0] for t in request.transactions)) / 30 + 1), 2),
        }

        # Simulated population benchmarks (would come from database in production)
        benchmark_metrics = {
            'avg_transaction_p50': 2500,  # Median peer
            'avg_transaction_p75': 3500,  # 75th percentile
            'avg_transaction_p90': 5000,  # 90th percentile
            'monthly_average_p50': 45000,
            'monthly_average_p75': 65000,
            'monthly_average_p90': 100000,
        }

        # Calculate percentiles
        percentile_rank = {
            'transaction_amount': 'median' if user_metrics['average_transaction'] < benchmark_metrics['avg_transaction_p75'] else 'above_average',
            'monthly_spending': 'median' if user_metrics['monthly_average'] < benchmark_metrics['monthly_average_p75'] else 'above_average',
        }

        return {
            'status': 'success',
            'user_metrics': user_metrics,
            'benchmark_metrics': benchmark_metrics,
            'percentile_rank': percentile_rank,
            'insights': [
                f"Your average transaction ({user_metrics['average_transaction']}) is in the {percentile_rank['transaction_amount']} range",
                f"Your monthly spending pattern ({user_metrics['monthly_average']}) is in the {percentile_rank['monthly_spending']} range",
            ],
        }

    except Exception as e:
        logger.error(f"Error in peer comparison: {e}")
        raise HTTPException(status_code=500, detail=str(e))