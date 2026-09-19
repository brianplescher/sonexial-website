"""Sonexial Database Models - LLM Call Log."""
from sqlalchemy import Column, String, DateTime, func, ForeignKey, Integer, Numeric
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.db import Base


class LLMCall(Base):
    """LLMCall model for tracking all LLM API calls and costs."""
    
    __tablename__ = "llm_calls"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent = Column(String, nullable=False, index=True)  # pitch_agent, content_agent, etc.
    model = Column(String, nullable=False)
    related_entity_type = Column(String, nullable=True)  # client, scan, etc.
    related_entity_id = Column(UUID(as_uuid=True), nullable=True)
    input_tokens = Column(Integer, nullable=False)
    output_tokens = Column(Integer, nullable=False)
    estimated_cost_usd = Column(Numeric(12, 6), nullable=False)
    request_hash = Column(String, nullable=True, index=True)
    error = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<LLMCall(id={self.id}, agent={self.agent}, cost={self.estimated_cost_usd})>"
