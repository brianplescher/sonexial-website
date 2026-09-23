# Sonexial Agentic Automation — AI Coder Project Brief

Read this entire file before writing code.

You are building a low-cost, solo-operator automation system for **Sonexial**, an author infrastructure and book marketing service focused on Generative Engine Optimization (GEO). The operator has **0 clients, 0 revenue**, and limited weekly time. The system must be cheap, boring, debuggable, and asynchronous.

If anything is ambiguous:

1. Choose the simplest implementation that satisfies the constraints.
2. Do not add SaaS dependencies.
3. Do not ask follow-up questions unless blocked by a missing local file or secret.
4. Record every assumption in `ASSUMPTIONS.md`.

---

## 1. Business Context

**Business name:** Sonexial  
**Domain:** sonexial.com  
**Operator:** one person, no team  
**Current stage:** pre-revenue  
**Goal:** generate side revenue with minimal ongoing manual effort, then scale into a productized service.

Sonexial helps indie authors become visible to AI recommendation engines such as ChatGPT, Claude, Perplexity, and Gemini by adding semantic structure, entity clarity, machine-readable schemas, and AI-friendly content roadmaps to author websites.

### Offers

Use these defaults unless operator overrides them:

| Offer | Price | Deliverables |
|---|---:|---|
| Author GEO Scan | $297 | Automated/manual GEO scan, failure report, prioritized fix list, pitch summary |
| Author Foundation | $1,500 | JSON-LD schema, `llms.txt`, `robots.txt`, sitemap, canonical/meta fixes |
| Author Platform | $3,000 | Full static author site with GEO baked in, deployed to Netlify |
| GEO Retainer | $300/month | Citation monitoring, monthly report, small schema/content updates |

### Target Customer

Indie authors who:

- have an existing website or no website at all,
- have at least one published book,
- want discovery through AI recommendation engines,
- do not want to learn technical SEO/GEO themselves.

---

## 2. Non-Negotiable Constraints

The generated system must obey all of the following.

1. **Marginal infrastructure cost must approach zero below 100 audits/month.**
2. **Total infrastructure cost must stay under $30/month at 1,000 audits/month.**
3. **No per-operation SaaS orchestrators.**
   - Make.com, Zapier, n8n Cloud, Pipedream, etc. are rejected.
4. **Netlify stays.**
   - Client sites deploy to Netlify.
   - Do not propose Vercel.
5. **Python is the primary backend language.**
   - JavaScript is acceptable only for the static site build or minimal edge behavior.
6. **No headless CMS subscription.**
   - Sanity, Contentful, Strapi Cloud, etc. are rejected.
7. **No OpenClaw.**
8. **No Telegram bots.**
9. **No OpenRouter.**
10. **No Anthropic models.**
11. **Use Qwen models if possible.**
12. **No paid API before first revenue unless explicitly enabled.**
13. **No Amazon scraping.**
14. **Single-operator failure modes matter.**
   - If the operator is asleep or working a day job, queued work must persist.
   - No lost jobs.
   - No accidental client spam.
   - Failures must notify the operator, not the client.
15. **Every LLM call must be logged.**
   - model,
   - input tokens,
   - output tokens,
   - estimated cost USD,
   - agent name,
   - timestamp,
   - related entity ID.

---

## 3. Explicitly Rejected Patterns

Do not build or recommend:

- Telegram-bound agents.
- OpenClaw.
- LangChain agents unless absolutely unavoidable; prefer direct API calls.
- Multi-agent chat meshes.
- Real-time dashboards for clients.
- Client login portal in v1.
- Headless CMS.
- Amazon scraping.
- HeyGen or video avatar generation.
- Make.com/Zapier automation.
- Complex Kubernetes or Docker Swarm setups.
- Paid analytics in v1.
- Newsletter infrastructure unless client explicitly needs it.

---

## 4. Target Stack

Use this stack unless a local environment constraint blocks it.

### Backend

- Python 3.12
- FastAPI
- Pydantic v2
- httpx
- lxml
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Pillow
- Stripe Python SDK
- Resend Python SDK or plain HTTP
- OpenAI-compatible client for Qwen via Together AI

### LLM Provider

Primary provider:

```text
Together AI
Base URL: https://api.together.xyz/v1
```

Default models:

