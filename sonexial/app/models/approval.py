"""Sonexial Database Models - Approval."""
from sqlalchemy import Column, String, DateTime, func, ForeignKey, JSON as SAJSON, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from enum import Enum

from app.core.db import Base


class ApprovalType(str, Enum):
    """Valid approval types."""
    OUTBOUND_PITCH = "outbound_pitch"
    CLIENT_BUILD = "client_build"
    PRODUCTION_DEPLOY = "production_deploy"
    MONTHLY_REPORT = "monthly_report"
    SCHEMA_OVERRIDE = "schema_override"


class ApprovalStatus(str, Enum):
    """Valid approval statuses."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class Approval(Base):
    """Approval model for operator approval workflow."""
    
    __tablename__ = "approvals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String, nullable=False, index=True)  # outbound_pitch, client_build, etc.
    token_hash = Column(String, unique=True, nullable=False, index=True)
    payload = Column(JSONB, nullable=True)
    status = Column(
        String,
        default="pending",
        nullable=False,
        index=True,
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<Approval(id={self.id}, type={self.type}, status={self.status})>"
