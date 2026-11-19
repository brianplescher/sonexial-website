# Website Agent Bugfix & Cleanup Design

## Overview

This design addresses 33 issue groups across six categories in the Sonexial website frontend, the Node.js agent service (`agent/`), CI/CD workflows, and build configuration:

- **Build & Asset Rewriting (3 issues)**: `build.js` asset-rewriting regex only matches single-level relative paths, an intake page omits its script tag entirely, and Netlify post-processing flags bypass immutable `/static/*` caching.
- **Frontend & HTML Bugs (7 issues)**: Missing CSS classes for the calculator squeeze meter and results grid, mismatched footer classes and missing script on a subdirectory page, missing mobile nav-toggle buttons, an incomplete contact-form honeypot/success-modal, an HTML entity inside a JSON-LD string, a malformed Google Fonts URL, and undefined CSS custom properties.
- **Backend / Agent Service Bugs (4 issues)**: A stale test assertion, redundant SSRF/DNS lookups per scan, a double-fetch of homepage/robots/llms/sitemap in the diagnostic flow, and missing `OWNER_EMAIL` guards on two email senders.
- **CI / GitHub Actions Bugs (3 issues)**: An SEO monitor workflow that never fails, a security scan grep that swallows findings, and an `html-validate` glob that skips subdirectory pages.
- **Code Duplications (8 issues)**: Duplicated `sanitizeLog`, `parseJson`, `escapeHtml`, JSON-LD tree-walker, HS256 signature verification, image-optimization commands, SSRF/live test scripts, and split logo directories.
- **Unnecessary / Dead / Legacy Code (8 issues)**: A 0-byte placeholder script, a committed Lighthouse report, obsolete mock scripts, unused build scripts/dependencies, dead CSS and inconsistent font loading, a nonexistent `Audio` directory config, inconsistent Node versions, and 24 stale branches.

The general strategy is a category-by-category cleanup that fixes broken behavior, consolidates duplicated logic into shared modules, and removes dead code — all while preserving existing correct behavior through Fix Checking and Preservation Checking.

## Glossary

- **Bug_Condition (C)**: The composite condition that identifies any input/configuration triggering one or more of the 33 defects. It dispatches to six category-specific sub-conditions.
- **Property (P)**: The desired correct behavior for buggy inputs — e.g. deep relative asset paths are rewritten, redundant DNS lookups are eliminated, CI workflows fail on real findings.
- **Preservation**: Existing correct behavior that must remain unchanged — e.g. root-level asset rewriting, valid webhook signature verification, mouse-click navigation, `npm run optimize:images` output.
- **build.js**: The build script in `scripts/build.js` that hashes `styles.css`/`script.js` into `/static/*` and rewrites HTML asset references.
- **rewriteHtml**: The function in `scripts/build.js` responsible for replacing `styles.css`/`script.js` references with their hashed `/static/*` counterparts.
- **scanner.js**: The module in `agent/src/scanner.js` that performs GEO scans, SSRF validation, DNS lookups, and JSON-LD extraction.
- **scanWithContent**: The function in `agent/src/scanner.js` that fetches the homepage, `llms.txt`, `robots.txt`, and `sitemap.xml` concurrently and returns the report plus HTML.
- **safeFetch**: The SSRF-safe fetch wrapper in `scanner.js` that calls `validateSSRF` and uses a `guardedLookup` dispatcher.
- **validateSSRF**: The function in `scanner.js` that validates a URL's protocol, hostname blocklist, and resolves DNS to reject private/reserved IPs.
- **guardedLookup**: The socket-level DNS lookup in `scanner.js` that re-resolves the hostname and rejects private IPs, closing the DNS-rebinding gap.
- **ai-utils.js**: The shared helpers module in `agent/src/ai-utils.js` exporting `sanitizeLog` and `parseJson`.
- **email.js**: The module in `agent/src/email.js` that sends email via Resend and defines `sendDraftEmail`, `sendErrorEmail`, `sendLeadNotification`, `sendDiagnosticOwnerNotice`, and a local `escapeHtml`.
- **netlify-signature.js**: The module in `agent/src/netlify-signature.js` that verifies HS256 JWS webhook signatures (`verifyNetlifySignature`, `verifyNetlifyProxySignature`).
- **diagnostic/index.js**: The module in `agent/src/diagnostic/index.js` that runs the paid diagnostic flow (`runDiagnostic`).
- **netlify.toml**: The Netlify configuration file defining build, redirects, headers, and post-processing flags.
- **seo-monitor.yml**: The GitHub Actions workflow in `.github/workflows/seo-monitor.yml` that checks SEO health.
- **security-scan.yml**: The GitHub Actions workflow in `.github/workflows/security-scan.yml` that audits dependencies and scans for hardcoded credentials.
- **isBugCondition**: The formal predicate that returns true when an input/configuration falls into any defective category.
- **isPreserved**: The formal predicate that returns true when an input/configuration is outside all bug conditions and must behave identically before and after the fix.

## Bug Details

### Bug Condition

The bug manifests across six distinct domains. The composite bug condition holds when an input or configuration matches any one of the category sub-conditions. Each sub-condition identifies a specific class of defect.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BuildConfig | HtmlPage | ScanRequest | WorkflowRun | CodeModule | RepoFile
  OUTPUT: boolean

  RETURN isBuildAssetBug(input)
      OR isFrontendBug(input)
      OR isBackendBug(input)
      OR isCiBug(input)
      OR isDuplicationBug(input)
      OR isDeadCodeBug(input)
END FUNCTION

FUNCTION isBuildAssetBug(input)
  // 1.1: deep nested relative asset path not rewritten
  IF input IS HtmlPage AND input.depth >= 2
     AND input.assetRef MATCHES /^(?:\.\.\/){2,}(styles|script)\.(css|js)$/
     THEN RETURN TRUE
  // 1.2: intake page missing script.js tag entirely
  IF input IS HtmlPage AND input.path = "Intake/amazon-visibility.html"
     AND NOT input.containsScriptTag THEN RETURN TRUE
  // 1.3: Netlify post-processing flags enabled
  IF input IS BuildConfig AND (input.cssBundle OR input.jsBundle OR input.prettyUrls)
     THEN RETURN TRUE
  RETURN FALSE
END FUNCTION

