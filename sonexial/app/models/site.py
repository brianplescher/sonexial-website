"""Sonexial Database Models - Site."""
from sqlalchemy import Column, String, DateTime, func, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.core.db import Base


class Site(Base):
    """Site model representing a client's author website."""
    
    __tablename__ = "sites"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slug = Column(String, unique=True, nullable=False, index=True)
    primary_domain = Column(String, nullable=True)
    preview_url = Column(String, nullable=True)
    netlify_site_id = Column(String, nullable=True)
    repo_url = Column(String, nullable=True)
    status = Column(
        String,
        default="build_queued",
        nullable=False,
        index=True,
    )
    geo_score = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationships
    client = relationship("Client", back_populates="sites")
    
    def __repr__(self):
        return f"<Site(id={self.id}, slug={self.slug}, status={self.status})>"
