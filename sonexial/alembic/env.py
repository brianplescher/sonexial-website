from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import all models to ensure they're registered with Base
from app.models import client, site, onboarding, asset, scan, approval, job, llm_call, citation
from app.core.db import Base

config = context.config

if config.get_main_option("sqlalchemy.url"):
    from app.core.config import settings
    # Convert async URL to sync for Alembic
    sync_url = str(settings.database_url).replace('+asyncpg', '')
    config.set_main_option("sqlalchemy.url", sync_url)

if context.is_offline_mode():
    pass
else:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()
