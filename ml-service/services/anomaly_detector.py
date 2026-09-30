"""Enhanced anomaly detection with multiple ensemble methods."""

import logging
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.svm import OneClassSVM
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import GridSearchCV
from datetime import datetime, timedelta
import joblib
from pathlib import Path

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Enhanced detector using Isolation Forest, LOF, One-Class SVM, and Autoencoder."""

    def __init__(
        self,
        model_path: Optional[Path] = None,
        contamination: float = 0.05,
    ):
        """Initialize anomaly detector."""
        self.model_path = model_path
        self.contamination = contamination

        self.iso_forest = None
        self.lof_model = None
        self.ocsvm_model = None
        self.autoencoder = None
        self.scaler = None

        self.is_trained = False
        self.training_history = []
        self.metrics = {}

        if model_path and model_path.exists():
            self._load()

    def _load(self) -> bool:
        """Load trained models."""
        try:
            if self.model_path.exists():
                models = joblib.load(self.model_path)
                self.iso_forest = models.get('iso_forest')
                self.lof_model = models.get('lof')
                self.ocsvm_model = models.get('ocsvm')
                self.autoencoder = models.get('autoencoder')
                self.scaler = models.get('scaler')
                self.is_trained = True
                logger.info("Anomaly detector models loaded")
                return True
        except Exception as e:
            logger.error(f"Error loading anomaly detector: {e}")
        return False

    def train(
        self,
        transactions: List[Dict[str, Any]],
        epochs: int = 35,
    ) -> Dict[str, Any]:
        """Train ensemble of anomaly detection models.

        Args:
            transactions: Transaction data
            epochs: Number of training iterations

        Returns:
            Training metrics
        """
        try:
            if not transactions or len(transactions) < 10:
                logger.warning("Insufficient transactions for training")
                return {'success': False, 'error': 'Insufficient data'}

            features = self._extract_features(transactions)
            if features.empty or len(features) < 10:
                return {'success': False, 'error': 'Cannot extract features'}

            X = features.values
            self.scaler = StandardScaler()
            X_scaled = self.scaler.fit_transform(X)

            epoch_metrics = {
                'epoch': [],
                'iso_forest_anomalies': [],
                'lof_anomalies': [],
                'ocsvm_anomalies': [],
                'autoencoder_anomalies': [],
                'ensemble_anomalies': [],
            }

            for epoch in range(epochs):
                logger.info(f"Training epoch {epoch + 1}/{epochs}")

                # Isolation Forest with GridSearchCV
                if epoch == 0:
                    param_grid = {
                        'n_estimators': [50, 100],
                        'max_samples': ['auto', 256],
                    }
                    self.iso_forest = GridSearchCV(
                        IsolationForest(contamination=self.contamination, random_state=42),
                        param_grid,
                        cv=3,
                        n_jobs=-1,
                    )
                self.iso_forest.fit(X_scaled)
                iso_preds = self.iso_forest.predict(X_scaled)
                iso_anomalies = np.sum(iso_preds == -1)

                # Local Outlier Factor
                if epoch == 0:
                    self.lof_model = LocalOutlierFactor(
                        n_neighbors=min(20, len(X_scaled) // 2),
                        contamination=self.contamination,
                    )
                lof_preds = self.lof_model.fit_predict(X_scaled)
                lof_anomalies = np.sum(lof_preds == -1)

                # One-Class SVM
                if epoch == 0:
                    self.ocsvm_model = OneClassSVM(
                        kernel='rbf',
                        gamma='auto',
                        nu=self.contamination,
                    )
                self.ocsvm_model.fit(X_scaled)
                ocsvm_preds = self.ocsvm_model.predict(X_scaled)
                ocsvm_anomalies = np.sum(ocsvm_preds == -1)

                # Autoencoder (using MLPRegressor for reconstruction)
                if epoch == 0:
                    self.autoencoder = MLPRegressor(
                        hidden_layer_sizes=(32, 16, 32),
                        activation='relu',
                        max_iter=100,
                        random_state=42,
                        early_stopping=False,
                    )
                self.autoencoder.fit(X_scaled, X_scaled)
                X_recon = self.autoencoder.predict(X_scaled)
                recon_error = np.mean((X_scaled - X_recon) ** 2, axis=1)
                threshold = np.percentile(recon_error, 100 * (1 - self.contamination))
                autoencoder_preds = np.where(recon_error > threshold, -1, 1)
                autoencoder_anomalies = np.sum(autoencoder_preds == -1)

                # Ensemble voting
                ensemble_preds = self._ensemble_vote([iso_preds, lof_preds, ocsvm_preds, autoencoder_preds])
                ensemble_anomalies = np.sum(ensemble_preds == -1)

                epoch_metrics['epoch'].append(epoch + 1)
                epoch_metrics['iso_forest_anomalies'].append(iso_anomalies)
                epoch_metrics['lof_anomalies'].append(lof_anomalies)
                epoch_metrics['ocsvm_anomalies'].append(ocsvm_anomalies)
                epoch_metrics['autoencoder_anomalies'].append(autoencoder_anomalies)
                epoch_metrics['ensemble_anomalies'].append(ensemble_anomalies)

                if (epoch + 1) % 7 == 0:
                    logger.info(
                        f"Epoch {epoch + 1} - ISO: {iso_anomalies}, LOF: {lof_anomalies}, "
                        f"OCSVM: {ocsvm_anomalies}, Auto: {autoencoder_anomalies}, "
                        f"Ensemble: {ensemble_anomalies}"
                    )

            self.metrics = {
                'total_samples': len(X),
                'contamination': self.contamination,
                'final_anomalies': ensemble_anomalies,
            }

            self.is_trained = True
            self.training_history = epoch_metrics

            logger.info(f"Anomaly detector training complete")
            return {
                'success': True,
                'metrics': self.metrics,
                'history': epoch_metrics,
            }

        except Exception as e:
            logger.error(f"Error training anomaly detector: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}

    def save(self) -> bool:
        """Save trained models."""
        try:
            if not self.is_trained:
                logger.warning("Models not trained yet")
                return False

            if self.model_path:
                models = {
                    'iso_forest': self.iso_forest,
                    'lof': self.lof_model,
                    'ocsvm': self.ocsvm_model,
                    'autoencoder': self.autoencoder,
                    'scaler': self.scaler,
                }
                joblib.dump(models, self.model_path)
                logger.info("Anomaly detector models saved")
            return True
        except Exception as e:
            logger.error(f"Error saving anomaly detector: {e}")
            return False

    def _ensemble_vote(self, predictions: List[np.ndarray]) -> np.ndarray:
        """Ensemble voting across multiple models."""
        stacked = np.column_stack(predictions)
        result = []
        for row in stacked:
            # Count -1 votes (anomalies)
            if np.sum(row == -1) >= 2:  # Majority vote
                result.append(-1)
            else:
                result.append(1)
        return np.array(result)

    def detect_anomalies(
        self,
        transactions: List[Dict[str, Any]],
        sensitivity: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """Detect anomalous transactions.

        Args:
            transactions: List of transaction dicts
            sensitivity: 0-1, higher = more sensitive (more anomalies detected)
        """
        results = []

        if not transactions:
            return results

        # Amount-based detection
        amount_anomalies = self._detect_amount_anomalies(transactions, sensitivity)

        # Timing-based detection
        timing_anomalies = self._detect_timing_anomalies(transactions)

        # Merchant-based detection
        merchant_anomalies = self._detect_merchant_anomalies(transactions, sensitivity)

        # ML-based detection (if trained)
        ml_anomalies = self._detect_ml_anomalies(transactions) if self.is_trained else {}

        # Combine results
        for i, txn in enumerate(transactions):
            txn_id = txn.get('transaction_id', f"TXN{i}")
            reasons = []
            anomaly_score = 0.0
            severity = 'low'

            # Check each detection method
            if txn_id in amount_anomalies:
                reasons.append(f"Unusual amount: {amount_anomalies[txn_id]}")
                anomaly_score += 0.3

            if txn_id in timing_anomalies:
                reasons.append(f"Unusual timing: {timing_anomalies[txn_id]}")
                anomaly_score += 0.2

            if txn_id in merchant_anomalies:
                reasons.append(f"Unusual merchant: {merchant_anomalies[txn_id]}")
                anomaly_score += 0.25

            if txn_id in ml_anomalies:
                reasons.append(f"ML anomaly score: {ml_anomalies[txn_id]:.2f}")
                anomaly_score += 0.25

            if anomaly_score >= 0.5:
                if anomaly_score >= 0.8:
                    severity = 'high'
                elif anomaly_score >= 0.6:
                    severity = 'medium'

                results.append({
                    'transaction_id': txn_id,
                    'description': txn.get('description', 'Unknown'),
                    'amount': txn['amount'],
                    'anomaly_score': min(anomaly_score, 1.0),
                    'is_anomaly': True,
                    'reason': ' | '.join(reasons) if reasons else 'Multi-factor anomaly detected',
                    'severity': severity,
                })

        return results

    def _detect_amount_anomalies(
        self,
        transactions: List[Dict[str, Any]],
        sensitivity: float,
    ) -> Dict[str, str]:
        """Detect transactions with unusual amounts."""
        anomalies = {}
        amounts = [t['amount'] for t in transactions]

        if len(amounts) < 10:
            return anomalies

        mean = np.mean(amounts)
        std = np.std(amounts)

        # Threshold increases with lower sensitivity
        threshold = 2.0 + (1.5 * (1 - sensitivity))

        for i, txn in enumerate(transactions):
            if std > 0:
                z_score = abs((txn['amount'] - mean) / std)
                if z_score > threshold:
                    percentile = np.percentile(amounts, [25, 75])
                    iqr = percentile[1] - percentile[0]
                    if txn['amount'] > percentile[1] + (1.5 * iqr):
                        txn_id = txn.get('transaction_id', f"TXN{i}")
                        anomalies[txn_id] = f"{txn['amount']:.2f} (Z-score: {z_score:.2f})"

        return anomalies

    def _detect_timing_anomalies(
        self,
        transactions: List[Dict[str, Any]],
    ) -> Dict[str, str]:
        """Detect transactions at unusual times."""
        anomalies = {}

        # Group by merchant and category
        by_merchant = {}
        for i, txn in enumerate(transactions):
            merchant = txn.get('merchant', 'Unknown')
            if merchant not in by_merchant:
                by_merchant[merchant] = []
            by_merchant[merchant].append((i, txn))

        for merchant, items in by_merchant.items():
            if len(items) < 3:
                continue

            hours = [pd.Timestamp(t[1]['timestamp']).hour for t in items]
            if not hours:
                continue

            hour_mean = np.mean(hours)
            hour_std = np.std(hours)

            for idx, (i, txn) in enumerate(items):
                hour = pd.Timestamp(txn['timestamp']).hour
                if hour_std > 0:
                    z_score = abs((hour - hour_mean) / hour_std)
                    if z_score > 2.0:
                        # Late night spending (10pm - 6am)
                        if hour in range(22, 24) or hour in range(0, 6):
                            txn_id = txn.get('transaction_id', f"TXN{i}")
                            anomalies[txn_id] = f"Late night transaction at {hour}:00"

        return anomalies

    def _detect_merchant_anomalies(
        self,
        transactions: List[Dict[str, Any]],
        sensitivity: float,
    ) -> Dict[str, str]:
        """Detect unusual merchant patterns."""
        anomalies = {}
        merchants = [t.get('merchant', 'Unknown') for t in transactions]

        # Find infrequent merchants
        from collections import Counter
        merchant_counts = Counter(merchants)
        total = len(merchants)
        threshold = 1 - sensitivity  # Higher sensitivity = lower threshold

        for i, txn in enumerate(transactions):
            merchant = txn.get('merchant', 'Unknown')
            frequency = merchant_counts[merchant] / total
            if frequency < threshold * 0.1:  # Very rare merchant
                txn_id = txn.get('transaction_id', f"TXN{i}")
                anomalies[txn_id] = f"Rare merchant: {merchant} (frequency: {frequency:.1%})"

        return anomalies

    def _detect_ml_anomalies(self, transactions: List[Dict[str, Any]]) -> Dict[str, float]:
        """Detect anomalies using trained ML model."""
        anomalies = {}

        try:
            features = self._extract_features(transactions)
            if features.empty or not self.iso_forest:
                return anomalies

            # Use Isolation Forest for ML-based detection
            predictions = self.iso_forest.predict(features)
            scores = self.iso_forest.score_samples(features)

            for i, (pred, score) in enumerate(zip(predictions, scores)):
                if pred == -1:  # Anomaly
                    txn_id = transactions[i].get('transaction_id', f"TXN{i}")
                    anomalies[txn_id] = max(0.0, -score)

        except Exception as e:
            logger.error(f"Error in ML anomaly detection: {e}")

        return anomalies

    def _extract_features(self, transactions: List[Dict[str, Any]]) -> pd.DataFrame:
        """Extract advanced features for anomaly detection."""
        try:
            features = []

            # Calculate global statistics
            amounts = np.array([t['amount'] for t in transactions])
            amount_mean = np.mean(amounts)
            amount_std = np.std(amounts)

            # Category and merchant statistics
            from collections import Counter
            categories = [t.get('category', 'Other') for t in transactions]
            merchants = [t.get('merchant', 'Unknown') for t in transactions]
            cat_counts = Counter(categories)
            merch_counts = Counter(merchants)

            for txn in transactions:
                ts = pd.Timestamp(txn['timestamp'])

                # Amount-based features
                amount = txn['amount']
                amount_zscore = (amount - amount_mean) / (amount_std + 1e-8)

                # Time-based features
                hour = ts.hour
                day_of_week = ts.weekday()
                day_of_month = ts.day
                is_weekend = 1 if day_of_week >= 5 else 0
                is_night = 1 if hour in [22, 23, 0, 1, 2, 3, 4, 5] else 0

                # Category and merchant frequency
                category = txn.get('category', 'Other')
                merchant = txn.get('merchant', 'Unknown')
                cat_frequency = cat_counts[category] / len(transactions)
                merch_frequency = merch_counts[merchant] / len(transactions)

                features.append({
                    'amount': amount,
                    'amount_zscore': amount_zscore,
                    'hour': hour,
                    'day_of_week': day_of_week,
                    'day_of_month': day_of_month,
                    'is_weekend': is_weekend,
                    'is_night': is_night,
                    'cat_frequency': cat_frequency,
                    'merch_frequency': merch_frequency,
                    'category_entropy': -np.log(cat_frequency + 1e-8),
                    'merchant_entropy': -np.log(merch_frequency + 1e-8),
                })

            df = pd.DataFrame(features)

            # Normalize features (except already normalized ones)
            for col in df.columns:
                if col not in ['amount_zscore', 'is_weekend', 'is_night']:
                    mean = df[col].mean()
                    std = df[col].std()
                    if std > 0:
                        df[col] = (df[col] - mean) / std
                    else:
                        df[col] = 0

            return df

        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            return pd.DataFrame()
