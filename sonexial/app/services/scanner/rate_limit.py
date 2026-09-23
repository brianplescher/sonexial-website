"""Sonexial Scanner - Rate Limiting (Postgres-backed)."""
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from app.core.config import get_settings
from app.core.logging import StructuredLogger

logger = StructuredLogger("scanner.rate_limit")

settings = get_settings()


async def check_rate_limit(identifier: str) -> Tuple[bool, Optional[int]]:
    """Check if request is within rate limit using database-backed tracking.

    Args:
        identifier: IP address or hostname used as the rate-limit bucket.

    Returns:
        Tuple of (allowed: bool, retry_after_seconds: Optional[int])
        If the database is unreachable, fail OPEN for availability but log it —
        the scanner is operator-triggered in v1 and public mode stays disabled.
    """
    from sqlalchemy import select, func
    from app.models.scan import Scan
    from app.core.db import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)

            result = await session.execute(
                select(func.count(Scan.id)).where(
                    Scan.normalized_url == identifier,
                    Scan.created_at >= one_hour_ago,
                )
            )
            count = result.scalar() or 0

            if count >= settings.scanner_rate_limit_per_hour:
                oldest_result = await session.execute(
                    select(Scan.created_at)
                    .where(
                        Scan.normalized_url == identifier,
                        Scan.created_at >= one_hour_ago,
                    )
                    .order_by(Scan.created_at.asc())
                    .limit(1)
                )
                oldest = oldest_result.scalar_one_or_none()

                retry_after = 3600
                if oldest is not None:
                    if oldest.tzinfo is None:
                        oldest = oldest.replace(tzinfo=timezone.utc)
                    retry_after = max(
                        0, int((oldest + timedelta(hours=1) - datetime.now(timezone.utc)).total_seconds())
                    )

                logger.warning(
                    f"Rate limit exceeded for {identifier}: "
                    f"{count}/{settings.scanner_rate_limit_per_hour}"
                )
                return False, retry_after

            return True, None
    except Exception as e:
        # Fail open on DB errors so scans still work; log loudly.
        logger.error(f"Rate limit check failed (allowing request): {e}")
        return True, None
