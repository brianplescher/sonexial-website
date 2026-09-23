"""Sonexial Scanner - Weighted GEO Rubric.

Weights (total 100):
    Entity graph completeness (Person + Book + sameAs) ... 20
    Schema validity (parseable JSON-LD, correct types) ..... 15
    llms.txt presence and quality ......................... 15
    AI crawler access in robots.txt ....................... 15
    Semantic heading hierarchy ............................ 10
    Canonical correctness ................................. 10
    Content-to-chrome ratio ............................... 5
    Internal entity linking (Amazon/Goodreads/etc.) ....... 5
    Freshness signals ..................................... 5
"""
import json
from typing import Any, Dict, List, Tuple

import httpx
from lxml import html as lxml_html

from app.services.scanner.taxonomy import FailureCode, create_failure
from app.core.logging import StructuredLogger

logger = StructuredLogger("scanner.rubric")


def _parse_jsonld(doc) -> Tuple[List[Dict], bool]:
    """Extract and parse all JSON-LD blocks from an lxml document tree."""
    scripts = doc.xpath('//script[@type="application/ld+json"]')
    parsed: List[Dict] = []
    malformed = False

    for script in scripts:
        raw = script.text_content()
        if not raw or not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            malformed = True
            continue

        # Handle @graph wrappers and top-level lists
        items: List[Any] = []
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            if "@graph" in data and isinstance(data["@graph"], list):
                items = data["@graph"]
            else:
                items = [data]

        for item in items:
            if isinstance(item, dict):
                parsed.append(item)

    return parsed, malformed


def _types_of(item: Dict) -> List[str]:
    t = item.get("@type", "")
    if isinstance(t, list):
        return [str(x) for x in t]
    return [str(t)] if t else []


def analyze_html(html_text: str) -> Dict[str, Any]:
    """Analyze HTML content for GEO optimization factors.

    Returns a dict with keys:
        score, checks, critical_failures, warnings, opportunities
    """
    result: Dict[str, Any] = {
        "score": 0,
        "checks": {},
        "critical_failures": [],
        "warnings": [],
        "opportunities": [],
    }

    try:
        doc = lxml_html.fromstring(html_text)
    except Exception as e:
        logger.error(f"Failed to parse HTML: {e}")
        result["critical_failures"].append(
            create_failure(FailureCode.MALFORMED_HTML, f"HTML parsing failed: {e}")
        )
        return result

    score = 0
    checks: Dict[str, Any] = {}
    critical: List[Dict] = []
    warnings: List[Dict] = []
    opportunities: List[Dict] = []

    # ------------------------------------------------------------------
    # 1. Entity graph completeness (20) + Schema validity (15)
    # ------------------------------------------------------------------
    schemas, malformed = _parse_jsonld(doc)

    types_flat = [t for item in schemas for t in _types_of(item)]
    has_person = "Person" in types_flat
    has_book = any(t in ("Book", "IndividualBook") for t in types_flat)

    has_sameas = False
    sameas_count = 0
    for item in schemas:
        same_as = item.get("sameAs")
        if same_as:
            links = same_as if isinstance(same_as, list) else [same_as]
            links = [l for l in links if isinstance(l, str) and l.startswith("http")]
            sameas_count += len(links)
    has_sameas = sameas_count > 0

    checks["schema"] = {
        "jsonld_blocks": len(schemas),
        "has_person": has_person,
        "has_book": has_book,
        "has_sameas": has_sameas,
        "sameas_count": sameas_count,
        "malformed": malformed,
    }

    # Schema validity (15 pts): penalize malformed JSON-LD heavily
    if malformed:
        critical.append(create_failure(FailureCode.MALFORMED_JSONLD))
        score += 0
    elif schemas:
        score += 15
    else:
        critical.append(create_failure(FailureCode.NO_JSONLD))

    # Entity graph completeness (20 pts)
    entity_pts = 0
    if has_person:
        entity_pts += 8
    else:
        critical.append(create_failure(FailureCode.MISSING_PERSON_SCHEMA))
    if has_book:
        entity_pts += 7
    else:
        warnings.append(create_failure(FailureCode.MISSING_BOOK_SCHEMA))
    if has_sameas:
        entity_pts += 5
    elif schemas:
        warnings.append(create_failure(FailureCode.MISSING_SAMEAS))
    score += min(entity_pts, 20)

    # ------------------------------------------------------------------
    # 2. Semantic heading hierarchy (10 pts)
    # ------------------------------------------------------------------
    h1_tags = doc.xpath("//h1")
    h2_tags = doc.xpath("//h2")
    checks["headings"] = {"h1_count": len(h1_tags), "h2_count": len(h2_tags)}

    if len(h1_tags) == 1 and len(h2_tags) > 0:
        score += 10
    elif len(h1_tags) == 1:
        score += 6
        warnings.append(create_failure(
            FailureCode.THIN_CONTENT,
            "Single H1 present but no H2 subheadings to structure topics for AI.",
        ))
    elif len(h1_tags) == 0:
        critical.append(create_failure(FailureCode.NO_H1))
    else:
        warnings.append(create_failure(
            FailureCode.MULTIPLE_H1,
            f"Page has {len(h1_tags)} H1 tags (should be exactly 1).",
        ))
        score += 3  # partial credit — headings exist, just messy

    # ------------------------------------------------------------------
    # 3. Internal entity linking (5 pts) — Amazon / Goodreads / BookBub
    # ------------------------------------------------------------------
    hrefs = [
        (a.get("href") or "").lower()
        for a in doc.xpath("//a[@href]")
    ]
    has_amazon = any(("amazon." in l or "amzn." in l) for l in hrefs)
    has_goodreads = "goodreads.com" in " ".join(hrefs)
    has_bookbub = "bookbub.com" in " ".join(hrefs)
    checks["entity_links"] = {
        "amazon": has_amazon,
        "goodreads": has_goodreads,
        "bookbub": has_bookbub,
    }

    link_pts = (3 if has_amazon else 0) + (1 if has_goodreads else 0) + (1 if has_bookbub else 0)
    score += min(link_pts, 5)
    if not (has_amazon or has_goodreads or has_bookbub):
        opportunities.append(create_failure(
            FailureCode.MISSING_SAMEAS,
            "No outbound retailer/entity links found. Add Amazon/Goodreads links "
            "to connect your knowledge graph.",
        ))

    # ------------------------------------------------------------------
    # 4. Open Graph / meta (part of chrome quality; informational)
    # ------------------------------------------------------------------
    og_tags = doc.xpath('//meta[starts-with(@property, "og:")]')
    checks["open_graph"] = {"count": len(og_tags)}
    if len(og_tags) < 3:
        warnings.append(create_failure(FailureCode.NO_OG_TAGS))

    # ------------------------------------------------------------------
    # 5. Content-to-chrome ratio (5 pts)
    # ------------------------------------------------------------------
    try:
        body = doc.find(".//body")
        text_content = (body.text_content() if body is not None else doc.text_content())
        text_content = " ".join(text_content.split())
    except Exception:
        text_content = ""
    html_length = max(len(html_text), 1)
    text_ratio = len(text_content) / html_length
    checks["content_ratio"] = {"ratio": round(text_ratio, 3)}

    if text_ratio >= 0.35:
        score += 5
    elif text_ratio >= 0.15:
        score += 3
    else:
        warnings.append(create_failure(FailureCode.THIN_CONTENT))

    result["score"] = score
    result["checks"] = checks
    result["critical_failures"] = critical
    result["warnings"] = warnings
    result["opportunities"] = opportunities
    return result


