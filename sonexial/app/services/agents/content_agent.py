"""Content Agent - generates author content from intake data."""
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.agents.qwen_client import QwenClient


class BookSummary(BaseModel):
    """Summary of a single book."""
    title: str
    short_blurb: str
    genres: list[str] = Field(default_factory=list)


class ReaderQA(BaseModel):
    """Q&A pair for reader questions."""
    question: str
    answer: str


class AuthorContentPack(BaseModel):
    """Output schema for content agent."""
    semantic_bio: str = Field(..., description="Third-person author biography optimized for AI discovery")
    reader_qa: list[ReaderQA] = Field(default_factory=list, description="Common reader questions with answers")
    book_summaries: list[BookSummary] = Field(default_factory=list, description="Book summaries with genre tags")
    author_entity_summary: str = Field(..., description="Concise entity summary connecting author to genres and comparables")


class ContentAgent:
    """Generate citation-ready author content from intake data."""

    SYSTEM_PROMPT = """You are an expert author content strategist specializing in Generative Engine Optimization.

Your task is to convert raw author intake data into clear, factual, machine-readable website content.

Rules:
1. Use supplied data only.
2. Do not invent awards, sales numbers, reviews, testimonials, or book titles.
3. Write in clear declarative sentences.
4. Prefer fact density over marketing hype.
5. Explicitly connect the author to their genres and comparable authors when supplied.
6. Return valid JSON only.
"""

    def __init__(self):
        self.client = QwenClient()

    async def generate(
        self,
        author_name: str,
        pen_name: str | None,
        primary_genre: str,
        secondary_genres: list[str],
        comparable_authors: list[str],
        target_reader: str,
        books: list[dict],
        raw_bio: str,
    ) -> AuthorContentPack:
        """
        Generate author content pack from intake data.
        
        Args:
            author_name: Legal name
            pen_name: Pen name if applicable
            primary_genre: Main genre
            secondary_genres: Additional genres
            comparable_authors: Similar authors for positioning
            target_reader: Target audience description
            books: List of book data
            raw_bio: Raw biographical information
            
        Returns:
            AuthorContentPack with bio, Q&A, book summaries, and entity summary
        """
        # Format books for prompt
        books_text = "\n".join([
            f"- {b.get('title', 'Unknown')}: {b.get('short_blurb', 'No description')}"
            for b in books
        ]) or "No books provided"
        
        comparables_text = ", ".join(comparable_authors) if comparable_authors else "None provided"
        
        prompt = f"""Create website content for this author:

Author: {author_name}
Pen Name: {pen_name or 'Same as legal name'}
Primary Genre: {primary_genre}
Secondary Genres: {', '.join(secondary_genres) if secondary_genres else 'None'}
Comparable Authors: {comparables_text}
Target Reader: {target_reader}

Books:
{books_text}

Raw Bio:
{raw_bio}

Generate:
1. A 150-200 word third-person biography optimized for AI discovery
2. 3-5 reader Q&A pairs (questions readers actually ask)
3. One-sentence summaries for each book with genre tags
4. A 50-word entity summary connecting the author to their genre and comparables

Return valid JSON matching the schema."""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        return await self.client.chat_completion(
            messages=messages,
            model=settings.QWEN_CONTENT_MODEL,
            response_model=AuthorContentPack,
            agent_name="content_agent",
            related_entity_type="onboarding",
        )
