"""Sonexial API - Main Application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.api import (
    health_router,
    scans_router,
    stripe_router,
    intake_router,
    approvals_router,
    ops_router,
)

# Setup logging
setup_logging()
logger = get_logger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Sonexial API",
    description="Author infrastructure and GEO optimization service",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(scans_router)
app.include_router(stripe_router)
app.include_router(intake_router)
app.include_router(approvals_router)
app.include_router(ops_router)


@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    logger.info("Sonexial API starting up...")
    logger.info(f"Environment: {settings.app_env}")
    logger.info(f"Database URL: {'***' if settings.database_url else 'NOT SET'}")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    logger.info("Sonexial API shutting down...")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Sonexial API",
        "version": "1.0.0",
        "status": "running",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=(settings.app_env == "development"),
    )
