"""Sonexial Scanner - Rate Limiting."""
from datetime import datetime, timedelta
from typing import Optional

from app.core.config import get_settings
from app.core.logging import StructuredLogger

logger = StructuredLogger("scanner.rate_limit")

settings = get_settings()


async def check_rate_limit(identifier: str) -> tuple[bool, Optional[int]]:
    """
    Check if request is within rate limit using database-backed tracking.
    
    Args:
        identifier: IP address or API key identifier
    
    Returns:
        Tuple of (allowed: bool, retry_after_seconds: Optional[int])
        - allowed: True if request can proceed
        - retry_after_seconds: Seconds until next allowed request (if blocked)
    """
    from sqlalchemy import select, func
    from app.models.scan import Scan
    from app.core.db import AsyncSessionLocal
    
    async with AsyncSessionLocal() as session:
        # Count scans in the last hour
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        
        result = await session.execute(
            select(func.count(Scan.id)).where(
                Scan.normalized_url == identifier,
                Scan.created_at >= one_hour_ago,
            )
        )
        count = result.scalar() or 0
        
        if count >= settings.scanner_rate_limit_per_hour:
            # Calculate when oldest scan expires
            oldest_result = await session.execute(
                select(Scan.created_at).where(
                    Scan.normalized_url == identifier,
                    Scan.created_at >= one_hour_ago,
                ).order_by(Scan.created_at.asc()).limit(1)
            )
            oldest = oldest_result.scalar_one_or_none()
            
            if oldest:
                retry_after = int((oldest + timedelta(hours=1) - datetime.utcnow()).total_seconds())
                retry_after = max(0, retry_after)
                
                logger.warning(
                    f"Rate limit exceeded for {identifier}: {count}/{settings.scanner_rate_limit_per_hour}"
                )
                return False, retry_after
        
        return True, None
