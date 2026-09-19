"""Sonexial Core Configuration."""
from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings from environment variables."""
    
    # Application
    app_env: str = "development"
    app_base_url: str = "http://localhost:8000"
    secret_key: str = "dev-secret-key-change-in-production"
    ops_bearer_token: str = "dev-ops-token-change-in-production"
    
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/sonexial"
    
    # Together AI (Qwen Models)
    together_api_key: Optional[str] = None
    qwen_pitch_model: str = "Qwen/Qwen2.5-72B-Instruct-Turbo"
    qwen_content_model: str = "Qwen/Qwen2.5-Coder-32B-Instruct"
    qwen_schema_model: str = "Qwen/Qwen2.5-Coder-32B-Instruct"
    qwen_classifier_model: str = "Qwen/Qwen2.5-7B-Instruct-Turbo"
    llm_monthly_budget_usd: float = 50.0
    
    # Stripe
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_price_geo_scan: str = "price_geo_scan_297"
    stripe_price_foundation: str = "price_foundation_1500"
    stripe_price_platform: str = "price_platform_3000"
    stripe_price_retainer: str = "price_retainer_300"
    
    # Email (Resend)
    resend_api_key: Optional[str] = None
    email_from: str = "Sonexial <noreply@sonexial.com>"
    operator_email: str = "operator@example.com"
    support_email: str = "support@example.com"
    physical_mailing_address: str = "[PHYSICAL_MAILING_ADDRESS]"
    
    # Storage
    storage_backend: str = "local"
    local_storage_dir: str = "./storage"
    supabase_url: Optional[str] = None
    supabase_service_key: Optional[str] = None
    
    # GitHub
    github_token: Optional[str] = None
    github_org: str = ""
    template_repo: str = "sonexial-author-site-template"
    client_repo_prefix: str = "sonexial-site"
    
    # Netlify
    netlify_auth_token: Optional[str] = None
    netlify_team_slug: str = ""
    
    # Scanner
    scanner_public: bool = False
    scanner_rate_limit_per_hour: int = 10
    cache_ttl_seconds: int = 86400
    
    # Perplexity (Optional)
    perplexity_api_key: Optional[str] = None
    
    # Domain
    domain: str = "sonexial.com"
    
    # CORS
    allowed_origins: list[str] = ["http://localhost:3000", "https://www.sonexial.com"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

# Global settings instance for easy access
settings = get_settings()