| Use Case | Model |
|---|---|
| Pitch drafting | `Qwen/Qwen2.5-72B-Instruct-Turbo` |
| Content/schema generation | `Qwen/Qwen2.5-Coder-32B-Instruct` |
| Cheap classification | `Qwen/Qwen2.5-7B-Instruct-Turbo` |

All model names must be configurable through environment variables.

If Together AI is unavailable, support a Qwen-compatible OpenAI-style endpoint via environment variables, but do not default to OpenRouter or Anthropic.

### Frontend / Client Sites

Default to **Python-generated static HTML/CSS** using Jinja2.

Rationale:

- operator already has static HTML/CSS,
- fewer build dependencies,
- Python remains primary,
- easy to validate GEO artifacts,
- no JavaScript required for crawlability.

The site generator must be component-driven through Jinja2 macros/partials.

Do not use client-side modals for important content. All important content must be crawlable HTML pages.

### Hosting

- Python API/worker: Fly.io or Railway.
- Static client sites: Netlify.
- Database: Supabase Postgres or Neon Postgres.
- File storage: Supabase Storage or local filesystem in development.

### CI/CD

- GitHub Actions.
- GEO validator runs as a CI gate.
- Client site deploys through Netlify.

---

## 5. Required Repository Layout

Generate a monorepo named `sonexial` with this structure:

```text
sonexial/
  README.md
  PROJECT_BRIEF.md
  ASSUMPTIONS.md
  Makefile
  .env.example
  pyproject.toml
  alembic.ini
  docs/
    runbook.md
    deployment.md
    stripe.md
    qwen-costs.md
  app/
    __init__.py
    main.py
    core/
      config.py
      logging.py
      security.py
      db.py
      email.py
      storage.py
    models/
      __init__.py
      client.py
      site.py
      onboarding.py
      asset.py
      scan.py
      approval.py
      job.py
      llm_call.py
      citation.py
    api/
      __init__.py
      health.py
      scans.py
      webhooks_stripe.py
      intake.py
      approvals.py
      ops.py
    services/
      scanner/
        __init__.py
        fetch.py
        rubric.py
        ssrf.py
        cache.py
        rate_limit.py
        taxonomy.py
      agents/
        __init__.py
        qwen_client.py
        cost.py
        pitch_agent.py
        content_agent.py
        schema_agent.py
        citation_classifier.py
      intake/
        __init__.py
        validation.py
        reminders.py
      sites/
        __init__.py
        generator.py
        github_repo.py
        netlify.py
      reporting/
        __init__.py
        monthly.py
    worker/
      __init__.py
      runner.py
      jobs.py
  site_template/
    site.json
    templates/
      base.html
      home.html
      about.html
      books.html
      book.html
      qa.html
      contact.html
      error.html
    partials/
      head.html
      header.html
      footer.html
      jsonld_person.html
      jsonld_book.html
      meta.html
    static/
      css/
        main.css
      robots.txt
      llms.txt
      sitemap.xml
  scripts/
    seed_dev.py
    create_stripe_products.py
    create_client_repo.py
    generate_site.py
    scan_url.py
    send_test_email.py
  tests/
    conftest.py
    fixtures/
      good_site.html
      bad_site.html
      robots_blocked_ai.txt
      robots_good.txt
      llms_good.txt
    test_scanner_rubric.py
    test_ssrf.py
    test_approvals.py
    test_stripe_webhook.py
    test_agents.py
    test_site_generator.py
```

---

## 6. Core Data Model

Use PostgreSQL with SQLAlchemy models.

### clients

```text
id UUID PK
email TEXT UNIQUE
name TEXT
stripe_customer_id TEXT NULL
status TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Statuses:

```text
lead
pitch_draft
pitch_approved
pitch_sent
paid
onboarding
assets_missing
ready_to_build
build_queued
preview_ready
qa_approved
live
retained
churned
failed
```

### sites

```text
id UUID PK
client_id UUID FK
slug TEXT UNIQUE
primary_domain TEXT NULL
preview_url TEXT NULL
netlify_site_id TEXT NULL
repo_url TEXT NULL
status TEXT
geo_score INT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### onboardings

