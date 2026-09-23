"""Health check endpoint."""
from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "sonexial-api",
    }


@router.get("/ready")
async def readiness_check():
    """Readiness check - verifies database connectivity."""
    from app.core.db import check_db_connection
    
    db_ok = await check_db_connection()
    
    return {
        "status": "ready" if db_ok else "not_ready",
        "database": "connected" if db_ok else "disconnected",
        "timestamp": datetime.utcnow().isoformat(),
    }