FUNCTION isFrontendBug(input)
  IF input IS HtmlPage AND input.path = "calculator.html"
     AND input.usesClass IN missingCalcClasses THEN RETURN TRUE    // 1.4
  IF input IS HtmlPage AND input.path = "tools/author-geo-audit/index.html"
     AND input.footerUsesLegacyClasses THEN RETURN TRUE             // 1.5
  IF input IS HtmlPage AND input.path IN ["404.html","diagnostic/start/index.html"]
     AND input.viewportWidth < 1100 AND NOT input.hasNavToggle THEN RETURN TRUE  // 1.6
  IF input IS HtmlPage AND input.path = "kits.html"
     AND (NOT input.hasHoneypot OR NOT input.hasSuccessModal) THEN RETURN TRUE    // 1.7
  IF input IS HtmlPage AND input.path = "about.html"
     AND input.jsonLdJobTitle CONTAINS "&amp;" THEN RETURN TRUE     // 1.8
  IF input IS HtmlPage AND input.path = "Intake/amazon-visibility.html"
     AND input.fontsUrlHasDuplicateWeight THEN RETURN TRUE          // 1.9
  IF input IS HtmlPage AND input.path IN ["diagnostic/start/index.html","tools/author-geo-audit/index.html"]
     AND input.usesUndefinedCustomProperty THEN RETURN TRUE         // 1.10
  RETURN FALSE
END FUNCTION

FUNCTION isBackendBug(input)
  // 1.11: test asserts llms.txt in critical_failures
  IF input IS TestRun AND input.file = "agent/scripts/test-comprehensive.js"
     AND input.assertsLlmsInCriticalFailures THEN RETURN TRUE
  // 1.12: redundant SSRF/DNS per scan
  IF input IS ScanRequest AND input.dnsLookupsPerHostname > 1 THEN RETURN TRUE
  // 1.13: double-fetch in diagnostic flow
  IF input IS DiagnosticRun AND input.refetchesHomepageRobotsLlmsSitemap THEN RETURN TRUE
  // 1.14: missing OWNER_EMAIL guard
  IF input IS EmailSend AND input.function IN ["sendDraftEmail","sendErrorEmail"]
     AND NOT input.checksOwnerEmail THEN RETURN TRUE
  RETURN FALSE
END FUNCTION

FUNCTION isCiBug(input)
  // 1.15: SEO monitor never fails + hardcoded Node 18
  IF input IS WorkflowRun AND input.workflow = "seo-monitor.yml"
     AND (input.exitsZeroOnFindings OR input.hardcodedNodeVersion) THEN RETURN TRUE
  // 1.16: security scan grep swallows findings
  IF input IS WorkflowRun AND input.workflow = "security-scan.yml"
     AND input.grepSwallowsMatches THEN RETURN TRUE
  // 1.17: html-validate glob skips subdirectories
  IF input IS LintRun AND input.glob = "*.html" THEN RETURN TRUE
  RETURN FALSE
END FUNCTION

FUNCTION isDuplicationBug(input)
  // 1.18-1.22: duplicated logic across modules
  IF input IS CodeModule AND input.definesLocally IN
     ["sanitizeLog","parseJson","escapeHtml","jsonLdWalker","hs256Verify"] THEN RETURN TRUE
  // 1.23: duplicated image-optimization commands in workflow
  IF input IS WorkflowRun AND input.workflow = "optimize-images.yml"
     AND input.duplicatesOptimizeScript THEN RETURN TRUE
  // 1.24: duplicated SSRF/live test scripts
  IF input IS CodeModule AND input.file IN
     ["test-scanner.js","test-comprehensive.js","test-api-endpoints.js"]
     AND input.duplicatesOfflineCoverage THEN RETURN TRUE
  // 1.25: split logo directories + unreferenced assets
  IF input IS RepoFile AND input.isUnreferencedLogoAsset THEN RETURN TRUE
  RETURN FALSE
END FUNCTION

FUNCTION isDeadCodeBug(input)
  // 1.26-1.28: empty/obsolete files
  IF input IS RepoFile AND input.file IN
     ["scripts/script.js","lighthouse-report.json",
      "scripts/analytics-report.js","scripts/email-automation.js"] THEN RETURN TRUE
  // 1.29: unused build scripts/devDependencies/imports
  IF input IS CodeModule AND input.hasUnusedBuildScriptOrDep THEN RETURN TRUE
  // 1.30: dead CSS selectors + inconsistent fonts
  IF input IS HtmlPage AND input.loadsUnusedGoogleFont THEN RETURN TRUE
  // 1.31: nonexistent Audio directory config
  IF input IS BuildConfig AND input.referencesAudioDir THEN RETURN TRUE
  // 1.32: inconsistent Node versions
  IF input IS BuildConfig AND input.nodeVersionInconsistent THEN RETURN TRUE
  // 1.33: stale branches
  IF input IS RepoState AND input.staleBranchCount > 0 THEN RETURN TRUE
  RETURN FALSE
