"""What-if spending simulation service."""

import logging
from typing import List, Dict, Any, Optional
import re
import numpy as np

logger = logging.getLogger(__name__)


class WhatIfSimulator:
    """Simulate what-if spending scenarios."""

    def simulate(
        self,
        query: str,
        transactions: List[Dict[str, Any]],
        monthly_income: float,
        savings_goal: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Simulate a what-if scenario."""
        try:
            # Parse query
            scenario = self._parse_query(query)
            if not scenario:
                return self._invalid_query_response(query)

            # Calculate current spending
            current_spending = sum(t['amount'] for t in transactions if t.get('type') == 'expense')

            # Apply scenario
            projected_spending = self._apply_scenario(current_spending, transactions, scenario)

            # Calculate impact
            monthly_savings = monthly_income - projected_spending
            yearly_savings = monthly_savings * 12

            # Calculate time to goal
            time_to_goal = None
            if savings_goal and savings_goal > 0 and monthly_savings > 0:
                months = savings_goal / monthly_savings
                time_to_goal = self._format_time_to_goal(months)

            # Calculate investment potential
            investment_potential = yearly_savings * 0.07  # Assume 7% annual return

            return {
                'scenario': scenario['description'],
                'current_spending': round(current_spending, 2),
                'projected_spending': round(projected_spending, 2),
                'monthly_savings': round(max(0, monthly_savings), 2),
                'yearly_savings': round(max(0, yearly_savings), 2),
                'time_to_goal': time_to_goal,
                'investment_potential': round(investment_potential, 2),
            }

        except Exception as e:
            logger.error(f"Error in what-if simulation: {e}")
            return self._error_response()

    def _parse_query(self, query: str) -> Optional[Dict[str, Any]]:
        """Parse what-if query."""
        query_lower = query.lower()

        # Pattern 1: "What if I reduce [category] spending by [percentage]?"
        pattern1 = r'reduce\s+(\w+)\s+spending\s+by\s+(\d+)\s*%'
        match1 = re.search(pattern1, query_lower)
        if match1:
            category = match1.group(1).capitalize()
            percentage = int(match1.group(2))
            return {
                'type': 'reduce_category',
                'category': category,
                'percentage': percentage,
                'description': f'Reduce {category} spending by {percentage}%',
            }

        # Pattern 2: "What if I increase [category] spending by [percentage]?"
        pattern2 = r'increase\s+(\w+)\s+spending\s+by\s+(\d+)\s*%'
        match2 = re.search(pattern2, query_lower)
        if match2:
            category = match2.group(1).capitalize()
            percentage = int(match2.group(2))
            return {
                'type': 'increase_category',
                'category': category,
                'percentage': percentage,
                'description': f'Increase {category} spending by {percentage}%',
            }

        # Pattern 3: "What if I reduce overall spending by [percentage]?"
        pattern3 = r'reduce\s+overall\s+spending\s+by\s+(\d+)\s*%|reduce\s+spending\s+by\s+(\d+)\s*%'
        match3 = re.search(pattern3, query_lower)
        if match3:
            percentage = int(match3.group(1) or match3.group(2))
            return {
                'type': 'reduce_overall',
                'percentage': percentage,
                'description': f'Reduce overall spending by {percentage}%',
            }

        # Pattern 4: "What if I save [amount]?"
        pattern4 = r'save\s+(?:₹|\$)?\s*(\d+(?:,\d+)*(?:\.\d+)?)'
        match4 = re.search(pattern4, query_lower)
        if match4:
            amount = float(match4.group(1).replace(',', ''))
            return {
                'type': 'save_amount',
                'amount': amount,
                'description': f'Save ₹{amount:,.0f} monthly',
            }

        # Pattern 5: "How long to save [amount]?"
        pattern5 = r'(?:how long|time)\s+to\s+save\s+(?:₹|\$)?\s*(\d+(?:,\d+)*(?:\.\d+)?)'
        match5 = re.search(pattern5, query_lower)
        if match5:
            amount = float(match5.group(1).replace(',', ''))
            return {
                'type': 'time_to_save',
                'amount': amount,
                'description': f'Time needed to save ₹{amount:,.0f}',
            }

        return None

    def _apply_scenario(
        self,
        current_spending: float,
        transactions: List[Dict[str, Any]],
        scenario: Dict[str, Any],
    ) -> float:
        """Apply scenario to calculate projected spending."""
        scenario_type = scenario['type']

        if scenario_type == 'reduce_category':
            category = scenario['category']
            percentage = scenario['percentage']
            category_spend = sum(t['amount'] for t in transactions
                               if t.get('category') == category and t.get('type') == 'expense')
            reduction = category_spend * (percentage / 100)
            return current_spending - reduction

        elif scenario_type == 'increase_category':
            category = scenario['category']
            percentage = scenario['percentage']
            category_spend = sum(t['amount'] for t in transactions
                               if t.get('category') == category and t.get('type') == 'expense')
            increase = category_spend * (percentage / 100)
            return current_spending + increase

        elif scenario_type == 'reduce_overall':
            percentage = scenario['percentage']
            reduction = current_spending * (percentage / 100)
            return current_spending - reduction

        elif scenario_type == 'save_amount':
            amount = scenario['amount']
            return current_spending - amount

        elif scenario_type == 'time_to_save':
            # Return current spending (used for time calculation)
            return current_spending

        return current_spending

    def _format_time_to_goal(self, months: float) -> str:
        """Format time to goal in readable format."""
        if months < 1:
            weeks = months * 4.33
            return f"{weeks:.0f} weeks"
        elif months < 12:
            return f"{months:.0f} months"
        else:
            years = months / 12
            return f"{years:.1f} years"

    def _invalid_query_response(self, query: str) -> Dict[str, Any]:
        """Return response for invalid query."""
        return {
            'scenario': f'Could not parse: {query}',
            'current_spending': 0.0,
            'projected_spending': 0.0,
            'monthly_savings': 0.0,
            'yearly_savings': 0.0,
            'time_to_goal': 'Invalid query format',
            'investment_potential': 0.0,
        }

    def _error_response(self) -> Dict[str, Any]:
        """Return error response."""
        return {
            'scenario': 'Error processing query',
            'current_spending': 0.0,
            'projected_spending': 0.0,
            'monthly_savings': 0.0,
            'yearly_savings': 0.0,
            'time_to_goal': None,
            'investment_potential': 0.0,
        }

    def generate_scenarios(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate common what-if scenarios."""
        from collections import Counter

        current_spending = sum(t['amount'] for t in transactions if t.get('type') == 'expense')
        categories = [t.get('category', 'Unknown') for t in transactions]
        category_counts = Counter(categories)
        top_categories = [cat for cat, _ in category_counts.most_common(3)]

        scenarios = []

        # Generate scenario for each top category
        for category in top_categories:
            for reduction in [10, 20, 30]:
                scenario_query = f"What if I reduce {category} spending by {reduction}%?"
                scenario = self._parse_query(scenario_query)
                if scenario:
                    projected = self._apply_scenario(current_spending, transactions, scenario)
                    scenarios.append({
                        'description': scenario['description'],
                        'monthly_savings': round(current_spending - projected, 2),
                        'yearly_savings': round((current_spending - projected) * 12, 2),
                    })

        # Overall reduction scenario
        for reduction in [10, 20]:
            scenario_query = f"What if I reduce overall spending by {reduction}%?"
            scenario = self._parse_query(scenario_query)
            if scenario:
                projected = self._apply_scenario(current_spending, transactions, scenario)
                scenarios.append({
                    'description': scenario['description'],
                    'monthly_savings': round(current_spending - projected, 2),
                    'yearly_savings': round((current_spending - projected) * 12, 2),
                })

        return scenarios
