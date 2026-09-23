"""GEO Scanner API endpoints."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, HttpUrl
from typing import Dict, Any, List

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.scanner import GEOScanner

router = APIRouter(tags=["Scanner"])
logger = get_logger(__name__)


class ScanRequest(BaseModel):
    """Request model for scan endpoint."""
    url: HttpUrl


class ScanResponse(BaseModel):
    """Response model for scan endpoint."""
    url: str
    normalized_url: str
    cache_key: str
    status: str = "success"
    score: int
    grade: str
    execution_time_seconds: float
    checks: Dict[str, Any]
    critical_failures: List[Dict[str, Any]]
    warnings: List[Dict[str, Any]]
    opportunities: List[Dict[str, Any]]
    cached: bool = False


@router.post("/scan", response_model=ScanResponse)
async def scan_website(request: ScanRequest, http_request: Request):
    """
    Scan a website for GEO optimization.

    Public access is gated by SCANNER_PUBLIC (default false). When disabled,
    the operator's bearer token (OPS_BEARER_TOKEN) is required so internal
    tools and the worker can still call it.

    Target-site failures return a partial report (HTTP 200), never a 500.
    """
    settings = get_settings()

    if not settings.scanner_public:
        auth = http_request.headers.get("Authorization", "")
        expected = f"Bearer {settings.ops_bearer_token}"
        if auth != expected:
            raise HTTPException(
                status_code=403,
                detail="Public scanner is disabled. Provide operator bearer token.",
            )

    scanner = GEOScanner()

    try:
        result = await scanner.scan(str(request.url))
    except Exception as e:  # Defensive: scanner should never raise, but don't 500
        logger.error(f"Unexpected scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {e}")

    return ScanResponse(**{
        k: v for k, v in result.items()
        if k in ScanResponse.model_fields
    })