END FUNCTION
```

### Examples

- **Build — deep nested path (1.1)**: `diagnostic/start/index.html` contains `<link href="../../styles.css">`. Expected: rewritten to `<link href="/static/styles.<hash>.css">`. Actual: left as `../../styles.css` because the regex `(?:\.\.\/|\/)?` only matches one `../` prefix.
- **Build — missing script (1.2)**: `Intake/amazon-visibility.html` has no `<script src="...script.js">` tag. Expected: includes `<script src="/static/script.<hash>.js">`. Actual: no client-side JavaScript runs.
- **Build — Netlify post-processing (1.3)**: `netlify.toml` sets `[build.processing.css] bundle = true` and `[build.processing.html] pretty_urls = true`. Expected: disabled so `/static/*` immutable headers survive. Actual: Netlify rewrites asset URLs away from `/static/*`.
- **Frontend — calculator CSS (1.4)**: `calculator.html` references `.meter-track`, `.meter-fill`, `.result-value`, `.positive`, `.negative` which are absent from `styles.css`. Expected: defined classes with visible meter and grid layout. Actual: `#squeezeMeter` has height 0 and results lack color styling.
- **Frontend — JSON-LD entity (1.8)**: `about.html` JSON-LD has `"jobTitle": "Founder &amp; Strategist"`. Expected: `"Founder & Strategist"`. Actual: schema parsers decode the literal string "Founder &amp; Strategist".
- **Frontend — Google Fonts URL (1.9)**: `Intake/amazon-visibility.html` loads `family=DM+Sans:wght@300;400;500;600;800;800` (duplicate `800`). Expected: `...800` (no duplicate). Actual: Google Fonts CSS2 API returns HTTP 400.
- **Backend — redundant DNS (1.12)**: A single `scanWithContent` call for one hostname performs `validateSSRF` (1 DNS lookup) plus 4 `safeFetch` calls, each calling `validateSSRF` (4 DNS lookups) plus `guardedLookup` (4 DNS lookups) = 9 DNS lookups. Expected: at most 1 per hostname. Actual: 9.
- **Backend — missing OWNER_EMAIL guard (1.14)**: `sendDraftEmail` checks only `!process.env.RESEND_API_KEY`, then passes `to: OWNER_EMAIL` (undefined). Expected: also checks `!OWNER_EMAIL` and skips with a warning. Actual: Resend throws an API error.
- **CI — SEO monitor never fails (1.15)**: Each check writes `echo "✗ ..."` and the script exits 0. The `if: failure()` comment step never runs. Also `node-version: '18'` is hardcoded. Expected: exit non-zero on findings; use `.nvmrc`. Actual: always exits 0; Node 18.
- **CI — security grep swallows matches (1.16)**: `grep -r -l "password\s*=" ... || echo "No hardcoded passwords found"` exits 0 whether or not matches exist. Expected: exit non-zero when matches found. Actual: workflow never fails.
- **Duplication — HS256 verification (1.21)**: `verifyNetlifySignature` and `verifyNetlifyProxySignature` both split the JWS, parse the base64url header, check `alg === 'HS256'`, compute the HMAC-SHA256 digest, and call `crypto.timingSafeEqual`. Expected: one shared helper. Actual: ~20 lines duplicated.
- **Dead code — 0-byte placeholder (1.26)**: `scripts/script.js` is a 0-byte file while the real frontend script is `/script.js` in the repo root. Expected: removed. Actual: committed empty placeholder.
- **Edge case — out-of-range font weight**: If the duplicate token were at the start (`800;300`), the CSS2 API would still reject due to axis-tuple sorting rules. Expected: any sorted unique weight list loads successfully.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors (Build & Asset Rewriting):**
- Root-level pages (`index.html`) and single-level-nested pages (`Intake/amazon-visibility.html` with `../styles.css`) continue to have their asset references rewritten to hashed `/static/*` paths correctly.
- Pages that already load `script.js` correctly continue to include the hashed script reference.
- Netlify continues to apply immutable `max-age=31536000` cache headers for `/static/*` assets.

**Unchanged Behaviors (Frontend & HTML Bugs):**
- Calculator elements that currently display correctly (non-meter, non-grid elements) continue to display correctly.
- Pages other than `tools/author-geo-audit/index.html` continue to use `.logo-mark` / `.footer-bottom` classes and display correctly.
- Pages other than `404.html` and `diagnostic/start/index.html` continue to show the nav-toggle button and mobile navigation on narrow screens.
- The contact form on `index.html` continues to include the honeypot and show the success modal on `index.html`.
- Other JSON-LD blocks in `about.html` continue to parse correctly.
- Other pages with correctly formatted Google Fonts URLs continue to load fonts successfully.
- `styles.css` continues to apply existing custom properties (`--bg-card`, `--text-1`, `--text-2`) to pages that use them.

**Unchanged Behaviors (Backend / Agent Service Bugs):**
- When `llms.txt` is present, `scanner.js` continues to parse and include it in scan results as optional (not critical).
- First-time scan of a URL continues to perform SSRF validation and DNS lookup to protect against SSRF attacks.
- The diagnostic flow continues to crawl and fetch additional pages beyond the homepage as needed.
- `sendLeadNotification` and `sendDiagnosticOwnerNotice` continue to send emails when both `RESEND_API_KEY` and `OWNER_EMAIL` are set.

**Unchanged Behaviors (CI / GitHub Actions Bugs):**
- The SEO monitor workflow continues to exit code 0 when no issues are found.
- The security scan workflow continues to exit code 0 when no hardcoded passwords are found.
- `html-validate` continues to validate root-level HTML files.

**Unchanged Behaviors (Code Duplications):**
- `sanitizeLog` called via the shared helper continues to return the same sanitized output.
- `parseJson` called from existing consumers continues to return the same JSON extraction results.
- HTML escaping applied to user input continues to produce the same escaped output.
- `netlify-signature.js` continues to return true for valid webhook signatures and reject invalid signatures.
- JSON-LD parsing continues to return the same Book/Person extraction results from all three modules.
- `npm run optimize:images` continues to optimize images with the same `optipng` / `jpegoptim` / `cwebp` commands.
- `agent/test/scanner.test.js` continues to pass and provide SSRF/scan coverage.
- Referenced logo assets (`Images/sonexial_logo.png`, `Images/favicon.png`) continue to be served correctly.

**Unchanged Behaviors (Unnecessary / Dead / Legacy Code):**
- `/script.js` in the repo root continues to be hashed and copied to `/static/script.<hash>.js`.
- `build.js` continues to copy `.html` / `.txt` / `.xml` files to `dist/`.
- Real email sending via `agent/src/email.js` (Resend) continues to work.
- `build.js` continues to hash and copy `styles.css` and `script.js` to `/static/` and rewrite HTML references.
- `styles.css` continues to style live pages correctly (only dead/retired selectors are removed).
- `build.js` continues to copy existing directories (`Images/`, `assets/`) to `dist/`.
- `deploy.yml` continues to run agent tests successfully.
- The `main` branch continues to be used for production deployment.

**Scope:**
All inputs/configurations that do NOT match any category sub-condition shall be completely unaffected by this fix. This includes:
- Root-level and single-level-nested HTML asset rewriting
- Mouse-click navigation and existing correctly-functioning interactive elements
- Valid webhook signature verification
- All non-defective scan, email, CI, and build paths

## Hypothesized Root Cause

Based on reading the actual source code, the most likely root causes per category are:

### Build & Asset Rewriting

1. **Regex only matches one `../` prefix (1.1)**: `rewriteHtml` uses `/(?:\.\.\/|\/)?styles\.css/` which matches zero or one `../` prefix. Deeper paths like `../../styles.css` fall through un-rewritten. The fix is to match any number of `../` prefixes: `(?:\.\.\/)*`.
2. **Source HTML omits the script tag (1.2)**: `Intake/amazon-visibility.html` simply has no `<script src="...script.js">` element in its source. The build can only rewrite a tag that exists; the source must be amended to include it.
3. **Netlify post-processing overrides build output (1.3)**: `netlify.toml` enables `[build.processing.css].bundle`, `[build.processing.js].bundle`, and `[build.processing.html].pretty_urls`, which let Netlify's asset optimizer rewrite URLs away from the immutable `/static/*` paths that `build.js` establishes.

### Frontend & HTML Bugs

1. **Calculator classes never added to stylesheet (1.4)**: `calculator.html` and `scripts/calculator.js` reference classes that were never defined in `styles.css`. The meter, grid, and color styles are absent.
2. **Subdirectory page uses old footer pattern (1.5)**: `tools/author-geo-audit/index.html` was built with legacy `.footer-logo` / `.footer-links` / `.footer-copy` classes and omits the `<script src="...script.js">` tag, so it diverges from the canonical footer and nav-toggle pattern used elsewhere.
3. **Missing nav-toggle button in markup (1.6)**: `404.html` and `diagnostic/start/index.html` omit the `<button class="nav-toggle">` element from `#site-header`, so the CSS `display: none` rule on `.main-nav` (below 1100px) leaves no way to open the menu.
4. **Incomplete form integration (1.7)**: `kits.html`'s contact form was not given the honeypot attribute/field or the `#success-modal` markup that `index.html` has, so it falls back to Netlify's default redirect.
5. **HTML entity in JSON string (1.8)**: `about.html`'s JSON-LD block was hand-authored with `&amp;` inside a JSON string value. JSON strings are not HTML-decoded by schema parsers.
6. **Copy-paste duplicate weight token (1.9)**: The Google Fonts CSS2 URL in `Intake/amazon-visibility.html` contains `800;800` — a duplicated weight that violates the CSS2 API's strict axis-tuple sorting.
7. **Undefined CSS custom properties (1.10)**: `diagnostic/start/index.html` and `tools/author-geo-audit/index.html` reference `var(--color-surface, …)` and `var(--color-text-dim, …)` that do not exist in the `:root` block of `styles.css` (which defines `--bg-card`, `--text-1`, `--text-2`).

### Backend / Agent Service Bugs

1. **Stale test assertion (1.11)**: `agent/scripts/test-comprehensive.js` asserts that `repB.critical_failures` includes `'llms.txt'`, but the scanner's `llms.txt` handling is optional. (Note: the current `analyzeFiles` code still pushes a "Missing llms.txt" message to `critical_failures`; the fix per requirements is to align the test with the intended optional semantics — the test must not assert `llms.txt` in `critical_failures`, and `llms.txt` should be treated as optional when present.)
2. **SSRF validation repeated per fetch (1.12)**: `scanWithContent` calls `validateSSRF` once for the input URL, then each of the 4 `safeFetch` calls re-runs `validateSSRF` (a DNS lookup) and `guardedLookup` (another DNS lookup) — up to 9 redundant lookups. Caching the validated hostname (and its resolved IPs) per scan eliminates the redundancy.
3. **Diagnostic flow re-fetches from scratch (1.13)**: `runDiagnostic` calls `scanner.runScan(url)` (which fetches homepage/robots/llms/sitemap via `scanWithContent` but returns only the report), then calls `crawlSite(scan.url, options)` which independently re-fetches the same four resources. Passing the already-fetched content (or a shared fetch cache) into the crawl avoids the double-fetch.
4. **Inconsistent email guard (1.14)**: `sendDraftEmail` and `sendErrorEmail` check only `!process.env.RESEND_API_KEY` before passing `to: OWNER_EMAIL` (which is `undefined` when `OWNER_EMAIL` is unset). `sendLeadNotification` and `sendDiagnosticOwnerNotice` also check `!OWNER_EMAIL`. The fix is to add the same guard.

### CI / GitHub Actions Bugs

1. **Checks never exit non-zero (1.15)**: Every SEO monitor check uses `if … then echo "✓" else echo "✗"` and the step ends with exit 0 regardless. The `if: failure()` comment step is therefore dead code. Additionally `node-version: '18'` is hardcoded instead of `node-version-file: '.nvmrc'`.
2. **Grep swallows matches with `|| echo` (1.16)**: The "Scan for hardcoded credentials" step appends `|| echo "No … found"` to every grep, which forces exit 0 even when grep finds matches. The "Check for common secret patterns" step already does this correctly with `&& exit 1`; the credential-scan step needs the same pattern.
3. **Glob only matches root (1.17)**: `package.json`'s `test:html` script uses `html-validate '*.html'` which is a non-recursive glob matching only root-level files. Subdirectory HTML files are skipped.

### Code Duplications

1. **Local re-implementation instead of import (1.18–1.22)**: `sanitizeLog` is defined in `scanner.js`, `index.js`, and `ai-utils.js`; `parseJson` is re-implemented in `metadata-kit.js`; `escapeHtml` is defined in `email.js`, `render.js` (as `esc`), and `author-geo-audit/index.html`; the JSON-LD tree walker is duplicated in `scanner.js`, `page-facts.js`, and `semantic-extractor.js`; the HS256 verification is duplicated in both `netlify-signature.js` functions. The root cause is copy-paste development without refactoring to a shared module.
2. **Workflow duplicates script logic (1.23)**: `.github/workflows/optimize-images.yml` re-implements the `optipng`/`jpegoptim`/`cwebp` shell commands instead of calling `npm run optimize:images`.
3. **Redundant test scripts (1.24)**: `test-scanner.js`, `test-comprehensive.js`, and `test-api-endpoints.js` duplicate SSRF target arrays and live scans already covered offline by `agent/test/scanner.test.js`.
4. **Split asset directories (1.25)**: Logos live in both `Images/` and `assets/img/`, and several files (`assets/img/logo-full.png`, `assets/img/logo.png`, `Images/logo_mark_2026.png`, `Images/signal-bg.jpg`) are unreferenced.

### Unnecessary / Dead / Legacy Code

1. **Leftover placeholder/generated/obsolete files (1.26–1.28)**: `scripts/script.js` (0 bytes), `lighthouse-report.json` (558 KB generated output), `scripts/analytics-report.js` (mock data), and `scripts/email-automation.js` (stub with `console.log`) were never cleaned up after their functionality moved or was abandoned.
2. **Unused build tooling (1.29)**: `package.json` retains `build:css`/`build:js`/`build:html`/`watch` scripts outputting gitignored `.min.*` files, devDependencies (`npm-watch`, `watch`, `clean-css-cli`, `terser`, `html-minifier-terser`, `linkinator`), and unused imports (`http` in `test-api-endpoints.js`, `validateSSRF` in `test-scanner.js`/`test-comprehensive.js`).
3. **Accumulated dead CSS and inconsistent fonts (1.30)**: ~350 lines / 32 selectors from retired sections (Testimonials, Content Vault, old Hero/Lead Magnet, Example cards) remain in `styles.css`; meanwhile several pages load DM Serif Display / DM Mono from Google Fonts while `styles.css` uses IBM Plex Mono for `--font-mono`.
4. **Phantom Audio directory (1.31)**: Both `build.js` (`assetDirs` includes `'Audio'`) and `netlify.toml` (`/Audio/*` headers) reference a directory that does not exist.
5. **Inconsistent Node versions (1.32)**: `.nvmrc` (22), `agent/.nvmrc` (20), `seo-monitor.yml` (hardcoded 18), `deploy.yml` (uses root `.nvmrc` = 22 for agent tests).
6. **Stale branches (1.33)**: 24 branches (`antigravity/fix-redirects` and 23 `devin/*`) remain uncleaned.

## Correctness Properties

Property 1: Bug Condition - Build & Asset Rewriting

_For any_ build input where the bug condition holds — a subdirectory HTML page two or more levels deep with a nested relative asset path (`../../styles.css`), an intake page missing its script tag, or Netlify post-processing flags enabled — the fixed build pipeline SHALL rewrite all asset references (including deep nested paths) to their hashed `/static/*` counterparts, include the script reference on the intake page, and disable post-processing flags so immutable cache headers are preserved.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Build & Asset Rewriting

_For any_ build input where the bug condition does NOT hold — root-level or single-level-nested pages, pages that already load script.js correctly, and assets served from `/static/*` — the fixed build pipeline SHALL produce the same rewritten output as the original, preserving correct asset rewriting, hashed script references, and immutable cache headers.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 3: Bug Condition - Frontend & HTML Bugs

_For any_ HTML page where the bug condition holds — a calculator page with undefined CSS classes, a subdirectory footer with legacy classes and missing script, pages missing the mobile nav-toggle, a form without honeypot/success-modal, a JSON-LD block with an HTML entity, a malformed Google Fonts URL, or pages referencing undefined CSS custom properties — the fixed frontend SHALL define and apply the required CSS classes, use canonical footer classes and load script, include the nav-toggle button, add the honeypot and success-modal, use literal ampersands in JSON-LD strings, generate a duplicate-free Fonts URL, and use defined custom properties.

**Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

Property 4: Preservation - Frontend & HTML Bugs

_For any_ HTML page where the bug condition does NOT hold — correctly-styled calculator elements, pages with canonical footers, pages with working nav-toggle, the `index.html` contact form, other JSON-LD blocks in `about.html`, other pages with valid Fonts URLs, and pages using existing custom properties — the fixed frontend SHALL produce the same visual output and behavior as the original, preserving correct styling, navigation, form handling, schema parsing, font loading, and theme application.

**Validates: Requirements 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

Property 5: Bug Condition - Backend / Agent Service Bugs

_For any_ backend input where the bug condition holds — a test asserting `llms.txt` in `critical_failures`, a scan performing redundant SSRF/DNS lookups, a diagnostic flow re-fetching homepage/robots/llms/sitemap, or an email sender lacking the `OWNER_EMAIL` guard — the fixed backend SHALL align the test with optional `llms.txt` semantics, cache SSRF validation per hostname per scan, reuse fetched results in the diagnostic flow, and guard both `RESEND_API_KEY` and `OWNER_EMAIL` before sending.

**Validates: Requirements 2.11, 2.12, 2.13, 2.14**

Property 6: Preservation - Backend / Agent Service Bugs

_For any_ backend input where the bug condition does NOT hold — a scan where `llms.txt` is present, a first-time URL validation, a diagnostic crawl needing additional pages, or email senders with both env vars set — the fixed backend SHALL produce the same results as the original, preserving optional `llms.txt` inclusion, SSRF protection, crawl coverage, and successful email delivery.

**Validates: Requirements 3.11, 3.12, 3.13, 3.14**

Property 7: Bug Condition - CI / GitHub Actions Bugs

_For any_ CI input where the bug condition holds — an SEO monitor workflow that exits zero on findings or hardcodes Node 18, a security scan grep that swallows matches, or an `html-validate` glob that skips subdirectories — the fixed CI SHALL exit non-zero when issues are found, use `.nvmrc` for the Node version, fail on actual credential findings, and validate all HTML files including subdirectories.

**Validates: Requirements 2.15, 2.16, 2.17**

Property 8: Preservation - CI / GitHub Actions Bugs

_For any_ CI input where the bug condition does NOT hold — an SEO monitor run with no issues, a security scan with no findings, or `html-validate` on root-level files — the fixed CI SHALL produce the same exit code and validation results as the original, preserving successful exit codes and root-level HTML validation.

**Validates: Requirements 3.15, 3.16, 3.17**

Property 9: Bug Condition - Code Duplications

_For any_ code module where the bug condition holds — a module locally defining `sanitizeLog`, `parseJson`, `escapeHtml`, a JSON-LD tree-walker, or HS256 verification; a workflow duplicating image-optimization commands; redundant SSRF/live test scripts; or split/unreferenced logo assets — the fixed codebase SHALL import a single shared implementation, call `npm run optimize:images` from the workflow, consolidate or remove redundant test scripts, and consolidate logos into one directory while removing unreferenced assets.

**Validates: Requirements 2.18, 2.19, 2.20, 2.21, 2.22, 2.23, 2.24, 2.25**

Property 10: Preservation - Code Duplications

_For any_ code module where the bug condition does NOT hold — a `sanitizeLog` call via the shared helper, a `parseJson` call from existing consumers, HTML escaping of user input, valid webhook signature verification, JSON-LD Book/Person extraction, `npm run optimize:images` locally, offline `scanner.test.js`, or referenced logo assets — the fixed codebase SHALL produce the same output and behavior as the original, preserving sanitized logs, JSON extraction, escaped strings, signature verification, entity extraction, image optimization, offline test coverage, and logo serving.

**Validates: Requirements 3.18, 3.19, 3.20, 3.21, 3.22, 3.23, 3.24, 3.25**

Property 11: Bug Condition - Unnecessary / Dead / Legacy Code

_For any_ repo file or configuration where the bug condition holds — a 0-byte placeholder script, a committed Lighthouse report, obsolete mock scripts, unused build scripts/devDependencies/imports, dead CSS selectors and inconsistent fonts, a nonexistent Audio directory config, inconsistent Node versions, or stale branches — the fixed repository SHALL remove the dead files, scripts, dependencies, selectors, and Audio config, resolve font loading, align Node versions, and clean up stale branches.

**Validates: Requirements 2.26, 2.27, 2.28, 2.29, 2.30, 2.31, 2.32, 2.33**

Property 12: Preservation - Unnecessary / Dead / Legacy Code

_For any_ repo file or configuration where the bug condition does NOT hold — the root `/script.js`, `build.js` copying legitimate files, real email sending via Resend, the production build hashing pipeline, active CSS selectors on live pages, `build.js` copying existing directories, `deploy.yml` agent tests, or the `main` production branch — the fixed repository SHALL continue to hash and copy script, copy site files, send emails, build and rewrite assets, style live pages, copy directories, run agent tests, and deploy from main exactly as before.

**Validates: Requirements 3.26, 3.27, 3.28, 3.29, 3.30, 3.31, 3.32, 3.33**

## Fix Implementation

### Changes Required

**File**: `scripts/build.js`

1. **Deep nested asset rewriting (1.1)**: Change the regex in `rewriteHtml` from `(?:\.\.\/|\/)?` to `(?:\.\.\/)*` (zero or more `../` prefixes) for both the `styles.css` and `script.js` replacements so that `../../styles.css` and deeper paths are rewritten.
2. **Remove Audio directory (1.31)**: Remove `'Audio'` from the `assetDirs` array since the directory does not exist.
3. **Exclude lighthouse-report.json from dist (1.27)**: Ensure `lighthouse-report.json` is not copied into `dist/` (it is a root file matched by the root-files filter; either add an exclusion or remove it from the repo per 1.27).

**File**: `Intake/amazon-visibility.html`

4. **Add script.js tag (1.2)**: Add `<script src="../script.js"></script>` so `build.js` can rewrite it to the hashed `/static/script.<hash>.js`.
5. **Fix Google Fonts URL (1.9)**: Change `family=DM+Sans:wght@300;400;500;600;800;800` to `family=DM+Sans:wght@300;400;500;600;800` (remove the duplicate `800`).
6. **Resolve inconsistent font loading (1.30)**: Either remove the DM Serif Display / DM Mono Google Fonts loads if unused, or align the `--font-*` variables in `styles.css`. (Decision per requirements: remove unused font loads or align variables.)

**File**: `netlify.toml`

7. **Disable post-processing flags (1.3)**: Set `[build.processing.css].bundle = false`, `[build.processing.js].bundle = false`, and `[build.processing.html].pretty_urls = false` (or remove the `[build.processing.*]` blocks) so Netlify does not rewrite asset URLs away from `/static/*`.
8. **Remove Audio headers (1.31)**: Remove the `[[headers]] for = "/Audio/*"` block.

**File**: `styles.css`

9. **Add calculator CSS classes (1.4)**: Define `.product-detail`, `.product-detail-grid`, `.result-value`, `.positive`, `.negative`, `.meter-track`, `.meter-fill` so `#squeezeMeter` has visible height and the calculator results have grid layout and color styling.
10. **Add missing custom properties (1.10)**: Add `--color-surface` and `--color-text-dim` to the `:root` block (or rename the references in the affected pages to use `--bg-card` / `--text-2`).
11. **Remove dead CSS (1.30)**: Remove the ~32 unused selectors from retired sections (Testimonials, Content Vault articles, old Hero & Lead Magnet layouts, Example cards).

**File**: `tools/author-geo-audit/index.html`

12. **Fix footer classes (1.5)**: Replace `.footer-logo`, `.footer-links`, `.footer-copy` with the canonical `.logo-mark` / `.footer-bottom` classes used by other pages.
13. **Add script.js tag (1.5)**: Add `<script src="../../script.js"></script>` so `.nav-toggle` works.
14. **Fix undefined custom properties (1.10)**: Use defined `--color-surface` / `--color-text-dim` (added per change 10) or the existing `--bg-card` / `--text-2`.

**Files**: `404.html`, `diagnostic/start/index.html`

15. **Add nav-toggle button (1.6)**: Add `<button class="nav-toggle" aria-label="Toggle navigation">…</button>` inside `#site-header` so mobile users can open the navigation menu.

**File**: `kits.html`

16. **Add honeypot and success modal (1.7)**: Add `netlify-honeypot="bot-field"` to the form, a hidden `<input name="bot-field" hidden>` field, and the `#success-modal` markup so submission shows a success modal on `kits.html` rather than redirecting.

**File**: `about.html`

17. **Fix JSON-LD jobTitle (1.8)**: Change `"jobTitle": "Founder &amp; Strategist"` to `"jobTitle": "Founder & Strategist"` (literal ampersand).

**File**: `agent/scripts/test-comprehensive.js`

18. **Fix stale assertion (1.11)**: Remove or update the assertion that `repB.critical_failures` includes `'llms.txt'` to align with `scanner.js`'s optional `llms.txt` semantics.

**File**: `agent/src/scanner.js`

19. **Cache SSRF validation per hostname (1.12)**: Introduce a per-scan hostname cache so `validateSSRF` and the DNS resolution are performed at most once per hostname. `scanWithContent` validates the input URL once and passes validated resolution info to `safeFetch` (or `safeFetch` checks the cache before re-validating). `guardedLookup` can also consult the cache.
20. **Remove local `sanitizeLog` (1.18)**: Replace the local `sanitizeLog` definition with an import from `agent/src/ai-utils.js`.
21. **Extract shared JSON-LD walker (1.22)**: Extract the recursive `walk`/tree-walker from `analyzeHtml` into a shared module (e.g. `agent/src/jsonld.js`) imported by `scanner.js`, `page-facts.js`, and `semantic-extractor.js`.

**File**: `agent/src/diagnostic/index.js`

22. **Reuse fetched results (1.13)**: Have `runDiagnostic` call `scanWithContent` (which returns HTML) instead of `runScan`, and pass the already-fetched homepage/robots/llms/sitemap results into `crawlSite` (or have `crawlSite` accept pre-fetched content) so the four resources are fetched only once.

**File**: `agent/src/email.js`

23. **Add OWNER_EMAIL guard (1.14)**: In `sendDraftEmail` and `sendErrorEmail`, change the guard from `if (!process.env.RESEND_API_KEY)` to `if (!process.env.RESEND_API_KEY || !OWNER_EMAIL)` and skip with a `console.warn`, matching `sendLeadNotification` / `sendDiagnosticOwnerNotice`.
24. **Extract shared `escapeHtml` (1.20)**: Move `escapeHtml` to a shared module (e.g. `agent/src/ai-utils.js` or a new `agent/src/escape.js`) and import it in `email.js`, `diagnostic/render.js`, and (where feasible) `tools/author-geo-audit/index.html`.

**File**: `agent/src/ai-utils.js`

25. **Export shared helpers (1.18, 1.19, 1.20)**: Ensure `sanitizeLog`, `parseJson`, and `escapeHtml` are all exported from this shared module so consumers import rather than re-implement.

**File**: `agent/src/kits/metadata-kit.js`

26. **Use shared `parseJson` (1.19)**: Replace the local `indexOf('{')` / `lastIndexOf('}')` + `JSON.parse` block with an import of `parseJson` from `ai-utils.js`.

**File**: `agent/src/netlify-signature.js`

27. **Extract shared HS256 verifier (1.21)**: Extract a shared `verifyHs256Jws(signature, secret)` helper that splits the JWS, validates the `HS256` alg, computes the HMAC, and calls `crypto.timingSafeEqual`. Both `verifyNetlifySignature` and `verifyNetlifyProxySignature` call it, then apply their own payload-specific checks (`sha256` body hash vs. `exp` expiry).

**File**: `.github/workflows/seo-monitor.yml`

28. **Exit non-zero on findings (1.15)**: Track a failure flag in each check step and `exit 1` when any `✗` condition is detected, so the `if: failure()` comment step triggers.
29. **Use `.nvmrc` (1.15, 1.32)**: Replace `node-version: '18'` with `node-version-file: '.nvmrc'`.

**File**: `.github/workflows/security-scan.yml`

30. **Fail on credential matches (1.16)**: Change the "Scan for hardcoded credentials" greps to `exit 1` when matches are found (using the `&& echo "::error::…" && exit 1` pattern already used in the "Check for common secret patterns" step).

**File**: `package.json`

31. **Fix html-validate glob (1.17)**: Change `test:html` from `html-validate '*.html'` to `html-validate '**/*.html'` (recursive) so subdirectory files are validated.
32. **Remove unused build scripts (1.29)**: Remove `build:css`, `build:js`, `build:html`, `watch`, `watch:css`, `watch:js` and the `watch` config block.
33. **Remove unused devDependencies (1.29)**: Remove `npm-watch`, `watch`, `clean-css-cli`, `terser`, `html-minifier-terser`, `linkinator` from `devDependencies`.

