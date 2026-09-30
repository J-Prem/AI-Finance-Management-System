"""Helper utilities for the ML microservice."""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


def load_json_file(file_path: Path) -> Dict[str, Any]:
    """Load JSON file safely."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading JSON file {file_path}: {e}")
        return {}


def save_json_file(data: Dict[str, Any], file_path: Path) -> bool:
    """Save data to JSON file."""
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving JSON file {file_path}: {e}")
        return False


def calculate_z_score(value: float, values: List[float]) -> float:
    """Calculate z-score for a value."""
    if len(values) < 2:
        return 0.0
    mean = np.mean(values)
    std = np.std(values)
    if std == 0:
        return 0.0
    return abs((value - mean) / std)


def get_percentile(value: float, values: List[float]) -> float:
    """Get percentile rank of a value (0-100)."""
    if not values:
        return 50.0
    sorted_values = sorted(values)
    position = sum(1 for v in sorted_values if v <= value) / len(values)
    return position * 100


def extract_date_features(dt: datetime) -> Dict[str, int]:
    """Extract date features from datetime."""
    return {
        "year": dt.year,
        "month": dt.month,
        "day": dt.day,
        "hour": dt.hour,
        "minute": dt.minute,
        "day_of_week": dt.weekday(),  # 0=Monday, 6=Sunday
        "is_weekend": dt.weekday() >= 5,
        "is_month_start": dt.day <= 3,
        "is_month_end": dt.day >= 28,
        "quarter": (dt.month - 1) // 3 + 1,
    }


def group_by_day(transactions: List[Dict[str, Any]]) -> Dict[str, List[Dict]]:
    """Group transactions by day."""
    grouped = {}
    for t in transactions:
        day = pd.Timestamp(t['timestamp']).date()
        day_str = str(day)
        if day_str not in grouped:
            grouped[day_str] = []
        grouped[day_str].append(t)
    return grouped


def group_by_month(transactions: List[Dict[str, Any]]) -> Dict[str, List[Dict]]:
    """Group transactions by month."""
    grouped = {}
    for t in transactions:
        month = pd.Timestamp(t['timestamp']).to_period('M')
        month_str = str(month)
        if month_str not in grouped:
            grouped[month_str] = []
        grouped[month_str].append(t)
    return grouped


def group_by_category(transactions: List[Dict[str, Any]]) -> Dict[str, List[Dict]]:
    """Group transactions by category."""
    grouped = {}
    for t in transactions:
        cat = t.get('category', 'Unknown')
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(t)
    return grouped


def calculate_category_distribution(
    transactions: List[Dict[str, Any]],
) -> Dict[str, float]:
    """Calculate spending distribution by category."""
    if not transactions:
        return {}

    by_category = group_by_category(transactions)
    total = sum(t['amount'] for t in transactions)

    distribution = {}
    for category, items in by_category.items():
        amount = sum(t['amount'] for t in items)
        distribution[category] = round(amount / total * 100, 2)

    return dict(sorted(distribution.items(), key=lambda x: x[1], reverse=True))


def normalize_merchant_name(merchant: str) -> str:
    """Normalize merchant name."""
    if not merchant:
        return "Unknown"
    return merchant.strip().lower().replace(' ', '_')


def extract_keywords_from_description(description: str) -> List[str]:
    """Extract keywords from transaction description."""
    words = description.lower().split()
    # Filter out common words
    stopwords = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'from', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been'
    }
    keywords = [w for w in words if len(w) > 2 and w not in stopwords]
    return list(set(keywords))  # Remove duplicates


def calculate_spending_velocity(transactions: List[Dict[str, Any]]) -> float:
    """Calculate average days between transactions."""
    if len(transactions) < 2:
        return 0.0

    timestamps = sorted([pd.Timestamp(t['timestamp']) for t in transactions])
    deltas = []
    for i in range(1, len(timestamps)):
        delta = (timestamps[i] - timestamps[i-1]).days
        if delta > 0:
            deltas.append(delta)

    return round(np.mean(deltas), 2) if deltas else 0.0


def detect_payday(transactions: List[Dict[str, Any]]) -> Optional[int]:
    """Detect likely payday (day of month) from salary deposits."""
    if not transactions:
        return None

    paydays = []
    for t in transactions:
        if t.get('type') == 'income' or 'salary' in t.get('description', '').lower():
            paydays.append(pd.Timestamp(t['timestamp']).day)

    if paydays:
        # Return most common day
        from collections import Counter
        return Counter(paydays).most_common(1)[0][0]
    return None


def calculate_time_of_day_pattern(
    transactions: List[Dict[str, Any]],
) -> Dict[int, float]:
    """Calculate average spending by hour of day."""
    pattern = {}
    for t in transactions:
        hour = pd.Timestamp(t['timestamp']).hour
        if hour not in pattern:
            pattern[hour] = []
        pattern[hour].append(t['amount'])

    # Calculate averages
    return {hour: round(np.mean(amounts), 2) for hour, amounts in pattern.items()}


def calculate_day_of_week_pattern(
    transactions: List[Dict[str, Any]],
) -> Dict[str, float]:
    """Calculate average spending by day of week."""
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    pattern = {day: [] for day in days}

    for t in transactions:
        day_idx = pd.Timestamp(t['timestamp']).weekday()
        pattern[days[day_idx]].append(t['amount'])

    # Calculate averages
    return {
        day: round(np.mean(amounts), 2) if amounts else 0.0
        for day, amounts in pattern.items()
    }


def detect_recurring_pattern(amounts: List[float], tolerance: float = 0.1) -> bool:
    """Detect if amounts follow a recurring pattern."""
    if len(amounts) < 3:
        return False

    # Check if variance is low (amounts are similar)
    mean = np.mean(amounts)
    variance = np.var(amounts)
    coefficient_of_variation = np.sqrt(variance) / mean if mean > 0 else 1.0

    return coefficient_of_variation <= tolerance


def format_currency(amount: float, currency: str = "INR") -> str:
    """Format amount as currency."""
    if currency == "INR":
        return f"₹{amount:,.2f}"
    return f"${amount:,.2f}"


def get_time_period_name(days: int) -> str:
    """Get human-readable period name."""
    if days == 1:
        return "Today"
    elif days == 7:
        return "This Week"
    elif days == 30:
        return "This Month"
    elif days == 90:
        return "Last Quarter"
    elif days == 365:
        return "This Year"
    else:
        return f"Last {days} Days"


def calculate_moving_average(
    values: List[float],
    window: int = 7,
) -> List[float]:
    """Calculate moving average."""
    if len(values) < window:
        return values

    ma = []
    for i in range(len(values) - window + 1):
        avg = np.mean(values[i:i+window])
        ma.append(avg)
    return ma


def detect_trend(values: List[float]) -> str:
    """Detect trend from values: increasing, decreasing, or stable."""
    if len(values) < 2:
        return "stable"

    # Use first and second halves
    mid = len(values) // 2
    first_half_avg = np.mean(values[:mid]) if mid > 0 else values[0]
    second_half_avg = np.mean(values[mid:])

    threshold = 0.05  # 5% threshold
    diff_percent = abs(second_half_avg - first_half_avg) / first_half_avg if first_half_avg > 0 else 0

    if diff_percent < threshold:
        return "stable"
    elif second_half_avg > first_half_avg:
        return "increasing"
    else:
        return "decreasing"
