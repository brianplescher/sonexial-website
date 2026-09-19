"""GitHub repository management for client sites."""
import os
from typing import Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class GitHubService:
    """Manage GitHub repositories for client sites."""

    def __init__(self):
        self.token = settings.GITHUB_TOKEN
        self.org = settings.GITHUB_ORG or "sonexial"
        self.template_repo = settings.TEMPLATE_REPO or "sonexial-author-site-template"
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def create_client_repo(
        self,
        client_id: str,
        client_slug: str,
    ) -> dict | None:
        """
        Create a new private repo from template for a client.
        
        Args:
            client_id: Client UUID
            client_slug: URL-safe client identifier
            
        Returns:
            Repo info dict or None if failed
        """
        if not self.token:
            logger.warning("GitHub token not configured, skipping repo creation")
            return None
        
        repo_name = f"{settings.CLIENT_REPO_PREFIX or 'site'}-{client_slug}"
        
        # Create repo from template
        url = f"{self.base_url}/repos/{self.org}/{self.template_repo}/generate"
        
        payload = {
            "owner": self.org,
            "name": repo_name,
            "description": f"Author website for client {client_id}",
            "private": True,
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    headers=self.headers,
                    json=payload,
                    timeout=30.0,
                )
                
                if response.status_code == 201:
                    repo_data = response.json()
                    logger.info(f"Created GitHub repo: {repo_data['html_url']}")
                    return {
                        "repo_url": repo_data["html_url"],
                        "repo_name": repo_data["full_name"],
                        "default_branch": repo_data.get("default_branch", "main"),
                    }
                else:
                    logger.error(f"Failed to create repo: {response.status_code} - {response.text}")
                    return None
                    
            except Exception as e:
                logger.error(f"GitHub API error: {e}")
                return None

    async def push_files(
        self,
        repo_name: str,
        files: list[dict],
        commit_message: str = "Initial site generation",
    ) -> bool:
        """
        Push generated files to GitHub repo.
        
        Args:
            repo_name: Full repo name (org/repo)
            files: List of {path, content, encoding} dicts
            commit_message: Commit message
            
        Returns:
            True if successful
        """
        if not self.token:
            return False
        
        # Get latest commit SHA
        branch = "main"
        url = f"{self.base_url}/repos/{repo_name}/git/refs/heads/{branch}"
        
        async with httpx.AsyncClient() as client:
            try:
                # Get branch ref
                response = await client.get(url, headers=self.headers, timeout=10.0)
                if response.status_code != 200:
                    logger.error(f"Failed to get branch ref: {response.text}")
                    return False
                
                commit_sha = response.json()["object"]["sha"]
                
                # Create tree
                tree_items = []
                for file in files:
                    tree_items.append({
                        "path": file["path"],
                        "mode": "100644",
                        "type": "blob",
                        "content": file["content"],
                    })
                
                tree_url = f"{self.base_url}/repos/{repo_name}/git/trees"
                tree_payload = {
                    "base_tree": commit_sha,
                    "tree": tree_items,
                }
                
                tree_response = await client.post(
                    tree_url,
                    headers=self.headers,
                    json=tree_payload,
                    timeout=30.0,
                )
                
                if tree_response.status_code != 201:
                    logger.error(f"Failed to create tree: {tree_response.text}")
                    return False
                
                tree_sha = tree_response.json()["sha"]
                
                # Create commit
                commit_url = f"{self.base_url}/repos/{repo_name}/git/commits"
                commit_payload = {
                    "message": commit_message,
                    "tree": tree_sha,
                    "parents": [commit_sha],
                }
                
                commit_response = await client.post(
                    commit_url,
                    headers=self.headers,
                    json=commit_payload,
                    timeout=30.0,
                )
                
                if commit_response.status_code != 201:
                    logger.error(f"Failed to create commit: {commit_response.text}")
                    return False
                
                new_commit_sha = commit_response.json()["sha"]
                
                # Update branch ref
                update_url = f"{self.base_url}/repos/{repo_name}/git/refs/heads/{branch}"
                update_payload = {"sha": new_commit_sha, "force": False}
                
                update_response = await client.patch(
                    update_url,
                    headers=self.headers,
                    json=update_payload,
                    timeout=10.0,
                )
                
                if update_response.status_code != 200:
                    logger.error(f"Failed to update branch: {update_response.text}")
                    return False
                
                logger.info(f"Pushed {len(files)} files to {repo_name}")
                return True
                
            except Exception as e:
                logger.error(f"GitHub push error: {e}")
                return False

    async def get_repo_info(self, repo_name: str) -> dict | None:
        """Get repository information."""
        if not self.token:
            return None
        
        url = f"{self.base_url}/repos/{repo_name}"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "repo_url": data["html_url"],
                        "clone_url": data["clone_url"],
                        "default_branch": data.get("default_branch", "main"),
                    }
                return None
            except Exception as e:
                logger.error(f"Failed to get repo info: {e}")
                return None