**File**: `.github/workflows/optimize-images.yml`

34. **Call npm script (1.23)**: Replace the duplicated `optipng`/`jpegoptim`/`cwebp` shell commands with `npm run optimize:images`.

**Files**: `agent/scripts/test-scanner.js`, `test-comprehensive.js`, `test-api-endpoints.js`

35. **Remove redundant test scripts/imports (1.24, 1.29)**: Consolidate duplicated SSRF/live scan logic into a single shared script or remove the redundant files in favor of `agent/test/scanner.test.js`. Remove unused imports (`http` in `test-api-endpoints.js`, `validateSSRF` in `test-scanner.js`/`test-comprehensive.js`).

**Files**: `scripts/script.js`, `lighthouse-report.json`, `scripts/analytics-report.js`, `scripts/email-automation.js`

36. **Remove dead files (1.26, 1.27, 1.28)**: Delete the 0-byte placeholder, the generated Lighthouse report, and the obsolete mock scripts.

**Files**: Logo assets (`assets/img/logo-full.png`, `assets/img/logo.png`, `Images/logo_mark_2026.png`, `Images/signal-bg.jpg`)

37. **Consolidate logos and remove unreferenced assets (1.25)**: Consolidate logos into a single directory and delete unreferenced files (after confirming no references).

**Files**: `.nvmrc`, `agent/.nvmrc`, workflow files

