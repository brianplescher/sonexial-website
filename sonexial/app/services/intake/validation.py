"""Intake data validation."""
from typing import Any
from pydantic import BaseModel, EmailStr, Field

from app.core.logging import get_logger

logger = get_logger(__name__)


class BookData(BaseModel):
    """Book information from intake."""
    title: str
    asin_or_isbn: str | None = None
    publication_date: str | None = None
    format: str | None = None
    cover_image: str | None = None
    short_blurb: str | None = None


class IntakeData(BaseModel):
    """Complete intake form data."""
    author_name: str
    pen_name: str | None = None
    email: EmailStr
    primary_genre: str
    secondary_genres: list[str] = Field(default_factory=list)
    comparable_authors: list[str] = Field(default_factory=list)
    target_reader: str
    books: list[BookData] = Field(default_factory=list)
    raw_bio: str
    amazon_author_page: str | None = None
    goodreads_url: str | None = None
    bookbub_url: str | None = None
    newsletter_url: str | None = None
    social_links: list[str] = Field(default_factory=list)
    headshot: str | None = None
    book_covers: list[str] = Field(default_factory=list)


class ValidationResult(BaseModel):
    """Result of intake validation."""
    is_valid: bool
    missing_fields: list[str] = Field(default_factory=list)
    validation_errors: list[str] = Field(default_factory=list)
    validated_data: IntakeData | None = None


class IntakeValidator:
    """Validate and process intake form submissions."""

    REQUIRED_FIELDS = [
        "author_name",
        "email",
        "primary_genre",
        "target_reader",
        "raw_bio",
    ]

    def __init__(self):
        pass

    async def validate(self, data: dict[str, Any]) -> ValidationResult:
        """
        Validate intake data.
        
        Args:
            data: Raw intake form data
            
        Returns:
            ValidationResult with validation status and details
        """
        missing = self._check_required_fields(data)
        errors = []
        
        # Check email format
        if "email" in data:
            try:
                EmailStr.validate(data["email"])
            except (ValueError, AttributeError):
                errors.append("Invalid email format")
        
        # Validate books if present
        if "books" in data and isinstance(data["books"], list):
            for i, book in enumerate(data["books"]):
                if not book.get("title"):
                    errors.append(f"Book {i + 1} missing title")
        
        # Try to parse into model
        validated_data = None
        if not missing and not errors:
            try:
                validated_data = IntakeData(**data)
            except Exception as e:
                errors.append(f"Data parsing failed: {str(e)}")
        
        return ValidationResult(
            is_valid=len(missing) == 0 and len(errors) == 0,
            missing_fields=missing,
            validation_errors=errors,
            validated_data=validated_data,
        )

    def _check_required_fields(self, data: dict[str, Any]) -> list[str]:
        """Check for missing required fields."""
        missing = []
        for field in self.REQUIRED_FIELDS:
            if field not in data or not data[field]:
                missing.append(field)
        return missing

    def get_missing_assets(self, data: dict[str, Any]) -> list[str]:
        """Identify missing asset uploads."""
        missing = []
        
        if not data.get("headshot"):
            missing.append("headshot")
        
        books = data.get("books", [])
        for i, book in enumerate(books):
            if not book.get("cover_image"):
                missing.append(f"book_{i}_cover")
        
        return missing
