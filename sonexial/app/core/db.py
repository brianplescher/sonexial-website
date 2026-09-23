"""Sonexial Core Database Configuration."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator

from app.core.config import get_settings

settings = get_settings()


def _normalize_database_url(url: str) -> str:
    """Ensure the DATABASE_URL uses an async driver.

    Railway/Supabase/Neon often provide a sync-style URL such as
    postgresql://user:pass@host:5432/db. The async engine requires
    postgresql+asyncpg:// (or postgres://... which SQLAlchemy will not accept).
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


engine = create_async_engine(
    _normalize_database_url(settings.database_url),
    echo=settings.app_env == "development",
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session dependency."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables."""
    # Import models so they register on Base.metadata
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def check_db_connection() -> bool:
    """Return True if the database is reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()
