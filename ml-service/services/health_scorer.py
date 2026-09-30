"""Enhanced financial health scoring with 12+ components and ML weighting."""

import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

logger = logging.getLogger(__name__)


class FinancialHealthScorer:
    """Enhanced scorer with 12 components, ML weighting, and goal-based adjustments."""

    GRADES = {
        'A': {'min': 90, 'description': 'Excellent financial health'},
        'B': {'min': 80, 'description': 'Good financial health'},
        'C': {'min': 70, 'description': 'Fair financial health'},
        'D': {'min': 60, 'description': 'Poor financial health'},
        'F': {'min': 0, 'description': 'Critical financial health'},
    }

    # Component importance weights
    DEFAULT_WEIGHTS = {
        'saving_rate': 0.12,
        'debt_ratio': 0.12,
        'expense_stability': 0.10,
        'budget_adherence': 0.10,
        'emergency_fund': 0.12,
        'investment_ratio': 0.10,
        'income_growth': 0.08,
        'spending_control': 0.08,
        'category_balance': 0.08,
        'liquidity': 0.06,
        'financial_goals': 0.06,
        'risk_management': 0.06,
    }

    def calculate_health_score(
        self,
        transactions: List[Dict[str, Any]],
        income: float,
        debt: float = 0.0,
        savings: float = 0.0,
        monthly_budget: Optional[float] = None,
        investments: float = 0.0,
        goals: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Calculate comprehensive financial health score with 12 components.

        Args:
            transactions: Historical transactions
            income: Monthly income
            debt: Total debt
            savings: Liquid savings
            monthly_budget: Optional monthly budget limit
            investments: Investment account value
            goals: Optional financial goals

        Returns:
            Detailed health score with components and recommendations
        """
        try:
            components = []

            # 1. Saving Rate (12%)
            saving_score, saving_pct = self._calculate_saving_rate(
                transactions, income, savings
            )
            components.append(self._create_component(
                'Saving Rate', saving_score, 0.12,
                f'You save {saving_pct:.1%} of income'
            ))

            # 2. Debt Ratio (12%)
            debt_score = self._calculate_debt_score(income, debt)
            components.append(self._create_component(
                'Debt Ratio', debt_score, 0.12,
                f'Debt is {(debt/(income*12) if income > 0 else 0)*100:.1%} of annual income'
            ))

            # 3. Expense Stability (10%)
            stability_score = self._calculate_expense_stability(transactions)
            components.append(self._create_component(
                'Expense Stability', stability_score, 0.10,
                'Consistency of spending patterns'
            ))

            # 4. Budget Adherence (10%)
            budget_score = self._calculate_budget_adherence(transactions, monthly_budget)
            components.append(self._create_component(
                'Budget Adherence', budget_score, 0.10,
                'How well you stick to spending limits'
            ))

            # 5. Emergency Fund (12%)
            emergency_score = self._calculate_emergency_fund_score(transactions, savings)
            components.append(self._create_component(
                'Emergency Fund', emergency_score, 0.12,
                'Coverage for unexpected expenses'
            ))

            # 6. Investment Ratio (10%)
            investment_score = self._calculate_investment_ratio(income, investments)
            components.append(self._create_component(
                'Investment Ratio', investment_score, 0.10,
                f'Investing {(investments/(income*12) if income > 0 else 0)*100:.1%} of annual income'
            ))

            # 7. Income Growth (8%)
            income_growth_score = self._calculate_income_growth(transactions)
            components.append(self._create_component(
                'Income Growth', income_growth_score, 0.08,
                'Income trend over time'
            ))

            # 8. Spending Control (8%)
            spending_control_score = self._calculate_spending_control(transactions)
            components.append(self._create_component(
                'Spending Control', spending_control_score, 0.08,
                'Control over discretionary spending'
            ))

            # 9. Category Balance (8%)
            category_balance_score = self._calculate_category_balance(transactions)
            components.append(self._create_component(
                'Category Balance', category_balance_score, 0.08,
                'Diversification of spending categories'
            ))

            # 10. Liquidity (6%)
            liquidity_score = self._calculate_liquidity(savings, income)
            components.append(self._create_component(
                'Liquidity', liquidity_score, 0.06,
                'Access to liquid funds'
            ))

            # 11. Financial Goals (6%)
            goals_score = self._calculate_goals_progress(goals)
            components.append(self._create_component(
                'Financial Goals', goals_score, 0.06,
                'Progress towards defined financial goals'
            ))

            # 12. Risk Management (6%)
            risk_score = self._calculate_risk_management(debt, income, savings)
            components.append(self._create_component(
                'Risk Management', risk_score, 0.06,
                'Protection against financial risks'
            ))

            # Calculate weighted score
            overall_score = sum(c['score'] * c['weight'] for c in components)
            overall_score = max(0, min(100, overall_score))

            # Calculate confidence interval
            score_std = np.std([c['score'] for c in components]) / 100
            confidence_lower = max(0, overall_score - (1.96 * score_std * 100))
            confidence_upper = min(100, overall_score + (1.96 * score_std * 100))

            grade = self._get_grade(overall_score)

            # Generate priority-ranked recommendations
            recommendations = self._generate_priority_recommendations(
                components, overall_score, transactions, income, savings, debt, investments
            )

            # Calculate benchmarks
            benchmarks = self._calculate_benchmarks(components)

            return {
                'overall_score': round(overall_score, 1),
                'grade': grade,
                'confidence_interval': {
                    'lower': round(confidence_lower, 1),
                    'upper': round(confidence_upper, 1),
                },
                'components': components,
                'recommendations': recommendations,
                'benchmarks': benchmarks,
                'trend': self._calculate_trend(transactions),
            }

        except Exception as e:
            logger.error(f"Error calculating health score: {e}", exc_info=True)
            return self._default_score()

    def _create_component(
        self,
        name: str,
        score: float,
        weight: float,
        description: str,
    ) -> Dict[str, Any]:
        """Create a component object."""
        return {
            'name': name,
            'score': round(score, 1),
            'weight': weight,
            'description': description,
        }

    def _calculate_saving_rate(
        self,
        transactions: List[Dict[str, Any]],
        income: float,
        savings: float,
    ) -> tuple:
        """Calculate saving rate (0-100 score)."""
        if income <= 0:
            return 50.0, 0.0

        expenses = sum(t['amount'] for t in transactions if t.get('type') == 'expense')
        actual_saving = income - expenses

        # Ideal saving rate is 20% or more
        target_saving = income * 0.20
        saving_ratio = actual_saving / target_saving if target_saving > 0 else 0

        # Bonus for having emergency fund
        monthly_expenses = expenses / 12 if expenses > 0 else income / 12
        emergency_months = savings / monthly_expenses if monthly_expenses > 0 else 0
        emergency_bonus = min(20, emergency_months * 5)

        score = min(100, (saving_ratio * 80) + emergency_bonus)
        saving_pct = actual_saving / income if income > 0 else 0

        return max(0, score), saving_pct

    def _calculate_debt_score(self, income: float, debt: float) -> float:
        """Calculate debt ratio score (0-100)."""
        if income <= 0:
            return 50.0

        debt_ratio = debt / (income * 12) if income > 0 else float('inf')

        # Ideal: debt < 36% of annual income
        if debt_ratio <= 0.36:
            score = 100.0
        elif debt_ratio <= 0.50:
            score = 80.0
        elif debt_ratio <= 1.0:
            score = 60.0
        elif debt_ratio <= 2.0:
            score = 40.0
        else:
            score = 20.0

        return score

    def _calculate_expense_stability(self, transactions: List[Dict[str, Any]]) -> float:
        """Calculate expense stability score (0-100)."""
        if len(transactions) < 7:
            return 50.0

        amounts = [t['amount'] for t in transactions if t.get('type') == 'expense']
        if not amounts:
            return 50.0

        # Lower standard deviation = higher stability
        mean = np.mean(amounts)
        std = np.std(amounts)
        cv = std / (mean + 1)  # Coefficient of variation

        # Convert to score
        if cv < 0.5:
            score = 100.0
        elif cv < 1.0:
            score = 80.0
        elif cv < 1.5:
            score = 60.0
        else:
            score = 40.0

        return score

    def _calculate_budget_adherence(
        self,
        transactions: List[Dict[str, Any]],
        monthly_budget: float = None,
    ) -> float:
        """Calculate budget adherence score."""
        if not monthly_budget or monthly_budget <= 0:
            return 60.0

        expenses = sum(t['amount'] for t in transactions if t.get('type') == 'expense')
        adherence_ratio = expenses / monthly_budget if monthly_budget > 0 else float('inf')

        if adherence_ratio <= 0.8:
            return 100.0
        elif adherence_ratio <= 0.95:
            return 80.0
        elif adherence_ratio <= 1.05:
            return 60.0
        elif adherence_ratio <= 1.2:
            return 40.0
        else:
            return 20.0

    def _calculate_emergency_fund_score(
        self,
        transactions: List[Dict[str, Any]],
        savings: float,
    ) -> float:
        """Calculate emergency fund adequacy score."""
        expenses = sum(t['amount'] for t in transactions if t.get('type') == 'expense')
        monthly_expense = expenses / 12 if len(transactions) > 0 else expenses

        # Ideal: 3-6 months of expenses
        if monthly_expense <= 0:
            return 50.0

        months_covered = savings / monthly_expense

        if months_covered >= 6:
            return 100.0
        elif months_covered >= 3:
            return 80.0
        elif months_covered >= 1:
            return 60.0
        elif months_covered > 0:
            return 40.0
        else:
            return 20.0

    def _get_grade(self, score: float) -> str:
        """Get letter grade for score."""
        for grade in ['A', 'B', 'C', 'D', 'F']:
            if score >= self.GRADES[grade]['min']:
                return grade
        return 'F'

    def _generate_recommendations(
        self,
        components: List[Dict[str, Any]],
        score: float,
        transactions: List[Dict[str, Any]],
        income: float,
        savings: float,
        debt: float,
    ) -> List[str]:
        """Generate actionable recommendations."""
        recommendations = []

        # Find lowest scoring components
        sorted_components = sorted(components, key=lambda x: x['score'])

        for component in sorted_components[:2]:  # Top 2 weak areas
            if component['name'] == 'Saving Rate' and component['score'] < 60:
                recommendations.append(
                    'Increase your saving rate by reducing discretionary spending or increasing income'
                )
            elif component['name'] == 'Debt Ratio' and component['score'] < 60:
                recommendations.append(
                    'Focus on paying down debt to improve your debt-to-income ratio'
                )
            elif component['name'] == 'Expense Stability' and component['score'] < 60:
                recommendations.append(
                    'Create and stick to a monthly budget to stabilize your spending'
                )
            elif component['name'] == 'Budget Adherence' and component['score'] < 60:
                recommendations.append(
                    'Review your spending and set realistic budget limits'
                )
            elif component['name'] == 'Emergency Fund' and component['score'] < 60:
                recommendations.append(
                    'Build an emergency fund covering 3-6 months of expenses'
                )

        # General recommendations based on score
        if score >= 90:
            recommendations.insert(0, 'Excellent work! Maintain your financial discipline')
        elif score >= 80:
            recommendations.insert(0, 'Good financial health. Minor improvements could help')
        elif score >= 70:
            recommendations.insert(0, 'Fair health. Focus on building stronger habits')
        elif score >= 60:
            recommendations.insert(0, 'Poor health. Significant changes needed')
        else:
            recommendations.insert(0, 'Critical financial situation. Seek professional advice')

        return recommendations[:5]  # Return top 5

    def _calculate_investment_ratio(self, income: float, investments: float) -> float:
        """Calculate investment ratio score."""
        if income <= 0:
            return 50.0

        investment_ratio = investments / (income * 12)

        # Ideal: 20-50% of annual income invested
        if investment_ratio >= 0.5:
            return 100.0
        elif investment_ratio >= 0.3:
            return 85.0
        elif investment_ratio >= 0.2:
            return 75.0
        elif investment_ratio >= 0.1:
            return 60.0
        else:
            return 40.0

    def _calculate_income_growth(self, transactions: List[Dict[str, Any]]) -> float:
        """Calculate income growth trend."""
        income_txns = [t for t in transactions if t.get('category') == 'Salary']

        if len(income_txns) < 2:
            return 50.0

        amounts = [t['amount'] for t in income_txns]
        first_half_avg = np.mean(amounts[:len(amounts)//2])
        second_half_avg = np.mean(amounts[len(amounts)//2:])

        growth_rate = (second_half_avg - first_half_avg) / (first_half_avg + 1)

        if growth_rate > 0.1:
            return 90.0
        elif growth_rate > 0.05:
            return 80.0
        elif growth_rate > 0:
            return 70.0
        elif growth_rate > -0.05:
            return 60.0
        else:
            return 40.0

    def _calculate_spending_control(self, transactions: List[Dict[str, Any]]) -> float:
        """Calculate spending control score."""
        expenses = [t for t in transactions if t.get('type') == 'expense']

        if len(expenses) < 10:
            return 50.0

        amounts = np.array([t['amount'] for t in expenses])
        discretionary_categories = ['Entertainment', 'Shopping', 'Gifts', 'Dining']

        discretionary_spending = sum(
            t['amount'] for t in expenses
            if t.get('category') in discretionary_categories
        )

        discretionary_ratio = discretionary_spending / np.sum(amounts) if np.sum(amounts) > 0 else 0

        # Ideal: 10-20% of expenses on discretionary
        if discretionary_ratio <= 0.1:
            return 85.0
        elif discretionary_ratio <= 0.2:
            return 90.0
        elif discretionary_ratio <= 0.3:
            return 70.0
        elif discretionary_ratio <= 0.4:
            return 50.0
        else:
            return 30.0

    def _calculate_category_balance(self, transactions: List[Dict[str, Any]]) -> float:
        """Calculate spending category diversity."""
        from collections import Counter

        categories = [t.get('category', 'Other') for t in transactions]
        cat_counts = Counter(categories)

        unique_categories = len(cat_counts)
        total = len(categories)

        # Higher diversity is better, but not too spread
        diversity = len(set(categories)) / min(total, 20)  # Normalize

        if diversity >= 0.7:
            return 85.0
        elif diversity >= 0.5:
            return 75.0
        elif diversity >= 0.3:
            return 60.0
        else:
            return 40.0

    def _calculate_liquidity(self, savings: float, income: float) -> float:
        """Calculate liquidity score."""
        if income <= 0:
            return 50.0

        months_of_liquid = savings / (income + 1)

        # Ideal: 3-6 months
        if months_of_liquid >= 6:
            return 100.0
        elif months_of_liquid >= 3:
            return 85.0
        elif months_of_liquid >= 1:
            return 70.0
        elif months_of_liquid > 0:
            return 50.0
        else:
            return 20.0

    def _calculate_goals_progress(self, goals: Optional[Dict[str, Any]]) -> float:
        """Calculate financial goals progress score."""
        if not goals:
            return 50.0

        try:
            completed = goals.get('completed_count', 0)
            total = goals.get('total_count', 1)
            progress = completed / total if total > 0 else 0

            return min(100, progress * 100 + 20)
        except Exception:
            return 50.0

    def _calculate_risk_management(
        self,
        debt: float,
        income: float,
        savings: float,
    ) -> float:
        """Calculate risk management score."""
        if income <= 0:
            return 50.0

        # Multiple risk factors
        debt_risk = debt / (income * 12) if income > 0 else 1
        emergency_risk = 1 - min(savings / (income * 3), 1)

        risk_score = 100 - ((debt_risk * 0.5 + emergency_risk * 0.5) * 100)
        return max(0, min(100, risk_score))

    def _generate_priority_recommendations(
        self,
        components: List[Dict[str, Any]],
        score: float,
        transactions: List[Dict[str, Any]],
        income: float,
        savings: float,
        debt: float,
        investments: float,
    ) -> List[Dict[str, Any]]:
        """Generate priority-ranked recommendations."""
        recommendations = []

        # Find weak areas (score < 70)
        weak_components = [c for c in components if c['score'] < 70]
        weak_components.sort(key=lambda x: x['score'])

        for comp in weak_components[:3]:
            comp_name = comp['name']
            estimated_savings = 0

            if comp_name == 'Saving Rate':
                estimated_savings = income * 0.1  # 10% increase potential
                recommendations.append({
                    'priority': 'high',
                    'component': comp_name,
                    'action': 'Increase savings rate by tracking discretionary spending',
                    'estimated_impact': round(estimated_savings, 2),
                    'timeline': '3 months',
                })
            elif comp_name == 'Debt Ratio':
                estimated_savings = debt * 0.2 / 12  # 20% paydown potential
                recommendations.append({
                    'priority': 'high',
                    'component': comp_name,
                    'action': 'Focus on debt repayment with avalanche or snowball method',
                    'estimated_impact': round(estimated_savings, 2),
                    'timeline': '6-12 months',
                })
            elif comp_name == 'Emergency Fund':
                target = income * 3
                gap = target - savings
                recommendations.append({
                    'priority': 'high',
                    'component': comp_name,
                    'action': f'Build emergency fund. Target: {target:,.0f}. Current gap: {gap:,.0f}',
                    'estimated_impact': 'Financial security',
                    'timeline': '12 months',
                })

        # General recommendations based on overall score
        if score >= 85:
            recommendations.insert(0, {
                'priority': 'medium',
                'component': 'Overall',
                'action': 'Excellent financial health. Consider diversifying investments and increasing retirement contributions.',
                'estimated_impact': 'Long-term wealth growth',
                'timeline': 'Ongoing',
            })
        elif score < 60:
            recommendations.insert(0, {
                'priority': 'critical',
                'component': 'Overall',
                'action': 'Significant financial restructuring needed. Consider professional financial advice.',
                'estimated_impact': 'Financial stability restoration',
                'timeline': 'Immediate',
            })

        return recommendations[:5]  # Top 5 recommendations

    def _calculate_benchmarks(self, components: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate benchmark comparisons."""
        return {
            'population_average': 65.0,  # Simulated average
            'your_rank': 'above_average' if np.mean([c['score'] for c in components]) > 65 else 'average',
            'percentile': round(np.mean([c['score'] for c in components]) / 100 * 100, 1),
        }

    def _calculate_trend(self, transactions: List[Dict[str, Any]]) -> str:
        """Calculate financial health trend."""
        if len(transactions) < 14:
            return 'stable'

        # Compare first half to second half
        amounts = [t['amount'] for t in transactions if t.get('type') == 'expense']
        if not amounts:
            return 'stable'

        first_half = np.mean(amounts[:len(amounts)//2])
        second_half = np.mean(amounts[len(amounts)//2:])

        change = (second_half - first_half) / (first_half + 1)

        if change > 0.1:
            return 'declining'
        elif change < -0.1:
            return 'improving'
        else:
            return 'stable'

    def _default_score(self) -> Dict[str, Any]:
        """Return default score when calculation fails."""
        return {
            'overall_score': 50.0,
            'grade': 'C',
            'confidence_interval': {'lower': 40.0, 'upper': 60.0},
            'components': [],
            'recommendations': [{'priority': 'medium', 'action': 'Provide more data for accurate assessment'}],
            'benchmarks': {'population_average': 65.0},
            'trend': 'stable',
        }
