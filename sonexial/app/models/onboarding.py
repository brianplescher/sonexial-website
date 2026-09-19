"""Sonexial Database Models - Onboarding."""
from sqlalchemy import Column, String, DateTime, func, ForeignKey, JSON as SAJSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from enum import Enum

from app.core.db import Base


class OnboardingStatus(str, Enum):
    """Valid onboarding statuses."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    ASSETS_MISSING = "assets_missing"
    VALIDATED = "validated"
    READY_TO_BUILD = "ready_to_build"
    COMPLETED = "completed"


class Onboarding(Base):
    """Onboarding model tracking client intake progress."""
    
    __tablename__ = "onboardings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    status = Column(
        String,
        default="pending",
        nullable=False,
        index=True,
    )
    intake_data = Column(JSONB, nullable=True)
    missing_fields = Column(JSONB, nullable=True, default=list)
    validation_errors = Column(JSONB, nullable=True, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationships
    client = relationship("Client", back_populates="onboarding")
    
    def __repr__(self):
        return f"<Onboarding(id={self.id}, client_id={self.client_id}, status={self.status})>"
