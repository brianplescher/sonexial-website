"""Citation Classifier - detects author citations in AI responses."""
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.agents.qwen_client import QwenClient


class CitationClassification(BaseModel):
    """Output schema for citation classifier."""
    cited: bool = Field(..., description="Whether the author or their books are cited")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0-1")
    matched_text: str | None = Field(None, description="Exact text that matched")


class CitationClassifier:
    """Classify whether AI search responses cite the client author."""

    SYSTEM_PROMPT = """You are a citation classifier.

Given a reader query, an AI engine response, and an author's name and book titles, determine whether the author or their books are cited.

Rules:
1. Return true only if the author or one of their books is clearly mentioned.
2. Do not infer citation from genre similarity alone.
3. Return valid JSON only.
"""

    def __init__(self):
        self.client = QwenClient()

    async def classify(
        self,
        client_name: str,
        book_titles: list[str],
        query: str,
        engine_response: str,
        engine: str = "unknown",
    ) -> CitationClassification:
        """
        Classify whether an AI response cites the client.
        
        Args:
            client_name: Author name or pen name
            book_titles: List of book titles
            query: The reader's query to the AI engine
            engine_response: The AI engine's response text
            engine: Name of the AI engine (Perplexity, ChatGPT, etc.)
            
        Returns:
            CitationClassification with cited flag, confidence, and matched text
        """
        books_list = "\n".join([f"- {title}" for title in book_titles]) or "No books listed"
        
        prompt = f"""Analyze this AI engine response for citations.

Author Name: {client_name}
Book Titles:
{books_list}

Reader Query: {query}

Engine Response:
{engine_response}

Determine:
1. Is the author or any of their books explicitly mentioned?
2. What is your confidence (0.0 to 1.0)?
3. What exact text matches the author or book title?

Return JSON with: cited (boolean), confidence (float 0-1), matched_text (string or null)"""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        return await self.client.chat_completion(
            messages=messages,
            model=settings.QWEN_CLASSIFIER_MODEL,
            response_model=CitationClassification,
            agent_name="citation_classifier",
            related_entity_type="citation_check",
        )
