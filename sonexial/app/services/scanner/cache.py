"""Sonexial Scanner - Response Caching."""
import hashlib
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

from app.core.config import get_settings
from app.core.logging import StructuredLogger

logger = StructuredLogger("scanner.cache")

settings = get_settings()


def compute_cache_key(url: str, content_hash: str) -> str:
    """Compute cache key from normalized URL and content hash."""
    combined = f"{url}|{content_hash}"
    return hashlib.sha256(combined.encode()).hexdigest()


def compute_content_hash(content: str) -> str:
    """Compute SHA256 hash of content."""
    return hashlib.sha256(content.encode()).hexdigest()


async def get_cached_scan(cache_key: str) -> Optional[Dict[str, Any]]:
    """
    Get cached scan result from database.
    
    Args:
        cache_key: Pre-computed cache key
    
    Returns:
        Cached scan report dict or None if not found/expired
    """
    from sqlalchemy import select
    from app.models.scan import Scan
    from app.core.db import AsyncSessionLocal
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Scan).where(Scan.cache_key == cache_key)
        )
        scan = result.scalar_one_or_none()
        
        if not scan:
            return None
        
        # Check if cache is expired
        age = datetime.utcnow() - scan.created_at
        if age.total_seconds() > settings.cache_ttl_seconds:
            logger.info(f"Cache expired for {cache_key}")
            return None
        
        logger.info(f"Cache hit for {cache_key}")
        return {
            "score": scan.score,
            "report": scan.report,
            "status": scan.status,
            "cached": True,
            "cache_age_seconds": age.total_seconds(),
        }


async def cache_scan(
    url: str,
    normalized_url: str,
    cache_key: str,
    score: int,
    report: Dict[str, Any],
    status: str = "success",
) -> None:
    """
    Cache scan result in database.
    
    Args:
        url: Original URL scanned
        normalized_url: Normalized URL
        cache_key: Cache key
        score: GEO score
        report: Full scan report
        status: Scan status
    """
    from app.models.scan import Scan
    from app.core.db import AsyncSessionLocal
    
    async with AsyncSessionLocal() as session:
        # Check if existing scan exists
        from sqlalchemy import select
        result = await session.execute(
            select(Scan).where(Scan.cache_key == cache_key)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update existing
            existing.score = score
            existing.report = report
            existing.status = status
            existing.created_at = datetime.utcnow()  # Reset cache timer
        else:
            # Create new
            scan = Scan(
                url=url,
                normalized_url=normalized_url,
                cache_key=cache_key,
                score=score,
                report=report,
                status=status,
            )
            session.add(scan)
        
        await session.commit()
        logger.info(f"Cached scan result for {cache_key}")
