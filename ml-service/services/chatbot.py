"""AI Chatbot for financial insights."""

import logging
from typing import Optional, Dict, Any, List
import json

logger = logging.getLogger(__name__)


class FinancialChatbot:
    """Financial chatbot for user interactions."""

    INTENT_PATTERNS = {
        'spending': ['how much', 'spent', 'spending', 'expense', 'cost'],
        'saving': ['save', 'saving', 'saved', 'accumulated'],
        'budget': ['budget', 'limit', 'allocation'],
        'advice': ['advice', 'recommend', 'should', 'suggest', 'help'],
        'anomaly': ['unusual', 'strange', 'odd', 'anomaly'],
        'prediction': ['predict', 'forecast', 'future', 'next month'],
        'comparison': ['compare', 'vs', 'than', 'more', 'less'],
    }

    RESPONSES = {
        'greeting': [
            'Hi! I\'m your financial assistant. How can I help you today?',
            'Hello! Let\'s talk about your finances. What would you like to know?',
            'Welcome! I\'m here to help with financial insights.',
        ],
        'spending': [
            'I can help you understand your spending patterns. What category interests you?',
            'Let me analyze your spending data for you.',
        ],
        'saving': [
            'Great! I\'ll help you track your savings goals.',
            'Let\'s work on your savings strategy.',
        ],
        'advice': [
            'Based on your financial data, I\'d suggest:',
            'Here\'s what I recommend for your finances:',
        ],
        'not_found': [
            'I\'m not sure about that. Could you ask differently?',
            'I don\'t have enough information to answer that.',
        ]
    }

    def __init__(self, openai_key: Optional[str] = None):
        """Initialize chatbot."""
        self.openai_key = openai_key
        self.openai_available = openai_key is not None
        if self.openai_available:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=openai_key)
            except Exception as e:
                logger.warning(f"OpenAI not available: {e}")
                self.openai_available = False

    def chat(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Process user message and generate response."""
        try:
            if self.openai_available:
                return self._chat_with_openai(message, context)
            else:
                return self._chat_with_rules(message, context)
        except Exception as e:
            logger.error(f"Error in chatbot: {e}")
            return self._error_response()

    def _chat_with_openai(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Chat using OpenAI."""
        try:
            # Build context for OpenAI
            system_prompt = """You are a helpful financial advisor chatbot.
            Provide practical financial advice based on user's spending patterns.
            Be concise, friendly, and actionable."""

            context_str = ""
            if context:
                context_str = f"""
User's Financial Context:
- Current Spending: ₹{context.get('current_spending', 0):,.0f}
- Monthly Income: ₹{context.get('income', 0):,.0f}
- Savings: ₹{context.get('savings', 0):,.0f}
- Top Categories: {', '.join(context.get('top_categories', []))}
- Financial Health Score: {context.get('health_score', 'Unknown')}/100
"""

            messages = [
                {"role": "system", "content": system_prompt + context_str},
                {"role": "user", "content": message},
            ]

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=500,
                temperature=0.7,
            )

            chatbot_response = response.choices[0].message.content

            # Extract insights if any
            insights = self._extract_insights(chatbot_response, context)

            return {
                'response': chatbot_response,
                'insights': insights,
                'confidence': 0.9,
            }

        except Exception as e:
            logger.error(f"OpenAI error: {e}")
            return self._chat_with_rules(message, context)

    def _chat_with_rules(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Chat using rule-based responses."""
        message_lower = message.lower()

        # Detect intent
        intent = self._detect_intent(message_lower)

        # Generate response
        if 'hello' in message_lower or 'hi' in message_lower:
            response = self._random_response('greeting')
        elif intent == 'spending':
            response = self._handle_spending_query(message_lower, context)
        elif intent == 'advice':
            response = self._handle_advice_query(context)
        elif intent == 'prediction':
            response = self._handle_prediction_query(context)
        else:
            response = self._handle_general_query(message_lower, context)

        insights = self._extract_insights(response, context)

        return {
            'response': response,
            'insights': insights,
            'confidence': 0.6,
        }

    def _detect_intent(self, message: str) -> Optional[str]:
        """Detect user intent."""
        for intent, patterns in self.INTENT_PATTERNS.items():
            if any(pattern in message for pattern in patterns):
                return intent
        return None

    def _handle_spending_query(self, message: str, context: Optional[Dict[str, Any]]) -> str:
        """Handle spending-related queries."""
        if not context:
            return "I need your spending data to provide insights."

        current_spending = context.get('current_spending', 0)
        income = context.get('income', 0)

        if 'category' in message:
            category = message.split('category')[-1].strip()
            return f"Let me analyze your {category} spending patterns for you."

        spending_ratio = (current_spending / income * 100) if income > 0 else 0
        if spending_ratio > 80:
            return f"You're spending {spending_ratio:.0f}% of your income. Consider reducing expenses."
        elif spending_ratio > 50:
            return f"Your spending is at {spending_ratio:.0f}% of income. This is within normal range."
        else:
            return f"Great! You're only spending {spending_ratio:.0f}% of your income."

    def _handle_advice_query(self, context: Optional[Dict[str, Any]]) -> str:
        """Handle advice queries."""
        if not context:
            return "I'd recommend sharing your financial data for personalized advice."

        score = context.get('health_score', 0)
        if score >= 80:
            return "Your finances look great! Keep maintaining this discipline."
        elif score >= 60:
            return "You're doing well, but there's room for improvement in budget discipline."
        else:
            return "I'd recommend reviewing your spending patterns and creating a budget."

    def _handle_prediction_query(self, context: Optional[Dict[str, Any]]) -> str:
        """Handle prediction queries."""
        return "I can predict your future spending patterns. Please provide more transaction history for better accuracy."

    def _handle_general_query(self, message: str, context: Optional[Dict[str, Any]]) -> str:
        """Handle general queries."""
        if context and context.get('top_categories'):
            categories = context.get('top_categories', [])
            return f"Your top spending categories are: {', '.join(categories[:3])}. Would you like to explore any of these?"
        return "I'm here to help with your finances! Ask me about spending, savings, budgets, or financial advice."

    def _extract_insights(
        self,
        response: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[str]:
        """Extract actionable insights from response."""
        insights = []

        if context:
            if context.get('current_spending', 0) > context.get('income', 0) * 0.8:
                insights.append("Your spending is above 80% of income")
            if context.get('savings', 0) < context.get('income', 0) * 0.2:
                insights.append("Consider increasing your savings rate")
            if context.get('health_score', 0) < 70:
                insights.append("Your financial health score needs improvement")

        return insights

    def _random_response(self, category: str) -> str:
        """Get random response from category."""
        import random
        responses = self.RESPONSES.get(category, [])
        return random.choice(responses) if responses else "How can I help?"

    def _error_response(self) -> Dict[str, Any]:
        """Return error response."""
        return {
            'response': 'Sorry, I encountered an error. Please try again.',
            'insights': [],
            'confidence': 0.0,
        }
