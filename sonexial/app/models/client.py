"""Sonexial Database Models - Client."""
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from enum import Enum

from app.core.db import Base


class ClientStatus(str, Enum):
    """Valid client statuses."""
    LEAD = "lead"
    PITCH_DRAFT = "pitch_draft"
    PITCH_APPROVED = "pitch_approved"
    PITCH_SENT = "pitch_sent"
    PAID = "paid"
    ONBOARDING = "onboarding"
    ASSETS_MISSING = "assets_missing"
    READY_TO_BUILD = "ready_to_build"
    BUILD_QUEUED = "build_queued"
    PREVIEW_READY = "preview_ready"
    QA_APPROVED = "qa_approved"
    LIVE = "live"
    RETAINED = "retained"
    CHURNED = "churned"
    FAILED = "failed"


class Client(Base):
    """Client model representing an author/customer."""
    
    __tablename__ = "clients"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True, index=True)
    status = Column(
        String,
        default="lead",
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationships
    sites = relationship("Site", back_populates="client", cascade="all, delete-orphan")
    onboarding = relationship(
        "Onboarding",
        back_populates="client",
        uselist=False,
        cascade="all, delete-orphan",
    )
    assets = relationship("Asset", back_populates="client", cascade="all, delete-orphan")
    citations = relationship(
        "Citation", back_populates="client", cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<Client(id={self.id}, email={self.email}, status={self.status})>"
