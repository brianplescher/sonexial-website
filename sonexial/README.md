# Sonexial

Author infrastructure and book marketing service focused on Generative Engine Optimization (GEO).

## Quick Start

```bash
# Install dependencies
make install

# Set up environment
cp .env.example .env
# Edit .env with your secrets

# Start database (Docker required)
docker-compose up -d postgres

# Run migrations
make db-upgrade

# Seed development data
make seed

# Start API server
make dev

# Start worker in another terminal
make worker
```

## Project Structure

- `app/` - Main application code
  - `core/` - Configuration, logging, security, database
  - `models/` - SQLAlchemy database models
  - `api/` - FastAPI endpoints
  - `services/` - Business logic (scanner, agents, intake, sites, reporting)
  - `worker/` - Background job processor
- `site_template/` - Jinja2 templates for client sites
- `scripts/` - Utility scripts
- `tests/` - Pytest test suite
- `docs/` - Documentation

## Key Commands

```bash
make dev              # Start FastAPI server
make worker           # Start background job processor
make test             # Run tests
make lint             # Run linters
make scan URL=...     # Scan a website for GEO issues
make create-client EMAIL=...  # Create a test client
make generate-site CLIENT_ID=...  # Generate a client site
```

## Environment Variables

See `.env.example` for all required variables. Key ones:

- `DATABASE_URL` - PostgreSQL connection string
- `TOGETHER_API_KEY` - Together AI API key for Qwen models
- `STRIPE_SECRET_KEY` - Stripe API key
- `RESEND_API_KEY` - Resend email API key
- `OPS_BEARER_TOKEN` - Secret token for ops endpoints

## Documentation

- [Runbook](docs/runbook.md) - Operational procedures
- [Deployment](docs/deployment.md) - Production deployment guide
- [Stripe](docs/stripe.md) - Stripe integration details
- [Qwen Costs](docs/qwen-costs.md) - LLM cost tracking

## License

Proprietary. All rights reserved.
