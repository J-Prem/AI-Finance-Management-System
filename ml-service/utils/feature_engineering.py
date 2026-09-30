"""Feature engineering utilities for ML models."""

import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FeatureEngineer:
    """Feature engineering for financial ML models."""

    @staticmethod
    def extract_time_features(dt: datetime) -> Dict[str, Any]:
        """Extract time-based features from datetime."""
        ts = pd.Timestamp(dt)
        return {
            'hour': ts.hour,
            'day_of_week': ts.weekday(),  # 0=Monday, 6=Sunday
            'is_weekend': ts.weekday() >= 5,
            'day_of_month': ts.day,
            'month': ts.month,
            'quarter': (ts.month - 1) // 3 + 1,
            'is_month_start': ts.day <= 3,
            'is_month_end': ts.day >= 28,
            'week_of_year': ts.isocalendar()[1],
            'day_name': ts.day_name(),
        }

    @staticmethod
    def extract_amount_features(
        amount: float,
        historical_amounts: List[float],
    ) -> Dict[str, float]:
        """Extract amount-based features."""
        if not historical_amounts:
            return {
                'amount_percentile': 50.0,
                'amount_zscore': 0.0,
                'log_amount': np.log1p(amount),
            }

        percentile = (sum(1 for a in historical_amounts if a <= amount) /
                     len(historical_amounts) * 100)
        mean = np.mean(historical_amounts)
        std = np.std(historical_amounts)
        zscore = (amount - mean) / std if std > 0 else 0.0

        return {
            'amount_percentile': percentile,
            'amount_zscore': abs(zscore),
            'log_amount': np.log1p(amount),
        }

    @staticmethod
    def extract_category_features(
        category: str,
        transaction_categories: List[str],
    ) -> Dict[str, Any]:
        """Extract category-based features."""
        total = len(transaction_categories)
        count = sum(1 for c in transaction_categories if c == category)
        frequency = count / total if total > 0 else 0.0

        # Category diversity (entropy)
        from collections import Counter
        counts = Counter(transaction_categories)
        entropy = -sum((c/total * np.log2(c/total) for c in counts.values()
                       if c > 0))

        return {
            'category_frequency': frequency,
            'category_diversity': entropy / np.log2(len(set(transaction_categories)))
            if len(set(transaction_categories)) > 1 else 0.0,
        }

    @staticmethod
    def calculate_rolling_statistics(
        amounts: List[float],
        window: int = 7,
    ) -> Dict[str, List[float]]:
        """Calculate rolling statistics for amounts."""
        if len(amounts) < window:
            return {
                'rolling_mean': amounts,
                'rolling_std': [0.0] * len(amounts),
            }

        df = pd.DataFrame({'amount': amounts})
        rolling_mean = df['amount'].rolling(window=window, min_periods=1).mean().tolist()
        rolling_std = df['amount'].rolling(window=window, min_periods=1).std().tolist()

        return {
            'rolling_mean': rolling_mean,
            'rolling_std': rolling_std,
        }

    @staticmethod
    def create_transaction_features(
        transaction: Dict[str, Any],
        historical_data: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create comprehensive features for a single transaction."""
        features = {}

        # Time features
        time_feats = FeatureEngineer.extract_time_features(
            transaction['timestamp']
        )
        features.update(time_feats)

        # Amount features
        amounts = [t['amount'] for t in historical_data]
        amount_feats = FeatureEngineer.extract_amount_features(
            transaction['amount'],
            amounts,
        )
        features.update(amount_feats)

        # Category features
        if 'category' in transaction:
            categories = [t.get('category', 'Unknown') for t in historical_data]
            cat_feats = FeatureEngineer.extract_category_features(
                transaction['category'],
                categories,
            )
            features.update(cat_feats)

        return features

    @staticmethod
    def create_user_profile_features(
        transactions: List[Dict[str, Any]],
    ) -> Dict[str, float]:
        """Create user profile features from transaction history."""
        if not transactions:
            return {}

        amounts = [t['amount'] for t in transactions]
        categories = [t.get('category', 'Unknown') for t in transactions]

        features = {
            # Spending statistics
            'avg_spend': np.mean(amounts),
            'median_spend': np.median(amounts),
            'max_spend': np.max(amounts),
            'min_spend': np.min(amounts),
            'std_spend': np.std(amounts),
            'spend_variance': np.var(amounts),

            # Spending patterns
            'transaction_count': len(transactions),
            'daily_spend_avg': np.mean(amounts),
            'category_count': len(set(categories)),

            # Entropy (spending diversity)
            'spend_entropy': _calculate_entropy(categories),

            # Impulse spending (high transactions as percentage)
            'impulse_score': sum(1 for a in amounts if a > np.percentile(amounts, 75))
                             / len(amounts),

            # Consistency (inverse of variance coefficient)
            'consistency_score': 1.0 / (1.0 + np.std(amounts) / np.mean(amounts))
                                 if np.mean(amounts) > 0 else 0.0,

            # Spending velocity
            'spending_velocity': len(transactions) / 30.0 if transactions else 0.0,
        }

        return features

    @staticmethod
    def normalize_features(features: Dict[str, float]) -> Dict[str, float]:
        """Normalize features to 0-1 range."""
        normalized = {}
        for key, value in features.items():
            if isinstance(value, (int, float)):
                # Clip to 0-1 range
                normalized[key] = max(0.0, min(1.0, value))
            else:
                normalized[key] = value
        return normalized


def _calculate_entropy(categories: List[str]) -> float:
    """Calculate entropy of category distribution."""
    if not categories:
        return 0.0

    from collections import Counter
    counts = Counter(categories)
    total = len(categories)
    entropy = 0.0
    for count in counts.values():
        p = count / total
        if p > 0:
            entropy -= p * np.log2(p)
    return entropy


def create_training_data(
    transactions: List[Dict[str, Any]],
) -> Tuple[np.ndarray, np.ndarray]:
    """Create training data from transactions."""
    X = []
    y = []

    for t in transactions:
        features = FeatureEngineer.create_transaction_features(t, transactions)
        feature_vector = [features.get(k, 0.0) for k in sorted(features.keys())]
        X.append(feature_vector)
        y.append(t.get('category', 'Unknown'))

    return np.array(X), np.array(y)