38. **Align Node versions (1.32)**: Use a consistent Node version (or a documented intentional split) across `.nvmrc`, `agent/.nvmrc`, and all GitHub Actions workflows.

**Repository branches**

39. **Clean up stale branches (1.33)**: Delete the 24 stale branches (`antigravity/fix-redirects` and 23 `devin/*` branches).

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fix works correctly and preserves existing behavior. Because the 33 issues span six domains with different testing modalities, each category has its own exploratory, fix, and preservation plan.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan (Build & Asset Rewriting)**: Build the site on unfixed code and inspect the `dist/` output for deep-nested pages. Run `grep` for un-rewritten asset paths. Check the Intake page source for a missing script tag. Confirm `netlify.toml` post-processing flags.

**Test Cases**:
1. **Deep Nested Path Test**: Build and inspect `dist/diagnostic/start/index.html` — assert `../../styles.css` survives un-rewritten (will fail on unfixed code; the path remains).
2. **Intake Script Test**: Inspect `Intake/amazon-visibility.html` source — assert no `<script src="...script.js">` exists.
3. **Netlify Flags Test**: Grep `netlify.toml` for `bundle = true` and `pretty_urls = true`.
4. **Single-Level Preservation Test**: Build and inspect `dist/Intake/amazon-visibility.html` — assert `../styles.css` IS rewritten (confirms preservation baseline).

