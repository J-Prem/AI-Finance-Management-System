"""Spending DNA profile generation."""

import logging
from typing import List, Dict, Any
import pandas as pd
import numpy as np
from collections import Counter
from utils.helpers import calculate_category_distribution, detect_payday

logger = logging.getLogger(__name__)


class SpendingDNAAnalyzer:
    """Generate spending DNA profile - unique fingerprint of spending habits."""

    def analyze(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate comprehensive spending DNA profile."""
        try:
            if not transactions:
                return self._empty_dna()

            profile_id = self._generate_profile_id()

            return {
                'profile_id': profile_id,
                'category_distribution': self._analyze_categories(transactions),
                'spending_velocity': self._calculate_velocity(transactions),
                'time_of_day_patterns': self._analyze_time_patterns(transactions),
                'day_of_week_patterns': self._analyze_weekday_patterns(transactions),
                'seasonal_patterns': self._analyze_seasonal_patterns(transactions),
                'top_merchants': self._analyze_merchants(transactions),
                'total_transactions': len(transactions),
                'total_spent': round(sum(t['amount'] for t in transactions), 2),
            }

        except Exception as e:
            logger.error(f"Error analyzing spending DNA: {e}")
            return self._empty_dna()

    def _generate_profile_id(self) -> str:
        """Generate unique profile ID."""
        import uuid
        return f"DNA_{uuid.uuid4().hex[:12].upper()}"

    def _analyze_categories(self, transactions: List[Dict[str, Any]]) -> Dict[str, float]:
        """Analyze spending distribution by category."""
        return calculate_category_distribution(transactions)

    def _calculate_velocity(self, transactions: List[Dict[str, Any]]) -> float:
        """Calculate spending velocity (average days between transactions)."""
        if len(transactions) < 2:
            return 0.0

        timestamps = sorted([pd.Timestamp(t['timestamp']) for t in transactions])
        deltas = []
        for i in range(1, len(timestamps)):
            delta = (timestamps[i] - timestamps[i-1]).days
            if delta > 0:
                deltas.append(delta)

        return round(np.mean(deltas), 2) if deltas else 0.0

    def _analyze_time_patterns(self, transactions: List[Dict[str, Any]]) -> Dict[str, float]:
        """Analyze spending by hour of day."""
        pattern = {}
        for t in transactions:
            hour = pd.Timestamp(t['timestamp']).hour
            if hour not in pattern:
                pattern[hour] = []
            pattern[hour].append(t['amount'])

        # Calculate averages
        return {str(hour): round(np.mean(amounts), 2) for hour, amounts in pattern.items()}

    def _analyze_weekday_patterns(self, transactions: List[Dict[str, Any]]) -> Dict[str, float]:
        """Analyze spending by day of week."""
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        pattern = {day: [] for day in days}

        for t in transactions:
            day_idx = pd.Timestamp(t['timestamp']).weekday()
            pattern[days[day_idx]].append(t['amount'])

        return {
            day: round(np.mean(amounts), 2) if amounts else 0.0
            for day, amounts in pattern.items()
        }

    def _analyze_seasonal_patterns(self, transactions: List[Dict[str, Any]]) -> Dict[str, float]:
        """Analyze spending by month (seasonal patterns)."""
        months = {
            1: 'January', 2: 'February', 3: 'March', 4: 'April',
            5: 'May', 6: 'June', 7: 'July', 8: 'August',
            9: 'September', 10: 'October', 11: 'November', 12: 'December'
        }
        pattern = {month: [] for month in months.values()}

        for t in transactions:
            month = pd.Timestamp(t['timestamp']).month
            pattern[months[month]].append(t['amount'])

        result = {}
        total = sum(t['amount'] for t in transactions)
        for month, amounts in pattern.items():
            if amounts:
                result[month] = round(sum(amounts) / total * 100, 2)
        return result if result else None

    def _analyze_merchants(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze top merchants."""
        merchants = {}
        for t in transactions:
            merchant = t.get('merchant', 'Unknown')
            if merchant not in merchants:
                merchants[merchant] = {'count': 0, 'total': 0.0}
            merchants[merchant]['count'] += 1
            merchants[merchant]['total'] += t['amount']

        # Get top merchants
        top_merchants = sorted(
            merchants.items(),
            key=lambda x: x[1]['total'],
            reverse=True
        )[:10]

        return [
            {
                'merchant': name,
                'transactions': data['count'],
                'total_spent': round(data['total'], 2),
                'average_transaction': round(data['total'] / data['count'], 2),
            }
            for name, data in top_merchants
        ]

    def _empty_dna(self) -> Dict[str, Any]:
        """Return empty DNA profile."""
        return {
            'profile_id': 'UNKNOWN',
            'category_distribution': {},
            'spending_velocity': 0.0,
            'time_of_day_patterns': {},
            'day_of_week_patterns': {},
            'seasonal_patterns': None,
            'top_merchants': [],
            'total_transactions': 0,
            'total_spent': 0.0,
        }