```text
id UUID PK
client_id UUID FK
status TEXT
intake_data JSONB
missing_fields JSONB
validation_errors JSONB
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### assets

```text
id UUID PK
client_id UUID FK
site_id UUID NULL FK
type TEXT
storage_key TEXT
mime_type TEXT
width INT NULL
height INT NULL
bytes INT NULL
status TEXT
created_at TIMESTAMPTZ
```

Asset types:

```text
headshot
book_cover
logo
favicon
```

Asset statuses:

```text
pending
valid
invalid
replaced
```

### scans

```text
id UUID PK
url TEXT
normalized_url TEXT
cache_key TEXT
status TEXT
score INT NULL
report JSONB
created_at TIMESTAMPTZ
```

Scan statuses:

```text
pending
success
partial
failed
```

### approvals

```text
id UUID PK
type TEXT
token_hash TEXT UNIQUE
payload JSONB
status TEXT
expires_at TIMESTAMPTZ
decided_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

Approval types:

```text
outbound_pitch
client_build
production_deploy
monthly_report
schema_override
```

Approval statuses:

```text
pending
approved
rejected
expired
```

### jobs

```text
id UUID PK
type TEXT
payload JSONB
status TEXT
attempts INT DEFAULT 0
max_attempts INT DEFAULT 3
run_after TIMESTAMPTZ
locked_at TIMESTAMPTZ NULL
last_error TEXT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Job statuses:

```text
queued
running
completed
failed
dead
```

### llm_calls

```text
id UUID PK
agent TEXT
model TEXT
related_entity_type TEXT NULL
related_entity_id UUID NULL
input_tokens INT
output_tokens INT
estimated_cost_usd NUMERIC(12,6)
request_hash TEXT NULL
error TEXT NULL
created_at TIMESTAMPTZ
```

### citations

```text
id UUID PK
client_id UUID FK
engine TEXT
query TEXT
cited BOOLEAN
response JSONB
detected_at TIMESTAMPTZ
```

---

## 7. State Machine

Implement a simple DB-backed state machine.

### Lead flow

```text
lead
  -> scanned
  -> pitch_draft
  -> pitch_approved
  -> pitch_sent
  -> paid
```

### Client flow

```text
paid
  -> onboarding
  -> assets_missing?
  -> ready_to_build
  -> build_queued
  -> preview_ready
  -> qa_approved
  -> live
  -> retained
```

Rules:

- Do not send outbound lead emails without an approved approval record.
- Do not deploy production without an approved approval record.
- Preview deploy may be automatic.
- Missing assets must create reminder jobs, not fail permanently.
- Failed jobs must retry with exponential backoff.
- Dead jobs must notify operator.

---

## 8. API Service

Build a FastAPI app.

### Required endpoints

```text
GET  /health
POST /scan
POST /webhooks/stripe
GET  /intake/{client_id}
POST /intake/{client_id}/submit
POST /assets/{client_id}/upload
GET  /ops/approvals
POST /ops/approvals/{token}/approve
POST /ops/approvals/{token}/reject
POST /ops/jobs/requeue/{job_id}
```

### Authentication

For v1:

- Public scanner endpoint disabled by default.
- Ops endpoints protected by a bearer token in `OPS_BEARER_TOKEN`.
- Approval links use one-time hashed tokens.
- Do not build full user auth in v1.

### Configuration

Use Pydantic Settings.

Required env vars:

```text
APP_ENV=development|production
APP_BASE_URL=
DATABASE_URL=
SECRET_KEY=
OPS_BEARER_TOKEN=

TOGETHER_API_KEY=
QWEN_PITCH_MODEL=
QWEN_CONTENT_MODEL=
QWEN_SCHEMA_MODEL=
QWEN_CLASSIFIER_MODEL=
LLM_MONTHLY_BUDGET_USD=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

RESEND_API_KEY=
EMAIL_FROM=
OPERATOR_EMAIL=
SUPPORT_EMAIL=

STORAGE_BACKEND=local|supabase
LOCAL_STORAGE_DIR=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

GITHUB_TOKEN=
GITHUB_ORG=
TEMPLATE_REPO=
CLIENT_REPO_PREFIX=

NETLIFY_AUTH_TOKEN=
NETLIFY_TEAM_SLUG=