**Expected Counterexamples**:
- Deep nested HTML retains `../../styles.css` instead of `/static/styles.<hash>.css`
- Intake page has no script tag
- Post-processing flags are enabled

**Test Plan (Frontend & HTML Bugs)**: Load each affected page in a browser (or headless) and inspect computed styles and DOM.

**Test Cases**:
5. **Squeeze Meter Test**: Open `calculator.html`, inspect `#squeezeMeter` computed height — assert 0px (invisible) on unfixed code.
6. **Footer Logo Test**: Open `tools/author-geo-audit/index.html`, inspect the footer logo width — assert full intrinsic width on unfixed code.
7. **Nav-Toggle Test**: Open `404.html` at <1100px viewport, assert no `.nav-toggle` button in `#site-header`.
8. **Kits Form Test**: Inspect `kits.html` form — assert no `netlify-honeypot` and no `#success-modal`.
9. **JSON-LD Entity Test**: Parse `about.html` JSON-LD — assert `jobTitle` literally contains `&amp;`.
10. **Fonts URL Test**: Request the Google Fonts URL from `Intake/amazon-visibility.html` — assert HTTP 400 due to duplicate `800;800`.
11. **Custom Property Test**: Inspect computed styles on `diagnostic/start/index.html` — assert `--color-surface`/`--color-text-dim` are undefined (fallback values used).

