"""Sonexial Database Models - Citation."""
from sqlalchemy import Column, String, DateTime, func, ForeignKey, Boolean, JSON as SAJSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from app.core.db import Base


class Citation(Base):
    """Citation model for tracking AI engine citations of client work."""
    
    __tablename__ = "citations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    engine = Column(String, nullable=False, index=True)  # perplexity, chatgpt, claude, etc.
    query = Column(String, nullable=False)
    cited = Column(Boolean, default=False, index=True)
    response = Column(JSONB, nullable=True)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    client = relationship("Client", back_populates="citations")
    
    def __repr__(self):
        return f"<Citation(id={self.id}, client_id={self.client_id}, engine={self.engine})>"
