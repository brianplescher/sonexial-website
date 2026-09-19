"""Sonexial Database Models - Job."""
from sqlalchemy import Column, String, DateTime, func, ForeignKey, Integer, JSON as SAJSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from enum import Enum

from app.core.db import Base


class JobType(str, Enum):
    """Valid job types."""
    SCAN_URL = "scan_url"
    GENERATE_PITCH = "generate_pitch"
    GENERATE_CONTENT = "generate_content"
    GENERATE_SCHEMA = "generate_schema"
    SEND_INTAKE_EMAIL = "send_intake_email"
    SEND_ASSET_REMINDER = "send_asset_reminder"
    CREATE_CLIENT_REPO = "create_client_repo"
    BUILD_SITE = "build_site"
    DEPLOY_PREVIEW = "deploy_preview"
    PREPARE_MONTHLY_REPORT = "prepare_monthly_report"
    NOTIFY_OPERATOR = "notify_operator"


class JobStatus(str, Enum):
    """Valid job statuses."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD = "dead"


class Job(Base):
    """Job model for background worker queue."""
    
    __tablename__ = "jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String, nullable=False, index=True)
    payload = Column(JSONB, nullable=True)
    status = Column(
        String,
        default="queued",
        nullable=False,
        index=True,
    )
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    run_after = Column(DateTime(timezone=True), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Valid statuses
    VALID_STATUSES = ["queued", "running", "completed", "failed", "dead"]
    
    def __repr__(self):
        return f"<Job(id={self.id}, type={self.type}, status={self.status})>"
