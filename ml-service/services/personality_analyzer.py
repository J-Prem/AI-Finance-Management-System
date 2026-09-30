"""Enhanced spending personality analysis with 30+ features and 8 personality types."""

import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
import joblib
from pathlib import Path

logger = logging.getLogger(__name__)


class SpendingPersonalityAnalyzer:
    """Enhanced analyzer with multiple clustering methods and 30+ features."""

    PERSONALITY_TYPES = {
        0: {
            'name': 'The Minimalist',
            'description': 'Extremely conservative, minimal spending, maximum savings',
            'characteristics': ['Very low spending', 'Ultra-high savings rate', 'Disciplined', 'Necessary purchases only'],
            'strengths': ['Financial discipline', 'Strong emergency fund potential', 'Low financial stress'],
            'weaknesses': ['May miss life experiences', 'Potential over-restriction', 'Lower lifestyle enjoyment'],
            'tips': [
                'Your discipline is admirable; invest excess savings for future growth',
                'Balance saving with experiential spending for well-being',
                'Consider goal-based savings to optimize allocation',
            ]
        },
        1: {
            'name': 'The Optimizer',
            'description': 'Strategic spender who seeks maximum value and efficiency',
            'characteristics': ['Planned spending', 'Research-driven purchases', 'Value-conscious', 'Budget-aware'],
            'strengths': ['Efficient spending', 'Strategic planning', 'Good savings rate'],
            'weaknesses': ['Can be overly analytical', 'May miss impulse joys', 'Spending paralysis risk'],
            'tips': [
                'Your strategic approach is excellent; maintain this discipline',
                'Allow occasional guilt-free indulgences within budget',
                'Track ROI on your planned purchases to validate decisions',
            ]
        },
        2: {
            'name': 'The Splurger',
            'description': 'Enjoys spending freely, prioritizes experiences over savings',
            'characteristics': ['High spending', 'Low savings rate', 'Impulsive purchases', 'Experience-focused'],
            'strengths': ['Enjoys life', 'Less financial anxiety', 'Creates memories'],
            'weaknesses': ['Low savings', 'Financial vulnerability', 'Future planning lacking'],
            'tips': [
                'Implement automatic transfers to savings (pay yourself first)',
                'Use spending categories to identify high-risk areas',
                'Create emergency fund target to build financial security',
            ]
        },
        3: {
            'name': 'The Investor',
            'description': 'Growth-focused with strategic investments and calculated spending',
            'characteristics': ['Moderate spending', 'High investment ratio', 'Long-term thinking', 'Risk-aware'],
            'strengths': ['Future-oriented', 'Compound growth mindset', 'Strategic decisions'],
            'weaknesses': ['May neglect present enjoyment', 'Over-complication risk', 'Market anxiety'],
            'tips': [
                'Continue diversifying your portfolio',
                'Review investment strategy quarterly',
                'Balance growth with present-day quality of life',
            ]
        },
        4: {
            'name': 'The Social Spender',
            'description': 'Spending driven by social activities and peer influence',
            'characteristics': ['Social spending spikes', 'Entertainment-heavy', 'Peer-influenced', 'Event-driven'],
            'strengths': ['Strong social connections', 'Quality relationships', 'Life enjoyment'],
            'weaknesses': ['High discretionary spending', 'Peer pressure vulnerability', 'Budget drift'],
            'tips': [
                'Set social spending budget to control costs',
                'Find free or low-cost social activities',
                'Track social vs solo spending patterns',
            ]
        },
        5: {
            'name': 'The Planner',
            'description': 'Methodical with structured budgets and long-term financial goals',
            'characteristics': ['Structured spending', 'Goal-driven', 'Budget adherent', 'Organized tracking'],
            'strengths': ['Clear financial goals', 'Discipline', 'Predictability', 'Organized finances'],
            'weaknesses': ['Rigid approach', 'Adaptation difficulty', 'Occasional over-planning'],
            'tips': [
                'Your planning is excellent; maintain regular reviews',
                'Build flexibility into plans for unexpected changes',
                'Share your system with family for collective success',
            ]
        },
        6: {
            'name': 'The Impulse Buyer',
            'description': 'Spontaneous purchases, emotional spending, variable patterns',
            'characteristics': ['Variable spending', 'Emotional triggers', 'Sudden spikes', 'Spontaneous'],
            'strengths': ['Flexibility', 'Enjoys life moments', 'Adaptable', 'Less worry'],
            'weaknesses': ['Unpredictable finances', 'Low savings', 'Future uncertainty'],
            'tips': [
                'Try 24-hour rule before purchases over certain amount',
                'Set spending alerts to track impulse purchases',
                'Identify emotional triggers and healthy alternatives',
            ]
        },
        7: {
            'name': 'The Balanced',
            'description': 'Healthy equilibrium between spending and saving with stability',
            'characteristics': ['Moderate spending', 'Good savings rate', 'Consistent patterns', 'Flexible approach'],
            'strengths': ['Financial stability', 'Good savings', 'Life enjoyment', 'Low stress'],
            'weaknesses': ['Lack of aggressive growth', 'May be too moderate', 'No extreme discipline'],
            'tips': [
                'Maintain your balanced approach',
                'Consider increasing savings by small increments',
                'Optimize investment allocation for growth',
            ]
        }
    }

    def __init__(
        self,
        model_path: Optional[Path] = None,
        n_clusters: int = 8,
    ):
        """Initialize personality analyzer."""
        self.model_path = model_path
        self.n_clusters = n_clusters

        self.kmeans_model = None
        self.dbscan_model = None
        self.gmm_model = None
        self.scaler = None

        self.is_trained = False
        self.cluster_centers = None
        self.training_history = []
        self.metrics = {}

        if model_path and model_path.exists():
            self._load()

    def _load(self) -> bool:
        """Load trained models."""
        try:
            if self.model_path.exists():
                models = joblib.load(self.model_path)
                self.kmeans_model = models.get('kmeans')
                self.dbscan_model = models.get('dbscan')
                self.gmm_model = models.get('gmm')
                self.scaler = models.get('scaler')
                self.is_trained = True
                if self.kmeans_model:
                    self.cluster_centers = self.kmeans_model.cluster_centers_
                logger.info("Personality analyzer models loaded")
                return True
        except Exception as e:
            logger.error(f"Error loading personality analyzer: {e}")
        return False

    def train(
        self,
        transactions_per_user: List[List[Dict[str, Any]]],
        epochs: int = 30,
    ) -> Dict[str, Any]:
        """Train ensemble of clustering models.

        Args:
            transactions_per_user: List of transaction lists per user
            epochs: Number of optimization iterations

        Returns:
            Training metrics
        """
        try:
            if not transactions_per_user or len(transactions_per_user) < 5:
                logger.warning("Insufficient user data")
                return {'success': False, 'error': 'Insufficient data'}

            features = []
            for user_txns in transactions_per_user:
                feature_set = self._extract_features(user_txns)
                if feature_set is not None:
                    features.append(feature_set)

            if len(features) < 5:
                return {'success': False, 'error': 'Cannot extract features'}

            features_array = np.array(features)

            # Scale features
            self.scaler = StandardScaler()
            features_scaled = self.scaler.fit_transform(features_array)

            silhouette_scores = {
                'kmeans': [],
                'gmm': [],
                'dbscan': [],
            }

            for epoch in range(epochs):
                logger.info(f"Optimization epoch {epoch + 1}/{epochs}")

                # KMeans with silhouette optimization
                if epoch == 0:
                    self.kmeans_model = KMeans(
                        n_clusters=self.n_clusters,
                        random_state=42,
                        n_init=10,
                        max_iter=300,
                    )
                self.kmeans_model.fit(features_scaled)
                kmeans_score = silhouette_score(features_scaled, self.kmeans_model.labels_)
                silhouette_scores['kmeans'].append(round(kmeans_score, 4))

                # Gaussian Mixture Model
                if epoch == 0:
                    self.gmm_model = GaussianMixture(
                        n_components=self.n_clusters,
                        random_state=42,
                        n_init=10,
                    )
                self.gmm_model.fit(features_scaled)
                gmm_labels = self.gmm_model.predict(features_scaled)
                gmm_score = silhouette_score(features_scaled, gmm_labels)
                silhouette_scores['gmm'].append(round(gmm_score, 4))

                # DBSCAN
                if epoch == 0:
                    self.dbscan_model = DBSCAN(eps=0.5, min_samples=3)
                dbscan_labels = self.dbscan_model.fit_predict(features_scaled)
                # Only calculate silhouette if we have at least 2 clusters
                if len(np.unique(dbscan_labels)) > 1:
                    dbscan_score = silhouette_score(features_scaled, dbscan_labels)
                    silhouette_scores['dbscan'].append(round(dbscan_score, 4))

                if (epoch + 1) % 5 == 0:
                    logger.info(
                        f"Epoch {epoch + 1} - KMeans: {silhouette_scores['kmeans'][-1]}, "
                        f"GMM: {silhouette_scores['gmm'][-1]}"
                    )

            self.cluster_centers = self.kmeans_model.cluster_centers_
            self.is_trained = True

            self.metrics = {
                'n_users': len(features),
                'n_features': features_array.shape[1],
                'n_clusters': self.n_clusters,
                'final_silhouette': silhouette_scores['kmeans'][-1] if silhouette_scores['kmeans'] else 0,
            }

            self.training_history = silhouette_scores

            logger.info(f"Training complete. Final Silhouette Score: {self.metrics['final_silhouette']}")
            return {
                'success': True,
                'metrics': self.metrics,
                'history': silhouette_scores,
            }

        except Exception as e:
            logger.error(f"Error training personality analyzer: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}

    def save(self) -> bool:
        """Save trained models."""
        try:
            if not self.is_trained:
                logger.warning("Models not trained yet")
                return False

            if self.model_path:
                models = {
                    'kmeans': self.kmeans_model,
                    'dbscan': self.dbscan_model,
                    'gmm': self.gmm_model,
                    'scaler': self.scaler,
                }
                joblib.dump(models, self.model_path)
                logger.info("Personality analyzer models saved")
            return True
        except Exception as e:
            logger.error(f"Error saving personality analyzer: {e}")
            return False

    def analyze(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze spending personality from transactions."""
        try:
            if not transactions:
                return self._default_personality()

            features = self._extract_features(transactions)
            if not features:
                return self._default_personality()

            personality_idx = self._classify_personality(features)
            personality_type = self.PERSONALITY_TYPES.get(personality_idx, self.PERSONALITY_TYPES[2])

            # Calculate metrics
            spending_habits = self._calculate_spending_habits(transactions)
            confidence = self._calculate_confidence(features)
            similar_percentage = self._calculate_similar_users_percentage(features)

            return {
                'personality_type': personality_type['name'],
                'confidence': confidence,
                'description': personality_type['description'],
                'spending_habits': spending_habits,
                'tips': personality_type['tips'],
                'similar_users_percentage': similar_percentage,
            }

        except Exception as e:
            logger.error(f"Error analyzing personality: {e}")
            return self._default_personality()

    def _extract_features(self, transactions: List[Dict[str, Any]]) -> Optional[np.ndarray]:
        """Extract 30+ features for personality analysis."""
        try:
            if not transactions:
                return None

            amounts = np.array([t['amount'] for t in transactions])
            categories = [t.get('category', 'Other') for t in transactions]
            merchants = [t.get('merchant', 'Unknown') for t in transactions]
            timestamps = [pd.Timestamp(t['timestamp']) for t in transactions]

            from collections import Counter
            cat_counts = Counter(categories)
            merch_counts = Counter(merchants)

            # Amount-based features
            avg_spend = np.mean(amounts)
            median_spend = np.median(amounts)
            std_spend = np.std(amounts)
            max_spend = np.max(amounts)
            min_spend = np.min(amounts)
            spend_range = max_spend - min_spend
            cv_spend = std_spend / (avg_spend + 1)  # Coefficient of variation

            # Spending percentiles
            p25 = np.percentile(amounts, 25)
            p75 = np.percentile(amounts, 75)
            iqr = p75 - p25

            # Category features
            unique_categories = len(cat_counts)
            category_diversity = unique_categories / len(amounts) if amounts.size > 0 else 0
            top_cat_ratio = max(cat_counts.values()) / len(amounts) if cat_counts else 0
            top_3_ratio = sum(count for _, count in cat_counts.most_common(3)) / len(amounts)

            # Merchant features
            unique_merchants = len(merch_counts)
            merchant_diversity = unique_merchants / len(amounts)
            top_merchant_ratio = max(merch_counts.values()) / len(amounts) if merch_counts else 0

            # Impulse and discipline scores
            high_spend_count = sum(1 for a in amounts if a > p75)
            impulse_score = high_spend_count / len(amounts) if amounts.size > 0 else 0
            low_spend_count = sum(1 for a in amounts if a < p25)
            frugality_score = low_spend_count / len(amounts)

            # Consistency and regularity
            consistency_score = 1.0 / (1.0 + cv_spend)
            regularity_score = 1.0 - (std_spend / (avg_spend + 1))

            # Time-based features
            hours = np.array([ts.hour for ts in timestamps])
            weekdays = np.array([ts.weekday() for ts in timestamps])

            weekend_count = sum(1 for wd in weekdays if wd >= 5)
            weekend_ratio = weekend_count / len(timestamps) if timestamps else 0

            night_count = sum(1 for h in hours if h >= 22 or h <= 6)
            night_spending_ratio = night_count / len(timestamps) if timestamps else 0

            # Transaction frequency
            days_span = (timestamps[-1] - timestamps[0]).days + 1 if timestamps else 1
            transaction_frequency = len(transactions) / max(days_span, 1)

            # Subscription patterns (recurring transactions)
            subscription_ratio = sum(1 for m in merch_counts if merch_counts[m] > len(amounts) * 0.1) / len(merch_counts) if merch_counts else 0

            # Category entropy (higher = more diverse spending)
            cat_entropy = -sum((count / len(amounts)) * np.log((count / len(amounts)) + 1e-8)
                              for count in cat_counts.values())

            # Luxury vs necessity (approximation based on categories)
            luxury_categories = ['Entertainment', 'Gifts', 'Travel', 'Shopping']
            luxury_spend = sum(a for a, c in zip(amounts, categories) if c in luxury_categories)
            luxury_ratio = luxury_spend / np.sum(amounts) if np.sum(amounts) > 0 else 0

            necessity_categories = ['Food', 'Transport', 'Healthcare', 'Groceries', 'Utilities', 'Bills']
            necessity_spend = sum(a for a, c in zip(amounts, categories) if c in necessity_categories)
            necessity_ratio = necessity_spend / np.sum(amounts) if np.sum(amounts) > 0 else 0

            # Savings proxy (based on lack of spending volatility)
            savings_consistency = 1.0 - cv_spend

            # Spending acceleration
            first_half_avg = np.mean(amounts[:len(amounts)//2]) if len(amounts) >= 2 else avg_spend
            second_half_avg = np.mean(amounts[len(amounts)//2:]) if len(amounts) >= 2 else avg_spend
            spending_acceleration = (second_half_avg - first_half_avg) / (first_half_avg + 1)

            features = np.array([
                avg_spend,
                median_spend,
                std_spend,
                max_spend,
                min_spend,
                spend_range,
                cv_spend,
                p25, p75, iqr,
                unique_categories,
                category_diversity,
                top_cat_ratio,
                top_3_ratio,
                unique_merchants,
                merchant_diversity,
                top_merchant_ratio,
                impulse_score,
                frugality_score,
                consistency_score,
                regularity_score,
                weekend_ratio,
                night_spending_ratio,
                transaction_frequency,
                subscription_ratio,
                cat_entropy,
                luxury_ratio,
                necessity_ratio,
                savings_consistency,
                spending_acceleration,
            ])

            return features

        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            return None

    def _classify_personality(self, features: np.ndarray) -> int:
        """Classify personality type using trained models."""
        if not self.is_trained or not self.kmeans_model:
            # Rule-based fallback
            avg_spend = features[0]
            impulse_score = features[17]  # Updated index
            consistency = features[19]

            if consistency > 0.7 and impulse_score < 0.15:
                return 0  # Minimalist
            elif impulse_score > 0.4:
                return 6  # Impulse Buyer
            elif avg_spend > 3000:
                return 2  # Splurger
            elif features[28] > 0.3:  # savings_consistency
                return 3  # Investor
            elif features[19] > 0.75:  # consistency
                return 5  # Planner
            else:
                return 7  # Balanced

        try:
            features_scaled = self.scaler.transform([features])[0]
            cluster = self.kmeans_model.predict([features_scaled])[0]
            return min(cluster, self.n_clusters - 1)
        except Exception as e:
            logger.warning(f"Error classifying personality: {e}, using fallback")
            return 7  # Default to Balanced

    def _calculate_spending_habits(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate detailed spending habits."""
        amounts = [t['amount'] for t in transactions]
        categories = [t.get('category', 'Other') for t in transactions]

        from collections import Counter
        category_counts = Counter(categories)

        return {
            'average_transaction': round(np.mean(amounts), 2),
            'median_transaction': round(np.median(amounts), 2),
            'total_spent': round(sum(amounts), 2),
            'transaction_count': len(transactions),
            'top_categories': dict(category_counts.most_common(3)),
            'spending_volatility': round(np.std(amounts) / (np.mean(amounts) + 1), 2),
        }

    def _calculate_confidence(self, features: np.ndarray) -> float:
        """Calculate confidence score for classification."""
        if not self.is_trained or not self.model:
            return 0.7

        try:
            features_scaled = self.scaler.transform([features])[0]
            distances = np.linalg.norm(
                self.model.cluster_centers_ - features_scaled,
                axis=1
            )
            min_dist = np.min(distances)
            max_dist = np.max(distances)
            confidence = 1.0 - (min_dist / (max_dist + 0.001))
            return max(0.5, min(0.95, confidence))
        except Exception:
            return 0.7

    def _calculate_similar_users_percentage(self, features: np.ndarray) -> float:
        """Estimate percentage of similar users."""
        if not self.is_trained:
            return 20.0

        try:
            features_scaled = self.scaler.transform([features])[0]
            cluster = self.model.predict([features_scaled])[0]
            cluster_size = sum(1 for c in self.model.labels_ if c == cluster)
            total_size = len(self.model.labels_)
            percentage = (cluster_size / total_size * 100) if total_size > 0 else 20.0
            return round(percentage, 1)
        except Exception:
            return 20.0

    def _default_personality(self) -> Dict[str, Any]:
        """Return default personality analysis."""
        return {
            'personality_type': 'The Balanced',
            'confidence': 0.5,
            'description': 'Unable to analyze with limited data',
            'spending_habits': {},
            'tips': ['Provide more transaction history for better analysis'],
            'similar_users_percentage': 20.0,
        }
