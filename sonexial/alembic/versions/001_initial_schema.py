"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    
    # Create clients table
    op.create_table('clients',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('email', sa.Text(), nullable=False),
        sa.Column('name', sa.Text(), nullable=True),
        sa.Column('stripe_customer_id', sa.Text(), nullable=True),
        sa.Column('status', sa.Text(), nullable=False, server_default='lead'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_clients_email'), 'clients', ['email'], unique=True)
    
    # Create sites table
    op.create_table('sites',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('slug', sa.Text(), nullable=False),
        sa.Column('primary_domain', sa.Text(), nullable=True),
        sa.Column('preview_url', sa.Text(), nullable=True),
        sa.Column('netlify_site_id', sa.Text(), nullable=True),
        sa.Column('repo_url', sa.Text(), nullable=True),
        sa.Column('status', sa.Text(), nullable=False, server_default='pending'),
        sa.Column('geo_score', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sites_slug'), 'sites', ['slug'], unique=True)
    
    # Create onboardings table
    op.create_table('onboardings',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.Text(), nullable=False, server_default='pending'),
        sa.Column('intake_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('missing_fields', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('validation_errors', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create assets table
    op.create_table('assets',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('type', sa.Text(), nullable=False),
        sa.Column('storage_key', sa.Text(), nullable=False),
        sa.Column('mime_type', sa.Text(), nullable=False),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('bytes', sa.Integer(), nullable=True),
        sa.Column('status', sa.Text(), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create scans table
    op.create_table('scans',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('normalized_url', sa.Text(), nullable=True),
        sa.Column('cache_key', sa.Text(), nullable=False),
        sa.Column('status', sa.Text(), nullable=False, server_default='pending'),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('report', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create approvals table
    op.create_table('approvals',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('type', sa.Text(), nullable=False),
        sa.Column('token_hash', sa.Text(), nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.Text(), nullable=False, server_default='pending'),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('decided_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_approvals_token_hash'), 'approvals', ['token_hash'], unique=True)
    
    # Create jobs table
    op.create_table('jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('type', sa.Text(), nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.Text(), nullable=False, server_default='queued'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_attempts', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('run_after', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('locked_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create llm_calls table
    op.create_table('llm_calls',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('agent', sa.Text(), nullable=False),
        sa.Column('model', sa.Text(), nullable=False),
        sa.Column('related_entity_type', sa.Text(), nullable=True),
        sa.Column('related_entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('input_tokens', sa.Integer(), nullable=False),
        sa.Column('output_tokens', sa.Integer(), nullable=False),
        sa.Column('estimated_cost_usd', sa.Numeric(precision=12, scale=6), nullable=False),
        sa.Column('request_hash', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create citations table
    op.create_table('citations',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('engine', sa.Text(), nullable=False),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('cited', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('response', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('detected_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('citations')
    op.drop_table('llm_calls')
    op.drop_table('jobs')
    op.drop_index(op.f('ix_approvals_token_hash'), table_name='approvals')
    op.drop_table('approvals')
    op.drop_table('scans')
    op.drop_table('assets')
    op.drop_table('onboardings')
    op.drop_index(op.f('ix_sites_slug'), table_name='sites')
    op.drop_table('sites')
    op.drop_index(op.f('ix_clients_email'), table_name='clients')
    op.drop_table('clients')
