"""Sonexial Core Package."""
from app.core.config import get_settings
from app.core.logging import setup_logging, StructuredLogger
from app.core.security import generate_token, hash_token, verify_token, create_approval_token
from app.core.db import get_db, init_db, close_db, Base
from app.core.email import send_email, create_intake_email, create_approval_email
from app.core.storage import storage, LocalStorage, SupabaseStorage

__all__ = [
    "get_settings",
    "setup_logging",
    "StructuredLogger",
    "generate_token",
    "hash_token",
    "verify_token",
    "create_approval_token",
    "get_db",
    "init_db",
    "close_db",
    "Base",
    "send_email",
    "create_intake_email",
    "create_approval_email",
    "storage",
    "LocalStorage",
    "SupabaseStorage",
]