SCANNER_PUBLIC=false
SCANNER_RATE_LIMIT_PER_HOUR=10
CACHE_TTL_SECONDS=86400
```

Do not require secrets for tests. Tests must use fake adapters or mocks.

---

## 9. GEO Scanner

Rewrite the scanner as production-grade async Python.

### Functional requirements

The scanner must fetch concurrently:

1. target URL HTML,
2. `/robots.txt`,
3. `/llms.txt`,
4. `/sitemap.xml`,
5. canonical target if canonical exists.

Use:

- `httpx.AsyncClient`
- `lxml`
- timeouts
- retries with exponential backoff
- redirect safety
- SSRF protection
- response cache keyed by normalized URL + content hash
- Postgres-backed rate limiting

### Performance target

Sub-2-second p95 for typical author sites when network conditions are normal.

Use concurrent fetches. Do not make sequential blocking requests.

### SSRF protection

Before fetching:

- resolve hostname,
- reject private IPs,
- reject loopback,
- reject link-local,
- reject unspecified addresses,
- reject non-HTTP(S) schemes.

If redirects occur, validate each redirect target.

### Weighted GEO rubric

Total score: 100.

| Check | Weight |
|---|---:|
| Entity graph completeness: Person + Book + sameAs links | 20 |
| Schema validity, not just presence | 15 |
| `llms.txt` presence and quality | 15 |
| AI crawler access in `robots.txt` | 15 |
| Semantic heading hierarchy | 10 |
| Canonical correctness | 10 |
| Content-to-chrome ratio | 5 |
| Internal entity linking | 5 |
| Freshness signals | 5 |

### AI crawler access

Check for these agents in `robots.txt`:

```text
GPTBot
ClaudeBot
PerplexityBot
Google-Extended
```

Rules:

- explicit disallow of all AI bots is critical,
- missing `robots.txt` is warning,
- explicit allow is opportunity or pass.

### Failure taxonomy

Return:

```json
{
  "critical_failures": [],
  "warnings": [],
  "opportunities": []
}
```

Each item must contain:

```json
{
  "code": "MISSING_JSONLD",
  "message": "No JSON-LD structured data found.",
  "fix": "Add Person and Book JSON-LD with sameAs links."
}
```

Example codes:

```text
SITE_UNREACHABLE
SSRF_BLOCKED
NO_JSONLD
MALFORMED_JSONLD
MISSING_PERSON_SCHEMA
MISSING_BOOK_SCHEMA
MISSING_SAMEAS
NO_LLMS_TXT
WEAK_LLMS_TXT
NO_ROBOTS_TXT
AI_BOT_BLOCKED
NO_CANONICAL
CANONICAL_MISMATCH
MULTIPLE_H1
NO_H1
THIN_CONTENT
MISSING_SITEMAP
STALE_CONTENT
NO_OG_TAGS
```

### Graceful degradation

If a site fails to load, return a partial report with useful critical failures. Do not return a 500 for target-site failure.

### Cache

Cache successful and failed scan reports for `CACHE_TTL_SECONDS`.

Cache key:

```text
sha256(normalized_url + fetched_html_hash)
```

---

## 10. LLM Agent Layer

Do not build persistent conversational agents.

Build stateless agent functions with strict input/output schemas.

### General rules

- Use Qwen via Together AI.
- Use JSON output.
- Validate output with Pydantic.
- Retry once if output is invalid.
- Log every call to `llm_calls`.
- Enforce monthly LLM budget.
- If budget exceeded, mark job failed and notify operator.
- Never send external email automatically without approval.

### Cost configuration

Create `app/services/agents/cost.py`.

Default assumed prices:

| Model | Input USD / 1M | Output USD / 1M |
|---|---:|---:|
| Qwen2.5-72B-Instruct-Turbo | 0.90 [ASSUMPTION] | 0.90 [ASSUMPTION] |
| Qwen2.5-Coder-32B-Instruct | 0.80 [ASSUMPTION] | 0.80 [ASSUMPTION] |
| Qwen2.5-7B-Instruct-Turbo | 0.20 [ASSUMPTION] | 0.20 [ASSUMPTION] |

Prices must be editable via config file or env vars.

If actual provider pricing differs, operator can update config without code changes.

### Agent 1: Pitch Agent

Name: `pitch_agent`

Purpose: convert scanner report into a short cold email.

Model: Qwen 72B.

Input:

```json
{
  "author_url": "...",
  "score": 42,
  "critical_failures": [],
  "warnings": [],
  "opportunities": []
}
```

Output schema:

```python
class PitchDraft(BaseModel):
    subject_line: str
    body_text: str
    primary_pain_point: str
