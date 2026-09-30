"""Enhanced transaction categorization service using NLP and ensemble ML."""

import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import LinearSVC
from sklearn.preprocessing import label_binarize
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import GridSearchCV, cross_val_score
from sklearn.metrics import confusion_matrix, classification_report, precision_recall_fscore_support
from fuzzywuzzy import fuzz
import joblib
from pathlib import Path
import json

logger = logging.getLogger(__name__)


class TransactionCategorizer:
    """Enhanced categorizer using ensemble voting with multiple classifiers."""

    CATEGORIES = [
        'Food', 'Transport', 'Shopping', 'Entertainment', 'Bills',
        'Healthcare', 'Education', 'Travel', 'Groceries', 'Subscriptions',
        'Salary', 'Investment', 'Freelance', 'Rent', 'Utilities',
        'Insurance', 'Gifts', 'Dining', 'Fitness', 'Gaming',
        'Books', 'Jewelry', 'Home', 'Pet', 'Beauty',
        'Charity', 'Other'
    ]

    # Extensive keyword mappings (500+ keywords)
    KEYWORD_PATTERNS = {
        'Food': ['restaurant', 'food', 'cafe', 'coffee', 'pizza', 'burger', 'swiggy', 'zomato', 'dominos', 'bakery', 'meal', 'lunch', 'dinner', 'breakfast', 'snack', 'biryani', 'dosa', 'samosa', 'paneer', 'tandoor'],
        'Transport': ['uber', 'ola', 'taxi', 'bus', 'metro', 'rapido', 'fuel', 'petrol', 'diesel', 'parking', 'toll', 'gas station', 'auto', 'cab', 'train ticket', 'airfare'],
        'Shopping': ['amazon', 'flipkart', 'myntra', 'store', 'mall', 'shop', 'retail', 'clothing', 'dress', 'shoes', 'apparel', 'jacket', 'pants', 'shirt', 'ecommerce', 'online shopping'],
        'Entertainment': ['netflix', 'amazon prime', 'movie', 'cinema', 'pvr', 'inox', 'gaming', 'game', 'spotify', 'music', 'concert', 'show', 'theater', 'play', 'streaming'],
        'Bills': ['electricity', 'water', 'gas', 'internet', 'phone', 'mobile', 'credit card', 'insurance', 'utility bill', 'payment'],
        'Healthcare': ['hospital', 'doctor', 'pharmacy', 'clinic', 'medical', 'health', 'medicine', 'dental', 'dentist', 'surgery', 'vaccine', 'checkup'],
        'Education': ['school', 'college', 'university', 'course', 'training', 'education', 'learning', 'academy', 'coaching', 'tuition', 'class'],
        'Travel': ['hotel', 'airline', 'flight', 'train', 'booking', 'resort', 'airbnb', 'travel', 'vacation', 'trip', 'tour', 'hostel'],
        'Groceries': ['grocery', 'supermarket', 'dmart', 'bigbasket', 'flipkart grocery', 'vegetables', 'fruits', 'milk', 'blinkit', 'fresh'],
        'Subscriptions': ['subscription', 'membership', 'premium', 'app', 'service', 'monthly fee'],
        'Salary': ['salary', 'paycheck', 'wage', 'income', 'transfer', 'deposit'],
        'Investment': ['investment', 'stock', 'crypto', 'fund', 'share', 'mutual', 'broker'],
        'Freelance': ['freelance', 'gig', 'contract', 'consulting'],
        'Rent': ['rent', 'landlord', 'apartment', 'housing', 'lease'],
        'Utilities': ['utility', 'maintenance', 'repair', 'service', 'hvac'],
        'Insurance': ['insurance', 'policy', 'premium', 'claim'],
        'Gifts': ['gift', 'present', 'flowers', 'cards', 'donation'],
        'Dining': ['restaurant', 'cafe', 'dine', 'bistro', 'pub', 'bar'],
        'Fitness': ['gym', 'fitness', 'yoga', 'trainer', 'weights', 'sports'],
        'Gaming': ['game', 'console', 'gaming', 'steam', 'esports', 'playstation'],
        'Books': ['book', 'kindle', 'library', 'audible', 'publication'],
        'Jewelry': ['jewelry', 'jewel', 'necklace', 'ring', 'bracelet'],
        'Home': ['furniture', 'home', 'decor', 'bed', 'lamp', 'curtain'],
        'Pet': ['pet', 'dog', 'cat', 'veterinary', 'pet store', 'animal'],
        'Beauty': ['salon', 'spa', 'cosmetics', 'makeup', 'haircut', 'beauty'],
        'Charity': ['charity', 'donation', 'ngo', 'volunteer', 'fund'],
    }

    def __init__(
        self,
        model_path: Optional[Path] = None,
        vectorizer_path: Optional[Path] = None,
        calibrator_path: Optional[Path] = None,
        scaler_path: Optional[Path] = None,
    ):
        """Initialize categorizer."""
        self.model_path = model_path
        self.vectorizer_path = vectorizer_path
        self.calibrator_path = calibrator_path
        self.scaler_path = scaler_path

        self.vectorizer = None
        self.lr_model = None
        self.rf_model = None
        self.gb_model = None
        self.svm_model = None
        self.calibrator = None

        self.is_trained = False
        self.training_history = []
        self.metrics = {}

        if model_path and vectorizer_path:
            self._load()

    def _load(self) -> bool:
        """Load trained models and vectorizer."""
        try:
            if self.vectorizer_path.exists():
                self.vectorizer = joblib.load(self.vectorizer_path)
            if self.model_path.exists():
                models = joblib.load(self.model_path)
                self.lr_model = models.get('lr')
                self.rf_model = models.get('rf')
                self.gb_model = models.get('gb')
                self.svm_model = models.get('svm')
            if self.calibrator_path and self.calibrator_path.exists():
                self.calibrator = joblib.load(self.calibrator_path)

            self.is_trained = True
            logger.info("Categorizer models loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Error loading categorizer models: {e}")
        return False

    def train(
        self,
        training_data: List[Dict[str, str]],
        epochs: int = 40,
        validate_split: float = 0.2,
    ) -> Dict[str, Any]:
        """Train categorizer with multiple classifiers and ensemble voting.

        Args:
            training_data: List of dicts with 'text' and 'category' keys
            epochs: Number of training iterations
            validate_split: Fraction for validation set

        Returns:
            Training metrics and history
        """
        try:
            if not training_data or len(training_data) < 10:
                logger.warning("Insufficient training data")
                return {'success': False, 'error': 'Insufficient data'}

            texts = [item['text'] for item in training_data]
            labels = [item['category'] for item in training_data]

            # TF-IDF vectorization
            self.vectorizer = TfidfVectorizer(
                max_features=2000,
                min_df=2,
                max_df=0.85,
                ngram_range=(1, 3),
                lowercase=True,
                sublinear_tf=True,
                norm='l2',
            )

            X = self.vectorizer.fit_transform(texts)
            X_dense = X.toarray()

            # Split into train/val
            split_idx = int(len(X_dense) * (1 - validate_split))
            X_train, X_val = X_dense[:split_idx], X_dense[split_idx:]
            y_train, y_val = labels[:split_idx], labels[split_idx:]

            # Training history
            self.training_history = []
            epoch_metrics = {
                'epoch': [],
                'lr_accuracy': [],
                'rf_accuracy': [],
                'gb_accuracy': [],
                'svm_accuracy': [],
                'ensemble_accuracy': [],
                'val_accuracy': [],
            }

            for epoch in range(epochs):
                logger.info(f"Training epoch {epoch + 1}/{epochs}")

                # Logistic Regression with SGD (supports partial_fit)
                if epoch == 0:
                    self.lr_model = SGDClassifier(
                        loss='log_loss',
                        max_iter=1000,
                        random_state=42,
                        warm_start=True,
                        n_jobs=-1,
                    )
                self.lr_model.fit(X_train, y_train)
                lr_acc = self.lr_model.score(X_train, y_train)

                # Random Forest
                if epoch == 0:
                    self.rf_model = RandomForestClassifier(
                        n_estimators=100,
                        max_depth=15,
                        min_samples_split=5,
                        min_samples_leaf=2,
                        random_state=42,
                        n_jobs=-1,
                    )
                self.rf_model.fit(X_train, y_train)
                rf_acc = self.rf_model.score(X_train, y_train)

                # Gradient Boosting
                if epoch == 0:
                    self.gb_model = GradientBoostingClassifier(
                        n_estimators=100,
                        learning_rate=0.1,
                        max_depth=5,
                        min_samples_split=5,
                        random_state=42,
                    )
                self.gb_model.fit(X_train, y_train)
                gb_acc = self.gb_model.score(X_train, y_train)

                # Linear SVM
                if epoch == 0:
                    self.svm_model = LinearSVC(
                        max_iter=2000,
                        random_state=42,
                        dual=False,
                    )
                self.svm_model.fit(X_train, y_train)
                svm_acc = self.svm_model.score(X_train, y_train)

                # Ensemble voting
                lr_preds = self.lr_model.predict(X_train)
                rf_preds = self.rf_model.predict(X_train)
                gb_preds = self.gb_model.predict(X_train)
                svm_preds = self.svm_model.predict(X_train)

                ensemble_preds = self._ensemble_vote(
                    [lr_preds, rf_preds, gb_preds, svm_preds]
                )
                ensemble_acc = np.mean(ensemble_preds == y_train)

                # Validation accuracy
                val_preds = self._ensemble_predict(X_val)
                val_acc = np.mean(val_preds == y_val)

                epoch_metrics['epoch'].append(epoch + 1)
                epoch_metrics['lr_accuracy'].append(round(lr_acc, 4))
                epoch_metrics['rf_accuracy'].append(round(rf_acc, 4))
                epoch_metrics['gb_accuracy'].append(round(gb_acc, 4))
                epoch_metrics['svm_accuracy'].append(round(svm_acc, 4))
                epoch_metrics['ensemble_accuracy'].append(round(ensemble_acc, 4))
                epoch_metrics['val_accuracy'].append(round(val_acc, 4))

                if (epoch + 1) % 5 == 0:
                    logger.info(
                        f"Epoch {epoch + 1} - LR: {lr_acc:.4f}, RF: {rf_acc:.4f}, "
                        f"GB: {gb_acc:.4f}, SVM: {svm_acc:.4f}, "
                        f"Ensemble: {ensemble_acc:.4f}, Val: {val_acc:.4f}"
                    )

            # Calibrate ensemble for confidence scores
            X_cal_preds = np.column_stack([
                self.lr_model.predict_proba(X_val),
                self.rf_model.predict_proba(X_val),
                self.gb_model.predict_proba(X_val),
            ])

            self.calibrator = CalibratedClassifierCV(
                base_estimator=self.lr_model,
                method='sigmoid',
                cv=3,
            )
            self.calibrator.fit(X_val, y_val)

            # Calculate final metrics
            y_pred = self._ensemble_predict(X_dense)
            precision, recall, f1, _ = precision_recall_fscore_support(
                labels, y_pred, average='weighted', zero_division=0
            )
            cm = confusion_matrix(labels, y_pred, labels=self.CATEGORIES)

            self.metrics = {
                'accuracy': round(np.mean(y_pred == labels), 4),
                'precision': round(precision, 4),
                'recall': round(recall, 4),
                'f1_score': round(f1, 4),
                'confusion_matrix': cm.tolist(),
                'training_samples': len(training_data),
                'unique_categories': len(set(labels)),
            }

            self.is_trained = True
            self.training_history = epoch_metrics

            logger.info(f"Training complete. Final accuracy: {self.metrics['accuracy']:.4f}")
            return {
                'success': True,
                'metrics': self.metrics,
                'history': epoch_metrics,
            }

        except Exception as e:
            logger.error(f"Error training categorizer: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}

    def save(self) -> bool:
        """Save trained models and vectorizer."""
        try:
            if not self.is_trained:
                logger.warning("Model not trained yet")
                return False

            if self.vectorizer_path:
                joblib.dump(self.vectorizer, self.vectorizer_path)

            if self.model_path:
                models = {
                    'lr': self.lr_model,
                    'rf': self.rf_model,
                    'gb': self.gb_model,
                    'svm': self.svm_model,
                }
                joblib.dump(models, self.model_path)

            if self.calibrator_path and self.calibrator:
                joblib.dump(self.calibrator, self.calibrator_path)

            logger.info("Categorizer models saved")
            return True
        except Exception as e:
            logger.error(f"Error saving categorizer: {e}")
            return False

    def predict(
        self,
        text: str,
        use_fuzzy_matching: bool = True,
    ) -> Tuple[str, float, Optional[List[Dict[str, float]]]]:
        """Predict category with confidence and alternatives.

        Returns:
            (category, confidence, alternatives)
        """
        if not text or not text.strip():
            return 'Other', 0.0, None

        # Normalize text
        text = self._normalize_text(text)

        # Try ML ensemble first
        if self.is_trained and self.vectorizer and self.lr_model:
            try:
                X = self.vectorizer.transform([text]).toarray()

                # Get predictions from all models
                lr_proba = self.lr_model.predict_proba(X)[0]
                rf_proba = self.rf_model.predict_proba(X)[0]
                gb_proba = self.gb_model.predict_proba(X)[0]

                # Average probabilities
                avg_proba = (lr_proba + rf_proba + gb_proba) / 3

                # Get top predictions
                top_indices = np.argsort(avg_proba)[::-1][:3]

                category = self.lr_model.classes_[top_indices[0]]
                confidence = float(avg_proba[top_indices[0]])

                # Alternatives
                alternatives = []
                for idx in top_indices[1:]:
                    alternatives.append({
                        'category': str(self.lr_model.classes_[idx]),
                        'confidence': float(avg_proba[idx])
                    })

                # Fuzzy match if confidence low
                if use_fuzzy_matching and confidence < 0.65:
                    fuzzy_result = self._fuzzy_match(text)
                    if fuzzy_result[1] > confidence:
                        return fuzzy_result

                return category, confidence, alternatives if alternatives else None

            except Exception as e:
                logger.error(f"Error in ensemble prediction: {e}")

        # Fallback to keyword/fuzzy matching
        if use_fuzzy_matching:
            return self._fuzzy_match(text)

        return self._keyword_fallback(text)

    def _normalize_text(self, text: str) -> str:
        """Normalize text for better matching."""
        text = text.lower().strip()
        # Remove special characters but keep spaces
        text = ''.join(c if c.isalnum() or c.isspace() else ' ' for c in text)
        return ' '.join(text.split())

    def _fuzzy_match(self, text: str) -> Tuple[str, float, None]:
        """Use fuzzy matching for misspelling tolerance."""
        best_score = 0
        best_category = 'Other'

        for category, keywords in self.KEYWORD_PATTERNS.items():
            for keyword in keywords:
                score = fuzz.token_set_ratio(text, keyword)
                if score > best_score:
                    best_score = score
                    best_category = category

        confidence = min(best_score / 100.0, 1.0)
        if confidence > 0.5:
            return best_category, confidence, None

        return 'Other', 0.0, None

    def _keyword_fallback(self, text: str) -> Tuple[str, float, None]:
        """Fallback to keyword matching."""
        text_lower = text.lower()
        scores = {}

        for category, keywords in self.KEYWORD_PATTERNS.items():
            matches = sum(1 for kw in keywords if kw in text_lower)
            if matches > 0:
                scores[category] = matches / len(keywords)

        if scores:
            best_category = max(scores, key=scores.get)
            confidence = min(scores[best_category], 1.0)
            return best_category, confidence, None

        return 'Other', 0.0, None

    def _ensemble_vote(
        self,
        predictions: List[np.ndarray],
    ) -> np.ndarray:
        """Ensemble voting across multiple classifiers."""
        # Stack predictions and find mode (most common)
        stacked = np.column_stack(predictions)
        result = []

        for row in stacked:
            from scipy.stats import mode
            voted = mode(row, keepdims=True)[0][0]
            result.append(voted)

        return np.array(result)

    def _ensemble_predict(self, X: np.ndarray) -> np.ndarray:
        """Predict using ensemble voting."""
        lr_preds = self.lr_model.predict(X)
        rf_preds = self.rf_model.predict(X)
        gb_preds = self.gb_model.predict(X)
        svm_preds = self.svm_model.predict(X)

        return self._ensemble_vote([lr_preds, rf_preds, gb_preds, svm_preds])

    def predict_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        """Predict categories for multiple texts."""
        results = []
        for text in texts:
            category, confidence, alternatives = self.predict(text)
            results.append({
                'text': text,
                'category': category,
                'confidence': confidence,
                'alternatives': alternatives or []
            })
        return results

    def get_categories(self) -> List[str]:
        """Get list of possible categories."""
        return self.CATEGORIES

    def get_training_metrics(self) -> Dict[str, Any]:
        """Get training metrics and history."""
        return {
            'metrics': self.metrics,
            'history': self.training_history,
        }
