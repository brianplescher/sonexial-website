"""Sonexial Database Models - Asset."""
from sqlalchemy import Column, String, DateTime, func, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from enum import Enum

from app.core.db import Base


class AssetType(str, Enum):
    """Valid asset types."""
    HEADSHOT = "headshot"
    BOOK_COVER = "book_cover"
    LOGO = "logo"
    FAVICON = "favicon"


class AssetStatus(str, Enum):
    """Valid asset statuses."""
    PENDING = "pending"
    VALID = "valid"
    INVALID = "invalid"
    REPLACED = "replaced"


class Asset(Base):
    """Asset model for client files (headshots, book covers, etc.)."""
    
    __tablename__ = "assets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    site_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sites.id", ondelete="SET NULL"),
        nullable=True,
    )
    type = Column(String, nullable=False, index=True)  # headshot, book_cover, logo, favicon
    storage_key = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    bytes = Column(Integer, nullable=True)
    status = Column(
        String,
        default="pending",
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    client = relationship("Client", back_populates="assets")
    
    def __repr__(self):
        return f"<Asset(id={self.id}, type={self.type}, status={self.status})>"
