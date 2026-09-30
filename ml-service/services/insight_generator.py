"""Smart insight generation from financial data."""

import logging
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from collections import Counter
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class InsightGenerator:
    """Generate actionable insights from financial data."""

    def generate_insights(
        self,
        transactions: List[Dict[str, Any]],
        period: str = "monthly",
        include_predictions: bool = True,
    ) -> Dict[str, Any]:
        """Generate comprehensive insights."""
        try:
            if not transactions:
                return self._empty_insights()

            insights = []

            # Spending change insights
            spending_change = self._analyze_spending_change(transactions, period)
            if spending_change:
                insights.append(spending_change)

            # Category insights
            category_insights = self._analyze_category_changes(transactions)
            insights.extend(category_insights)

            # Anomaly insights
            anomaly_insight = self._analyze_anomalies(transactions)
            if anomaly_insight:
                insights.append(anomaly_insight)

            # Pattern insights
            pattern_insights = self._analyze_patterns(transactions)
            insights.extend(pattern_insights)

            # Optimization insights
            opt_insights = self._generate_optimizations(transactions)
            insights.extend(opt_insights)

            # Sort by priority
            insights = sorted(insights, key=lambda x: {'high': 0, 'medium': 1, 'low': 2}.get(x.get('priority', 'low'), 2))

            # Generate summary
            summary = self._generate_summary(insights, transactions)

            return {
                'insights': insights,
                'summary': summary,
                'period': period,
            }

        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            return self._empty_insights()

    def _analyze_spending_change(
        self,
        transactions: List[Dict[str, Any]],
        period: str,
    ) -> Optional[Dict[str, Any]]:
        """Analyze spending changes over time."""
        if len(transactions) < 2:
            return None

        # Separate transactions by period
        df = pd.DataFrame(transactions)
        df['timestamp'] = pd.to_datetime(df['timestamp'])

        if period == 'monthly':
            df['period'] = df['timestamp'].dt.to_period('M')
        elif period == 'weekly':
            df['period'] = df['timestamp'].dt.to_period('W')
        else:
            df['period'] = df['timestamp'].dt.to_period('D')

        # Group by period
        by_period = df.groupby('period')['amount'].sum().sort_index()

        if len(by_period) < 2:
            return None

        current = by_period.iloc[-1]
        previous = by_period.iloc[-2]

        change_pct = ((current - previous) / previous * 100) if previous > 0 else 0
        change_amount = current - previous

        if abs(change_pct) > 15:  # Significant change
            direction = "increased" if change_pct > 0 else "decreased"
            return {
                'title': f'Spending {direction.capitalize()}',
                'description': f'Your spending has {direction} by ₹{abs(change_amount):,.0f} ({abs(change_pct):.0f}%) this {period}.',
                'category': 'spending',
                'priority': 'high' if abs(change_pct) > 30 else 'medium',
                'action': 'Review discretionary spending' if change_pct > 0 else 'Consider reinvesting savings',
            }

        return None

    def _analyze_category_changes(
        self,
        transactions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Analyze changes in category spending."""
        insights = []

        # Group by category
        by_cat = {}
        for t in transactions:
            cat = t.get('category', 'Unknown')
            if cat not in by_cat:
                by_cat[cat] = []
            by_cat[cat].append(t['amount'])

        # Find biggest spenders
        cat_totals = {cat: sum(amounts) for cat, amounts in by_cat.items()}
        top_category = max(cat_totals, key=cat_totals.get)
        top_amount = cat_totals[top_category]
        total_spend = sum(cat_totals.values())
        top_pct = top_amount / total_spend * 100 if total_spend > 0 else 0

        if top_pct > 30:
            insights.append({
                'title': f'{top_category} Dominates Budget',
                'description': f'{top_category} accounts for {top_pct:.0f}% of your spending (₹{top_amount:,.0f}).',
                'category': 'spending',
                'priority': 'medium',
                'action': f'Review if {top_category} spending aligns with your goals',
            })

        # Find big changes
        for cat in list(by_cat.keys())[:3]:
            amounts = by_cat[cat]
            if len(amounts) >= 5:
                recent_avg = np.mean(amounts[-3:]) if len(amounts) >= 3 else amounts[-1]
                earlier_avg = np.mean(amounts[:3]) if len(amounts) >= 3 else amounts[0]
                change_pct = ((recent_avg - earlier_avg) / earlier_avg * 100) if earlier_avg > 0 else 0

                if abs(change_pct) > 25:
                    direction = "increased" if change_pct > 0 else "decreased"
                    insights.append({
                        'title': f'{cat} Spending {direction.capitalize()}',
                        'description': f'Your {cat} spending has {direction} by {abs(change_pct):.0f}% recently.',
                        'category': 'pattern',
                        'priority': 'low',
                        'action': None,
                    })

        return insights

    def _analyze_anomalies(self, transactions: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Analyze anomalies in spending."""
        amounts = [t['amount'] for t in transactions]
        if not amounts or len(amounts) < 5:
            return None

        mean = np.mean(amounts)
        std = np.std(amounts)
        high_threshold = mean + (2 * std)
        high_transactions = [t for t in transactions if t['amount'] > high_threshold]

        if high_transactions:
            high_count = len(high_transactions)
            high_pct = high_count / len(transactions) * 100
            high_total = sum(t['amount'] for t in high_transactions)

            return {
                'title': 'Unusual Large Transactions',
                'description': f'You have {high_count} unusually large transactions (₹{high_total:,.0f} total). {high_pct:.0f}% of your spending.',
                'category': 'warning',
                'priority': 'medium',
                'action': 'Review if these are planned purchases or impulse buys',
            }

        return None

    def _analyze_patterns(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze spending patterns."""
        insights = []

        # Weekend spending
        weekend_txns = []
        weekday_txns = []
        for t in transactions:
            ts = pd.Timestamp(t['timestamp'])
            if ts.weekday() >= 5:
                weekend_txns.append(t['amount'])
            else:
                weekday_txns.append(t['amount'])

        if weekend_txns and weekday_txns:
            weekend_avg = np.mean(weekend_txns)
            weekday_avg = np.mean(weekday_txns)
            ratio = weekend_avg / weekday_avg if weekday_avg > 0 else 1.0

            if ratio > 1.4:
                insights.append({
                    'title': 'Weekend Spending Spike',
                    'description': f'You spend {ratio:.1f}x more on weekends than weekdays.',
                    'category': 'pattern',
                    'priority': 'low',
                    'action': 'Plan weekend activities in advance to manage spending',
                })

        return insights

    def _generate_optimizations(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate optimization suggestions."""
        insights = []

        # Savings opportunity
        expenses = sum(t['amount'] for t in transactions if t.get('type') == 'expense')
        income = sum(t['amount'] for t in transactions if t.get('type') == 'income')

        if income > 0:
            saving_rate = (income - expenses) / income * 100
            if saving_rate < 10:
                insights.append({
                    'title': 'Low Savings Rate',
                    'description': f'You\'re only saving {saving_rate:.0f}% of income. Target: 20%+',
                    'category': 'saving',
                    'priority': 'high',
                    'action': 'Review and reduce discretionary spending',
                })

        # Budget adherence
        by_cat = {}
        for t in transactions:
            cat = t.get('category', 'Unknown')
            if cat not in by_cat:
                by_cat[cat] = 0
            by_cat[cat] += t['amount']

        # Check for high-variance categories
        for cat, total in by_cat.items():
            cat_txns = [t['amount'] for t in transactions if t.get('category') == cat]
            if len(cat_txns) >= 5:
                cv = np.std(cat_txns) / np.mean(cat_txns) if np.mean(cat_txns) > 0 else 0
                if cv > 1.0:  # High variance
                    insights.append({
                        'title': f'Inconsistent {cat} Spending',
                        'description': f'{cat} spending is highly variable. Consider setting spending limits.',
                        'category': 'spending',
                        'priority': 'low',
                        'action': f'Set monthly budget for {cat}',
                    })

        return insights

    def _generate_summary(
        self,
        insights: List[Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> str:
        """Generate text summary of insights."""
        if not insights:
            return "No significant insights to report this period."

        high_priority = [i for i in insights if i.get('priority') == 'high']
        summary_parts = []

        if high_priority:
            count = len(high_priority)
            summary_parts.append(f"You have {count} important financial item{'s' if count > 1 else ''} to address:")
            for i in high_priority[:2]:
                summary_parts.append(f"• {i['title']}")

        total_spent = sum(t['amount'] for t in transactions if t.get('type') == 'expense')
        summary_parts.append(f"Total spending this period: ₹{total_spent:,.0f}")

        return " ".join(summary_parts)

    def _empty_insights(self) -> Dict[str, Any]:
        """Return empty insights."""
        return {
            'insights': [],
            'summary': 'No transactions to analyze',
            'period': 'unknown',
        }
