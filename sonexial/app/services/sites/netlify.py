"""Netlify deployment service."""
import os
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class NetlifyService:
    """Deploy static sites to Netlify."""

    def __init__(self):
        self.token = settings.NETLIFY_AUTH_TOKEN
        self.team_slug = settings.NETLIFY_TEAM_SLUG
        self.base_url = "https://api.netlify.com/api/v1"
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        } if self.token else {}

    async def create_site(
        self,
        site_name: str,
        dist_dir: str,
    ) -> dict | None:
        """
        Create a new Netlify site and deploy.
        
        Args:
            site_name: Site name (will be used for subdomain)
            dist_dir: Directory containing built site files
            
        Returns:
            Site info dict or None if failed
        """
        if not self.token:
            logger.warning("Netlify token not configured, skipping deployment")
            return None
        
        # Read all files from dist directory
        files = self._read_directory(dist_dir)
        
        url = f"{self.base_url}/sites"
        payload = {
            "name": site_name,
            "account_slug": self.team_slug,
            "deploy_hook": True,
        }
        
        async with httpx.AsyncClient() as client:
            try:
                # Create site
                response = await client.post(
                    url,
                    headers=self.headers,
                    json=payload,
                    timeout=30.0,
                )
                
                if response.status_code != 201:
                    logger.error(f"Failed to create site: {response.status_code} - {response.text}")
                    return None
                
                site_data = response.json()
                site_id = site_data["id"]
                
                logger.info(f"Created Netlify site: {site_data['ssl_url']}")
                
                # Deploy files
                deploy_result = await self._deploy_files(site_id, files)
                if not deploy_result:
                    logger.error("Failed to deploy files to Netlify")
                    return None
                
                return {
                    "site_id": site_id,
                    "site_url": site_data.get("url"),
                    "admin_url": site_data.get("admin_url"),
                    "ssl_url": site_data.get("ssl_url"),
                    "deploy_url": deploy_result.get("deploy_url"),
                }
                
            except Exception as e:
                logger.error(f"Netlify API error: {e}")
                return None

    async def _deploy_files(
        self,
        site_id: str,
        files: dict,
    ) -> dict | None:
        """Deploy files to existing site."""
        url = f"{self.base_url}/sites/{site_id}/deploys"
        
        # Netlify expects a special format for deploys
        # For simplicity, we'll use the deploy hook approach
        # In production, you'd use their CLI or more sophisticated API
        
        payload = {
            "files": files,
            "async": True,
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    headers=self.headers,
                    json=payload,
                    timeout=60.0,
                )
                
                if response.status_code in [200, 201]:
                    deploy_data = response.json()
                    return {
                        "deploy_id": deploy_data.get("id"),
                        "deploy_url": deploy_data.get("deploy_ssl_url"),
                        "state": deploy_data.get("state"),
                    }
                else:
                    logger.error(f"Deploy failed: {response.status_code} - {response.text}")
                    return None
                    
            except Exception as e:
                logger.error(f"Deploy error: {e}")
                return None

    def _read_directory(self, dir_path: str) -> dict:
        """Read all files in directory for Netlify upload."""
        files = {}
        base_path = Path(dir_path)
        
        for file_path in base_path.rglob("*"):
            if file_path.is_file():
                rel_path = str(file_path.relative_to(base_path))
                
                # Skip node_modules and other unnecessary files
                if "node_modules" in rel_path or ".git" in rel_path:
                    continue
                
                try:
                    # Read as binary for non-text files
                    if file_path.suffix in [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf"]:
                        with open(file_path, "rb") as f:
                            content = f.read().hex()
                        files[rel_path] = {"content": content, "encoding": "hex"}
                    else:
                        with open(file_path, "r", encoding="utf-8") as f:
                            files[rel_path] = {"content": f.read()}
                except Exception as e:
                    logger.warning(f"Failed to read {file_path}: {e}")
        
        return files

    async def trigger_deploy_hook(
        self,
        deploy_hook_url: str,
    ) -> bool:
        """Trigger a Netlify deploy hook."""
        if not deploy_hook_url:
            return False
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(deploy_hook_url, timeout=10.0)
                return response.status_code in [200, 204]
            except Exception as e:
                logger.error(f"Deploy hook failed: {e}")
                return False

    async def get_site_info(self, site_id: str) -> dict | None:
        """Get site information from Netlify."""
        if not self.token:
            return None
        
        url = f"{self.base_url}/sites/{site_id}"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "site_id": data["id"],
                        "name": data.get("name"),
                        "url": data.get("url"),
                        "ssl_url": data.get("ssl_url"),
                        "admin_url": data.get("admin_url"),
                        "deploy_hook": data.get("deploy_hook"),
                    }
                return None
            except Exception as e:
                logger.error(f"Failed to get site info: {e}")
                return None
