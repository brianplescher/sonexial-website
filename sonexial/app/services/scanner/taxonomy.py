"""Sonexial Scanner - Failure Taxonomy."""
from enum import Enum
from typing import Dict


class FailureCode(str, Enum):
    """Standardized failure codes for GEO scans."""
    
    SITE_UNREACHABLE = "SITE_UNREACHABLE"
    SSRF_BLOCKED = "SSRF_BLOCKED"
    NO_JSONLD = "NO_JSONLD"
    MALFORMED_JSONLD = "MALFORMED_JSONLD"
    MISSING_PERSON_SCHEMA = "MISSING_PERSON_SCHEMA"
    MISSING_BOOK_SCHEMA = "MISSING_BOOK_SCHEMA"
    MISSING_SAMEAS = "MISSING_SAMEAS"
    NO_LLMS_TXT = "NO_LLMS_TXT"
    WEAK_LLMS_TXT = "WEAK_LLMS_TXT"
    NO_ROBOTS_TXT = "NO_ROBOTS_TXT"
    AI_BOT_BLOCKED = "AI_BOT_BLOCKED"
    NO_CANONICAL = "NO_CANONICAL"
    CANONICAL_MISMATCH = "CANONICAL_MISMATCH"
    MULTIPLE_H1 = "MULTIPLE_H1"
    NO_H1 = "NO_H1"
    THIN_CONTENT = "THIN_CONTENT"
    MISSING_SITEMAP = "MISSING_SITEMAP"
    STALE_CONTENT = "STALE_CONTENT"
    NO_OG_TAGS = "NO_OG_TAGS"
    MALFORMED_HTML = "MALFORMED_HTML"


FAILURE_MESSAGES = {
    FailureCode.SITE_UNREACHABLE: "Website could not be reached",
    FailureCode.SSRF_BLOCKED: "Request blocked by security policy",
    FailureCode.NO_JSONLD: "No JSON-LD structured data found",
    FailureCode.MALFORMED_JSONLD: "JSON-LD contains syntax errors",
    FailureCode.MISSING_PERSON_SCHEMA: "Missing Person schema markup",
    FailureCode.MISSING_BOOK_SCHEMA: "Missing Book schema markup",
    FailureCode.MISSING_SAMEAS: "Missing sameAs links in schema",
    FailureCode.NO_LLMS_TXT: "Missing llms.txt AI roadmap file",
    FailureCode.WEAK_LLMS_TXT: "llms.txt exists but lacks detail",
    FailureCode.NO_ROBOTS_TXT: "Missing robots.txt file",
    FailureCode.AI_BOT_BLOCKED: "AI crawlers explicitly blocked",
    FailureCode.NO_CANONICAL: "Missing canonical URL tag",
    FailureCode.CANONICAL_MISMATCH: "Canonical URL is unreachable or mismatched",
    FailureCode.MULTIPLE_H1: "Multiple H1 tags found (should be exactly one)",
    FailureCode.NO_H1: "Page missing H1 tag",
    FailureCode.THIN_CONTENT: "Low content-to-chrome ratio",
    FailureCode.MISSING_SITEMAP: "Missing sitemap.xml",
    FailureCode.STALE_CONTENT: "Content appears outdated",
    FailureCode.NO_OG_TAGS: "Missing Open Graph social meta tags",
    FailureCode.MALFORMED_HTML: "HTML could not be parsed",
}


FIX_SUGGESTIONS = {
    FailureCode.SITE_UNREACHABLE: "Verify the website is online and accessible",
    FailureCode.SSRF_BLOCKED: "Contact support if you believe this is an error",
    FailureCode.NO_JSONLD: "Add Person and Book JSON-LD schema with sameAs links",
    FailureCode.MALFORMED_JSONLD: "Validate JSON-LD syntax using a JSON validator",
    FailureCode.MISSING_PERSON_SCHEMA: "Add Person schema with name, bio, and sameAs links",
    FailureCode.MISSING_BOOK_SCHEMA: "Add Book schema for each published work",
    FailureCode.MISSING_SAMEAS: "Include sameAs links to Amazon, Goodreads, social profiles",
    FailureCode.NO_LLMS_TXT: "Create an llms.txt file at your site root",
    FailureCode.WEAK_LLMS_TXT: "Expand llms.txt with book details and key pages",
    FailureCode.NO_ROBOTS_TXT: "Create a robots.txt allowing AI crawlers",
    FailureCode.AI_BOT_BLOCKED: "Remove Disallow rules for GPTBot, ClaudeBot, PerplexityBot",
    FailureCode.NO_CANONICAL: "Add canonical link tag pointing to the preferred URL",
    FailureCode.CANONICAL_MISMATCH: "Ensure canonical URL is accessible and correct",
    FailureCode.MULTIPLE_H1: "Use exactly one H1 tag per page",
    FailureCode.NO_H1: "Add a descriptive H1 tag as the main page heading",
    FailureCode.THIN_CONTENT: "Add more substantive text content relative to page structure",
    FailureCode.MISSING_SITEMAP: "Generate and submit a sitemap.xml",
    FailureCode.STALE_CONTENT: "Update content regularly to signal freshness",
    FailureCode.NO_OG_TAGS: "Add og:title, og:description, and og:image meta tags",
    FailureCode.MALFORMED_HTML: "Fix HTML syntax errors",
}


def create_failure(code: FailureCode, custom_message: str | None = None) -> Dict:
    """
    Create a standardized failure object.
    
    Args:
        code: FailureCode enum value
        custom_message: Optional custom message (uses default if not provided)
    
    Returns:
        Dict with code, message, and fix keys
    """
    message = custom_message or FAILURE_MESSAGES.get(code, "Unknown error")
    fix = FIX_SUGGESTIONS.get(code, "Review and fix the identified issue")
    
    return {
        "code": code.value,
        "message": message,
        "fix": fix,
    }
