"""Recurring subscription detection service."""

import logging
from typing import List, Dict, Any
import pandas as pd
import numpy as np
from collections import defaultdict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class SubscriptionDetector:
    """Detect recurring subscriptions and payments."""

    FREQUENCY_PATTERNS = {
        'weekly': 7,
        'biweekly': 14,
        'monthly': 30,
        'quarterly': 90,
        'yearly': 365,
    }

    def detect_subscriptions(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect recurring subscriptions."""
        try:
            subscriptions = []

            # Group by merchant
            by_merchant = self._group_by_merchant(transactions)

            for merchant, txns in by_merchant.items():
                if len(txns) < 2:  # Need at least 2 transactions
                    continue

                # Check for recurring pattern
                recurring = self._find_recurring_pattern(txns)
                if recurring:
                    subscriptions.append(recurring)

            return sorted(subscriptions, key=lambda x: x['total_spent'], reverse=True)

        except Exception as e:
            logger.error(f"Error detecting subscriptions: {e}")
            return []

    def _group_by_merchant(self, transactions: List[Dict[str, Any]]) -> Dict[str, List[Dict]]:
        """Group transactions by merchant."""
        grouped = defaultdict(list)
        for t in transactions:
            merchant = t.get('merchant', 'Unknown')
            grouped[merchant].append(t)
        return grouped

    def _find_recurring_pattern(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Find recurring pattern in transactions."""
        if len(transactions) < 2:
            return None

        # Sort by timestamp
        sorted_txns = sorted(transactions, key=lambda x: pd.Timestamp(x['timestamp']))
        amounts = [t['amount'] for t in sorted_txns]
        timestamps = [pd.Timestamp(t['timestamp']) for t in sorted_txns]

        # Check for regular pattern
        frequency = self._detect_frequency(timestamps)
        if not frequency:
            return None

        # Check amount consistency
        amount_avg = np.mean(amounts)
        amount_std = np.std(amounts)
        cv = amount_std / amount_avg if amount_avg > 0 else 1.0

        # If CV is too high, not a regular subscription
        if cv > 0.3:  # More than 30% variation
            return None

        # Calculate confidence
        confidence = max(0.6, 1.0 - (cv / 0.5))

        # Determine if active (last transaction within expected interval)
        last_txn = sorted_txns[-1]
        last_date = pd.Timestamp(last_txn['timestamp'])
        days_since = (datetime.now() - last_date.to_pydatetime()).days

        expected_interval = self.FREQUENCY_PATTERNS.get(frequency, 30)
        is_active = days_since <= expected_interval * 2  # Grace period of 2x interval

        return {
            'merchant': transactions[0].get('merchant', 'Unknown'),
            'amount': round(amount_avg, 2),
            'frequency': frequency,
            'confidence': round(min(1.0, confidence), 2),
            'first_occurrence': sorted_txns[0]['timestamp'],
            'last_occurrence': last_txn['timestamp'],
            'count': len(transactions),
            'total_spent': round(sum(amounts), 2),
            'is_active': is_active,
        }

    def _detect_frequency(self, timestamps: List[pd.Timestamp]) -> str:
        """Detect frequency of transactions."""
        if len(timestamps) < 2:
            return None

        # Calculate intervals between transactions
        intervals = []
        for i in range(1, len(timestamps)):
            delta = (timestamps[i] - timestamps[i-1]).days
            if delta > 0:
                intervals.append(delta)

        if not intervals:
            return None

        avg_interval = np.mean(intervals)
        std_interval = np.std(intervals)
        cv = std_interval / avg_interval if avg_interval > 0 else 1.0

        # If too much variance, not regular
        if cv > 0.5:
            return None

        # Match to known frequency
        for freq_name, freq_days in sorted(
            self.FREQUENCY_PATTERNS.items(),
            key=lambda x: x[1]
        ):
            if abs(avg_interval - freq_days) <= max(freq_days * 0.15, 5):
                return freq_name

        return None

    def calculate_monthly_cost(self, subscriptions: List[Dict[str, Any]]) -> float:
        """Calculate total monthly subscription cost."""
        total = 0.0
        for sub in subscriptions:
            freq = sub.get('frequency', 'monthly')
            amount = sub.get('amount', 0.0)

            if freq == 'weekly':
                total += amount * 4.33
            elif freq == 'biweekly':
                total += amount * 2.17
            elif freq == 'monthly':
                total += amount
            elif freq == 'quarterly':
                total += amount / 3
            elif freq == 'yearly':
                total += amount / 12

        return round(total, 2)

    def find_dormant_subscriptions(
        self,
        subscriptions: List[Dict[str, Any]],
        days_threshold: int = 60,
    ) -> List[Dict[str, Any]]:
        """Find subscriptions that haven't been active recently."""
        dormant = []
        for sub in subscriptions:
            if not sub.get('is_active'):
                last_date = pd.Timestamp(sub.get('last_occurrence'))
                days_since = (datetime.now() - last_date.to_pydatetime()).days
                if days_since > days_threshold:
                    sub['days_since_last'] = days_since
                    dormant.append(sub)
        return dormant
