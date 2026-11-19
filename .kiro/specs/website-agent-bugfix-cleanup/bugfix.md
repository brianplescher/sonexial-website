# Bugfix Requirements Document

## Introduction

This document captures a comprehensive set of bugs, code duplications, and dead/legacy code across the Sonexial website frontend, the Node.js agent service (`agent/`), CI/CD workflows, and build configuration. The issues span six logical groups: Build & Asset Rewriting, Frontend & HTML Bugs, Backend / Agent Service Bugs, CI / GitHub Actions Bugs, Code Duplications, and Unnecessary / Dead / Legacy Code. Each issue is specified using the bug condition methodology so that fixes can be validated through Fix Checking (buggy inputs behave correctly after the fix) and Preservation Checking (non-buggy inputs behave identically before and after the fix).

## Bug Analysis

### Current Behavior (Defect)

**Build & Asset Rewriting**

1.1 WHEN build.js processes subdirectory HTML pages with deeply nested relative asset paths (e.g. `../../styles.css` in pages two or more levels deep such as `diagnostic/start/index.html` or `tools/author-geo-audit/index.html`) THEN the system's asset-rewriting logic only matches single-level relative (`../styles.css`) and root-relative (`/styles.css`) patterns, leaving deeper nested paths un-rewritten so those pages never receive hashed `/static/styles.<hash>.css` or `/static/script.<hash>.js` references.

1.2 WHEN `Intake/amazon-visibility.html` is built THEN the system does not load `/script.js` at all, so no client-side JavaScript runs on that page.

1.3 WHEN Netlify's post-processor runs with the `[build.processing]` flags enabled in `netlify.toml` (`css.bundle = true`, `js.bundle = true`, `html.pretty_urls = true`) THEN the system rewrites asset URLs to Netlify CDN paths, bypassing the immutable `/static/*` cache headers established by `build.js` and potentially breaking `.html` canonical/redirect assumptions.

**Frontend & HTML Bugs**

1.4 WHEN `calculator.html` and `scripts/calculator.js` render the squeeze meter and the results grid THEN the system references CSS classes (`.product-detail`, `.product-detail-grid`, `.result-value`, `.positive`, `.negative`, `.meter-track`, `.meter-fill`) that do not exist in `styles.css`, causing `#squeezeMeter` to have height 0 (invisible progress bar) and the calculator inputs and results to lack grid layout and color styling.

1.5 WHEN `tools/author-geo-audit/index.html` renders its footer THEN the system uses `.footer-logo`, `.footer-links`, and `.footer-copy` classes that are not defined in `styles.css` (other pages use `.logo-mark` / `.footer-bottom`), causing `/Images/sonexial_logo.png` to render at its full intrinsic width in the footer, and `.nav-toggle` has no effect on this page because `script.js` is never loaded.

1.6 WHEN `404.html` and `diagnostic/start/index.html` are viewed on screens narrower than 1100 px THEN the system omits the `<button class="nav-toggle">` element in `#site-header`, so `.main-nav` is `display: none` and mobile users have no way to open the navigation menu at all.

1.7 WHEN the contact form on `kits.html` is submitted THEN the system lacks the `netlify-honeypot="bot-field"` attribute and hidden bot-field input that `index.html` includes, and the page redirects to `/?success=true` (the `index.html` URL) because `kits.html` does not contain the `#success-modal` markup.

1.8 WHEN schema parsers read the JSON-LD Person block in `about.html` THEN the system sets `"jobTitle": "Founder &amp; Strategist"` with an HTML entity inside a JSON string; JSON strings are not HTML-decoded by schema parsers, so the value literally parses as "Founder &amp; Strategist".

1.9 WHEN the browser requests the Google Fonts CSS2 URL in `Intake/amazon-visibility.html` THEN the system generates a URL containing a duplicate weight token (`800;800` in `family=DM+Sans:wght@300;400;500;600;800;800`), causing the Google Fonts CSS2 API (which enforces strict axis-tuple sorting) to return HTTP 400 Bad Request and fail to load all fonts on the intake page.

1.10 WHEN `diagnostic/start/index.html` and `tools/author-geo-audit/index.html` reference CSS custom properties THEN the system uses `var(--color-surface, …)` and `var(--color-text-dim, …)` which do not exist in the `:root` block of `styles.css` (which defines `--bg-card`, `--text-1`, `--text-2`), so styling falls back to inline fallback values only and never receives the intended theme values.

**Backend / Agent Service Bugs**

