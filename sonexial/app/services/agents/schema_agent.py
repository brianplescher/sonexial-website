"""Schema Agent - generates JSON-LD and llms.txt content."""
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.agents.qwen_client import QwenClient


class SchemaOutput(BaseModel):
    """Output schema for schema agent."""
    person_jsonld: dict = Field(..., description="JSON-LD Person schema")
    book_jsonld_list: list[dict] = Field(default_factory=list, description="List of JSON-LD Book schemas")
    llms_txt: str = Field(..., description="Plain text llms.txt file content")


class SchemaAgent:
    """Generate JSON-LD structured data and AI roadmap files."""

    SYSTEM_PROMPT = """You are a schema.org and GEO specialist.

Your task is to generate valid JSON-LD and llms.txt content for an author website.

Rules:
1. Use only supplied data.
2. Do not invent URLs, identifiers, awards, or dates.
3. Generate schema.org Person and Book structured data.
4. Include sameAs links only when supplied.
5. Generate a concise llms.txt file that summarizes the author, books, and canonical pages.
6. Return valid JSON only.
"""

    def __init__(self):
        self.client = QwenClient()

    async def generate(
        self,
        author_name: str,
        pen_name: str | None,
        email: str,
        primary_genre: str,
        books: list[dict],
        same_as_links: list[str],
        site_url: str,
        headshot_url: str | None = None,
    ) -> SchemaOutput:
        """
        Generate JSON-LD schemas and llms.txt content.
        
        Args:
            author_name: Author's name
            pen_name: Pen name if applicable
            email: Contact email
            primary_genre: Main genre
            books: List of book data with titles, ASIN/ISBN, etc.
            same_as_links: List of social/profile URLs (Amazon, Goodreads, etc.)
            site_url: Canonical site URL
            headshot_url: URL to author headshot
            
        Returns:
            SchemaOutput with Person JSON-LD, Book JSON-LD list, and llms.txt content
        """
        # Format books for prompt
        books_data = []
        for b in books:
            books_data.append({
                "title": b.get("title", ""),
                "asin_or_isbn": b.get("asin_or_isbn", ""),
                "publication_date": b.get("publication_date", ""),
                "short_blurb": b.get("short_blurb", ""),
            })
        
        prompt = f"""Generate structured data for this author website:

Author Name: {author_name}
Pen Name: {pen_name or 'Same as legal name'}
Email: {email}
Primary Genre: {primary_genre}
Site URL: {site_url}
Headshot URL: {headshot_url or 'Not provided'}
Social/Profile Links: {', '.join(same_as_links) if same_as_links else 'None'}

Books Data:
{books_data}

Generate:
1. Valid JSON-LD Person schema including:
   - @type: Person
   - name (use pen_name if different)
   - email
   - sameAs links (only those provided)
   - image (headshot if available)

2. JSON-LD Book schema for each book including:
   - @type: Book
   - name (title)
   - author (reference to Person)
   - isbn or additionalProperty for ASIN
   - datePublished (if available)
   - description (short_blurb)

3. Plain text llms.txt file containing:
   - Author name and genres
   - List of books with canonical URLs
   - Key page URLs (About, Books, Q&A, Contact)
   - Keep it concise and machine-readable

Return valid JSON matching the schema exactly."""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        return await self.client.chat_completion(
            messages=messages,
            model=settings.QWEN_SCHEMA_MODEL,
            response_model=SchemaOutput,
            agent_name="schema_agent",
            related_entity_type="onboarding",
        )

    @staticmethod
    def format_jsonld_script(jsonld_data: dict) -> str:
        """Format JSON-LD data as a script tag for HTML insertion."""
        import json
        return f'<script type="application/ld+json">\n{json.dumps(jsonld_data, indent=2)}\n</script>'
