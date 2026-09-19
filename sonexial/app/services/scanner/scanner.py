"""Main GEO Scanner orchestrator."""
import hashlib
import time
from urllib.parse import urlparse, urljoin
from typing import Dict, Any, Optional

import httpx
from lxml import html as lxml_html

from app.core.logging import get_logger
from app.core.config import settings
from app.services.scanner.fetch import fetch_urls
from app.services.scanner.rubric import analyze_html, analyze_files, calculate_geo_score
from app.services.scanner.ssrf import is_safe_url
from app.services.scanner.cache import get_cached_scan, cache_scan
from app.services.scanner.rate_limit import check_rate_limit
from app.services.scanner.taxonomy import FailureCode, create_failure

logger = get_logger(__name__)


class GEOScanner:
    """Main GEO Scanner class that orchestrates the scanning process."""
    
    def __init__(self):
        self.timeout = httpx.Timeout(10.0, read=30.0)
        self.max_redirects = 5
        
    async def scan(self, url: str) -> Dict[str, Any]:
        """
        Perform a complete GEO scan on a URL.
        
        Args:
            url: The URL to scan
            
        Returns:
            Dictionary containing scan results including score, failures, warnings, opportunities
        """
        start_time = time.time()
        
        # Normalize URL
        parsed = urlparse(url)
        if parsed.scheme not in ["http", "https"]:
            raise ValueError(f"Invalid scheme: {parsed.scheme}")
            
        normalized_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if parsed.query:
            normalized_url += f"?{parsed.query}"
            
        # Remove trailing slash for consistency
        normalized_url = normalized_url.rstrip("/")
        
        # Generate cache key
        cache_key = self._generate_cache_key(normalized_url)
        
        # Check cache first
        cached = await get_cached_scan(cache_key)
        if cached:
            logger.info(f"Cache hit for {normalized_url}")
            return cached
            
        # Check rate limit
        await check_rate_limit(parsed.netloc)
        
        # SSRF protection - validate URL safety
        if not await is_safe_url(normalized_url):
            logger.warning(f"SSRF protection blocked: {normalized_url}")
            return self._create_error_result(
                url=normalized_url,
                error_code=FailureCode.SSRF_BLOCKED,
                message="URL failed SSRF protection checks",
            )
        
        # Fetch all resources concurrently
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                max_redirects=self.max_redirects,
            ) as client:
                fetch_results = await fetch_urls(client, normalized_url)
        except Exception as e:
            logger.error(f"Fetch failed: {e}")
            return self._create_error_result(
                url=normalized_url,
                error_code=FailureCode.SITE_UNREACHABLE,
                message=f"Failed to fetch URL: {str(e)}",
            )
        
        # Unpack results
        html_response = fetch_results.get("html")
        robots_response = fetch_results.get("robots")
        llms_response = fetch_results.get("llms")
        sitemap_response = fetch_results.get("sitemap")
        fetch_error = fetch_results.get("error")
        
        if fetch_error or not html_response:
            return self._create_error_result(
                url=normalized_url,
                error_code=FailureCode.SITE_UNREACHABLE,
                message="Failed to fetch HTML content",
            )
        
        # Parse HTML
        try:
            html_content = html_response.text
            html_tree = lxml_html.fromstring(html_content.encode('utf-8', errors='ignore'))
        except Exception as e:
            logger.error(f"HTML parsing failed: {e}")
            html_tree = None
        
        # Analyze HTML content
        html_analysis = analyze_html(html_tree, html_content) if html_tree else {
            "score": 0,
            "checks": {},
            "critical_failures": [create_failure(FailureCode.SITE_UNREACHABLE, "Could not parse HTML")],
            "warnings": [],
            "opportunities": [],
        }
        
        # Analyze supporting files
        file_analysis = analyze_files(
            llms_response=llms_response,
            robots_response=robots_response,
            sitemap_response=sitemap_response,
        )
        
        # Calculate total score
        total_score = calculate_geo_score(html_analysis["score"], file_analysis["score"])
        
        # Compile results
        execution_time = time.time() - start_time
        
        result = {
            "url": normalized_url,
            "normalized_url": normalized_url,
            "cache_key": cache_key,
            "score": total_score,
            "grade": self._calculate_grade(total_score),
            "execution_time_seconds": round(execution_time, 2),
            "checks": {
                **html_analysis["checks"],
                **file_analysis["checks"],
            },
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
        
        # Cache successful scan
        await cache_scan(cache_key, result)
        
        logger.info(f"Scan completed: {normalized_url} - Score: {total_score}/100")
        
        return result
    
    def _generate_cache_key(self, url: str) -> str:
        """Generate a cache key from URL."""
        # For now, just hash the URL
        # In production, would also incorporate content hash
        return hashlib.sha256(url.encode()).hexdigest()[:32]
    
    def _calculate_grade(self, score: int) -> str:
        """Calculate letter grade from score."""
        if score >= 85:
            return "A (AI-Ready)"
        elif score >= 70:
            return "B (Needs Tuning)"
        elif score >= 50:
            return "C (Invisible to AI)"
        elif score >= 30:
            return "D (Critical Issues)"
        else:
            return "F (Ghost in the Machine)"
    
    def _create_error_result(
        self,
        url: str,
        error_code: FailureCode,
        message: str,
    ) -> Dict[str, Any]:
        """Create an error result structure."""
        return {
            "url": url,
            "normalized_url": url,
            "cache_key": "",
            "score": 0,
            "grade": "F (Error)",
            "execution_time_seconds": 0,
            "checks": {},
            "critical_failures": [create_failure(error_code, message)],
            "warnings": [],
            "opportunities": [],
            "error": message,
            "timestamp": time.time(),
        }