1.11 WHEN `agent/scripts/test-comprehensive.js` runs the representative-book test THEN the system asserts that `repB.critical_failures` includes `'llms.txt'`, but `agent/src/scanner.js` was updated so that `llms.txt` is optional and never added to `critical_failures`, so the assertion always fails.

1.12 WHEN `scanWithContent()` in `agent/src/scanner.js` processes a scan URL THEN the system calls `validateSSRF(urlToScan)` once and then calls `safeFetch()` for the homepage, `llms.txt`, `robots.txt`, and `sitemap.xml`; each `safeFetch()` calls `validateSSRF()` again and performs another DNS lookup inside `guardedLookup`, resulting in up to 9 redundant DNS lookups for the same hostname on a single scan.

1.13 WHEN the paid diagnostic flow runs in `agent/src/diagnostic/index.js` THEN the system calls `await scanner.runScan(url)` (which fetches the homepage, `robots.txt`, `llms.txt`, and `sitemap.xml`) and then immediately calls `await crawlSite(scan.url, options)`, which re-fetches the same four resources from scratch a second time.

1.14 WHEN `sendDraftEmail` and `sendErrorEmail` in `agent/src/email.js` are called without `OWNER_EMAIL` set THEN the system only checks `if (!process.env.RESEND_API_KEY)` and passes `to: undefined` to Resend, causing Resend to throw an API error (unlike `sendLeadNotification` and `sendDiagnosticOwnerNotice` which also check `OWNER_EMAIL`).

**CI / GitHub Actions Bugs**

1.15 WHEN the SEO monitor workflow (`.github/workflows/seo-monitor.yml`) runs its checks THEN the system only echoes `✗ …` messages into `seo-report.md` and exits with code 0 for every check, so the "comment on commit (if issues found)" step (guarded by `if: failure()`) is dead code that can never trigger; the workflow also hardcodes `node-version: '18'` instead of using `.nvmrc`.

1.16 WHEN the security scan workflow (`.github/workflows/security-scan.yml`) runs grep for hardcoded passwords THEN the system uses `grep -r -l "password\s*=" … || echo "No hardcoded passwords found"`, which always exits 0 whether matches are found or not, so the workflow never fails on actual findings.

1.17 WHEN `html-validate` runs via the `package.json` lint script and `deploy.yml` with the glob `"*.html"` THEN the system only validates root-level HTML files and skips subdirectory HTML files (`constellations/index.html`, `tools/author-geo-audit/index.html`, `diagnostic/start/index.html`, `Intake/amazon-visibility.html`).

**Code Duplications**

1.18 WHEN `sanitizeLog()` is needed across agent service modules THEN the system defines it locally in three separate files (`agent/src/ai-utils.js` as the shared export, `agent/src/index.js`, and `agent/src/scanner.js`) instead of importing the shared helper, so fixes must be applied in three places.

1.19 WHEN `agent/src/kits/metadata-kit.js` needs to extract JSON from AI output THEN the system manually re-implements the same `indexOf('{')` / `lastIndexOf('}')` + `JSON.parse` + error-logging block already exported as `parseJson()` in `agent/src/ai-utils.js` (and used by `bisac-kit.js`, `pitch.js`, `semantic-extractor.js`, and `writeup.js`).

1.20 WHEN HTML escaping is needed THEN the system implements `escapeHtml()` separately in three files: `agent/src/email.js`, `agent/src/diagnostic/render.js` (as `esc`), and `tools/author-geo-audit/index.html`, so the same logic is maintained in three places.

1.21 WHEN `agent/src/netlify-signature.js` verifies webhook signatures THEN the system duplicates ~20 lines of JWT header parsing, HS256 algorithm check, HMAC-SHA256 digest computation, and `crypto.timingSafeEqual` verification in both `verifyNetlifySignature` and `verifyNetlifyProxySignature`.

1.22 WHEN JSON-LD `<script type="application/ld+json">` parsing and `@type` / Book / Person extraction is needed THEN the system implements the recursive tree walker separately in three modules: `agent/src/scanner.js`, `agent/src/diagnostic/page-facts.js`, and `agent/src/semantic-extractor.js`.

1.23 WHEN image optimization runs THEN the system duplicates the exact same `optipng`, `jpegoptim`, and `cwebp` shell commands in both `scripts/optimize-images.js` and `.github/workflows/optimize-images.yml` instead of the workflow calling `npm run optimize:images`.

