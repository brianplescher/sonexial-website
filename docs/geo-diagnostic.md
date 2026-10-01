# GEO Diagnostic ($297) — product spec

## Positioning vs. Semrush

Semrush Site Audit (140+ checks, errors/warnings/notices, Site Health %) and its AI Search Health
report are built for marketing teams crawling thousands of pages. They tell you *what* is wrong in
generic SEO terms. They do not know what an author is, what a book page needs, or which profiles
make an author a recognizable entity to an AI engine.

The diagnostic borrows Semrush's proven structure and adds the author layer Semrush lacks:

| Borrowed from Semrush | Sonexial addition |
| --- | --- |
| Error / warning / notice severity | Every issue also scored impact 1-5 and effort 1-5, placed in a Quick win / Major project / Fill-in / Deprioritize matrix |
| Site Health % (pages with errors) | AI Readiness score (weighted AI-specific issues) alongside Site Health |
| AI Search Health: AI crawler access, llms.txt, semantic HTML, freshness | Search crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot…) separated from training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot) — blocking training is a rights choice, blocking search removes you from answers |
| Structured data validity | Person + Book schema completeness, sameAs depth, Amazon/Goodreads/BookBub profile coverage |
| Crawlability, sitemap, orphans, depth, canonicals, HTTPS | Same checks, explained in author terms |
| Issue list with "how to fix" | Ready-to-paste Person JSON-LD, Book JSON-LD, llms.txt, robots.txt drafted from the crawl |
| — | AI-written diagnosis, "why AI engines miss you", 30-day plan, one-line bio |

## Deliverable

One self-contained HTML document: hosted at an unguessable URL and attached to the delivery email
(prints cleanly to PDF). No PDF stack on the server.

## Fulfillment

Stripe Payment Link (with a required custom text field keyed `websiteurl`) →
`checkout.session.completed` → `POST /webhooks/stripe` (signature verified on `req.rawBody`) →
idempotent insert keyed by Checkout Session ID → crawl + checks + write-up → email + owner notice.
Missing URL or failures notify the owner; admins re-run with `POST /diagnostics/:id/retry`.

## Not in v1

JavaScript rendering, Core Web Vitals, backlink data, live AI answer sampling (asking ChatGPT /
Perplexity about the author and checking citations) — the strongest candidate for v2 and for the
GEO Retainer's monthly re-run.
