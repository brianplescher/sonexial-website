# Sonexial Agent Service

A Node.js backend for processing Netlify webhook submissions, generating Metadata Kits via Anthropic Claude, and delivering drafts via Resend email.

## Setup

1. Copy `.env.example` to `.env` and fill in the values.
2. Run `npm install`.
3. Run `npm start`.

## Testing

Run `npm run test:pipeline` to test the Claude pipeline locally with mock data.

## Deployment

Deploy to Railway by connecting your GitHub repository.
Set the Root Directory to `agent/` in Railway settings.
Add a volume to store the SQLite data.
