"""Sonexial Core Storage Service."""
import os
import aiofiles
from pathlib import Path
from typing import Optional, BinaryIO
import logging

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class LocalStorage:
    """Local filesystem storage backend."""
    
    def __init__(self):
        self.base_dir = Path(settings.local_storage_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
    
    async def save_file(
        self,
        content: bytes,
        filename: str,
        subdirectory: Optional[str] = None,
    ) -> str:
        """
        Save a file to local storage.
        
        Args:
            content: File content as bytes
            filename: Original filename
            subdirectory: Optional subdirectory (e.g., client ID)
        
        Returns:
            Storage key (relative path)
        """
        if subdirectory:
            dir_path = self.base_dir / subdirectory
            dir_path.mkdir(parents=True, exist_ok=True)
        else:
            dir_path = self.base_dir
        
        storage_path = dir_path / filename
        
        async with aiofiles.open(storage_path, 'wb') as f:
            await f.write(content)
        
        return str(storage_path.relative_to(self.base_dir))
    
    async def read_file(self, storage_key: str) -> Optional[bytes]:
        """Read a file from local storage."""
        try:
            file_path = self.base_dir / storage_key
            async with aiofiles.open(file_path, 'rb') as f:
                return await f.read()
        except FileNotFoundError:
            logger.error(f"File not found: {storage_key}")
            return None
    
    async def delete_file(self, storage_key: str) -> bool:
        """Delete a file from local storage."""
        try:
            file_path = self.base_dir / storage_key
            file_path.unlink()
            return True
        except FileNotFoundError:
            logger.warning(f"File not found for deletion: {storage_key}")
            return False
    
    def get_url(self, storage_key: str) -> str:
        """Get URL for a stored file (for local dev only)."""
        return f"/static/storage/{storage_key}"


class SupabaseStorage:
    """Supabase Storage backend (stub for production)."""
    
    def __init__(self):
        if not settings.supabase_url or not settings.supabase_service_key:
            raise ValueError("Supabase credentials not configured")
        
        # Would initialize Supabase client here
        logger.info("Supabase storage initialized (stub)")
    
    async def save_file(
        self,
        content: bytes,
        filename: str,
        subdirectory: Optional[str] = None,
    ) -> str:
        """Save file to Supabase Storage (stub)."""
        # Implementation would use supabase-py library
        storage_key = f"{subdirectory}/{filename}" if subdirectory else filename
        logger.info(f"Would save to Supabase: {storage_key}")
        return storage_key
    
    async def read_file(self, storage_key: str) -> Optional[bytes]:
        """Read file from Supabase Storage (stub)."""
        logger.info(f"Would read from Supabase: {storage_key}")
        return None
    
    async def delete_file(self, storage_key: str) -> bool:
        """Delete file from Supabase Storage (stub)."""
        logger.info(f"Would delete from Supabase: {storage_key}")
        return True
    
    def get_url(self, storage_key: str) -> str:
        """Get public URL for stored file."""
        return f"{settings.supabase_url}/storage/v1/object/public/{storage_key}"


def get_storage():
    """Get appropriate storage backend based on configuration."""
    if settings.storage_backend == "supabase":
        return SupabaseStorage()
    else:
        return LocalStorage()


# Global storage instance
storage = get_storage()
