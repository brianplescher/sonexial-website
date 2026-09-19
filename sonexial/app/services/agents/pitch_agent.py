"""Pitch Agent - converts scanner reports into cold emails."""
from pydantic import BaseModel

from app.core.config import settings
from app.services.agents.qwen_client import QwenClient


class PitchDraft(BaseModel):
    """Output schema for pitch agent."""
    subject_line: str
    body_text: str
    primary_pain_point: str


class PitchAgent:
    """Generate personalized outreach emails from GEO scan results."""

    SYSTEM_PROMPT = """You are a senior GEO strategist for Sonexial.

Your task is to convert technical website audit data into a short cold email for an indie author.

Rules:
1. Do not use technical jargon such as JSON-LD, schema, DOM, crawl budget, or canonical unless absolutely necessary.
2. Translate technical failures into business pain.
3. Focus on the idea that the author is invisible to AI recommendation engines.
4. Keep the email body under 150 words.
5. Do not use hype, exclamation marks, or fake familiarity.
6. Do not include a signature.
7. Return valid JSON only.
"""

    def __init__(self):
        self.client = QwenClient()

    async def generate(
        self,
        author_url: str,
        score: int,
        critical_failures: list[dict],
        warnings: list[dict],
        opportunities: list[dict],
    ) -> PitchDraft:
        """
        Generate a pitch email from scan results.
        
        Args:
            author_url: Author's website URL
            score: GEO score (0-100)
            critical_failures: List of critical failure objects
            warnings: List of warning objects
            opportunities: List of opportunity objects
            
        Returns:
            PitchDraft with subject, body, and primary pain point
        """
        # Build context from failures
        failure_summary = self._summarize_failures(critical_failures)
        
        prompt = f"""Analyze this author website GEO audit and create a short outreach email.

Website: {author_url}
GEO Score: {score}/100

Critical Issues Found:
{failure_summary}

Write a concise, professional email that:
- Explains why their site is invisible to AI (ChatGPT, Perplexity, Claude)
- Mentions the specific issues without heavy jargon
- Positions Sonexial's solution naturally
- Does NOT include pricing or call-to-action yet

Return JSON with: subject_line, body_text, primary_pain_point"""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        return await self.client.chat_completion(
            messages=messages,
            model=settings.QWEN_PITCH_MODEL,
            response_model=PitchDraft,
            agent_name="pitch_agent",
            related_entity_type="scan",
        )

    def _summarize_failures(self, failures: list[dict]) -> str:
        """Convert failure codes to plain English summary."""
        if not failures:
            return "No critical failures detected."
        
        summaries = []
        for f in failures[:3]:  # Top 3 only
            code = f.get("code", "")
            message = f.get("message", "")
            
            # Translate codes to business impact
            translations = {
                "NO_JSONLD": "Missing structured data that helps AI understand your books",
                "MISSING_LLMS_TXT": "No AI roadmap file guiding crawlers to your content",
                "AI_BOT_BLOCKED": "Actively blocking AI crawlers from reading your site",
                "NO_CANONICAL": "Unclear which pages are authoritative",
                "THIN_CONTENT": "Not enough substantive content for AI to analyze",
            }
            
            business_impact = translations.get(code, message)
            summaries.append(f"- {business_impact}")
        
        return "\n".join(summaries)
