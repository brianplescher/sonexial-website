"""Sonexial Core Security Utilities."""
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional


def generate_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_hex(length)


def hash_token(token: str) -> str:
    """Hash a token using SHA256."""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_token(token: str, hashed_token: str) -> bool:
    """Verify a token against its hash."""
    return hash_token(token) == hashed_token


def create_approval_token() -> tuple[str, str]:
    """
    Create a new approval token.
    
    Returns:
        Tuple of (raw_token, hashed_token)
        - raw_token: Send to user via email
        - hashed_token: Store in database
    """
    raw_token = generate_token(32)  # 256-bit token
    hashed_token = hash_token(raw_token)
    return raw_token, hashed_token


def is_token_expired(expires_at: datetime) -> bool:
    """Check if a token has expired."""
    return datetime.utcnow() > expires_at


def get_expiry_timestamp(hours: int = 48) -> datetime:
    """Get expiry timestamp for tokens."""
    return datetime.utcnow() + timedelta(hours=hours)
