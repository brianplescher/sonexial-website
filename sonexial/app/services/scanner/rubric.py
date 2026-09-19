"""Sonexial Scanner - Weighted GEO Rubric."""
import json
from typing import Any, Dict, List, Tuple
import httpx

from app.services.scanner.taxonomy import FailureCode, create_failure
from app.core.logging import StructuredLogger

logger = StructuredLogger("scanner.rubric")


def analyze_html(html_text: str) -> Tuple[int, Dict[str, Any], List[Dict], List[Dict]]:
    """
    Analyze HTML content for GEO optimization factors.
    
    Returns:
        Tuple of (score, checks_dict, critical_failures, recommendations)
    """
    import lxml.html
    
    try:
        doc = lxml.html.fromstring(html_text)
    except Exception as e:
        logger.error(f"Failed to parse HTML: {e}")
        return 0, {}, [create_failure(FailureCode.MALFORMED_HTML, "HTML parsing failed")], []
    
    score = 0
    checks = {}
    critical_failures = []
    recommendations = []
    
    # 1. JSON-LD Schema (20 points: Entity graph completeness)
    schemas = doc.xpath('//script[@type="application/ld+json"]/text()')
    has_person = False
    has_book = False
    has_sameas = False
    
    for schema_text in schemas:
        try:
            data = json.loads(schema_text.strip())
            items = data if isinstance(data, list) else [data]
            for item in items:
                if isinstance(item, dict):
                    schema_type = item.get("@type", "")
                    if schema_type == "Person":
                        has_person = True
                    elif schema_type == "Book":
                        has_book = True
                    
                    # Check for sameAs links
                    same_as = item.get("sameAs", [])
                    if same_as and len(same_as) > 0:
                        has_sameas = True
        except json.JSONDecodeError:
            continue
    
    checks["schema"] = {
        "has_person": has_person,
        "has_book": has_book,
        "has_sameas": has_sameas,
    }
    
    if has_person and has_book:
        score += 15  # Schema validity
        if has_sameas:
            score += 5  # Entity graph completeness bonus
    elif has_person or has_book:
        score += 8
        recommendations.append(create_failure(
            FailureCode.MISSING_PERSON_SCHEMA if not has_person else FailureCode.MISSING_BOOK_SCHEMA,
            "Incomplete schema markup"
        ))
    else:
        critical_failures.append(create_failure(
            FailureCode.NO_JSONLD,
            "No JSON-LD structured data found"
        ))
    
    # 2. Semantic Heading Hierarchy (10 points)
    h1_tags = doc.xpath("//h1")
    h2_tags = doc.xpath("//h2")
    
    checks["headings"] = {
        "h1_count": len(h1_tags),
        "h2_count": len(h2_tags),
    }
    
    if len(h1_tags) == 1 and len(h2_tags) > 0:
        score += 10
    elif len(h1_tags) == 0:
        critical_failures.append(create_failure(FailureCode.NO_H1, "Page missing H1 tag"))
    elif len(h1_tags) > 1:
        critical_failures.append(create_failure(
            FailureCode.MULTIPLE_H1, 
            f"Page has {len(h1_tags)} H1 tags (should be exactly 1)"
        ))
    
    # 3. Open Graph Tags (5 points)
    og_tags = doc.xpath('//meta[starts-with(@property, "og:")]')
    checks["open_graph"] = {"count": len(og_tags)}
    
    if len(og_tags) >= 3:
        score += 5
    else:
        recommendations.append(create_failure(
            FailureCode.NO_OG_TAGS,
            "Add Open Graph tags for better AI/social previews"
        ))
    
    # 4. Content-to-chrome ratio (5 points) - simplified check
    text_content = doc.text_content().strip()
    html_length = len(html_text)
    text_ratio = len(text_content) / html_length if html_length > 0 else 0
    
    checks["content_ratio"] = {"ratio": round(text_ratio, 2)}
    
    if text_ratio > 0.3:
        score += 5
    else:
        recommendations.append(create_failure(
            FailureCode.THIN_CONTENT,
            "Low content-to-chrome ratio"
        ))
    
    return score, checks, critical_failures, recommendations


