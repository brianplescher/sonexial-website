"""GEO Scanner API endpoints."""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import HttpUrl, BaseModel
from typing import Dict, Any

from app.core.logging import get_logger
from app.services.scanner import GEOScanner

router = APIRouter(prefix="/scan", tags=["Scanner"])
logger = get_logger(__name__)


class ScanRequest(BaseModel):
    """Request model for scan endpoint."""
    url: HttpUrl


class ScanResponse(BaseModel):
    """Response model for scan endpoint."""
    url: str
    normalized_url: str
    cache_key: str
    score: int
    grade: str
    execution_time_seconds: float
    checks: Dict[str, Any]
    critical_failures: list
    warnings: list
    opportunities: list


@router.post("", response_model=ScanResponse)
async def scan_website(request: ScanRequest):
    """
    Scan a website for GEO optimization.
    
    This endpoint is disabled by default (SCANNER_PUBLIC=false).
    Enable only for internal use or trusted partners.
    """
    from app.core.config import settings
    
    if not settings.SCANNER_PUBLIC:
        raise HTTPException(
            status_code=403,
            detail="Public scanner is disabled. Contact operator for access.",
        )
    
    scanner = GEOScanner()
    
    try:
        # Perform scan
        result = await scanner.scan(str(request.url))
        
        return ScanResponse(**result)
        
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")
