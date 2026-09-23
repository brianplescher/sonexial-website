"""Sonexial API - Main Application."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.db import init_db, close_db
from app.core.logging import setup_logging, get_logger
from app.api import (
    health_router,
    scans_router,
    stripe_router,
    intake_router,
    approvals_router,
    ops_router,
)

settings = get_settings()

# Setup logging
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info("Sonexial API starting up...")
    logger.info(f"Environment: {settings.app_env}")
    # Create tables if they don't exist (idempotent; Alembic owns the schema
    # in production, but this keeps first-boot on Railway/Supabase painless).
    try:
        await init_db()
        logger.info("Database schema ensured.")
    except Exception as e:
        logger.warning(
            f"DB not reachable at startup (will retry per-request): {e}"
        )
    yield
    logger.info("Sonexial API shutting down...")
    try:
        await close_db()
    except Exception:
        pass


app = FastAPI(
    title="Sonexial API",
    description="Author infrastructure and GEO optimization service",
    version="1.0.0",
    lifespan=lifespan,
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
