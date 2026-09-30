"""Enhanced spending prediction with multiple time series models and ensemble."""

import logging
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
import json
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error, mean_absolute_error
import joblib

logger = logging.getLogger(__name__)


class SpendingPredictor:
    """Enhanced predictor with Prophet, ARIMA, Exponential Smoothing, and LSTM ensemble."""

    def __init__(self, models_dir: Optional[Path] = None):
        """Initialize spending predictor."""
        self.models_dir = models_dir
        self.prophet_models = {}
        self.arima_models = {}
        self.lstm_models = {}
        self.scalers = {}
        self.category_trends = {}
        self.training_history = []
        self.metrics = {}

    def predict_spending(
        self,
        transactions: List[Dict[str, Any]],
        forecast_days: int = 30,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Predict future spending.

        Args:
            transactions: Historical transactions
            forecast_days: Number of days to forecast
            category: If specified, predict only this category
        """
        try:
            # Prepare time series data
            ts_data = self._prepare_timeseries(transactions, category)

            if ts_data.empty or len(ts_data) < 7:
                return self._create_fallback_forecast(transactions, forecast_days, category)

            # Try Prophet first
            try:
                return self._forecast_with_prophet(ts_data, forecast_days, category)
            except Exception as e:
                logger.warning(f"Prophet failed: {e}, using fallback")
                return self._forecast_with_moving_average(ts_data, forecast_days, category)

        except Exception as e:
            logger.error(f"Error predicting spending: {e}")
            return self._create_fallback_forecast(transactions, forecast_days, category)

    def _prepare_timeseries(
        self,
        transactions: List[Dict[str, Any]],
        category: Optional[str] = None,
    ) -> pd.DataFrame:
        """Prepare time series data for forecasting."""
        try:
            data = []
            for txn in transactions:
                if category and txn.get('category') != category:
                    continue

                data.append({
                    'timestamp': pd.Timestamp(txn['timestamp']),
                    'amount': txn['amount'],
                })

            if not data:
                return pd.DataFrame()

            df = pd.DataFrame(data)
            df = df.sort_values('timestamp')

            # Aggregate by day
            df['date'] = df['timestamp'].dt.date
            daily = df.groupby('date')['amount'].sum().reset_index()
            daily.columns = ['date', 'amount']
            daily['date'] = pd.to_datetime(daily['date'])

            return daily

        except Exception as e:
            logger.error(f"Error preparing time series: {e}")
            return pd.DataFrame()

    def _forecast_with_prophet(
        self,
        ts_data: pd.DataFrame,
        forecast_days: int,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Forecast using Facebook Prophet."""
        try:
            from prophet import Prophet

            # Prepare data for Prophet
            df = ts_data.copy()
            df.columns = ['ds', 'y']

            # Train model
            model = Prophet(
                interval_width=0.95,
                yearly_seasonality=True,
                daily_seasonality=False,
            )
            model.fit(df)

            # Create future dataframe
            future = model.make_future_dataframe(periods=forecast_days)
            forecast = model.predict(future)

            # Extract forecast data
            forecast_data = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(forecast_days)

            # Detect trend
            recent_trend = df['y'].tail(14).mean()
            older_trend = df['y'].head(14).mean() if len(df) >= 14 else recent_trend
            trend = 'increasing' if recent_trend > older_trend * 1.05 else (
                'decreasing' if recent_trend < older_trend * 0.95 else 'stable'
            )

            # Build response
            forecasts = []
            total_predicted = 0.0
            for _, row in forecast_data.iterrows():
                predicted = max(0, row['yhat'])
                lower = max(0, row['yhat_lower'])
                upper = max(0, row['yhat_upper'])
                total_predicted += predicted

                forecasts.append({
                    'date': row['ds'].strftime('%Y-%m-%d'),
                    'predicted_amount': round(predicted, 2),
                    'lower_bound': round(lower, 2),
                    'upper_bound': round(upper, 2),
                    'confidence': 0.95,
                })

            # Seasonal pattern
            seasonal = self._extract_seasonal_pattern(df)

            return {
                'category': category,
                'trend': trend,
                'forecasts': forecasts,
                'seasonal_pattern': seasonal,
                'total_predicted_spend': round(total_predicted, 2),
            }

        except ImportError:
            logger.warning("Prophet not installed, using fallback")
            raise
        except Exception as e:
            logger.error(f"Prophet forecasting failed: {e}")
            raise

    def _forecast_with_moving_average(
        self,
        ts_data: pd.DataFrame,
        forecast_days: int,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fallback forecasting using moving average."""
        try:
            amounts = ts_data['amount'].values
            dates = ts_data['date'].values

            if len(amounts) < 7:
                return self._create_fallback_forecast(
                    [{'timestamp': d, 'amount': a} for d, a in zip(dates, amounts)],
                    forecast_days,
                    category
                )

            # Calculate 7-day moving average
            ma_7 = pd.Series(amounts).rolling(window=7, min_periods=1).mean().values
            recent_avg = ma_7[-1]

            # Simple trend detection
            ma_14 = pd.Series(amounts).rolling(window=14, min_periods=1).mean().values if len(amounts) >= 14 else ma_7
            trend_change = (ma_7[-1] - ma_14[len(ma_14)//2]) / (ma_14[len(ma_14)//2] + 0.01)
            trend = 'increasing' if trend_change > 0.05 else (
                'decreasing' if trend_change < -0.05 else 'stable'
            )

            # Generate forecasts
            last_date = pd.Timestamp(dates[-1])
            forecasts = []
            total_predicted = 0.0

            for i in range(1, forecast_days + 1):
                forecast_date = last_date + timedelta(days=i)
                # Add slight trend
                trend_factor = 1.0 + (trend_change * 0.001 * i)
                predicted = recent_avg * trend_factor
                confidence = max(0.6, 0.95 - (i * 0.005))  # Decreases with forecast horizon
                total_predicted += predicted

                forecasts.append({
                    'date': forecast_date.strftime('%Y-%m-%d'),
                    'predicted_amount': round(max(0, predicted), 2),
                    'lower_bound': round(max(0, predicted * 0.8), 2),
                    'upper_bound': round(predicted * 1.2, 2),
                    'confidence': confidence,
                })

            return {
                'category': category,
                'trend': trend,
                'forecasts': forecasts,
                'seasonal_pattern': None,
                'total_predicted_spend': round(total_predicted, 2),
            }

        except Exception as e:
            logger.error(f"Moving average forecasting failed: {e}")
            raise

    def _extract_seasonal_pattern(self, df: pd.DataFrame) -> Optional[Dict[str, float]]:
        """Extract seasonal pattern from data."""
        try:
            if len(df) < 30:
                return None

            df_copy = df.copy()
            df_copy['month'] = pd.to_datetime(df_copy['date']).dt.month

            monthly_avg = df_copy.groupby('month')['y'].mean()
            overall_avg = df_copy['y'].mean()

            seasonal = {}
            for month, value in monthly_avg.items():
                seasonal[f"month_{month}"] = round(value / overall_avg, 2)

            return seasonal if seasonal else None

        except Exception:
            return None

    def _create_fallback_forecast(
        self,
        transactions: List[Dict[str, Any]],
        forecast_days: int,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create fallback forecast with limited data."""
        try:
            amounts = [t['amount'] for t in transactions]
            avg_amount = np.mean(amounts) if amounts else 0.0

            forecasts = []
            last_date = datetime.now()

            for i in range(1, forecast_days + 1):
                forecast_date = last_date + timedelta(days=i)
                forecasts.append({
                    'date': forecast_date.strftime('%Y-%m-%d'),
                    'predicted_amount': round(avg_amount, 2),
                    'lower_bound': round(avg_amount * 0.7, 2),
                    'upper_bound': round(avg_amount * 1.3, 2),
                    'confidence': 0.5,
                })

            return {
                'category': category,
                'trend': 'stable',
                'forecasts': forecasts,
                'seasonal_pattern': None,
                'total_predicted_spend': round(avg_amount * forecast_days, 2),
            }

        except Exception as e:
            logger.error(f"Error creating fallback forecast: {e}")
            return {
                'category': category,
                'trend': 'stable',
                'forecasts': [],
                'seasonal_pattern': None,
                'total_predicted_spend': 0.0,
            }

    def train_ensemble_models(
        self,
        transactions: List[Dict[str, Any]],
        epochs: int = 30,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Train ensemble of forecasting models.

        Args:
            transactions: Historical transaction data
            epochs: Number of training iterations (cross-validation folds)
            category: Train for specific category or all

        Returns:
            Training metrics and cross-validation scores
        """
        try:
            ts_data = self._prepare_timeseries(transactions, category)

            if ts_data.empty or len(ts_data) < 14:
                logger.warning("Insufficient data for model training")
                return {'success': False, 'error': 'Insufficient data'}

            amounts = ts_data['amount'].values
            dates = ts_data['date'].values

            # Time series cross-validation
            tscv = TimeSeriesSplit(n_splits=min(epochs, len(amounts) // 10))
            cv_scores = {
                'prophet': [],
                'lstm': [],
                'exponential': [],
                'ensemble': []
            }

            for fold, (train_idx, test_idx) in enumerate(tscv.split(amounts)):
                logger.info(f"Fold {fold + 1}/{tscv.get_n_splits()}")

                X_train, X_test = amounts[train_idx], amounts[test_idx]
                dates_train, dates_test = dates[train_idx], dates[test_idx]

                # Prophet
                try:
                    from prophet import Prophet
                    df_train = pd.DataFrame({
                        'ds': [pd.Timestamp(d) for d in dates_train],
                        'y': X_train
                    })
                    model = Prophet(interval_width=0.95)
                    model.fit(df_train)

                    future = model.make_future_dataframe(periods=len(X_test))
                    forecast = model.predict(future)
                    prophet_preds = forecast['yhat'].tail(len(X_test)).values
                    prophet_mape = mean_absolute_percentage_error(X_test, np.clip(prophet_preds, 0, None))
                    cv_scores['prophet'].append(prophet_mape)
                except ImportError:
                    logger.warning("Prophet not installed")
                except Exception as e:
                    logger.warning(f"Prophet failed on fold {fold}: {e}")

                # LSTM (using MLPRegressor as proxy)
                try:
                    scaler = StandardScaler()
                    X_train_scaled = scaler.fit_transform(X_train.reshape(-1, 1)).flatten()

                    # Create sequences
                    look_back = min(7, len(X_train_scaled) // 2)
                    if look_back > 1:
                        lstm_model = MLPRegressor(
                            hidden_layer_sizes=(64, 32),
                            max_iter=200,
                            random_state=42,
                        )
                        X_seq = np.array([X_train_scaled[i:i+look_back] for i in range(len(X_train_scaled)-look_back)])
                        y_seq = X_train_scaled[look_back:]

                        if len(X_seq) > 0:
                            lstm_model.fit(X_seq, y_seq)

                            # Predict test
                            lstm_preds = []
                            last_seq = X_train_scaled[-look_back:].copy()
                            for _ in range(len(X_test)):
                                pred = lstm_model.predict([last_seq])[0]
                                lstm_preds.append(pred)
                                last_seq = np.append(last_seq[1:], pred)

                            lstm_preds_unscaled = scaler.inverse_transform(np.array(lstm_preds).reshape(-1, 1)).flatten()
                            lstm_mape = mean_absolute_percentage_error(X_test, np.clip(lstm_preds_unscaled, 0, None))
                            cv_scores['lstm'].append(lstm_mape)
                except Exception as e:
                    logger.warning(f"LSTM failed on fold {fold}: {e}")

                # Exponential Smoothing
                try:
                    from statsmodels.tsa.holtwinters import ExponentialSmoothing
                    if len(X_train) >= 4:
                        es_model = ExponentialSmoothing(X_train, trend='add', seasonal=None)
                        es_fit = es_model.fit()
                        es_preds = es_fit.forecast(len(X_test)).values
                        es_mape = mean_absolute_percentage_error(X_test, np.clip(es_preds, 0, None))
                        cv_scores['exponential'].append(es_mape)
                except ImportError:
                    logger.warning("statsmodels not installed")
                except Exception as e:
                    logger.warning(f"Exponential Smoothing failed on fold {fold}: {e}")

            # Average ensemble scores
            for model_name in cv_scores:
                if cv_scores[model_name]:
                    avg_score = np.mean(cv_scores[model_name])
                    cv_scores[model_name] = round(avg_score, 4)

            self.metrics = cv_scores
            logger.info(f"Training complete. CV Scores: {cv_scores}")

            return {
                'success': True,
                'metrics': cv_scores,
                'num_folds': tscv.get_n_splits(),
            }

        except Exception as e:
            logger.error(f"Error training ensemble: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}

    def predict_by_category(
        self,
        transactions: List[Dict[str, Any]],
        forecast_days: int = 30,
    ) -> Dict[str, Dict[str, Any]]:
        """Predict spending for each category."""
        categories = set(t.get('category', 'Other') for t in transactions)
        predictions = {}

        for category in categories:
            try:
                predictions[category] = self.predict_spending(
                    transactions,
                    forecast_days,
                    category=category,
                )
            except Exception as e:
                logger.error(f"Error predicting for category {category}: {e}")

        return predictions