def analyze_files(
    llms_res: Any,
    robots_res: Any,
    sitemap_res: Any,
    canonical_res: Any,
) -> Tuple[int, Dict[str, Any], List[Dict], List[Dict]]:
    """
    Analyze supporting files (llms.txt, robots.txt, sitemap.xml).
    
    Returns:
        Tuple of (score, checks_dict, critical_failures, recommendations)
    """
    score = 0
    checks = {}
    critical_failures = []
    recommendations = []
    
    # 1. llms.txt presence and quality (15 points)
    if isinstance(llms_res, httpx.Response) and llms_res.status_code == 200:
        content = llms_res.text.strip()
        if len(content) > 50:
            checks["llms_txt"] = {"present": True, "quality": "good" if len(content) > 200 else "basic"}
            score += 15
        else:
            checks["llms_txt"] = {"present": True, "quality": "weak"}
            score += 5
            recommendations.append(create_failure(
                FailureCode.WEAK_LLMS_TXT,
                "llms.txt exists but is too brief"
            ))
    else:
        checks["llms_txt"] = {"present": False}
        critical_failures.append(create_failure(
            FailureCode.NO_LLMS_TXT,
            "Missing llms.txt AI roadmap file"
        ))
    
    # 2. AI crawler access in robots.txt (15 points)
    ai_bots = ["gptbot", "claudebot", "perplexitybot", "google-extended"]
    blocked_bots = []
    
    if isinstance(robots_res, httpx.Response) and robots_res.status_code == 200:
        content = robots_res.text.lower()
        
        # Check if any AI bots are explicitly blocked
        for bot in ai_bots:
            # Look for pattern: User-agent: bot followed by Disallow: /
            lines = content.split("\n")
            for i, line in enumerate(lines):
                if f"user-agent: {bot}" in line or f"user-agent:{bot}" in line:
                    # Check next few lines for Disallow: /
                    for j in range(i + 1, min(i + 5, len(lines))):
                        if "disallow: /" in lines[j] and lines[j].strip() == "disallow: /":
                            blocked_bots.append(bot)
                            break
        
        checks["ai_bot_access"] = {
            "blocked": blocked_bots,
            "allowed": [b for b in ai_bots if b not in blocked_bots],
        }
        
        if not blocked_bots:
            score += 15
        else:
            critical_failures.append(create_failure(
                FailureCode.AI_BOT_BLOCKED,
                f"AI crawlers blocked: {', '.join(blocked_bots)}"
            ))
            score -= 10  # Penalty
    else:
        checks["ai_bot_access"] = {"robots_txt_missing": True}
        recommendations.append(create_failure(
            FailureCode.NO_ROBOTS_TXT,
            "Missing robots.txt (not critical but recommended)"
        ))
        score += 5  # Not having robots.txt is okay, default is allow
    
    # 3. Sitemap presence (5 points)
    if isinstance(sitemap_res, httpx.Response) and sitemap_res.status_code == 200:
        checks["sitemap"] = {"present": True}
        score += 5
    else:
        checks["sitemap"] = {"present": False}
        recommendations.append(create_failure(
            FailureCode.MISSING_SITEMAP,
            "Missing sitemap.xml"
        ))
    
    # 4. Canonical correctness (10 points)
    if isinstance(canonical_res, Exception):
        checks["canonical"] = {"error": str(canonical_res)}
        critical_failures.append(create_failure(
            FailureCode.CANONICAL_MISMATCH,
            "Canonical URL unreachable"
        ))
    elif isinstance(canonical_res, httpx.Response):
        checks["canonical"] = {"present": True, "status": canonical_res.status_code}
        score += 10
    else:
        checks["canonical"] = {"present": False}
        recommendations.append(create_failure(
            FailureCode.NO_CANONICAL,
            "Missing canonical tag"
        ))
    
    return score, checks, critical_failures, recommendations


def calculate_geo_score(
    html_score: int,
    file_score: int,
) -> Tuple[int, str]:
    """
    Calculate final GEO score and grade.
    
    Returns:
        Tuple of (total_score, grade)
    """
    total_score = max(0, min(100, html_score + file_score))
    
    if total_score >= 85:
        grade = "A (AI-Ready)"
    elif total_score >= 70:
        grade = "B (Needs Minor Tuning)"
    elif total_score >= 55:
        grade = "C (Partially Visible)"
    elif total_score >= 40:
        grade = "D (Mostly Invisible to AI)"
    else:
        grade = "F (Ghost in the Machine)"
    
    return total_score, grade
