"""Sonexial Scanner - URL Fetching with SSRF Protection."""
import httpx
from urllib.parse import urlparse, urljoin
from typing import List, Tuple, Any
import asyncio

from app.services.scanner.ssrf import is_safe_url
from app.core.logging import StructuredLogger

logger = StructuredLogger("scanner.fetch")


async def fetch_urls(
    client: httpx.AsyncClient,
    url: str,
) -> Tuple[Any, Any, Any, Any, Any]:
    """
    Fetches HTML, llms.txt, robots.txt, sitemap.xml, and canonical concurrently.
    
    Args:
        client: httpx AsyncClient instance
        url: Target URL to scan
    
    Returns:
        Tuple of (html_res, llms_res, robots_res, sitemap_res, canonical_res)
        Each element is either httpx.Response or Exception
    """
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    
    # Construct all URLs to fetch
    llms_url = urljoin(base_url, "/llms.txt")
    robots_url = urljoin(base_url, "/robots.txt")
    sitemap_url = urljoin(base_url, "/sitemap.xml")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Sonexial GEO Scanner 1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    
    # Validate all URLs for SSRF before fetching
    urls_to_fetch = [url, llms_url, robots_url, sitemap_url]
    safe_urls = []
    
    for fetch_url in urls_to_fetch:
        if await is_safe_url(fetch_url):
            safe_urls.append(fetch_url)
        else:
            logger.warning(f"URL blocked by SSRF protection: {fetch_url}")
            safe_urls.append(None)
    
    # Create fetch tasks
    tasks = []
    for fetch_url in safe_urls:
        if fetch_url:
            task = client.get(fetch_url, headers=headers, follow_redirects=True, timeout=10.0)
        else:
            task = None
        tasks.append(task)
    
    # Execute fetches concurrently
    results = []
    for i, task in enumerate(tasks):
        if task:
            try:
                result = await task
                # Validate redirect targets if any
                if result.url != urls_to_fetch[i]:
                    if not await is_safe_url(str(result.url)):
                        logger.warning(f"Redirect to unsafe URL blocked: {result.url}")
                        results.append(Exception("SSRF_BLOCKED"))
                        continue
                results.append(result)
            except Exception as e:
                logger.error(f"Fetch failed for {urls_to_fetch[i]}: {e}")
                results.append(e)
        else:
            results.append(Exception("SSRF_BLOCKED"))
    
    # Handle canonical URL separately after getting HTML
    html_res = results[0] if results else None
    canonical_res = None
    
    if isinstance(html_res, httpx.Response) and html_res.status_code == 200:
        # Extract canonical from HTML
        import lxml.html
        try:
            doc = lxml.html.fromstring(html_res.text)
            canonical_links = doc.xpath('//link[@rel="canonical"]/@href')
            if canonical_links:
                canonical_url = canonical_links[0]
                if await is_safe_url(canonical_url):
                    canonical_res = await client.get(
                        canonical_url, headers=headers, follow_redirects=True, timeout=10.0
                    )
                else:
                    canonical_res = Exception("SSRF_BLOCKED_CANONICAL")
        except Exception as e:
            logger.warning(f"Failed to parse canonical: {e}")
    
    return (
        results[0],  # html_res
        results[1],  # llms_res
        results[2],  # robots_res
        results[3],  # sitemap_res
        canonical_res,
    )