1.24 WHEN SSRF and live scan test scripts run in `agent/scripts/` THEN the system duplicates the same SSRF target array and live scans against `sonexial.com` and `example.com` across `test-scanner.js`, `test-comprehensive.js`, and `test-api-endpoints.js`, which are already covered offline by `agent/test/scanner.test.js`.

1.25 WHEN logo assets are managed THEN the system stores logos in two separate directories (`Images/` and `assets/img/`), and several files (`assets/img/logo-full.png`, `assets/img/logo.png`, `Images/logo_mark_2026.png`, `Images/signal-bg.jpg`) are not referenced anywhere in the codebase.

**Unnecessary, Dead, or Legacy Code**

1.26 WHEN `scripts/script.js` exists as a 0-byte file THEN the system commits an empty placeholder in `scripts/` while the actual frontend script is `/script.js` in the repo root.

1.27 WHEN `lighthouse-report.json` (558 KB) exists in the repo root THEN the system commits a generated Lighthouse output referencing retired Gumroad content and "$29 Metadata Kit"; the file bloats the repository and is swept into `dist/` by `build.js`.

1.28 WHEN `scripts/analytics-report.js` (235 lines) and `scripts/email-automation.js` (293 lines) are present THEN the system retains obsolete mock scripts: `analytics-report.js` returns hardcoded fake numbers (users: 1234, sessions: 1567) with a `TODO: Integrate with Google Analytics Data API` and checks `['weekly', 'monthly'].includes(period)` twice; `email-automation.js` contains outdated Gumroad templates and a `sendEmail()` that only `console.log`s with `// TODO: Integrate with your email service` while real email sending lives in `agent/src/email.js` via Resend.

1.29 WHEN `package.json` defines build/watch scripts (outputting `styles.min.css`, `script.min.js`, `index.min.html` that are gitignored and unused by `build.js` or any HTML file) and devDependencies (`npm-watch`, `watch`, `clean-css-cli`, `terser`, `html-minifier-terser`, `linkinator`) THEN the system retains unused build scripts and devDependencies; additionally, `test-api-endpoints.js` has an unused `const http = require('http')` import and `test-scanner.js` / `test-comprehensive.js` import `validateSSRF` but never call it directly.

1.30 WHEN `styles.css` contains ~350 lines of dead CSS from retired sections (Testimonials, Content Vault articles, old Hero & Lead Magnet layouts, Example cards — 32 unused selectors) and `--font-display` / `--font-sans` are both set to `'DM Sans', system-ui, sans-serif` while several HTML files (`about.html`, `kits.html`, `amazon-visibility-kit.html`, `calculator.html`) load DM Serif Display and DM Mono from Google Fonts even though `styles.css` uses IBM Plex Mono for `--font-mono` THEN the system retains dead CSS and inconsistent font loading.

1.31 WHEN `scripts/build.js` and `netlify.toml` configure copying and caching for an `Audio` directory THEN the system references a directory that does not exist in the repository.

1.32 WHEN Node version is specified across the project THEN the system uses inconsistent versions: root `.nvmrc` specifies Node 22, `agent/.nvmrc` specifies Node 20, `deploy.yml` runs agent-tests using root `.nvmrc` (22), and `seo-monitor.yml` hardcodes Node 18.

1.33 WHEN the repository is inspected for branches THEN the system retains 24 stale, uncleaned branches (`antigravity/fix-redirects` and 23 `devin/*` branches) alongside `main`.

### Expected Behavior (Correct)

**Build & Asset Rewriting**

2.1 WHEN `build.js` processes subdirectory HTML pages with deeply nested relative asset paths (two or more levels deep) THEN the system SHALL rewrite all asset references — including `../../styles.css` and deeper — to their hashed `/static/styles.<hash>.css` and `/static/script.<hash>.js` counterparts.

2.2 WHEN `Intake/amazon-visibility.html` is built THEN the system SHALL include the hashed `/static/script.<hash>.js` reference so that client-side JavaScript runs on that page.

2.3 WHEN Netlify's post-processor runs THEN the system SHALL NOT rewrite asset URLs away from `/static/*` paths, preserving immutable cache headers and `.html` canonical/redirect assumptions; the `netlify.toml` processing flags (`css.bundle`, `js.bundle`, `html.pretty_urls`) SHALL be disabled or configured so they do not interfere with `build.js` output.

**Frontend & HTML Bugs**

2.4 WHEN `calculator.html` and `scripts/calculator.js` render the squeeze meter and results grid THEN the system SHALL define and use the required CSS classes in `styles.css` so that `#squeezeMeter` has visible height and the calculator inputs and results have grid layout and color styling.

