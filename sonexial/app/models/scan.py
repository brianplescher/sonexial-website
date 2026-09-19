"""Sonexial Database Models - Scan."""
from sqlalchemy import Column, String, DateTime, func, Integer, JSON as SAJSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from enum import Enum

from app.core.db import Base


class ScanStatus(str, Enum):
    """Valid scan statuses."""
    PENDING = "pending"
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class Scan(Base):
    """Scan model for GEO audit reports."""
    
    __tablename__ = "scans"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(String, nullable=False, index=True)
    normalized_url = Column(String, nullable=True, index=True)
    cache_key = Column(String, nullable=True, unique=True, index=True)
    status = Column(
        String,
        default="pending",
        nullable=False,
        index=True,
    )
    score = Column(Integer, nullable=True)
    report = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<Scan(id={self.id}, url={self.url}, score={self.score})>"