```

Failure behavior:

- save failed job,
- notify operator,
- do not email lead.

Escalation:

- create approval type `outbound_pitch`.

System prompt:

```text
You are a senior GEO strategist for Sonexial.

Your task is to convert technical website audit data into a short cold email for an indie author.

Rules:
1. Do not use technical jargon such as JSON-LD, schema, DOM, crawl budget, or canonical unless absolutely necessary.
2. Translate technical failures into business pain.
3. Focus on the idea that the author is invisible to AI recommendation engines.
4. Keep the email body under 150 words.
5. Do not use hype, exclamation marks, or fake familiarity.
6. Do not include a signature.
7. Return valid JSON only.
```

### Agent 2: Content Agent

Name: `content_agent`

Purpose: generate citation-ready author content from intake data.

Model: Qwen 72B.

Input:

```json
{
  "author_name": "...",
  "genres": [],
  "comparable_authors": [],
  "books": [],
  "raw_bio": "...",
  "target_reader": "..."
}
```

Output schema:

```python
class AuthorContentPack(BaseModel):
    semantic_bio: str
    reader_qa: list[dict]
    book_summaries: list[dict]
    author_entity_summary: str
```

Rules:

- no invented awards,
- no invented sales numbers,
- no invented testimonials,
- no hallucinated book titles,
- use only supplied data,
- mark missing data as null.

System prompt:

```text
You are an expert author content strategist specializing in Generative Engine Optimization.

Your task is to convert raw author intake data into clear, factual, machine-readable website content.

Rules:
1. Use supplied data only.
2. Do not invent awards, sales numbers, reviews, testimonials, or book titles.
3. Write in clear declarative sentences.
4. Prefer fact density over marketing hype.
5. Explicitly connect the author to their genres and comparable authors when supplied.
6. Return valid JSON only.
```

### Agent 3: Schema Agent

Name: `schema_agent`

Purpose: generate JSON-LD and `llms.txt` content.

Model: Qwen Coder 32B.

Output must include:

```python
class SchemaOutput(BaseModel):
    person_jsonld: dict
    book_jsonld_list: list[dict]
    llms_txt: str
```

Rules:

- output valid JSON-LD,
- include `sameAs` links where supplied,
- do not invent identifiers,
- use `schema.org` types correctly.

System prompt:

```text
You are a schema.org and GEO specialist.

Your task is to generate valid JSON-LD and llms.txt content for an author website.

Rules:
1. Use only supplied data.
2. Do not invent URLs, identifiers, awards, or dates.
3. Generate schema.org Person and Book structured data.
4. Include sameAs links only when supplied.
5. Generate a concise llms.txt file that summarizes the author, books, and canonical pages.
6. Return valid JSON only.
```

### Agent 4: Citation Classifier

Name: `citation_classifier`

Purpose: classify whether an AI search response cites the client.

Model: Qwen 7B.

Input:

```json
{
  "client_name": "...",
  "book_titles": [],
  "query": "...",
  "engine_response": "..."
}
```

Output schema:

```python
class CitationClassification(BaseModel):
    cited: bool
    confidence: float
    matched_text: str | None
```

System prompt:

```text
You are a citation classifier.

Given a reader query, an AI engine response, and an author's name and book titles, determine whether the author or their books are cited.