2.5 WHEN `tools/author-geo-audit/index.html` renders its footer THEN the system SHALL use the same footer classes as other pages (`.logo-mark` / `.footer-bottom`) so `/Images/sonexial_logo.png` renders at the correct size, and SHALL load `script.js` so `.nav-toggle` works on that page.

2.6 WHEN `404.html` and `diagnostic/start/index.html` are viewed on screens narrower than 1100 px THEN the system SHALL include the `<button class="nav-toggle">` element in `#site-header` so mobile users can toggle the navigation menu.

2.7 WHEN the contact form on `kits.html` is submitted THEN the system SHALL include `netlify-honeypot="bot-field"` and the hidden bot-field input AND SHALL include the `#success-modal` markup so submission shows a success modal on `kits.html` rather than redirecting to `index.html`.

2.8 WHEN schema parsers read the JSON-LD Person block in `about.html` THEN the system SHALL set `"jobTitle": "Founder & Strategist"` using the literal ampersand character, not the HTML entity, so the value parses correctly as "Founder & Strategist".

2.9 WHEN the browser requests the Google Fonts CSS2 URL in `Intake/amazon-visibility.html` THEN the system SHALL generate a URL with no duplicate weight tokens (e.g. `family=DM+Sans:wght@300;400;500;600;800`) so the Google Fonts CSS2 API returns HTTP 200 and loads all fonts.

2.10 WHEN `diagnostic/start/index.html` and `tools/author-geo-audit/index.html` reference CSS custom properties THEN the system SHALL use custom property names that exist in the `:root` block of `styles.css` (or add the missing `--color-surface` and `--color-text-dim` definitions) so the intended theme styling applies.

**Backend / Agent Service Bugs**

2.11 WHEN `agent/scripts/test-comprehensive.js` runs the representative-book test THEN the system SHALL assert behavior consistent with `scanner.js`'s current `llms.txt`-optional logic and SHALL NOT assert that `llms.txt` appears in `critical_failures`.

2.12 WHEN `scanWithContent()` in `agent/src/scanner.js` processes a scan URL THEN the system SHALL perform SSRF validation and DNS lookup at most once per hostname per scan, eliminating redundant `validateSSRF()` calls and DNS lookups in `safeFetch()` and the `llms.txt` / `robots.txt` / `sitemap.xml` fetches.

2.13 WHEN the paid diagnostic flow runs in `agent/src/diagnostic/index.js` THEN the system SHALL fetch the homepage, `robots.txt`, `llms.txt`, and `sitemap.xml` only once, reusing the results from `runScan()` for `crawlSite()` rather than re-fetching from scratch.

2.14 WHEN `sendDraftEmail` and `sendErrorEmail` in `agent/src/email.js` are called without `OWNER_EMAIL` set THEN the system SHALL check both `!process.env.RESEND_API_KEY` and `!OWNER_EMAIL` (consistent with `sendLeadNotification` and `sendDiagnosticOwnerNotice`) and SHALL gracefully skip sending or log a warning rather than passing `to: undefined` to Resend.

**CI / GitHub Actions Bugs**

2.15 WHEN the SEO monitor workflow runs its checks THEN the system SHALL exit non-zero when issues are found so the "comment on commit" step triggers, and SHALL use `.nvmrc` for the Node version instead of hardcoding `'18'`.

2.16 WHEN the security scan workflow runs grep for hardcoded passwords THEN the system SHALL exit non-zero when matches are found so the workflow fails on actual findings.

2.17 WHEN `html-validate` runs THEN the system SHALL use a glob that includes all HTML files in the repository (including subdirectory files `constellations/index.html`, `tools/author-geo-audit/index.html`, `diagnostic/start/index.html`, and `Intake/amazon-visibility.html`).

**Code Duplications**

2.18 WHEN `sanitizeLog()` is needed across agent service modules THEN the system SHALL use a single shared implementation imported from `agent/src/ai-utils.js` rather than defining it locally in `agent/src/index.js` and `agent/src/scanner.js`.

2.19 WHEN `agent/src/kits/metadata-kit.js` needs to extract JSON from AI output THEN the system SHALL use the shared `parseJson()` from `agent/src/ai-utils.js` instead of re-implementing the same logic.

2.20 WHEN HTML escaping is needed THEN the system SHALL use a single shared `escapeHtml()` implementation imported by `agent/src/email.js`, `agent/src/diagnostic/render.js`, and `tools/author-geo-audit/index.html`.