**Expected Counterexamples**:
- Meter height 0, results unstyled, footer logo oversized, no nav-toggle, no honeypot/modal, `&amp;` in JSON-LD, HTTP 400 fonts, fallback-only custom properties.

**Test Plan (Backend / Agent Service Bugs)**: Run the agent test suite and instrument DNS lookups.

**Test Cases**:
12. **Stale Assertion Test**: Run `node agent/scripts/test-comprehensive.js` — assert failure on the `llms.txt` / `critical_failures` assertion.
13. **Redundant DNS Test**: Instrument `dns.lookup` calls during a single `scanWithContent` run — assert >1 lookup per hostname (expect ~9).
14. **Double-Fetch Test**: Instrument `safeFetch` calls during `runDiagnostic` — assert homepage/robots/llms/sitemap fetched twice.
15. **Missing Guard Test**: Call `sendDraftEmail` with `RESEND_API_KEY` set but `OWNER_EMAIL` unset — assert Resend API error.

**Expected Counterexamples**:
- Test failure on stale assertion, 9 DNS lookups, double-fetch, API error on undefined `to`.

**Test Plan (CI / GitHub Actions Bugs)**: Inspect workflow YAML and simulate check steps.

**Test Cases**:
16. **SEO Monitor Exit Test**: Simulate a missing `<title>` in `index.html` and run the check script — assert exit 0 (bug: should be non-zero).
17. **Security Grep Test**: Run the credential grep against a fixture with `password = "x"` — assert exit 0 (bug: should be non-zero).
18. **HTML Validate Glob Test**: Run `npm run test:html` — assert subdirectory files are not validated.

**Expected Counterexamples**:
- Exit 0 on findings, glob skips subdirectories.

**Test Plan (Code Duplications & Dead Code)**: Grep for local definitions, count duplicates, and confirm unreferenced assets.

**Test Cases**:
19. **Duplication Grep Test**: Grep for `function sanitizeLog` across `agent/src/` — assert 3 definitions. Grep for `escapeHtml` — assert 3 definitions. Grep for HS256 in `netlify-signature.js` — assert duplicated blocks.
20. **Dead File Test**: Assert `scripts/script.js` is 0 bytes. Assert `lighthouse-report.json` exists. Assert `scripts/analytics-report.js` / `email-automation.js` exist with mock content.

