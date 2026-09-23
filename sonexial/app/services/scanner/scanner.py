"""Main GEO Scanner orchestrator.

Pipeline:
  normalize URL -> SSRF check -> rate limit -> concurrent fetch (HTML,
  robots.txt, llms.txt, sitemap.xml, canonical) -> rubric scoring ->
  normalized report -> Postgres cache.

Graceful degradation: target-site failures return a *partial* report with
useful critical failures — never a 500.
"""
import time
from urllib.parse import urlparse
from typing import Dict, Any

import httpx

from app.core.logging import get_logger
from app.services.scanner.fetch import fetch_urls
from app.services.scanner.rubric import analyze_html, analyze_files, calculate_geo_score
from app.services.scanner.ssrf import is_safe_url
from app.services.scanner.cache import (
    compute_cache_key,
    compute_content_hash,
    get_cached_scan,
    cache_scan,
)
from app.services.scanner.rate_limit import check_rate_limit
from app.services.scanner.taxonomy import FailureCode, create_failure

logger = get_logger(__name__)


class GEOScanner:
    """Orchestrates a full GEO scan of a website."""

    def __init__(self):
        self.timeout = httpx.Timeout(8.0, connect=4.0, read=10.0)
        self.max_redirects = 5

    @staticmethod
    def normalize_url(url: str) -> str:
        parsed = urlparse(url)
        scheme = parsed.scheme or "https"
        netloc = parsed.netloc.lower()
        path = parsed.path or "/"
        if path != "/" and path.endswith("/"):
            path = path.rstrip("/")
        normalized = f"{scheme}://{netloc}{path}"
        if parsed.query:
            normalized += f"?{parsed.query}"
        return normalized

    async def scan(self, url: str) -> Dict[str, Any]:
        """Perform a complete GEO scan and return a normalized report dict."""
        start_time = time.time()

        # ---- Validate & normalize -------------------------------------
        try:
            parsed = urlparse(url)
        except Exception:
            return self._error_result(url, FailureCode.SSRF_BLOCKED, "Malformed URL")

        if parsed.scheme not in ("http", "https"):
            return self._error_result(
                url, FailureCode.SSRF_BLOCKED,
                f"Only http/https URLs are supported (got '{parsed.scheme or 'none'}')",
            )

        normalized_url = self.normalize_url(url)

        # ---- SSRF gate --------------------------------------------------
        if not await is_safe_url(normalized_url):
            logger.warning(f"SSRF protection blocked: {normalized_url}")
            return self._error_result(
                normalized_url, FailureCode.SSRF_BLOCKED,
                "URL resolves to a private/internal address and was blocked.",
            )

        # ---- Rate limit (bucket by host) --------------------------------
        allowed, retry_after = await check_rate_limit(parsed.netloc.lower())
        if not allowed:
            result = self._error_result(
                normalized_url, FailureCode.SITE_UNREACHABLE,
                f"Rate limit exceeded for this host. Retry in {retry_after}s.",
            )
            result["retry_after_seconds"] = retry_after
            return result

        # ---- Cache lookup (URL-only key; refined after fetch) -----------
        provisional_key = compute_cache_key(normalized_url)
        cached = await get_cached_scan(provisional_key)
        if cached:
            cached.setdefault("url", normalized_url)
            cached.setdefault("normalized_url", normalized_url)
            cached["execution_time_seconds"] = round(time.time() - start_time, 3)
            return cached

        # ---- Concurrent fetch -------------------------------------------
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                max_redirects=self.max_redirects,
            ) as client:
                html_res, llms_res, robots_res, sitemap_res, canonical_res = \
                    await fetch_urls(client, normalized_url)
        except Exception as e:
            logger.error(f"Fetch failed for {normalized_url}: {e}")
            return self._error_result(
                normalized_url, FailureCode.SITE_UNREACHABLE,
                f"Failed to fetch URL: {e}",
            )

        # ---- HTML must succeed; everything else degrades gracefully -----
        if isinstance(html_res, Exception) or not isinstance(html_res, httpx.Response):
            return self._error_result(
                normalized_url, FailureCode.SITE_UNREACHABLE,
                f"Could not reach the page: {html_res}",
            )
        if html_res.status_code >= 400:
            return self._error_result(
                normalized_url, FailureCode.SITE_UNREACHABLE,
                f"Page returned HTTP {html_res.status_code}",
            )

        html_text = html_res.text

        # ---- Analysis ----------------------------------------------------
        html_analysis = analyze_html(html_text)
        file_analysis = analyze_files(
            llms_res=llms_res,
            robots_res=robots_res,
            sitemap_res=sitemap_res,
            canonical_res=canonical_res,
            html_text=html_text,
            normalized_url=normalized_url,
        )

        total_score = calculate_geo_score(html_analysis, file_analysis)

        status = "success"
        if html_analysis["critical_failures"] or file_analysis["critical_failures"]:
            # Still a valid report — just an unhappy site. Reserve "partial"
            # for scans where sub-resources could not be evaluated at all.
            status = "success"

        result: Dict[str, Any] = {
            "url": str(url),
            "normalized_url": normalized_url,
            "cache_key": compute_cache_key(normalized_url, compute_content_hash(html_text)),
            "status": status,
            "score": total_score,
            "grade": self._grade(total_score),
            "execution_time_seconds": round(time.time() - start_time, 2),
            "checks": {**html_analysis["checks"], **file_analysis["checks"]},
            "critical_failures": [
                *html_analysis["critical_failures"],
                *file_analysis["critical_failures"],
            ],
            "warnings": [
                *html_analysis["warnings"],
                *file_analysis["warnings"],
            ],
            "opportunities": [
                *html_analysis["opportunities"],
                *file_analysis["opportunities"],
            ],
            "timestamp": time.time(),
        }

        # Store under both content-aware key and provisional URL key so the
        # next scan hits cache even before re-fetching.
        await cache_scan(result)
        result_for_provisional = {**result, "cache_key": provisional_key}
        await cache_scan(result_for_provisional)

        logger.info(f"Scan completed: {normalized_url} score={total_score}/100")
        return result

    @staticmethod
    def _grade(score: int) -> str:
        if score >= 85:
            return "A (AI-Ready)"
        if score >= 70:
            return "B (Needs Tuning)"
        if score >= 55:
            return "C (Partially Visible)"
        if score >= 40:
            return "D (Mostly Invisible to AI)"
        return "F (Ghost in the Machine)"

    @staticmethod
    def _error_result(url: str, code: FailureCode, message: str) -> Dict[str, Any]:
        return {
            "url": url,
            "normalized_url": url,
            "cache_key": "",
            "status": "partial",
            "score": 0,
            "grade": "F (Unscannable)",
            "execution_time_seconds": 0,
            "checks": {},
            "critical_failures": [create_failure(code, message)],
            "warnings": [],
            "opportunities": [],
            "error": message,
            "timestamp": time.time(),
        }