2.21 WHEN `agent/src/netlify-signature.js` verifies webhook signatures THEN the system SHALL use a single shared HS256 JWS verification helper for both `verifyNetlifySignature` and `verifyNetlifyProxySignature`, eliminating the duplicated JWT/HMAC logic.

2.22 WHEN JSON-LD parsing and `@type` / Book / Person extraction is needed THEN the system SHALL use a single shared JSON-LD tree-walker module imported by `agent/src/scanner.js`, `agent/src/diagnostic/page-facts.js`, and `agent/src/semantic-extractor.js`.

2.23 WHEN image optimization runs in CI THEN the system SHALL call `npm run optimize:images` from the workflow instead of duplicating the shell commands in `.github/workflows/optimize-images.yml`.

2.24 WHEN SSRF and live scan tests run THEN the system SHALL consolidate the duplicated test logic into a single shared script or remove the redundant `agent/scripts/` test files in favor of the offline `agent/test/scanner.test.js` coverage.

2.25 WHEN logo assets are managed THEN the system SHALL consolidate logos into a single directory and SHALL remove unreferenced assets (`assets/img/logo-full.png`, `assets/img/logo.png`, `Images/logo_mark_2026.png`, `Images/signal-bg.jpg`).

**Unnecessary, Dead, or Legacy Code**

2.26 WHEN `scripts/script.js` exists as a 0-byte file THEN the system SHALL remove it from the repository (keeping only the actual `/script.js` in the repo root).

2.27 WHEN `lighthouse-report.json` exists in the repo root THEN the system SHALL remove it from version control and exclude it from `dist/` copying.

2.28 WHEN `scripts/analytics-report.js` and `scripts/email-automation.js` are present THEN the system SHALL remove these obsolete mock scripts since real functionality lives in `agent/src/email.js` (Resend) and analytics integration is not implemented.

2.29 WHEN `package.json` defines build/watch scripts and devDependencies THEN the system SHALL remove unused build scripts (`build:css`, `build:js`, `build:html`, `watch`, `watch:css`, `watch:js`), unused devDependencies (`npm-watch`, `watch`, `clean-css-cli`, `terser`, `html-minifier-terser`, `linkinator`), and unused require/imports (`http` in `test-api-endpoints.js`, `validateSSRF` in `test-scanner.js` and `test-comprehensive.js`).

2.30 WHEN `styles.css` contains dead CSS and inconsistent font loading THEN the system SHALL remove the ~32 unused CSS selectors from retired sections and SHALL resolve the font-loading inconsistency (either remove unused DM Serif Display / DM Mono Google Fonts loads or align the font variables).

2.31 WHEN `scripts/build.js` and `netlify.toml` reference an `Audio` directory THEN the system SHALL remove the `Audio` copy/cache configuration since the directory does not exist.

2.32 WHEN Node version is specified across the project THEN the system SHALL use a consistent Node version (or a documented, intentional version split) across `.nvmrc`, `agent/.nvmrc`, and all GitHub Actions workflows.

2.33 WHEN the repository is inspected for branches THEN the system SHALL clean up the 24 stale, uncleaned branches (`antigravity/fix-redirects` and 23 `devin/*` branches) that are no longer in active development.

### Unchanged Behavior (Regression Prevention)

**Build & Asset Rewriting**

3.1 WHEN `build.js` processes root-level and single-level-nested HTML pages (e.g. `index.html`, `Intake/amazon-visibility.html` with `../styles.css`) THEN the system SHALL CONTINUE TO rewrite their asset references to hashed `/static/*` paths correctly.

3.2 WHEN pages that already load `script.js` correctly are built THEN the system SHALL CONTINUE TO include the hashed script reference.

3.3 WHEN Netlify serves assets from `/static/*` with immutable cache headers THEN the system SHALL CONTINUE TO apply long-lived cache headers for hashed assets.

**Frontend & HTML Bugs**

3.4 WHEN `calculator.html` renders elements that currently display correctly (non-meter, non-grid elements) THEN the system SHALL CONTINUE TO display those elements correctly.

3.5 WHEN pages other than `tools/author-geo-audit/index.html` render their footers THEN the system SHALL CONTINUE TO use the `.logo-mark` / `.footer-bottom` classes and display correctly.

3.6 WHEN pages other than `404.html` and `diagnostic/start/index.html` are viewed on narrow screens THEN the system SHALL CONTINUE TO show the nav-toggle button and mobile navigation.