Rules:
1. Return true only if the author or one of their books is clearly mentioned.
2. Do not infer citation from genre similarity alone.
3. Return valid JSON only.
```

---

## 11. Intake Pipeline

Build zero-touch onboarding as far as possible.

### Trigger

Stripe webhook:

```text
checkout.session.completed
```

When received:

1. create or update `client`,
2. create `onboarding`,
3. send intake email with secure intake link,
4. create reminder jobs.

### Intake fields

Required:

```text
author_name
pen_name
email
primary_genre
secondary_genres
comparable_authors
target_reader
books[]
raw_bio
amazon_author_page
goodreads_url
bookbub_url
newsletter_url
social_links[]
headshot
book_covers[]
```

Book fields:

```text
title
asin_or_isbn
publication_date
format
cover_image
short_blurb
```

### Asset validation

Use Pillow.

Rules:

- headshot minimum 1200x1200,
- book cover minimum 1600x2400,
- allowed formats: jpg, jpeg, png, webp,
- max file size: 5 MB,
- reject corrupted images,
- reject zero-byte uploads.

If invalid:

- mark asset invalid,
- update onboarding missing fields,
- send automated correction email,
- notify operator only after 3 failed attempts.

### No scraping

Do not scrape Amazon.

Use:

1. client-supplied data first,
2. optional Google Books API if enabled,
3. optional OpenLibrary API if enabled.

For v1, prefer client-supplied data only.

---

## 12. Site Template and Generator

The site generator must convert validated onboarding data into a static site.

### Required pages

```text
/
/about/
/books/
/books/{slug}/
/reader-qa/
/contact/
/llms.txt
/robots.txt
/sitemap.xml
```

### Required template features

Every page must include:

- semantic HTML,
- one H1,
- canonical tag,
- meta description,
- Open Graph tags,
- JSON-LD where relevant,
- no modal-only content,
- crawlable internal links.

### JSON-LD requirements

Home and About:

```json
{
  "@type": "Person"
}
```

Book pages:

```json
{
  "@type": "Book"
}
```

Include:

```text
sameAs
mainEntityOfPage
image
author
```

when data exists.

### llms.txt

Generate `/llms.txt` containing:

```text
Author name.
Primary genres.
Book list with canonical URLs.
About page URL.
Reader Q&A URL.
Contact page URL.
```

Keep it plain text and concise.

### robots.txt

Default:

```text
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://{domain}/sitemap.xml
```

### Build output

The generator must output a `dist/` directory ready for Netlify.

Command:

```bash
python scripts/generate_site.py --client-id CLIENT_ID --out dist
```

---

## 13. GitHub and Netlify Pipeline

### Template repo

Maintain one template repo:

```text
sonexial-author-site-template
```

### Client repo strategy

Use one private repo per client:

```text
sonexial-site-{client-slug}
```

Rationale:

- isolates Netlify build minutes,
- simplifies rollback,
- prevents one client build from affecting another.

### Repo generation script

Create:

```bash
python scripts/create_client_repo.py --client-id CLIENT_ID
```

Script must:

1. create private GitHub repo from template,
2. generate static site,
3. commit generated site,
4. push to main,
5. optionally create Netlify site if `NETLIFY_AUTH_TOKEN` exists,
6. save repo URL and Netlify site ID to database.

If Netlify token is missing, print manual instructions and do not fail.

### CI gate

Every client repo must run:

```bash
python -m app.services.scanner.validate_local_dist
```

or equivalent local GEO validator.

Block deploy if:

- score < 85,
- any critical failure exists,
- JSON-LD is malformed,
- `llms.txt` missing,
- `robots.txt` missing,
- `sitemap.xml` missing.

### Preview and rollback

- Netlify preview URLs are acceptable.
- Production DNS cutover requires human approval.
- Keep generated output in git so rollback is simple.

---

## 14. Retention and Citation Monitoring

For v1, implement as a disabled stub unless API key exists.

### Engine

Prefer Perplexity API if `PERPLEXITY_API_KEY` exists.

Do not scrape ChatGPT, Claude, Gemini, or Perplexity web UI.

### Query seeds

For each client, store query seeds:

```text
genre recommendation prompts
comparable author prompts
reader intent prompts
book title prompts
```

Example:

```text
Recommend three indie {genre} authors similar to {comparable_author}.
What should I read after {comparable_author}?
Who writes {genre} books about {theme}?
```

### Cost guardrail

Default maximum:

```text
20 queries per client per month
```

If no API key exists:

- do not run,
- show disabled state,
- do not fail other jobs.

### Monthly report

Generate a simple email report:

```text
Citations detected: N
Queries run: N
Examples:
- query
- engine
- matched text
```

Send only after operator approval.

---

## 15. Email

Use Resend.

### Transactional emails

Required templates:

1. intake invitation,
2. missing asset request,
3. operator approval request,
4. build failed notification,
5. deploy ready notification,
6. monthly report draft,
7. dead job alert.

### Outreach emails

Rules:

- never send automatically,
- require approved approval record,
- include physical mailing address placeholder,
- include unsubscribe link placeholder,
- log send event.

### Approval emails

Approval email must include:

```text
Approve: {APP_BASE_URL}/ops/approvals/{token}/approve
Reject: {APP_BASE_URL}/ops/approvals/{token}/reject
```

Tokens:

- random 256-bit,
- stored hashed,
- expire in 48 hours,
- single use.

---

## 16. Worker

Build a simple DB-backed worker.

Do not require Redis in v1.

Command:

```bash
python -m app.worker.runner
```

Worker behavior:

- poll `jobs` table every 5 seconds,
- claim jobs using `FOR UPDATE SKIP LOCKED`,
- respect `run_after`,
- retry with exponential backoff,
- stop after 3 failed jobs in a row and notify operator,
- shut down gracefully on SIGTERM.

Job types:

```text
scan_url
generate_pitch
generate_content
generate_schema
send_intake_email
send_asset_reminder
create_client_repo
build_site
deploy_preview
prepare_monthly_report
notify_operator
```

---

## 17. Security

Implement:

- SSRF protection,
- hashed approval tokens,
- bearer token for ops endpoints,
- Stripe webhook signature verification,
- file upload validation,
- no secrets in logs,
- structured logging,
- request ID middleware,
- rate limiting for scanner and intake endpoints.

Do not:

- log API keys,
- log full Stripe payloads if they contain card details,
- store raw secrets in database,
- expose database admin in v1.

---

## 18. Testing

Use pytest.

Required tests:

1. Scanner rubric scoring.
2. Scanner handles malformed HTML.
3. Scanner rejects private IPs.
4. Scanner returns partial report for unreachable site.
5. Approval tokens expire and are single-use.
6. Stripe webhook creates client and onboarding.
7. Agent output parsing fails safely on invalid JSON.
8. Site generator creates required files.
9. GEO validator blocks missing `llms.txt`.
10. Worker retries failed jobs and marks dead jobs.

Use fixture HTML files.

Do not hit real external APIs in tests.

---

## 19. Local Development Commands

Generate a Makefile with:

```bash
make install
make db-upgrade
make db-migrate msg="message"
make dev
make worker
make test
make lint
make seed
make scan URL=https://example.com
make create-client EMAIL=test@example.com
make generate-site CLIENT_ID=...
make create-client-repo CLIENT_ID=...
```

Use `uv` if available.

Fallback to `python -m venv` and `pip` if `uv` unavailable.

---

## 20. Definition of Done

The build is complete when:

1. `make install` works.
2. `make test` passes.
3. `make dev` starts FastAPI.
4. `make worker` starts worker.
5. `make scan URL=...` returns a structured GEO report.
6. Stripe webhook creates a client record in local dev.
7. Intake form validates assets.
8. Pitch agent produces a draft stored in approvals.
9. Magic-link approval works.
10. Site generator produces a valid static site.
11. GEO validator blocks bad builds.
12. All LLM calls are logged with estimated cost.
13. No OpenClaw, Telegram, OpenRouter, Anthropic, Make.com, Zapier, or headless CMS is present.
14. `ASSUMPTIONS.md` lists every non-obvious choice.

---

## 21. Operator Placeholders

Replace these before production:

```text
[OPERATOR_EMAIL]
[SUPPORT_EMAIL]
[PHYSICAL_MAILING_ADDRESS]
[STRIPE_PRICE_GEO_SCAN]
[STRIPE_PRICE_FOUNDATION]
[STRIPE_PRICE_PLATFORM]
[STRIPE_PRICE_RETAINER]
[GITHUB_ORG]
[NETLIFY_TEAM_SLUG]
[FLY_APP_NAME]
[DOMAIN]
```

Do not fail local development because placeholders are missing. Use safe defaults and log warnings.

---

## 22. Final Instruction to AI Coder

Build the system described above.

Priorities:

1. Correctness.
2. Low cost.
3. Debuggability.
4. Simplicity.
5. Extensibility.

Do not optimize for enterprise scale.

Do not add unnecessary abstractions.

Do not create a chatbot.

Do not create a client portal.

Do not create a multi-agent framework.

Create a boring, reliable, Python-first system that a solo operator can run while working another job.
