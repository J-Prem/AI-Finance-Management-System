"""Synthetic data generation for training and testing."""

import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
import numpy as np
from faker import Faker
import logging

logger = logging.getLogger(__name__)


class FinancialDataGenerator:
    """Generate realistic synthetic financial transaction data."""

    # Indian merchants and common merchants in India
    MERCHANTS = {
        'Food': [
            'Swiggy', 'Zomato', 'Uber Eats', 'Dominos', 'McDonalds',
            'Starbucks', 'Cafe Coffee Day', 'PizzaHut', 'ChickenChef',
            'Local Restaurant', 'Biryani House', 'South Indian Restaurant',
        ],
        'Groceries': [
            'Big Basket', 'Flipkart Grocery', 'Amazon Fresh', 'Blinkit',
            'DMart', 'Big Bazaar', 'Reliance Fresh', 'Supermarket',
            'Local Grocery Store', 'Milk Booth',
        ],
        'Transport': [
            'Uber', 'Ola', 'Rapido', 'Metro', 'Bus Service',
            'Railway Station', 'Petrol Pump', 'Parking', 'Toll Plaza',
            'Auto Rickshaw', 'Cab Service',
        ],
        'Shopping': [
            'Flipkart', 'Amazon', 'Myntra', 'Nike Store', 'Adidas Store',
            'H&M', 'Zara', 'Gap', 'Fashion Store', 'Clothing Shop',
            'Westside', 'Max Fashion', 'Forever 21',
        ],
        'Entertainment': [
            'Netflix', 'Amazon Prime', 'Disney+', 'Hotstar', 'BookMyShow',
            'PVR Cinema', 'INOX', 'Gaming Console', 'Arcade', 'Music App',
            'Spotify', 'YouTube Premium',
        ],
        'Bills': [
            'Electricity Board', 'Water Supply', 'Gas Supply', 'Internet Provider',
            'Mobile Operator', 'Insurance Company', 'Bank', 'Credit Card Payment',
        ],
        'Healthcare': [
            'Apollo Hospital', 'Max Hospital', 'Fortis Hospital', 'Pharmacy',
            'Medical Store', 'Doctor', 'Clinic', 'Diagnostic Center',
            'Dental Clinic', 'General Practitioner',
        ],
        'Education': [
            'School', 'College', 'University', 'Online Course', 'Skill Academy',
            'BYJU\'S', 'Unacademy', 'Coursera', 'Udemy', 'Coaching Center',
        ],
        'Travel': [
            'MakeMyTrip', 'Cleartrip', 'GoIbibo', 'OYO Rooms', 'Airbnb',
            'Hotel', 'Flight Booking', 'Train Booking', 'Tour Package',
            'Resort', 'Guest House',
        ],
        'Subscriptions': [
            'Apple Subscription', 'Google Play', 'Microsoft Subscription',
            'Software License', 'Cloud Storage', 'App Subscription',
        ],
    }

    CATEGORIES = list(MERCHANTS.keys()) + ['Salary', 'Investment', 'Freelance', 'Rent', 'Gifts', 'Other']

    def __init__(self, seed: int = 42):
        """Initialize data generator."""
        self.fake = Faker('en_IN')
        random.seed(seed)
        np.random.seed(seed)

    def generate_transactions(
        self,
        num_transactions: int = 50000,
        days: int = 730,  # 2 years for realistic patterns
        start_date: datetime = None,
        user_profile: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Generate realistic synthetic transactions with patterns.

        Args:
            num_transactions: Number of transactions to generate
            days: Time span in days
            start_date: Starting date (default: 2 years ago)
            user_profile: User profile type (student, professional, family, etc.)
        """
        if start_date is None:
            start_date = datetime.now() - timedelta(days=days)

        transactions = []

        # Profile-based configuration
        profile_config = self._get_profile_config(user_profile)
        salary_amount = profile_config['salary']
        salary_day = profile_config['salary_day']
        category_weights = profile_config['category_weights']

        # Generate subscriptions based on profile
        subscriptions = self._generate_subscriptions(user_profile)

        # Track salary additions to avoid duplicates
        salary_dates = set()

        # Generate transactions with realistic distribution
        current_date = start_date
        while len(transactions) < num_transactions and current_date <= datetime.now():
            # Add salary on payday
            salary_key = (current_date.year, current_date.month, salary_day)
            if current_date.day == salary_day and salary_key not in salary_dates:
                transactions.append({
                    'transaction_id': f"TXN{len(transactions):08d}",
                    'amount': round(salary_amount + np.random.normal(0, salary_amount * 0.02), 2),
                    'description': 'Monthly Salary Deposit',
                    'category': 'Salary',
                    'merchant': 'Employer',
                    'timestamp': current_date,
                    'type': 'income',
                })
                salary_dates.add(salary_key)

            # Add recurring subscriptions
            for sub in subscriptions:
                if self._should_add_subscription(current_date, sub):
                    transactions.append({
                        'transaction_id': f"TXN{len(transactions):08d}",
                        'amount': round(sub['amount'] + np.random.normal(0, sub['amount'] * 0.01), 2),
                        'description': f"{sub['name']} Subscription",
                        'category': 'Subscriptions',
                        'merchant': sub['name'],
                        'timestamp': current_date,
                        'type': 'expense',
                    })

            # Add 1-3 regular transactions on most days
            if random.random() < 0.8:  # 80% days have transactions
                num_daily_txns = np.random.choice([1, 2, 3], p=[0.5, 0.35, 0.15])

                for _ in range(num_daily_txns):
                    if len(transactions) >= num_transactions:
                        break

                    # Select category based on profile
                    category = np.random.choice(
                        list(category_weights.keys()),
                        p=list(category_weights.values())
                    )

                    amount = self._generate_amount(category)
                    merchant = random.choice(self.MERCHANTS.get(category, ['Other']))

                    # Add time variation
                    hour = self._get_realistic_hour(category)
                    transaction_time = current_date.replace(hour=hour, minute=random.randint(0, 59))

                    transactions.append({
                        'transaction_id': f"TXN{len(transactions):08d}",
                        'amount': round(amount, 2),
                        'description': f"Purchase at {merchant}",
                        'category': category,
                        'merchant': merchant,
                        'timestamp': transaction_time,
                        'type': 'expense',
                    })

            # Occasional large purchases (electronics, furniture)
            if random.random() < 0.02:  # 2% chance per day
                large_category = random.choice(['Shopping', 'Electronics', 'Home'])
                amount = np.random.lognormal(mean=np.log(20000), sigma=0.8)
                merchant = random.choice(self.MERCHANTS.get('Shopping', ['Amazon', 'Flipkart']))

                transactions.append({
                    'transaction_id': f"TXN{len(transactions):08d}",
                    'amount': round(amount, 2),
                    'description': f"Large purchase at {merchant}",
                    'category': large_category,
                    'merchant': merchant,
                    'timestamp': current_date,
                    'type': 'expense',
                })

            current_date += timedelta(days=1)

        # Sort by timestamp and return
        transactions.sort(key=lambda x: x['timestamp'])
        return transactions[:num_transactions]

    def _get_profile_config(self, profile: Optional[str] = None) -> Dict[str, Any]:
        """Get configuration for user profile."""
        configs = {
            'student': {
                'salary': 0,
                'salary_day': 1,
                'category_weights': {
                    'Food': 0.35, 'Transport': 0.15, 'Entertainment': 0.20,
                    'Shopping': 0.15, 'Groceries': 0.10, 'Other': 0.05
                }
            },
            'professional': {
                'salary': 100000,
                'salary_day': 5,
                'category_weights': {
                    'Food': 0.20, 'Transport': 0.10, 'Shopping': 0.20,
                    'Entertainment': 0.15, 'Groceries': 0.15, 'Bills': 0.10,
                    'Healthcare': 0.05, 'Other': 0.05
                }
            },
            'family': {
                'salary': 150000,
                'salary_day': 1,
                'category_weights': {
                    'Food': 0.20, 'Groceries': 0.25, 'Healthcare': 0.10,
                    'Education': 0.15, 'Shopping': 0.15, 'Transport': 0.10,
                    'Utilities': 0.05
                }
            },
            'business_owner': {
                'salary': 200000,
                'salary_day': 10,
                'category_weights': {
                    'Food': 0.15, 'Transport': 0.10, 'Shopping': 0.20,
                    'Travel': 0.15, 'Entertainment': 0.15, 'Bills': 0.15,
                    'Other': 0.10
                }
            },
            'retiree': {
                'salary': 50000,
                'salary_day': 1,
                'category_weights': {
                    'Food': 0.25, 'Healthcare': 0.20, 'Groceries': 0.20,
                    'Transport': 0.10, 'Entertainment': 0.15, 'Other': 0.10
                }
            },
            'freelancer': {
                'salary': 120000,
                'salary_day': 15,
                'category_weights': {
                    'Food': 0.25, 'Transport': 0.10, 'Shopping': 0.20,
                    'Entertainment': 0.15, 'Subscriptions': 0.10, 'Other': 0.20
                }
            }
        }

        if profile and profile in configs:
            return configs[profile]
        return configs['professional']  # Default

    def _get_realistic_hour(self, category: str) -> int:
        """Get realistic hour for transaction based on category."""
        hour_ranges = {
            'Food': (7, 22),  # Throughout day, more breakfast/lunch/dinner
            'Groceries': (8, 20),
            'Transport': (6, 23),
            'Shopping': (10, 21),
            'Entertainment': (15, 23),
            'Healthcare': (8, 18),
            'Subscriptions': (0, 23),  # Any time
        }

        start, end = hour_ranges.get(category, (8, 20))
        return random.randint(start, end)

    def _generate_amount(self, category: str) -> float:
        """Generate realistic amount for category."""
        ranges = {
            'Food': (200, 2000),
            'Groceries': (500, 5000),
            'Transport': (50, 500),
            'Shopping': (500, 10000),
            'Entertainment': (100, 5000),
            'Healthcare': (200, 20000),
            'Bills': (500, 5000),
            'Education': (500, 50000),
            'Travel': (1000, 100000),
            'Subscriptions': (99, 999),
            'Rent': (10000, 50000),
            'Gifts': (500, 5000),
            'Other': (100, 2000),
            'Salary': (50000, 200000),
            'Investment': (1000, 100000),
            'Freelance': (5000, 50000),
        }

        min_amt, max_amt = ranges.get(category, (100, 5000))
        return round(np.random.lognormal(
            mean=np.log((min_amt + max_amt) / 2),
            sigma=0.5
        ), 2)

    def _generate_subscriptions(self, profile: Optional[str] = None) -> List[Dict[str, Any]]:
        """Generate subscription services based on profile."""
        all_subs = [
            {'name': 'Netflix', 'amount': 199, 'frequency': 'monthly'},
            {'name': 'Amazon Prime', 'amount': 1499, 'frequency': 'yearly'},
            {'name': 'Spotify', 'amount': 119, 'frequency': 'monthly'},
            {'name': 'Gym Membership', 'amount': 3000, 'frequency': 'monthly'},
            {'name': 'Cloud Storage', 'amount': 99, 'frequency': 'monthly'},
            {'name': 'Apple Music', 'amount': 99, 'frequency': 'monthly'},
            {'name': 'Disney+', 'amount': 99, 'frequency': 'monthly'},
            {'name': 'Hotstar', 'amount': 99, 'frequency': 'monthly'},
            {'name': 'YouTube Premium', 'amount': 139, 'frequency': 'monthly'},
            {'name': 'LinkedIn Premium', 'amount': 649, 'frequency': 'monthly'},
        ]

        # Select subscriptions based on profile
        if profile == 'student':
            return random.sample(all_subs[:5], k=random.randint(2, 3))
        elif profile == 'professional':
            return random.sample(all_subs, k=random.randint(4, 6))
        elif profile == 'family':
            return random.sample(all_subs[:5], k=random.randint(3, 4))
        else:
            return random.sample(all_subs, k=random.randint(3, 5))

    def _should_add_subscription(self, date: datetime, subscription: Dict[str, Any]) -> bool:
        """Check if subscription should be added on this date."""
        if subscription['frequency'] == 'monthly':
            return date.day in [1, 15]  # On 1st and 15th
        elif subscription['frequency'] == 'yearly':
            return date.month == date.month and date.day == 1
        return False

    def generate_users_with_profiles(
        self,
        num_users: int = 100,
        transactions_per_user: int = 200,
    ) -> List[Dict[str, Any]]:
        """Generate users with different spending profiles."""
        users = []

        # Define spending profiles
        profiles = [
            {
                'name': 'Student',
                'spending_scale': 0.3,
                'category_weights': {'Food': 0.3, 'Transport': 0.15, 'Entertainment': 0.2, 'Shopping': 0.15, 'Other': 0.2},
            },
            {
                'name': 'Professional',
                'spending_scale': 1.0,
                'category_weights': {'Food': 0.2, 'Transport': 0.1, 'Shopping': 0.2, 'Healthcare': 0.1, 'Entertainment': 0.15, 'Bills': 0.15, 'Other': 0.1},
            },
            {
                'name': 'Family',
                'spending_scale': 1.5,
                'category_weights': {'Food': 0.2, 'Groceries': 0.2, 'Healthcare': 0.15, 'Education': 0.15, 'Shopping': 0.15, 'Transport': 0.1, 'Other': 0.05},
            },
            {
                'name': 'Investor',
                'spending_scale': 0.8,
                'category_weights': {'Investment': 0.4, 'Transport': 0.1, 'Food': 0.2, 'Entertainment': 0.15, 'Other': 0.15},
            },
        ]

        for i in range(num_users):
            profile = profiles[i % len(profiles)]
            user_transactions = self.generate_transactions(
                num_transactions=transactions_per_user,
            )

            users.append({
                'user_id': f"USER{i:06d}",
                'profile': profile['name'],
                'transactions': user_transactions,
                'metadata': {
                    'spending_scale': profile['spending_scale'],
                    'category_weights': profile['category_weights'],
                }
            })

        return users


def generate_sample_data_for_training(
    output_file: str = None,
) -> List[Dict[str, Any]]:
    """Generate sample training data."""
    generator = FinancialDataGenerator()
    transactions = generator.generate_transactions(num_transactions=5000, days=365)

    if output_file:
        import json
        with open(output_file, 'w') as f:
            json.dump(
                transactions,
                f,
                default=str,
                indent=2,
            )

    return transactions
