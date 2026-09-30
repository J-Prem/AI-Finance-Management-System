"""Behavioral pattern detection in spending."""

import logging
from typing import List, Dict, Any
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)


class BehavioralAnalyzer:
    """Detect behavioral patterns in spending."""

    def analyze_patterns(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze behavioral patterns."""
        try:
            if not transactions:
                return self._empty_analysis()

            patterns = []

            # Detect each pattern type
            weekend_pattern = self._detect_weekend_spending(transactions)
            if weekend_pattern:
                patterns.append(weekend_pattern)

            payday_pattern = self._detect_payday_effect(transactions)
            if payday_pattern:
                patterns.append(payday_pattern)

            emotional_pattern = self._detect_emotional_spending(transactions)
            if emotional_pattern:
                patterns.append(emotional_pattern)

            late_night_pattern = self._detect_late_night_spending(transactions)
            if late_night_pattern:
                patterns.append(late_night_pattern)

            category_switching = self._detect_category_switching(transactions)
            if category_switching:
                patterns.append(category_switching)

            seasonal_pattern = self._detect_seasonal_changes(transactions)
            if seasonal_pattern:
                patterns.append(seasonal_pattern)

            # Calculate weekend vs weekday
            weekend_vs_weekday = self._calculate_weekend_vs_weekday(transactions)

            # Emotional spending risk
            emotional_risk = self._calculate_emotional_risk(patterns)

            return {
                'patterns': patterns,
                'weekend_vs_weekday': weekend_vs_weekday,
                'payday_effect': self._detect_payday_spike(transactions),
                'emotional_spending_risk': emotional_risk,
            }

        except Exception as e:
            logger.error(f"Error analyzing behaviors: {e}")
            return self._empty_analysis()

    def _detect_weekend_spending(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect weekend vs weekday spending differences."""
        weekend_txns = []
        weekday_txns = []

        for t in transactions:
            ts = pd.Timestamp(t['timestamp'])
            if ts.weekday() >= 5:  # Saturday, Sunday
                weekend_txns.append(t['amount'])
            else:
                weekday_txns.append(t['amount'])

        if not weekend_txns or not weekday_txns:
            return None

        weekend_avg = np.mean(weekend_txns)
        weekday_avg = np.mean(weekday_txns)
        ratio = weekend_avg / weekday_avg if weekday_avg > 0 else 1.0

        if ratio > 1.3:
            return {
                'pattern_type': 'Weekend Spending',
                'description': f'You spend {ratio:.1f}x more on weekends than weekdays',
                'confidence': 0.8,
                'examples': ['Increased shopping', 'Entertainment expenses', 'Dining out'],
            }
        return None

    def _detect_payday_effect(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect spending spikes around payday."""
        by_day = defaultdict(list)

        for t in transactions:
            day = pd.Timestamp(t['timestamp']).day
            by_day[day].append(t['amount'])

        if not by_day:
            return None

        # Find day with highest average spending
        max_day = max(by_day.keys(), key=lambda d: np.mean(by_day[d]))
        max_avg = np.mean(by_day[max_day])

        overall_avg = np.mean([a for amounts in by_day.values() for a in amounts])
        if overall_avg == 0:
            return None

        ratio = max_avg / overall_avg

        if ratio > 1.4 and max_day in [1, 2, 3, 15, 16, 17]:  # Common payday dates
            return {
                'pattern_type': 'Payday Effect',
                'description': f'Spending spikes around day {max_day} (likely payday)',
                'confidence': 0.7,
                'examples': ['Big purchases after salary', 'Multiple transactions', 'Higher amounts'],
            }
        return None

    def _detect_emotional_spending(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect emotional spending patterns (spending clusters)."""
        if len(transactions) < 10:
            return None

        amounts = sorted([t['amount'] for t in transactions])
        high_threshold = np.percentile(amounts, 75)
        high_spending_count = sum(1 for a in amounts if a > high_threshold)
        total_high_amount = sum(a for a in amounts if a > high_threshold)
        total_amount = sum(amounts)

        high_spending_ratio = total_high_amount / total_amount if total_amount > 0 else 0

        if high_spending_ratio > 0.4 and high_spending_count > len(transactions) * 0.15:
            return {
                'pattern_type': 'Emotional Spending',
                'description': 'Tendency for impulse and emotional purchases',
                'confidence': 0.6,
                'examples': ['Sudden spending bursts', 'Large purchases', 'Multiple high-value transactions'],
            }
        return None

    def _detect_late_night_spending(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect late night spending patterns."""
        late_night = []

        for t in transactions:
            hour = pd.Timestamp(t['timestamp']).hour
            if hour in range(22, 24) or hour in range(0, 6):  # 10pm - 6am
                late_night.append(t['amount'])

        if not late_night or len(late_night) < 5:
            return None

        late_night_count = len(late_night)
        total_count = len(transactions)
        ratio = late_night_count / total_count if total_count > 0 else 0

        if ratio > 0.15:
            return {
                'pattern_type': 'Late Night Spending',
                'description': 'Higher activity during late night/early morning hours',
                'confidence': 0.7,
                'examples': ['Online shopping', 'Impulse purchases', 'Entertainment spending'],
            }
        return None

    def _detect_category_switching(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect category switching patterns."""
        categories = [t.get('category', 'Unknown') for t in transactions]

        if len(set(categories)) < 3:
            return None

        # Check for rapid category changes
        changes = sum(1 for i in range(1, len(categories)) if categories[i] != categories[i-1])
        total_pairs = len(categories) - 1

        change_ratio = changes / total_pairs if total_pairs > 0 else 0

        if change_ratio > 0.6:
            return {
                'pattern_type': 'Category Switching',
                'description': 'Frequent changes between spending categories',
                'confidence': 0.6,
                'examples': ['Varied spending habits', 'Multiple categories', 'Diverse purchases'],
            }
        return None

    def _detect_seasonal_changes(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect seasonal behavior changes."""
        by_month = defaultdict(list)

        for t in transactions:
            month = pd.Timestamp(t['timestamp']).month
            by_month[month].append(t['amount'])

        if len(by_month) < 6:  # Need at least 6 months
            return None

        monthly_avgs = [np.mean(amounts) for amounts in by_month.values()]
        if not monthly_avgs or max(monthly_avgs) == 0:
            return None

        variation = np.std(monthly_avgs) / np.mean(monthly_avgs)

        if variation > 0.3:
            return {
                'pattern_type': 'Seasonal Behavior',
                'description': 'Significant spending variations across seasons',
                'confidence': 0.7,
                'examples': ['Holiday season spending', 'Vacation periods', 'Annual events'],
            }
        return None

    def _calculate_weekend_vs_weekday(self, transactions: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculate average spending weekend vs weekday."""
        weekend = []
        weekday = []

        for t in transactions:
            ts = pd.Timestamp(t['timestamp'])
            if ts.weekday() >= 5:
                weekend.append(t['amount'])
            else:
                weekday.append(t['amount'])

        return {
            'weekday_avg': round(np.mean(weekday), 2) if weekday else 0.0,
            'weekend_avg': round(np.mean(weekend), 2) if weekend else 0.0,
        }

    def _detect_payday_spike(self, transactions: List[Dict[str, Any]]) -> float:
        """Detect if there's a payday spike effect."""
        by_day = defaultdict(list)

        for t in transactions:
            day = pd.Timestamp(t['timestamp']).day
            by_day[day].append(t['amount'])

        if not by_day:
            return 0.0

        daily_avgs = [np.mean(amounts) for amounts in by_day.values()]
        overall_avg = np.mean(daily_avgs)

        max_avg = max(daily_avgs)
        if overall_avg == 0:
            return 0.0

        ratio = (max_avg - overall_avg) / overall_avg
        return round(min(ratio, 1.0), 2)

    def _calculate_emotional_risk(self, patterns: List[Dict[str, Any]]) -> str:
        """Calculate emotional spending risk level."""
        emotional_patterns = [p for p in patterns if 'Emotional' in p.get('pattern_type', '')]

        if emotional_patterns:
            return 'high'

        impulse_patterns = [p for p in patterns if 'Impulse' in p.get('pattern_type', '') or 'Emotional' in p.get('pattern_type', '')]
        if impulse_patterns:
            return 'medium'

        return 'low'

    def _empty_analysis(self) -> Dict[str, Any]:
        """Return empty analysis."""
        return {
            'patterns': [],
            'weekend_vs_weekday': {},
            'payday_effect': None,
            'emotional_spending_risk': 'low',
        }
