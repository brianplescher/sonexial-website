"""LLM cost calculation and budget tracking."""
from decimal import Decimal
from typing import Optional

from app.core.config import settings


class CostCalculator:
    """Calculate LLM costs based on token usage."""

    # Default prices per 1M tokens (USD)
    DEFAULT_PRICES = {
        "Qwen/Qwen2.5-72B-Instruct-Turbo": {"input": Decimal("0.90"), "output": Decimal("0.90")},
        "Qwen/Qwen2.5-Coder-32B-Instruct": {"input": Decimal("0.80"), "output": Decimal("0.80")},
        "Qwen/Qwen2.5-7B-Instruct-Turbo": {"input": Decimal("0.20"), "output": Decimal("0.20")},
    }

    def __init__(self):
        self.prices = self.DEFAULT_PRICES.copy()

    def calculate_cost(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> Decimal:
        """
        Calculate estimated cost for a single LLM call.
        
        Args:
            model: Model name
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            
        Returns:
            Estimated cost in USD
        """
        price = self.prices.get(model)
        if not price:
            # Fallback to cheapest model pricing
            price = self.prices["Qwen/Qwen2.5-7B-Instruct-Turbo"]
        
        input_cost = (Decimal(input_tokens) / Decimal(1_000_000)) * price["input"]
        output_cost = (Decimal(output_tokens) / Decimal(1_000_000)) * price["output"]
        
        return input_cost + output_cost

    async def get_monthly_total(self) -> Decimal:
        """Get total LLM spending for current month."""
        from sqlmodel import select, func
        from datetime import datetime, timedelta
        from app.core.db import get_session
        from app.models.llm_call import LLMCall
        
        # Calculate first day of current month
        now = datetime.utcnow()
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        async for session in get_session():
            result = await session.execute(
                select(func.sum(LLMCall.estimated_cost_usd)).where(
                    LLMCall.created_at >= first_of_month
                )
            )
            total = result.scalar() or Decimal("0")
            break
        
        return total

    async def check_budget(self) -> tuple[bool, Decimal]:
        """
        Check if budget is exceeded.
        
        Returns:
            Tuple of (is_within_budget, current_spending)
        """
        current = await self.get_monthly_total()
        return current < settings.LLM_MONTHLY_BUDGET_USD, current
