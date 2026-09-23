# Assumptions

This file records all non-obvious choices made during implementation.

## LLM Pricing Assumptions

| Model | Input USD / 1M | Output USD / 1M |
|---|---:|---:|
| Qwen2.5-72B-Instruct-Turbo | 0.90 | 0.90 |
| Qwen2.5-Coder-32B-Instruct | 0.80 | 0.80 |
| Qwen2.5-7B-Instruct-Turbo | 0.20 | 0.20 |

These are estimates based on typical Together AI pricing. Actual prices may vary and should be updated in `app/services/agents/cost.py`.

## Infrastructure Assumptions

1. **Database**: Using Supabase Postgres as the default. Connection string format: `postgresql://user:pass@host:port/dbname`
2. **Storage**: Default to local filesystem in development, Supabase Storage in production
3. **Worker**: Single worker process polling every 5 seconds. Sufficient for <100 jobs/hour
4. **Email**: Resend used for all transactional emails. Free tier supports 3,000 emails/month
5. **LLM Budget**: Default monthly budget of $50 USD. Configurable via `LLM_MONTHLY_BUDGET_USD`

## Security Assumptions

1. **SSRF Protection**: DNS resolution performed before any HTTP request. Private IP ranges blocked at DNS level
2. **Approval Tokens**: 256-bit random tokens, SHA256 hashed before storage, 48-hour expiry
3. **Ops Bearer Token**: Single shared secret for all ops endpoints. Rotate periodically
4. **Stripe Webhooks**: Signature verification required. Secret stored in `STRIPE_WEBHOOK_SECRET`

## GEO Scanner Assumptions

1. **Cache TTL**: Default 24 hours (86400 seconds). Balances freshness vs cost
2. **Rate Limiting**: Default 10 scans/hour for public endpoint. Prevents abuse
3. **Timeout**: 10 seconds per HTTP request. 3 retries with exponential backoff
4. **Score Threshold**: Sites scoring <85 fail CI gate. Allows minor warnings but blocks critical failures

## Site Generator Assumptions

1. **Template Repo**: Single GitHub template repo `sonexial-author-site-template`
2. **Client Repos**: One private repo per client named `sonexial-site-{client-slug}`
3. **Netlify**: Team slug required for automated site creation. Manual fallback available
4. **Static Output**: All sites generated as pure HTML/CSS. No JavaScript build step

## Email Assumptions

1. **From Address**: Format `Sonexial <noreply@{domain}>` 
2. **Physical Address**: Placeholder `[PHYSICAL_MAILING_ADDRESS]` must be replaced before production
3. **Unsubscribe**: Placeholder link included. Actual implementation deferred until list management needed

## Development Assumptions

1. **Python Version**: 3.12+ required for latest asyncio features
2. **Package Manager**: `uv` preferred, fallback to `pip` with venv
3. **Testing**: PostgreSQL not required for tests. SQLite used as test database
4. **Local Dev**: Docker Compose for Postgres only. All other services mocked or stubbed

## Cost Guardrails

1. **Scanner**: ~$0.002 per scan in LLM costs (pitch agent only)
2. **Site Build**: ~$0.50 per site in LLM costs (content + schema agents)
3. **Citation Monitoring**: ~$0.04 per query (classifier agent). Max 20 queries/client/month = $0.80
4. **Infrastructure Target**: <$30/month at 1,000 audits includes hosting, database, email, and LLM costs