def analyze_files(
    llms_res: Any,
    robots_res: Any,
    sitemap_res: Any,
    canonical_res: Any = None,
    html_text: str = "",
    normalized_url: str = "",
) -> Dict[str, Any]:
    """Analyze supporting files (llms.txt, robots.txt, sitemap.xml, canonical).

    Returns a dict with keys:
        score, checks, critical_failures, warnings, opportunities
    """
    result: Dict[str, Any] = {
        "score": 0,
        "checks": {},
        "critical_failures": [],
        "warnings": [],
        "opportunities": [],
    }

    score = 0
    checks: Dict[str, Any] = {}
    critical: List[Dict] = []
    warnings: List[Dict] = []
    opportunities: List[Dict] = []

    # ------------------------------------------------------------------
    # 1. llms.txt presence & quality (15 pts)
    # ------------------------------------------------------------------
    if isinstance(llms_res, httpx.Response) and llms_res.status_code == 200:
        content = llms_res.text.strip()
        if len(content) >= 200:
            checks["llms_txt"] = {"present": True, "quality": "good"}
            score += 15
        elif len(content) > 50:
            checks["llms_txt"] = {"present": True, "quality": "basic"}
            score += 10
            warnings.append(create_failure(FailureCode.WEAK_LLMS_TXT))
        else:
            checks["llms_txt"] = {"present": True, "quality": "weak"}
            score += 3
            warnings.append(create_failure(
                FailureCode.WEAK_LLMS_TXT,
                "llms.txt exists but is too brief to guide AI crawlers.",
            ))
    else:
        checks["llms_txt"] = {"present": False}
        critical.append(create_failure(FailureCode.NO_LLMS_TXT))

    # ------------------------------------------------------------------
    # 2. AI crawler access in robots.txt (15 pts)
    # ------------------------------------------------------------------
    ai_bots = ["gptbot", "claudebot", "perplexitybot", "google-extended"]
    blocked_bots: List[str] = []
    wildcard_blocked = False

    if isinstance(robots_res, httpx.Response) and robots_res.status_code == 200:
        content = robots_res.text.lower()

        # Wildcard block affects everyone
        lines = [ln.strip() for ln in content.splitlines()]
        for i, line in enumerate(lines):
            if line.replace(" ", "") in ("user-agent:*",):
                for j in range(i + 1, min(i + 6, len(lines))):
                    nxt = lines[j]
                    if nxt.startswith("user-agent"):
                        break
                    if nxt.replace(" ", "") == "disallow:/":
                        wildcard_blocked = True

        # Per-bot blocks
        current_agent_blocks: Dict[str, bool] = {}
        current_agent = None
        for line in lines:
            if line.startswith("user-agent"):
                _, _, agent = line.partition(":")
                current_agent = agent.strip().lower()
                current_agent_blocks.setdefault(current_agent, False)
            elif line.startswith("disallow") and current_agent is not None:
                _, _, path = line.partition(":")
                if path.strip() == "/":
                    current_agent_blocks[current_agent] = True

        for bot in ai_bots:
            if current_agent_blocks.get(bot, False) or wildcard_blocked:
                blocked_bots.append(bot)

        checks["ai_bot_access"] = {
            "robots_txt": True,
            "wildcard_disallow_all": wildcard_blocked,
            "blocked": blocked_bots,
            "allowed": [b for b in ai_bots if b not in blocked_bots],
        }

        if blocked_bots:
            critical.append(create_failure(
                FailureCode.AI_BOT_BLOCKED,
                f"AI crawlers explicitly blocked: {', '.join(blocked_bots)}.",
            ))
            score += 0
        else:
            score += 15
            # Explicit Allow entries are a positive signal
            if any(f"allow: /" in ln for ln in lines):
                opportunities.append(create_failure(
                    FailureCode.NO_ROBOTS_TXT,
                    "robots.txt correctly permits AI crawlers — good baseline.",
                ))
    else:
        checks["ai_bot_access"] = {"robots_txt": False, "blocked": [], "allowed": ai_bots}
        warnings.append(create_failure(
            FailureCode.NO_ROBOTS_TXT,
            "Missing robots.txt. Default policy allows crawlers, but explicit "
            "permission is safer for GEO.",
        ))
        score += 10  # missing is a warning, not a block

    # ------------------------------------------------------------------
    # 3. Canonical correctness (10 pts)
    # ------------------------------------------------------------------
    canonical_href = None
    if html_text:
        try:
            doc = lxml_html.fromstring(html_text)
            links = doc.xpath('//link[@rel="canonical"]/@href')
            if links:
                canonical_href = links[0].strip()
        except Exception:
            pass

    checks["canonical"] = {"present": bool(canonical_href), "href": canonical_href}

    if canonical_href:
        # If we fetched the canonical target and it failed → mismatch penalty
        if isinstance(canonical_res, Exception):
            warnings.append(create_failure(FailureCode.CANONICAL_MISMATCH))
            score += 4
        elif isinstance(canonical_res, httpx.Response) and canonical_res.status_code >= 400:
            warnings.append(create_failure(FailureCode.CANONICAL_MISMATCH))
            score += 4
        else:
            score += 10
    else:
        warnings.append(create_failure(FailureCode.NO_CANONICAL))
        score += 0

    # ------------------------------------------------------------------
    # 4. Sitemap presence (informational; feeds freshness scoring)
    # ------------------------------------------------------------------
    has_sitemap = isinstance(sitemap_res, httpx.Response) and sitemap_res.status_code == 200
    checks["sitemap"] = {"present": has_sitemap}
    if not has_sitemap:
        warnings.append(create_failure(FailureCode.MISSING_SITEMAP))

    # ------------------------------------------------------------------
    # 5. Freshness signals (5 pts) — datePublished/dateModified in JSON-LD
    #    or visible dates in HTML
    # ------------------------------------------------------------------
    fresh = False
    detail = ""
    if html_text:
        try:
            doc = lxml_html.fromstring(html_text)
            schemas, _ = _parse_jsonld(doc)
            for item in schemas:
                if any(k in item for k in ("datePublished", "dateModified")):
                    fresh = True
                    detail = "JSON-LD contains date fields"
                    break
            if not fresh:
                metas = doc.xpath(
                    '//meta[contains(@property,"article:") or '
                    'contains(@name,"date")]/@content'
                )
                if metas:
                    fresh = True
                    detail = "Meta date tags present"
        except Exception:
            pass

    checks["freshness"] = {"signals": fresh, "detail": detail}
    if fresh:
        score += 5
    else:
        opportunities.append(create_failure(
            FailureCode.STALE_CONTENT,
            "No machine-readable freshness signals (datePublished/dateModified). "
            "Add them so AI engines can judge recency.",
        ))

    result["score"] = score
    result["checks"] = checks
    result["critical_failures"] = critical
    result["warnings"] = warnings
    result["opportunities"] = opportunities
    return result


def calculate_geo_score(html_analysis: Any, file_analysis: Any = None) -> int:
    """Combine analysis results into a final 0–100 score.

    Accepts either:
      - two dicts (html_analysis, file_analysis) — preferred
      - two ints (legacy call style)
    """
    if isinstance(html_analysis, dict):
        html_score = html_analysis.get("score", 0)
    else:
        html_score = int(html_analysis)

    if file_analysis is None:
        file_score = 0
    elif isinstance(file_analysis, dict):
        file_score = file_analysis.get("score", 0)
    else:
        file_score = int(file_analysis)

    return max(0, min(100, html_score + file_score))
