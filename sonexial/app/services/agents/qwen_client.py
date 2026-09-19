"""Qwen client for Together AI API."""
import os
import hashlib
import time
from typing import Optional
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.core.logging import get_logger
from app.models.llm_call import LLMCall
from app.services.agents.cost import CostCalculator

logger = get_logger(__name__)


class QwenClient:
    """Async client for Qwen models via Together AI."""

    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.TOGETHER_API_KEY or "fake-key-for-tests",
            base_url="https://api.together.xyz/v1"
        )
        self.cost_calculator = CostCalculator()

    async def chat_completion(
        self,
        messages: list[dict],
        model: str,
        response_model: type[BaseModel],
        agent_name: str,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[str] = None,
        temperature: float = 0.7,
        max_retries: int = 2,
    ) -> BaseModel:
        """
        Generate a chat completion with structured JSON output.
        
        Validates output against the provided Pydantic model and retries if invalid.
        Logs all calls to the database.
        """
        request_hash = self._hash_request(messages, model)
        
        # Check budget before making call
        monthly_cost = await self.cost_calculator.get_monthly_total()
        if monthly_cost >= settings.LLM_MONTHLY_BUDGET_USD:
            raise BudgetExceededError(
                f"Monthly LLM budget exceeded: ${monthly_cost:.2f} / ${settings.LLM_MONTHLY_BUDGET_USD:.2f}"
            )

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                start_time = time.time()
                
                response = await self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    response_format={"type": "json_object"},
                )
                
                content = response.choices[0].message.content
                input_tokens = response.usage.prompt_tokens
                output_tokens = response.usage.completion_tokens
                
                # Parse and validate response
                try:
                    result = response_model.model_validate_json(content)
                    
                    # Log successful call
                    await self._log_call(
                        agent_name=agent_name,
                        model=model,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        related_entity_type=related_entity_type,
                        related_entity_id=related_entity_id,
                        request_hash=request_hash,
                    )
                    
                    return result
                    
                except (ValidationError, ValueError) as e:
                    last_error = f"Invalid JSON response: {str(e)}"
                    logger.warning(f"Attempt {attempt + 1} failed: {last_error}")
                    if attempt < max_retries:
                        continue
                    raise
                    
            except Exception as e:
                last_error = str(e)
                logger.error(f"Attempt {attempt + 1} failed: {last_error}")
                if attempt < max_retries:
                    continue
                # Log failed call
                await self._log_call(
                    agent_name=agent_name,
                    model=model,
                    input_tokens=0,
                    output_tokens=0,
                    related_entity_type=related_entity_type,
                    related_entity_id=related_entity_id,
                    request_hash=request_hash,
                    error=last_error,
                )
                raise AgentError(f"LLM call failed after {max_retries + 1} attempts: {last_error}")

        raise AgentError(f"LLM call failed: {last_error}")

    async def _log_call(
        self,
        agent_name: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        related_entity_type: Optional[str],
        related_entity_id: Optional[str],
        request_hash: str,
        error: Optional[str] = None,
    ):
        """Log LLM call to database."""
        from sqlmodel import Session, select
        from app.core.db import get_session
        
        estimated_cost = self.cost_calculator.calculate_cost(model, input_tokens, output_tokens)
        
        llm_call = LLMCall(
            agent=agent_name,
            model=model,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated_cost,
            request_hash=request_hash,
            error=error,
        )
        
        async for session in get_session():
            session.add(llm_call)
            await session.commit()
            break

    def _hash_request(self, messages: list[dict], model: str) -> str:
        """Create a hash of the request for deduplication."""
        content = f"{model}:{str(messages)}"
        return hashlib.sha256(content.encode()).hexdigest()


class AgentError(Exception):
    """Raised when an agent operation fails."""
    pass


class BudgetExceededError(Exception):
    """Raised when monthly LLM budget is exceeded."""
    pass