**Expected Counterexamples**:
- Multiple local definitions of the same logic, dead/empty/obsolete files present.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function/configuration produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedPipeline(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Per-category fix checks**:
- **Build**: Build the site and assert every deep-nested page's assets are rewritten; assert the Intake page has a script tag; assert `netlify.toml` flags are disabled.
- **Frontend**: Assert calculator meter has height > 0 and results have grid/color; assert footer logo is sized; assert nav-toggle present; assert honeypot/modal present; assert JSON-LD `jobTitle` is `"Founder & Strategist"`; assert Fonts URL returns 200; assert custom properties resolve.
- **Backend**: Run the test suite (assert no stale-assertion failure); instrument DNS (assert ≤1 per hostname); instrument fetches in diagnostic (assert 1 fetch each); call `sendDraftEmail`/`sendErrorEmail` with no `OWNER_EMAIL` (assert graceful skip).
- **CI**: Simulate a failing check (assert non-zero exit); run credential grep on a fixture (assert non-zero on match); run `test:html` (assert subdirectory files validated).
- **Duplication**: Grep for local definitions (assert single shared source); assert workflow calls `npm run optimize:images`; assert unreferenced assets removed.
- **Dead code**: Assert dead files removed; assert unused scripts/deps removed; assert dead CSS removed; assert `Audio` config removed; assert Node versions aligned.

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function/configuration produces the same result as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalPipeline(input) = fixedPipeline(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many test cases automatically across the input domain, catches edge cases that manual unit tests might miss, and provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on UNFIXED code first for all non-bug inputs, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Root Asset Rewriting Preservation**: Build root-level and single-level pages before and after the fix; assert identical `/static/*` rewriting.
2. **Existing Script Loading Preservation**: Assert pages that already load `script.js` continue to load the hashed version.
3. **Static Cache Headers Preservation**: Assert `/static/*` headers remain `max-age=31536000, immutable`.
4. **Calculator Non-Meter Elements Preservation**: Assert non-meter/non-grid calculator elements render identically.
5. **Canonical Footer Preservation**: Assert pages other than `author-geo-audit` retain `.logo-mark` / `.footer-bottom` styling.
6. **Existing Nav-Toggle Preservation**: Assert pages with nav-toggle continue to show it on narrow screens.
7. **Index Contact Form Preservation**: Assert `index.html` form still has honeypot and success modal.
8. **Other JSON-LD Preservation**: Assert other JSON-LD blocks in `about.html` parse identically.
9. **Other Fonts URLs Preservation**: Assert other pages' Fonts URLs still return 200.
10. **Existing Custom Properties Preservation**: Assert `--bg-card`, `--text-1`, `--text-2` still apply.
11. **llms.txt Optional Preservation**: Assert scans with `llms.txt` present still parse and include it as optional.
12. **First-Time SSRF Preservation**: Assert first-time URL validation still rejects private IPs.
13. **Diagnostic Crawl Preservation**: Assert the diagnostic flow still crawls additional pages beyond the homepage.
14. **Lead/Diagnostic Email Preservation**: Assert `sendLeadNotification` / `sendDiagnosticOwnerNotice` still send with both env vars set.
15. **SEO No-Issue Exit Preservation**: Assert SEO monitor exits 0 when no issues found.
16. **Security No-Finding Exit Preservation**: Assert security scan exits 0 when no credentials found.
17. **Root HTML Validation Preservation**: Assert `html-validate` still checks root-level files.
18. **Shared Helper Output Preservation**: Assert `sanitizeLog`, `parseJson`, `escapeHtml` produce identical output via the shared module.
19. **Webhook Signature Preservation**: Assert valid signatures still return true and invalid ones still return false.
20. **JSON-LD Extraction Preservation**: Assert Book/Person extraction results are identical across all three modules.
21. **Image Optimization Preservation**: Assert `npm run optimize:images` produces the same optimized output.
22. **Offline Test Preservation**: Assert `agent/test/scanner.test.js` still passes.
23. **Referenced Logo Preservation**: Assert `Images/sonexial_logo.png` / `favicon.png` still serve.
24. **Root Script Hashing Preservation**: Assert `/script.js` still hashes to `/static/script.<hash>.js`.
25. **Site File Copying Preservation**: Assert `build.js` still copies `.html` / `.txt` / `.xml` to `dist/`.
26. **Real Email Preservation**: Assert `agent/src/email.js` (Resend) still sends emails.
27. **Production Build Preservation**: Assert `build.js` still hashes/copies `styles.css`/`script.js` and rewrites HTML.
28. **Active CSS Preservation**: Assert live pages still style correctly after dead CSS removal.
29. **Directory Copying Preservation**: Assert `build.js` still copies `Images/` / `assets/` to `dist/`.
30. **Agent Test Preservation**: Assert `deploy.yml` agent tests still pass.
31. **Main Branch Preservation**: Assert production still deploys from `main`.

### Unit Tests

- **Build**: Unit test `rewriteHtml` with root-level (`styles.css`), single-level (`../styles.css`), two-level (`../../styles.css`), and three-level (`../../../styles.css`) paths; assert all rewrite to `/static/*`.
- **Scanner**: Unit test the per-hostname SSRF/DNS cache — assert a second `safeFetch` for the same hostname does not re-resolve DNS.
- **Email**: Unit test `sendDraftEmail`/`sendErrorEmail` with `RESEND_API_KEY` set and `OWNER_EMAIL` unset — assert graceful skip (no Resend call).
- **netlify-signature**: Unit test the shared HS256 helper with valid and invalid signatures, tampered payloads, and wrong algorithms.
- **JSON-LD**: Unit test the shared tree-walker with nested `@graph`, arrays, and mixed `@type` values — assert Book/Person/FAQ extraction matches the original per-module output.
- **CI scripts**: Unit test (shell) the SEO check script with a fixture missing `<title>` — assert non-zero exit.

### Property-Based Tests

- **Asset rewriting**: Generate random nesting depths (0–5) and random asset filenames; verify the fixed regex rewrites every depth while the original only rewrites depth 0–1.
- **SSRF/DNS caching**: Generate random scan URLs with repeated hostnames; verify the fixed scanner performs at most 1 DNS lookup per hostname while the original performs up to 9.
- **Email guards**: Generate random combinations of `RESEND_API_KEY` set/unset and `OWNER_EMAIL` set/unset across all four email functions; verify the fixed functions all guard consistently.
- **HTML escaping**: Generate random strings with special characters (`&`, `<`, `>`, `"`, `'`); verify the shared `escapeHtml` produces identical output to each previous local implementation.
- **JSON-LD extraction**: Generate random JSON-LD structures (nested objects, arrays, `@graph`); verify the shared walker extracts the same `@type`/`sameAs`/Book/Person results as each original module.
- **Dead CSS removal**: Generate random selector lists; verify that only selectors with zero live-page references are removed and all referenced selectors are preserved.

### Integration Tests

- **Full build**: Run `npm run build` end-to-end and assert all HTML pages (root and subdirectory) reference hashed `/static/*` assets, the Intake page includes a script tag, and `lighthouse-report.json` is not in `dist/`.
- **Full scan + diagnostic**: Run `runDiagnostic` against a test fixture site and assert the homepage/robots/llms/sitemap are fetched exactly once, the crawl reuses those results, and the report is complete.
- **CI simulation**: Run the SEO monitor and security scan scripts against fixtures with and without issues; assert correct exit codes in both directions.
- **Workflow consistency**: Assert all GitHub Actions workflows resolve the same Node version from `.nvmrc` (or a documented split) and the `optimize-images` workflow calls `npm run optimize:images`.
- **HTML validation**: Run `npm run test:html` and assert all HTML files including subdirectories are validated.
