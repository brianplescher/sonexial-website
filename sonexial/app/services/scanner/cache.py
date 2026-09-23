"""Sonexial Scanner - Response Caching (Postgres-backed)."""
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from app.core.config import get_settings
from app.core.logging import StructuredLogger

logger = StructuredLogger("scanner.cache")

settings = get_settings()


def compute_cache_key(url: str, content_hash: str = "") -> str:
    """Cache key = sha256(normalized_url + fetched_html_hash), truncated."""
    combined = f"{url}|{content_hash}"
    return hashlib.sha256(combined.encode()).hexdigest()[:64]


def compute_content_hash(content: str) -> str:
    """SHA256 hash of response content."""
    return hashlib.sha256(content.encode("utf-8", errors="ignore")).hexdigest()


async def get_cached_scan(cache_key: str) -> Optional[Dict[str, Any]]:
    """Return a cached scan report dict if present and unexpired.

    The stored `report` is the full normalized ScanResponse payload; it is
    returned with extra cache metadata keys (`cached`, `cache_age_seconds`).
    """
    from sqlalchemy import select
    from app.models.scan import Scan
    from app.core.db import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Scan).where(Scan.cache_key == cache_key)
            )
            scan = result.scalar_one_or_none()
            if not scan or not scan.report:
                return None

            created = scan.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - created).total_seconds()

            if age > settings.cache_ttl_seconds:
                logger.info(f"Cache expired for {cache_key}")
                return None

            cached = dict(scan.report)
            cached["cached"] = True
            cached["cache_age_seconds"] = round(age, 1)
            cached["score"] = scan.score if scan.score is not None else cached.get("score", 0)
            return cached
    except Exception as e:
        # Cache misses must never break scanning.
        logger.warning(f"Cache lookup failed (treating as miss): {e}")
        return None


async def cache_scan(result: Dict[str, Any]) -> None:
    """Persist a scan result keyed by its cache_key.

    Args:
        result: Full scan report dict (must contain url, normalized_url,
                cache_key, score, critical_failures/warnings/opportunities...).
    """
    cache_key = result.get("cache_key")
    if not cache_key:
        return

    from sqlalchemy import select
    from app.models.scan import Scan
    from app.core.db import AsyncSessionLocal

    status = "failed" if result.get("error") else (
        "partial" if result.get("status") == "partial" else "success"
    )

    try:
        async with AsyncSessionLocal() as session:
            existing = (await session.execute(
                select(Scan).where(Scan.cache_key == cache_key)
            )).scalar_one_or_none()

            if existing:
                existing.score = result.get("score")
                existing.report = result
                existing.status = status
            else:
                session.add(Scan(
                    url=result.get("url", ""),
                    normalized_url=result.get("normalized_url", ""),
                    cache_key=cache_key,
                    score=result.get("score"),
                    report=result,
                    status=status,
                ))

            await session.commit()
            logger.info(f"Cached scan {cache_key[:12]}… ({status})")
    except Exception as e:
        # Never fail a scan because caching failed.
        logger.error(f"Failed to cache scan: {e}")
