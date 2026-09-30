"""Model evaluation and comparison service."""

import logging
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_curve, auc,
    precision_recall_curve, f1_score, accuracy_score
)
import json

logger = logging.getLogger(__name__)


class ModelEvaluator:
    """Evaluate and compare ML models."""

    def __init__(self):
        """Initialize model evaluator."""
        self.evaluation_results = {}
        self.feature_importance = {}

    def evaluate_categorizer(
        self,
        y_true: List[str],
        y_pred: List[str],
        y_pred_proba: Optional[np.ndarray] = None,
    ) -> Dict[str, Any]:
        """Evaluate categorization model.

        Args:
            y_true: True labels
            y_pred: Predicted labels
            y_pred_proba: Prediction probabilities

        Returns:
            Evaluation metrics and report
        """
        try:
            # Accuracy
            accuracy = accuracy_score(y_true, y_pred)

            # Detailed classification report
            report = classification_report(
                y_true, y_pred, output_dict=True, zero_division=0
            )

            # Confusion matrix
            cm = confusion_matrix(y_true, y_pred)
            cm_dict = {
                'matrix': cm.tolist(),
                'classes': sorted(set(y_true + y_pred))
            }

            # Per-class metrics
            per_class_metrics = {}
            for label in sorted(set(y_true)):
                if label in report:
                    per_class_metrics[label] = {
                        'precision': report[label].get('precision', 0),
                        'recall': report[label].get('recall', 0),
                        'f1': report[label].get('f1-score', 0),
                        'support': int(report[label].get('support', 0)),
                    }

            evaluation = {
                'model': 'Categorizer',
                'accuracy': round(accuracy, 4),
                'weighted_precision': round(report['weighted avg']['precision'], 4),
                'weighted_recall': round(report['weighted avg']['recall'], 4),
                'weighted_f1': round(report['weighted avg']['f1-score'], 4),
                'macro_f1': round(report['macro avg']['f1-score'], 4),
                'confusion_matrix': cm_dict,
                'per_class_metrics': per_class_metrics,
            }

            return evaluation

        except Exception as e:
            logger.error(f"Error evaluating categorizer: {e}")
            return {'error': str(e)}

    def evaluate_anomaly_detector(
        self,
        y_true: List[int],
        y_pred: List[int],
        y_scores: Optional[List[float]] = None,
    ) -> Dict[str, Any]:
        """Evaluate anomaly detection model.

        Args:
            y_true: True anomaly labels (-1 or 1)
            y_pred: Predicted labels (-1 or 1)
            y_scores: Anomaly scores

        Returns:
            Evaluation metrics
        """
        try:
            # Convert to binary (0 = normal, 1 = anomaly)
            y_true_binary = [1 if y == -1 else 0 for y in y_true]
            y_pred_binary = [1 if y == -1 else 0 for y in y_pred]

            accuracy = accuracy_score(y_true_binary, y_pred_binary)
            report = classification_report(
                y_true_binary, y_pred_binary, output_dict=True, zero_division=0
            )

            # Anomaly-specific metrics
            tp = sum(1 for t, p in zip(y_true_binary, y_pred_binary) if t == 1 and p == 1)
            fp = sum(1 for t, p in zip(y_true_binary, y_pred_binary) if t == 0 and p == 1)
            tn = sum(1 for t, p in zip(y_true_binary, y_pred_binary) if t == 0 and p == 0)
            fn = sum(1 for t, p in zip(y_true_binary, y_pred_binary) if t == 1 and p == 0)

            sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
            specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = sensitivity

            evaluation = {
                'model': 'AnomalyDetector',
                'accuracy': round(accuracy, 4),
                'precision': round(precision, 4),
                'recall': round(recall, 4),
                'sensitivity': round(sensitivity, 4),
                'specificity': round(specificity, 4),
                'f1_score': round(2 * (precision * recall) / (precision + recall + 1e-8), 4),
                'confusion_matrix': {
                    'true_positives': int(tp),
                    'false_positives': int(fp),
                    'true_negatives': int(tn),
                    'false_negatives': int(fn),
                }
            }

            return evaluation

        except Exception as e:
            logger.error(f"Error evaluating anomaly detector: {e}")
            return {'error': str(e)}

    def evaluate_predictor(
        self,
        y_true: List[float],
        y_pred: List[float],
    ) -> Dict[str, Any]:
        """Evaluate time series prediction model.

        Args:
            y_true: True values
            y_pred: Predicted values

        Returns:
            Regression metrics
        """
        try:
            y_true = np.array(y_true)
            y_pred = np.array(y_pred)

            # Ensure same length
            min_len = min(len(y_true), len(y_pred))
            y_true = y_true[:min_len]
            y_pred = y_pred[:min_len]

            # Metrics
            mae = np.mean(np.abs(y_true - y_pred))
            mse = np.mean((y_true - y_pred) ** 2)
            rmse = np.sqrt(mse)
            mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1e-8)))

            # R-squared
            ss_res = np.sum((y_true - y_pred) ** 2)
            ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
            r2_score = 1 - (ss_res / (ss_tot + 1e-8))

            evaluation = {
                'model': 'Predictor',
                'mae': round(mae, 4),
                'mse': round(mse, 4),
                'rmse': round(rmse, 4),
                'mape': round(mape, 4),
                'r2_score': round(r2_score, 4),
            }

            return evaluation

        except Exception as e:
            logger.error(f"Error evaluating predictor: {e}")
            return {'error': str(e)}

    def get_feature_importance(
        self,
        model: Any,
        feature_names: Optional[List[str]] = None,
        top_k: int = 20,
    ) -> Dict[str, Any]:
        """Extract and rank feature importance.

        Args:
            model: Trained model with feature importance
            feature_names: Names of features
            top_k: Number of top features to return

        Returns:
            Feature importance ranking
        """
        try:
            importance = {}

            # Try different attribute names
            if hasattr(model, 'feature_importances_'):
                importance_scores = model.feature_importances_
            elif hasattr(model, 'coef_'):
                importance_scores = np.abs(model.coef_[0]) if len(model.coef_.shape) > 1 else np.abs(model.coef_)
            else:
                return {'error': 'Model does not have feature importance'}

            # Create feature ranking
            if feature_names is None:
                feature_names = [f"feature_{i}" for i in range(len(importance_scores))]

            rankings = sorted(
                zip(feature_names, importance_scores),
                key=lambda x: x[1],
                reverse=True
            )[:top_k]

            importance = {
                'top_features': [
                    {'feature': name, 'importance': round(score, 4)}
                    for name, score in rankings
                ],
                'total_features': len(importance_scores),
            }

            return importance

        except Exception as e:
            logger.error(f"Error calculating feature importance: {e}")
            return {'error': str(e)}

    def compare_models(
        self,
        models: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Compare multiple models.

        Args:
            models: Dict of model evaluations

        Returns:
            Comparison analysis
        """
        try:
            comparison = {
                'models': models,
                'best_models': {},
            }

            # Find best model by key metrics
            if all(m.get('accuracy') for m in models.values()):
                best_accuracy = max(models.keys(), key=lambda k: models[k].get('accuracy', 0))
                comparison['best_models']['accuracy'] = {
                    'model': best_accuracy,
                    'score': models[best_accuracy]['accuracy'],
                }

            if all(m.get('f1_score') for m in models.values()):
                best_f1 = max(models.keys(), key=lambda k: models[k].get('f1_score', 0))
                comparison['best_models']['f1_score'] = {
                    'model': best_f1,
                    'score': models[best_f1]['f1_score'],
                }

            return comparison

        except Exception as e:
            logger.error(f"Error comparing models: {e}")
            return {'error': str(e)}

    def generate_evaluation_report(
        self,
        evaluations: Dict[str, Dict[str, Any]],
    ) -> str:
        """Generate human-readable evaluation report.

        Args:
            evaluations: Dict of model evaluations

        Returns:
            Formatted report string
        """
        try:
            report = []
            report.append("="*80)
            report.append("MODEL EVALUATION REPORT")
            report.append("="*80)

            for model_name, evaluation in evaluations.items():
                report.append(f"\n{model_name.upper()}")
                report.append("-"*80)

                if 'error' in evaluation:
                    report.append(f"Error: {evaluation['error']}")
                    continue

                for key, value in evaluation.items():
                    if key not in ['confusion_matrix', 'per_class_metrics']:
                        if isinstance(value, float):
                            report.append(f"  {key}: {value:.4f}")
                        else:
                            report.append(f"  {key}: {value}")

            report.append("\n" + "="*80)
            return "\n".join(report)

        except Exception as e:
            logger.error(f"Error generating report: {e}")
            return f"Error generating report: {str(e)}"
