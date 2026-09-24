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