3.7 WHEN the contact form on `index.html` is submitted THEN the system SHALL CONTINUE TO include the honeypot and show the success modal on `index.html`.

3.8 WHEN other JSON-LD blocks in `about.html` are parsed THEN the system SHALL CONTINUE TO parse them correctly.

3.9 WHEN other pages load Google Fonts with correctly formatted URLs THEN the system SHALL CONTINUE TO load fonts successfully.

3.10 WHEN `styles.css` applies existing custom properties (`--bg-card`, `--text-1`, `--text-2`) to pages that use them THEN the system SHALL CONTINUE TO apply those styles correctly.

**Backend / Agent Service Bugs**

3.11 WHEN `scanner.js` processes URLs where `llms.txt` is present THEN the system SHALL CONTINUE TO parse and include `llms.txt` in scan results as optional (not critical).

3.12 WHEN `scanWithContent()` processes a URL for the first time (no cached SSRF/DNS result) THEN the system SHALL CONTINUE TO perform SSRF validation and DNS lookup to protect against SSRF attacks.

3.13 WHEN the diagnostic flow needs crawled page data beyond the homepage THEN the system SHALL CONTINUE TO crawl and fetch additional pages as needed.

3.14 WHEN `sendLeadNotification` and `sendDiagnosticOwnerNotice` are called with both `RESEND_API_KEY` and `OWNER_EMAIL` set THEN the system SHALL CONTINUE TO send emails successfully.

**CI / GitHub Actions Bugs**

3.15 WHEN the SEO monitor workflow runs and no issues are found THEN the system SHALL CONTINUE TO exit code 0 (success).

3.16 WHEN the security scan workflow runs and no hardcoded passwords are found THEN the system SHALL CONTINUE TO exit code 0 (success).

3.17 WHEN `html-validate` validates root-level HTML files THEN the system SHALL CONTINUE TO check them.

**Code Duplications**

3.18 WHEN `sanitizeLog()` is called via the shared helper in `agent/src/ai-utils.js` THEN the system SHALL CONTINUE TO return the same sanitized output.

3.19 WHEN `parseJson()` is called from `bisac-kit.js`, `pitch.js`, `semantic-extractor.js`, or `writeup.js` THEN the system SHALL CONTINUE TO return the same JSON extraction results.

3.20 WHEN HTML escaping is applied to user input in any consumer THEN the system SHALL CONTINUE TO produce the same escaped output.

3.21 WHEN `netlify-signature.js` verifies a valid webhook signature THEN the system SHALL CONTINUE TO return true and reject invalid signatures.

3.22 WHEN JSON-LD parsing extracts Book or Person types from any of the three modules THEN the system SHALL CONTINUE TO return the same extraction results.

3.23 WHEN `npm run optimize:images` runs locally THEN the system SHALL CONTINUE TO optimize images with the same `optipng` / `jpegoptim` / `cwebp` commands.

3.24 WHEN `agent/test/scanner.test.js` runs offline tests THEN the system SHALL CONTINUE TO pass and provide SSRF/scan coverage.

3.25 WHEN referenced logo assets (`Images/sonexial_logo.png`, `Images/favicon.png`) are used by pages THEN the system SHALL CONTINUE TO serve them correctly.

**Unnecessary, Dead, or Legacy Code**

3.26 WHEN `/script.js` in the repo root is built THEN the system SHALL CONTINUE TO hash and copy it to `/static/script.<hash>.js`.

3.27 WHEN `build.js` copies `.html` / `.txt` / `.xml` files to `dist/` THEN the system SHALL CONTINUE TO copy all legitimate site files.

3.28 WHEN real email sending via `agent/src/email.js` (Resend) is invoked THEN the system SHALL CONTINUE TO send emails via Resend.

3.29 WHEN `build.js` runs the production build THEN the system SHALL CONTINUE TO hash and copy `styles.css` and `script.js` to `/static/` and rewrite HTML references.

3.30 WHEN `styles.css` applies active selectors to live pages THEN the system SHALL CONTINUE TO style those pages correctly (only dead/retired selectors are removed).

3.31 WHEN `build.js` copies existing directories (`Images/`, `assets/`) to `dist/` THEN the system SHALL CONTINUE TO copy them correctly.

3.32 WHEN `deploy.yml` runs agent-tests THEN the system SHALL CONTINUE TO run agent tests successfully.

3.33 WHEN the `main` branch is used for production THEN the system SHALL CONTINUE TO deploy from `main`.
