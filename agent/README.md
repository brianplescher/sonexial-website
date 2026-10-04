# Sonexial Agent Service

A Node.js backend for processing Netlify webhook submissions, generating Metadata Kits via an LLM, and delivering drafts via Resend email.

## LLM provider

All AI calls go through `src/llm.js`, which speaks the OpenAI chat-completions API. It
defaults to Qwen on Together AI (`https://api.together.ai/v1`, model `Qwen/Qwen3.5-9B`)
and is configured with three variables:

- `LLM_API_KEY` (or `TOGETHER_API_KEY`) — required for AI features only.
- `LLM_BASE_URL` — any OpenAI-compatible endpoint.
- `LLM_MODEL` — model id for that endpoint.

`Qwen/Qwen3.8-Flash` is cheaper still, but Together only serves it to organizations that
have enabled third-party data sharing (otherwise it returns HTTP 403).

Without a key the service still starts and the scanner, email gate, lead capture and
report emails all work; only AI generation is skipped.

## GEO Diagnostic ($297)

`src/diagnostic/` crawls up to 30 same-site pages (homepage + sitemap, SSRF-safe via
`scanner.safeFetch`), runs ~35 checks per page, ranks every issue by impact vs. effort, drafts
ready-to-paste fixes (Person/Book JSON-LD, llms.txt, robots.txt), and writes the narrative with the
LLM (template fallback without a key). The result is one self-contained HTML document.

- `POST /webhooks/stripe` — `checkout.session.completed` for a Payment Link listed in
  `STRIPE_DIAGNOSTIC_PAYMENT_LINKS`. Signature is verified against `req.rawBody`. The site URL comes
  from a Payment Link custom text field keyed `websiteurl` when present; otherwise the order waits in
  `needs_url` for the buyer. `stripe_session_id` is unique, so retries never re-run fulfillment.
- `POST /api/diagnostic/start` — public, rate-limited. `{ "sessionId", "url" }` from the post-payment
  page (`/diagnostic/start/?session_id=…`). Claims a `needs_url` order exactly once and starts it;
  later calls just return the report URL. Buyers who never submit are emailed that link after 10 min.
- `GET /api/diagnostic/:token` — the hosted report (unguessable 48-hex token, `noindex`).
- `POST /diagnostics` (admin) — `{ "url", "email"?, "name"? }` runs one without a purchase.
- `GET /diagnostics/:id`, `POST /diagnostics/:id/retry` (admin) — status and re-run (`{ "url" }` to
  fill in a missing URL).

## Setup

1. Copy `.env.example` to `.env` and fill in the values.
2. Run `npm install`.
3. Run `npm start`.

## Testing

Run `npm run test:pipeline` to test the AI pipeline locally with mock data.
Run `npm test` for the scanner unit tests.

## Deployment

Deploy to Railway by connecting your GitHub repository.
Set the Root Directory to `agent/` in Railway settings.
Add a volume to store the SQLite data.
