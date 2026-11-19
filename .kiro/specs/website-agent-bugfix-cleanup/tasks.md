# Implementation Plan

- [x] 1. Write bug condition exploration test for Build & Asset Rewriting
  - **Property 1: Bug Condition** - Build & Asset Rewriting
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate the build/asset bugs exist
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases for reproducibility
  - **Test Cases** (from design Testing Strategy):
    - Deep Nested Path Test: Build the site and inspect `dist/diagnostic/start/index.html` — assert `../../styles.css` survives un-rewritten (FAILS on unfixed code; the path remains instead of `/static/styles.<hash>.css`)
    - Intake Script Test: Inspect `Intake/amazon-visibility.html` source — assert no `<script src="...script.js">` tag exists
    - Netlify Flags Test: Grep `netlify.toml` for `bundle = true` and `pretty_urls = true` — assert flags are enabled
    - Single-Level Preservation Baseline: Build and inspect `dist/Intake/amazon-visibility.html` — assert `../styles.css` IS rewritten (confirms non-buggy path works, establishing baseline)
  - **Bug Condition Details**: `isBuildAssetBug(input)` — HtmlPage at depth >= 2 with nested relative asset path matching `^(?:\.\.\/){2,}(styles|script)\.(css|js)$`; OR Intake page missing script tag; OR BuildConfig with cssBundle/jsBundle/prettyUrls enabled
  - **Expected Behavior Properties**: deep nested paths rewrite to `/static/*`, intake page includes script tag, post-processing flags disabled
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., "`diagnostic/start/index.html` retains `../../styles.css` instead of hashed reference; Intake page has no script tag; Netlify flags enabled")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Write bug condition exploration test for Frontend & HTML Bugs
  - **Property 3: Bug Condition** - Frontend & HTML Bugs
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate the frontend bugs exist
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases for reproducibility
  - **Test Cases** (from design Testing Strategy):
    - Squeeze Meter Test: Open `calculator.html`, inspect `#squeezeMeter` computed height — assert 0px (invisible) on unfixed code
    - Footer Logo Test: Open `tools/author-geo-audit/index.html`, inspect footer logo width — assert full intrinsic width (no `.logo-mark` constraint) on unfixed code
    - Nav-Toggle Test: Open `404.html` at <1100px viewport — assert no `.nav-toggle` button in `#site-header`
    - Kits Form Test: Inspect `kits.html` form — assert no `netlify-honeypot` attribute and no `#success-modal`
    - JSON-LD Entity Test: Parse `about.html` JSON-LD — assert `jobTitle` literally contains `&amp;` instead of literal `&`
    - Fonts URL Test: Request the Google Fonts URL from `Intake/amazon-visibility.html` — assert HTTP 400 due to duplicate `800;800`
    - Custom Property Test: Inspect computed styles on `diagnostic/start/index.html` — assert `--color-surface`/`--color-text-dim` are undefined (fallback values used)
  - **Bug Condition Details**: `isFrontendBug(input)` — calculator page with missing CSS classes; subdirectory footer with legacy classes; pages missing nav-toggle at <1100px; kits form without honeypot/modal; JSON-LD with `&amp;`; Google Fonts URL with duplicate weight; pages using undefined custom properties
  - **Expected Behavior Properties**: meter has visible height, footer uses canonical classes, nav-toggle present, honeypot/modal present, JSON-LD uses literal ampersand, Fonts URL returns 200, custom properties resolve
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., "meter height 0, footer logo oversized, no nav-toggle, no honeypot/modal, `&amp;` in JSON-LD, HTTP 400 fonts, fallback-only custom properties")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

- [x] 3. Write bug condition exploration test for Backend / Agent Service Bugs
  - **Property 5: Bug Condition** - Backend / Agent Service Bugs
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate the backend bugs exist
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases for reproducibility
  - **Test Cases** (from design Testing Strategy):
    - Stale Assertion Test: Run `node agent/scripts/test-comprehensive.js` — assert failure on the `llms.txt` / `critical_failures` assertion
    - Redundant DNS Test: Instrument `dns.lookup` calls during a single `scanWithContent` run — assert >1 lookup per hostname (expect ~9)
    - Double-Fetch Test: Instrument `safeFetch` calls during `runDiagnostic` — assert homepage/robots/llms/sitemap fetched twice (once by `runScan`, once by `crawlSite`)
    - Missing Guard Test: Call `sendDraftEmail` with `RESEND_API_KEY` set but `OWNER_EMAIL` unset — assert Resend API error (to: undefined)
  - **Bug Condition Details**: `isBackendBug(input)` — test asserting `llms.txt` in critical_failures; scan with dnsLookupsPerHostname > 1; diagnostic run refetching homepage/robots/llms/sitemap; email send in sendDraftEmail/sendErrorEmail without OWNER_EMAIL check
  - **Expected Behavior Properties**: test aligned with optional llms.txt; at most 1 DNS lookup per hostname; resources fetched once; both env vars guarded
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., "test fails on llms.txt assertion, 9 DNS lookups, double-fetch, API error on undefined to")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.11, 2.12, 2.13, 2.14_

- [x] 4. Write bug condition exploration test for CI / GitHub Actions Bugs
  - **Property 7: Bug Condition** - CI / GitHub Actions Bugs
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate the CI bugs exist
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases for reproducibility
  - **Test Cases** (from design Testing Strategy):
    - SEO Monitor Exit Test: Simulate a missing `<title>` in `index.html` and run the check script — assert exit 0 (bug: should be non-zero)
    - Security Grep Test: Run the credential grep against a fixture with `password = "x"` — assert exit 0 (bug: should be non-zero)
    - HTML Validate Glob Test: Run `npm run test:html` — assert subdirectory files are not validated (glob `*.html` only matches root)
    - Node Version Test: Inspect `seo-monitor.yml` — assert `node-version: '18'` is hardcoded instead of using `.nvmrc`
  - **Bug Condition Details**: `isCiBug(input)` — seo-monitor.yml exitsZeroOnFindings or hardcodedNodeVersion; security-scan.yml grepSwallowsMatches; lint run with glob `*.html`
  - **Expected Behavior Properties**: non-zero exit on findings, `.nvmrc` for Node version, fail on credential matches, recursive HTML glob
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., "exit 0 on findings, grep swallows matches, glob skips subdirectories, Node 18 hardcoded")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.15, 2.16, 2.17_

- [ ] 5. Write bug condition exploration test for Code Duplications
  - **Property 9: Bug Condition** - Code Duplications
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate the code duplication bugs exist
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases for reproducibility
  - **Test Cases** (from design Testing Strategy):
    - SanitizeLog Duplication Test: Grep for `function sanitizeLog` across `agent/src/` — assert 3 local definitions (ai-utils.js, index.js, scanner.js)
    - ParseJson Duplication Test: Grep for `indexOf('{')` / `lastIndexOf('}')` + `JSON.parse` in `agent/src/kits/metadata-kit.js` — assert local re-implementation exists
    - EscapeHtml Duplication Test: Grep for `escapeHtml` / `esc` across `agent/src/` and `tools/author-geo-audit/index.html` — assert 3 definitions
    - HS256 Duplication Test: Grep for HS256 / `crypto.timingSafeEqual` in `agent/src/netlify-signature.js` — assert duplicated verification blocks in both functions
    - JSON-LD Walker Duplication Test: Grep for recursive tree-walker (`@type`, `@graph`) in `scanner.js`, `page-facts.js`, `semantic-extractor.js` — assert 3 separate implementations
    - Image Optimization Duplication Test: Inspect `.github/workflows/optimize-images.yml` — assert duplicated `optipng`/`jpegoptim`/`cwebp` commands instead of calling `npm run optimize:images`
    - Redundant Test Scripts Test: Inspect `agent/scripts/test-scanner.js`, `test-comprehensive.js`, `test-api-endpoints.js` — assert duplicated SSRF target arrays and live scans
    - Unreferenced Logo Assets Test: Search for references to `assets/img/logo-full.png`, `assets/img/logo.png`, `Images/logo_mark_2026.png`, `Images/signal-bg.jpg` — assert zero references
  - **Bug Condition Details**: `isDuplicationBug(input)` — CodeModule defining sanitizeLog/parseJson/escapeHtml/jsonLdWalker/hs256Verify locally; workflow duplicating optimize script; redundant test scripts; unreferenced logo assets
  - **Expected Behavior Properties**: single shared implementations imported everywhere, workflow calls npm script, redundant scripts removed/consolidated, logos consolidated and unreferenced removed
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., "3 sanitizeLog definitions, 3 escapeHtml definitions, duplicated HS256 blocks, duplicated image optimization commands, unreferenced logo files")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.18, 2.19, 2.20, 2.21, 2.22, 2.23, 2.24, 2.25_

- [~] 6. Write bug condition exploration test for Unnecessary / Dead / Legacy Code
  - **Property 11: Bug Condition** - Unnecessary / Dead / Legacy Code
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate the dead code bugs exist
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases for reproducibility
  - **Test Cases** (from design Testing Strategy):
    - Dead File Test: Assert `scripts/script.js` is 0 bytes. Assert `lighthouse-report.json` exists in repo root. Assert `scripts/analytics-report.js` and `scripts/email-automation.js` exist with mock/TODO content
    - Unused Build Scripts Test: Inspect `package.json` — assert `build:css`, `build:js`, `build:html`, `watch`, `watch:css`, `watch:js` scripts exist
    - Unused DevDependencies Test: Inspect `package.json` — assert `npm-watch`, `watch`, `clean-css-cli`, `terser`, `html-minifier-terser`, `linkinator` in devDependencies
    - Dead CSS Test: Grep `styles.css` for retired section selectors (Testimonials, Content Vault, old Hero/Lead Magnet, Example cards) — assert ~32 unused selectors present
    - Inconsistent Fonts Test: Inspect `about.html`, `kits.html`, `amazon-visibility-kit.html`, `calculator.html` for DM Serif Display / DM Mono Google Fonts loads — assert inconsistency with `--font-mono` using IBM Plex Mono
    - Audio Directory Test: Grep `build.js` for `'Audio'` in assetDirs — assert present. Grep `netlify.toml` for `/Audio/*` headers — assert present
    - Node Version Inconsistency Test: Read `.nvmrc` (22), `agent/.nvmrc` (20), `seo-monitor.yml` (18), `deploy.yml` (uses root .nvmrc = 22) — assert inconsistent versions
    - Stale Branches Test: Run `git branch` — assert 24 stale branches (`antigravity/fix-redirects` and 23 `devin/*` branches)
    - Unused Imports Test: Inspect `test-api-endpoints.js` for unused `const http = require('http')`; inspect `test-scanner.js` and `test-comprehensive.js` for unused `validateSSRF` imports
  - **Bug Condition Details**: `isDeadCodeBug(input)` — RepoFile in [script.js, lighthouse-report.json, analytics-report.js, email-automation.js]; CodeModule with unused build script/dep; HtmlPage loading unused Google Font; BuildConfig referencing Audio dir or with inconsistent Node version; RepoState with staleBranchCount > 0
  - **Expected Behavior Properties**: dead files removed, unused scripts/deps removed, dead CSS removed, fonts consistent, Audio config removed, Node versions aligned, stale branches cleaned
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., "0-byte script.js, 558KB lighthouse-report.json, mock scripts present, 32 dead CSS selectors, Audio dir referenced, Node 22/20/18 split, 24 stale branches")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.26, 2.27, 2.28, 2.29, 2.30, 2.31, 2.32, 2.33_

- [~] 7. Write preservation property tests for Build & Asset Rewriting
  - **Property 2: Preservation** - Build & Asset Rewriting
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Observe: `index.html` (root-level) with `styles.css` → builds to `/static/styles.<hash>.css` correctly
    - Observe: `Intake/amazon-visibility.html` (single-level nested) with `../styles.css` → builds to `/static/styles.<hash>.css` correctly
    - Observe: pages that already load `script.js` → include hashed `/static/script.<hash>.js`
    - Observe: `/static/*` assets served with `max-age=31536000, immutable` headers
  - Write property-based tests: for all root-level and single-level-nested pages, asset rewriting produces the same hashed `/static/*` output (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees: generate random root-level and single-level pages with various asset filenames; verify identical rewriting before and after fix
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [~] 8. Write preservation property tests for Frontend & HTML Bugs
  - **Property 4: Preservation** - Frontend & HTML Bugs
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Observe: calculator non-meter/non-grid elements render correctly
    - Observe: pages other than `author-geo-audit` use `.logo-mark` / `.footer-bottom` and display correctly
    - Observe: pages other than `404.html` and `diagnostic/start` show nav-toggle on narrow screens
    - Observe: `index.html` contact form has honeypot and success modal
    - Observe: other JSON-LD blocks in `about.html` parse correctly
    - Observe: other pages with valid Google Fonts URLs load successfully
    - Observe: `styles.css` applies `--bg-card`, `--text-1`, `--text-2` to pages that use them
  - Write property-based tests capturing observed behavior patterns: for all non-buggy frontend pages, visual output and behavior remain identical before and after fix (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees: generate random non-buggy HTML pages; verify identical rendering/styling/behavior
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [~] 9. Write preservation property tests for Backend / Agent Service Bugs
  - **Property 6: Preservation** - Backend / Agent Service Bugs
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Observe: `scanner.js` with `llms.txt` present → parses and includes it as optional (not critical)
    - Observe: first-time URL validation → performs SSRF validation and DNS lookup, rejects private IPs
    - Observe: diagnostic flow → crawls additional pages beyond homepage as needed
    - Observe: `sendLeadNotification` and `sendDiagnosticOwnerNotice` with both `RESEND_API_KEY` and `OWNER_EMAIL` set → send emails successfully
  - Write property-based tests: for all non-buggy backend inputs (llms.txt present, first-time validation, crawl beyond homepage, both env vars set), the fixed backend produces the same results (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees: generate random scan URLs with llms.txt present; verify identical scan results; generate random email calls with both env vars; verify successful sends
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.11, 3.12, 3.13, 3.14_

- [~] 10. Write preservation property tests for CI / GitHub Actions Bugs
  - **Property 8: Preservation** - CI / GitHub Actions Bugs
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Observe: SEO monitor with no issues found → exits code 0 (success)
    - Observe: security scan with no hardcoded passwords → exits code 0 (success)
    - Observe: `html-validate` on root-level HTML files → validates them correctly
  - Write property-based tests: for all non-buggy CI inputs (no issues, no findings, root-level files), the fixed CI produces the same exit code and validation results (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees: generate random valid HTML files; verify html-validate passes on root-level files; generate random clean repos; verify exit 0
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.15, 3.16, 3.17_

- [~] 11. Write preservation property tests for Code Duplications
  - **Property 10: Preservation** - Code Duplications
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Observe: `sanitizeLog` called via the shared helper in `ai-utils.js` → returns same sanitized output
    - Observe: `parseJson` called from `bisac-kit.js`, `pitch.js`, `semantic-extractor.js`, `writeup.js` → returns same JSON extraction results
    - Observe: HTML escaping applied to user input → produces same escaped output in all consumers
    - Observe: `netlify-signature.js` with valid signature → returns true; with invalid signature → returns false
    - Observe: JSON-LD parsing in all three modules → returns same Book/Person extraction results
    - Observe: `npm run optimize:images` locally → optimizes images with same `optipng`/`jpegoptim`/`cwebp` commands
    - Observe: `agent/test/scanner.test.js` offline tests → pass and provide SSRF/scan coverage
    - Observe: referenced logo assets (`Images/sonexial_logo.png`, `Images/favicon.png`) → served correctly
  - Write property-based tests: for all non-buggy code module inputs, the shared implementations produce identical output (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees: generate random strings with special characters; verify shared `escapeHtml` matches each local implementation; generate random JSON-LD structures; verify shared walker matches each original module
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.18, 3.19, 3.20, 3.21, 3.22, 3.23, 3.24, 3.25_

- [~] 12. Write preservation property tests for Unnecessary / Dead / Legacy Code
  - **Property 12: Preservation** - Unnecessary / Dead / Legacy Code
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Observe: `/script.js` in repo root → hashed and copied to `/static/script.<hash>.js` by build.js
    - Observe: `build.js` copies `.html` / `.txt` / `.xml` files to `dist/`
    - Observe: real email sending via `agent/src/email.js` (Resend) → sends emails
    - Observe: `build.js` hashes/copies `styles.css` and `script.js` to `/static/` and rewrites HTML
    - Observe: `styles.css` active selectors → style live pages correctly
    - Observe: `build.js` copies existing directories (`Images/`, `assets/`) to `dist/`
    - Observe: `deploy.yml` agent tests → pass successfully
    - Observe: `main` branch → used for production deployment
  - Write property-based tests: for all non-buggy repo files/config, the fixed repository continues to hash/copy/build/email/style/deploy exactly as before (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees: generate random active CSS selectors; verify only dead/retired selectors removed and all referenced selectors preserved; generate random legitimate files; verify build.js copies them
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.26, 3.27, 3.28, 3.29, 3.30, 3.31, 3.32, 3.33_

- [ ] 13. Fix for Build & Asset Rewriting bugs

  - [~] 13.1 Fix deep nested asset path rewriting in build.js
    - Change the regex in `rewriteHtml` from `(?:\.\.\/|\/)?` to `(?:\.\.\/)*` (zero or more `../` prefixes) for both `styles.css` and `script.js` replacements so that `../../styles.css` and deeper paths are rewritten to hashed `/static/*` counterparts
    - _Bug_Condition: isBuildAssetBug(input) where input is HtmlPage at depth >= 2 with assetRef matching `^(?:\.\.\/){2,}(styles|script)\.(css|js)$`_
    - _Expected_Behavior: expectedBehavior(result) — all asset references including deep nested paths rewrite to hashed `/static/styles.<hash>.css` and `/static/script.<hash>.js`_
    - _Preservation: root-level and single-level-nested pages continue to rewrite correctly (Preservation 3.1, 3.2)_
    - _Requirements: 2.1, 3.1, 3.2_

  - [~] 13.2 Add script.js tag to Intake/amazon-visibility.html
    - Add `<script src="../script.js"></script>` to the page so `build.js` can rewrite it to the hashed `/static/script.<hash>.js`
    - _Bug_Condition: isBuildAssetBug(input) where input.path = "Intake/amazon-visibility.html" AND NOT input.containsScriptTag_
    - _Expected_Behavior: expectedBehavior(result) — intake page includes hashed `/static/script.<hash>.js` reference so client-side JavaScript runs_
    - _Preservation: pages that already load script.js correctly continue to include the hashed script reference (Preservation 3.2)_
    - _Requirements: 2.2, 3.2_

  - [~] 13.3 Disable Netlify post-processing flags in netlify.toml
    - Set `[build.processing.css].bundle = false`, `[build.processing.js].bundle = false`, and `[build.processing.html].pretty_urls = false` (or remove the `[build.processing.*]` blocks) so Netlify does not rewrite asset URLs away from `/static/*`
    - _Bug_Condition: isBuildAssetBug(input) where input is BuildConfig AND (input.cssBundle OR input.jsBundle OR input.prettyUrls)_
    - _Expected_Behavior: expectedBehavior(result) — Netlify does not rewrite asset URLs away from `/static/*`, preserving immutable cache headers and `.html` canonical/redirect assumptions_
    - _Preservation: Netlify continues to apply immutable `max-age=31536000` cache headers for `/static/*` assets (Preservation 3.3)_
    - _Requirements: 2.3, 3.3_

  - [~] 13.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Build & Asset Rewriting
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run the Build & Asset Rewriting bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed — deep nested paths rewritten, intake page has script tag, post-processing flags disabled)
    - _Requirements: 2.1, 2.2, 2.3_

  - [~] 13.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Build & Asset Rewriting
    - **IMPORTANT**: Re-run the SAME tests from task 7 — do NOT write new tests
    - Run the Build & Asset Rewriting preservation property tests from step 7
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — root-level and single-level rewriting, script loading, and cache headers preserved)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 14. Fix for Frontend & HTML bugs

  - [~] 14.1 Add calculator CSS classes to styles.css
    - Define `.product-detail`, `.product-detail-grid`, `.result-value`, `.positive`, `.negative`, `.meter-track`, `.meter-fill` so `#squeezeMeter` has visible height and the calculator results have grid layout and color styling
    - _Bug_Condition: isFrontendBug(input) where input.path = "calculator.html" AND input.usesClass IN missingCalcClasses_
    - _Expected_Behavior: expectedBehavior(result) — `#squeezeMeter` has visible height and calculator inputs/results have grid layout and color styling_
    - _Preservation: calculator elements that currently display correctly (non-meter, non-grid) continue to display correctly (Preservation 3.4)_
    - _Requirements: 2.4, 3.4_

  - [~] 14.2 Fix Google Fonts duplicate weight URL in Intake/amazon-visibility.html
    - Change `family=DM+Sans:wght@300;400;500;600;800;800` to `family=DM+Sans:wght@300;400;500;600;800` (remove the duplicate `800` token)
    - _Bug_Condition: isFrontendBug(input) where input.path = "Intake/amazon-visibility.html" AND input.fontsUrlHasDuplicateWeight_
    - _Expected_Behavior: expectedBehavior(result) — Google Fonts CSS2 API returns HTTP 200 and loads all fonts_
    - _Preservation: other pages with correctly formatted Google Fonts URLs continue to load fonts successfully (Preservation 3.9)_
    - _Requirements: 2.9, 3.9_

  - [~] 14.3 Add missing CSS custom properties to styles.css
    - Add `--color-surface` and `--color-text-dim` to the `:root` block (or rename the references in the affected pages to use existing `--bg-card` / `--text-2`)
    - _Bug_Condition: isFrontendBug(input) where input.path IN ["diagnostic/start/index.html","tools/author-geo-audit/index.html"] AND input.usesUndefinedCustomProperty_
    - _Expected_Behavior: expectedBehavior(result) — pages use custom property names that exist in `:root` so intended theme styling applies_
    - _Preservation: `styles.css` continues to apply existing custom properties (`--bg-card`, `--text-1`, `--text-2`) to pages that use them (Preservation 3.10)_
    - _Requirements: 2.10, 3.10_

  - [~] 14.4 Fix footer classes in tools/author-geo-audit/index.html
    - Replace `.footer-logo`, `.footer-links`, `.footer-copy` with the canonical `.logo-mark` / `.footer-bottom` classes used by other pages so `/Images/sonexial_logo.png` renders at the correct size
    - _Bug_Condition: isFrontendBug(input) where input.path = "tools/author-geo-audit/index.html" AND input.footerUsesLegacyClasses_
    - _Expected_Behavior: expectedBehavior(result) — footer uses same classes as other pages so logo renders at correct size_
    - _Preservation: pages other than `author-geo-audit` continue to use `.logo-mark` / `.footer-bottom` and display correctly (Preservation 3.5)_
    - _Requirements: 2.5, 3.5_

  - [~] 14.5 Add script.js tag to tools/author-geo-audit/index.html
    - Add `<script src="../../script.js"></script>` so `.nav-toggle` works on that page
    - _Bug_Condition: isFrontendBug(input) where input.path = "tools/author-geo-audit/index.html" AND input.footerUsesLegacyClasses (page omits script tag)_
    - _Expected_Behavior: expectedBehavior(result) — page loads script.js so nav-toggle works_
    - _Preservation: pages that already load script.js correctly continue to include the hashed script reference (Preservation 3.2)_
    - _Requirements: 2.5, 3.2_

  - [~] 14.6 Fix undefined custom properties in subdirectory pages
    - Update `diagnostic/start/index.html` and `tools/author-geo-audit/index.html` to use defined `--color-surface` / `--color-text-dim` (added per change 14.3) or the existing `--bg-card` / `--text-2`
    - _Bug_Condition: isFrontendBug(input) where input.path IN ["diagnostic/start/index.html","tools/author-geo-audit/index.html"] AND input.usesUndefinedCustomProperty_
    - _Expected_Behavior: expectedBehavior(result) — pages reference defined custom property names so theme styling applies_
    - _Preservation: `styles.css` continues to apply existing custom properties to pages that use them (Preservation 3.10)_
    - _Requirements: 2.10, 3.10_

  - [~] 14.7 Add nav-toggle button to 404.html and diagnostic/start/index.html
    - Add `<button class="nav-toggle" aria-label="Toggle navigation">…</button>` inside `#site-header` so mobile users can open the navigation menu on screens narrower than 1100px
    - _Bug_Condition: isFrontendBug(input) where input.path IN ["404.html","diagnostic/start/index.html"] AND input.viewportWidth < 1100 AND NOT input.hasNavToggle_
    - _Expected_Behavior: expectedBehavior(result) — nav-toggle button present so mobile users can toggle navigation_
    - _Preservation: pages other than 404 and diagnostic/start continue to show nav-toggle on narrow screens (Preservation 3.6)_
    - _Requirements: 2.6, 3.6_

  - [~] 14.8 Add honeypot and success modal to kits.html
    - Add `netlify-honeypot="bot-field"` to the form, a hidden `<input name="bot-field" hidden>` field, and the `#success-modal` markup so submission shows a success modal on `kits.html` rather than redirecting to `index.html`
    - _Bug_Condition: isFrontendBug(input) where input.path = "kits.html" AND (NOT input.hasHoneypot OR NOT input.hasSuccessModal)_
    - _Expected_Behavior: expectedBehavior(result) — form includes honeypot and success modal, submission shows modal on kits.html_
    - _Preservation: the contact form on `index.html` continues to include honeypot and show success modal (Preservation 3.7)_
    - _Requirements: 2.7, 3.7_

  - [~] 14.9 Fix JSON-LD jobTitle entity in about.html
    - Change `"jobTitle": "Founder &amp; Strategist"` to `"jobTitle": "Founder & Strategist"` (literal ampersand, not HTML entity)
    - _Bug_Condition: isFrontendBug(input) where input.path = "about.html" AND input.jsonLdJobTitle CONTAINS "&amp;"_
    - _Expected_Behavior: expectedBehavior(result) — JSON-LD jobTitle uses literal ampersand so schema parsers decode "Founder & Strategist" correctly_
    - _Preservation: other JSON-LD blocks in `about.html` continue to parse correctly (Preservation 3.8)_
    - _Requirements: 2.8, 3.8_

  - [~] 14.10 Verify bug condition exploration test now passes
    - **Property 3: Expected Behavior** - Frontend & HTML Bugs
    - **IMPORTANT**: Re-run the SAME test from task 2 — do NOT write a new test
    - The test from task 2 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run the Frontend & HTML Bugs bug condition exploration test from step 2
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed — meter visible, footer sized, nav-toggle present, honeypot/modal present, JSON-LD literal, fonts 200, custom properties resolve)
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [~] 14.11 Verify preservation tests still pass
    - **Property 4: Preservation** - Frontend & HTML Bugs
    - **IMPORTANT**: Re-run the SAME tests from task 8 — do NOT write new tests
    - Run the Frontend & HTML Bugs preservation property tests from step 8
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — non-meter elements, canonical footers, existing nav-toggle, index form, other JSON-LD, other fonts, existing custom properties all preserved)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [ ] 15. Fix for Backend / Agent Service bugs

  - [~] 15.1 Fix stale llms.txt assertion in test-comprehensive.js
    - Remove or update the assertion that `repB.critical_failures` includes `'llms.txt'` to align with `scanner.js`'s optional `llms.txt` semantics — the test must not assert `llms.txt` in `critical_failures`
    - _Bug_Condition: isBackendBug(input) where input IS TestRun AND input.file = "agent/scripts/test-comprehensive.js" AND input.assertsLlmsInCriticalFailures_
    - _Expected_Behavior: expectedBehavior(result) — test asserts behavior consistent with scanner.js's current llms.txt-optional logic and does NOT assert llms.txt in critical_failures_
    - _Preservation: when `llms.txt` is present, scanner.js continues to parse and include it in scan results as optional (not critical) (Preservation 3.11)_
    - _Requirements: 2.11, 3.11_

  - [~] 15.2 Cache SSRF validation per hostname in scanner.js
    - Introduce a per-scan hostname cache so `validateSSRF` and DNS resolution are performed at most once per hostname — `scanWithContent` validates the input URL once and passes validated resolution info to `safeFetch` (or `safeFetch` checks the cache before re-validating); `guardedLookup` can also consult the cache, eliminating up to 9 redundant DNS lookups
    - _Bug_Condition: isBackendBug(input) where input IS ScanRequest AND input.dnsLookupsPerHostname > 1_
    - _Expected_Behavior: expectedBehavior(result) — SSRF validation and DNS lookup performed at most once per hostname per scan_
    - _Preservation: first-time scan of a URL continues to perform SSRF validation and DNS lookup to protect against SSRF attacks (Preservation 3.12)_
    - _Requirements: 2.12, 3.12_

  - [~] 15.3 Reuse fetched results in diagnostic/index.js
    - Have `runDiagnostic` call `scanWithContent` (which returns HTML) instead of `runScan`, and pass the already-fetched homepage/robots/llms/sitemap results into `crawlSite` (or have `crawlSite` accept pre-fetched content) so the four resources are fetched only once
    - _Bug_Condition: isBackendBug(input) where input IS DiagnosticRun AND input.refetchesHomepageRobotsLlmsSitemap_
    - _Expected_Behavior: expectedBehavior(result) — homepage, robots.txt, llms.txt, and sitemap.xml fetched only once, reusing results from scanWithContent for crawlSite_
    - _Preservation: the diagnostic flow continues to crawl and fetch additional pages beyond the homepage as needed (Preservation 3.13)_
    - _Requirements: 2.13, 3.13_

  - [~] 15.4 Add OWNER_EMAIL guard to sendDraftEmail and sendErrorEmail
    - In `sendDraftEmail` and `sendErrorEmail`, change the guard from `if (!process.env.RESEND_API_KEY)` to `if (!process.env.RESEND_API_KEY || !OWNER_EMAIL)` and skip with a `console.warn`, matching `sendLeadNotification` / `sendDiagnosticOwnerNotice`
    - _Bug_Condition: isBackendBug(input) where input IS EmailSend AND input.function IN ["sendDraftEmail","sendErrorEmail"] AND NOT input.checksOwnerEmail_
    - _Expected_Behavior: expectedBehavior(result) — both functions check RESEND_API_KEY and OWNER_EMAIL, gracefully skip sending or log a warning rather than passing to: undefined to Resend_
    - _Preservation: sendLeadNotification and sendDiagnosticOwnerNotice continue to send emails when both RESEND_API_KEY and OWNER_EMAIL are set (Preservation 3.14)_
    - _Requirements: 2.14, 3.14_

  - [~] 15.5 Verify bug condition exploration test now passes
    - **Property 5: Expected Behavior** - Backend / Agent Service Bugs
    - **IMPORTANT**: Re-run the SAME test from task 3 — do NOT write a new test
    - The test from task 3 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run the Backend / Agent Service Bugs bug condition exploration test from step 3
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed — no stale assertion, <=1 DNS lookup per hostname, single fetch, graceful skip without OWNER_EMAIL)
    - _Requirements: 2.11, 2.12, 2.13, 2.14_

  - [~] 15.6 Verify preservation tests still pass
    - **Property 6: Preservation** - Backend / Agent Service Bugs
    - **IMPORTANT**: Re-run the SAME tests from task 9 — do NOT write new tests
    - Run the Backend / Agent Service Bugs preservation property tests from step 9
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — llms.txt optional, first-time SSRF, diagnostic crawl, lead/diagnostic email all preserved)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.11, 3.12, 3.13, 3.14_

- [ ] 16. Fix for CI / GitHub Actions bugs

  - [~] 16.1 Make SEO monitor exit non-zero on findings
    - Track a failure flag in each check step and `exit 1` when any `✗` condition is detected, so the `if: failure()` comment step triggers
    - _Bug_Condition: isCiBug(input) where input IS WorkflowRun AND input.workflow = "seo-monitor.yml" AND input.exitsZeroOnFindings_
    - _Expected_Behavior: expectedBehavior(result) — workflow exits non-zero when issues are found so the comment-on-commit step triggers_
    - _Preservation: SEO monitor continues to exit code 0 when no issues are found (Preservation 3.15)_
    - _Requirements: 2.15, 3.15_

  - [~] 16.2 Use .nvmrc for Node version in seo-monitor.yml
    - Replace `node-version: '18'` with `node-version-file: '.nvmrc'`
    - _Bug_Condition: isCiBug(input) where input IS WorkflowRun AND input.workflow = "seo-monitor.yml" AND input.hardcodedNodeVersion_
    - _Expected_Behavior: expectedBehavior(result) — workflow uses .nvmrc for the Node version instead of hardcoding '18'_
    - _Preservation: SEO monitor continues to exit code 0 when no issues are found (Preservation 3.15)_
    - _Requirements: 2.15, 2.32, 3.15, 3.32_

  - [~] 16.3 Make security scan fail on credential matches
    - Change the "Scan for hardcoded credentials" greps to `exit 1` when matches are found (using the `&& echo "::error::…" && exit 1` pattern already used in the "Check for common secret patterns" step)
    - _Bug_Condition: isCiBug(input) where input IS WorkflowRun AND input.workflow = "security-scan.yml" AND input.grepSwallowsMatches_
    - _Expected_Behavior: expectedBehavior(result) — workflow exits non-zero when hardcoded password matches are found_
    - _Preservation: security scan continues to exit code 0 when no hardcoded passwords are found (Preservation 3.16)_
    - _Requirements: 2.16, 3.16_

  - [~] 16.4 Fix html-validate glob to include subdirectories
    - Change `test:html` from `html-validate '*.html'` to `html-validate '**/*.html'` (recursive glob) so subdirectory files (`constellations/index.html`, `tools/author-geo-audit/index.html`, `diagnostic/start/index.html`, `Intake/amazon-visibility.html`) are validated
    - _Bug_Condition: isCiBug(input) where input IS LintRun AND input.glob = "*.html"_
    - _Expected_Behavior: expectedBehavior(result) — html-validate validates all HTML files in the repository including subdirectories_
    - _Preservation: html-validate continues to validate root-level HTML files (Preservation 3.17)_
    - _Requirements: 2.17, 3.17_

  - [~] 16.5 Verify bug condition exploration test now passes
    - **Property 7: Expected Behavior** - CI / GitHub Actions Bugs
    - **IMPORTANT**: Re-run the SAME test from task 4 — do NOT write a new test
    - The test from task 4 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run the CI / GitHub Actions Bugs bug condition exploration test from step 4
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed — non-zero exit on findings, .nvmrc used, grep fails on matches, recursive glob)
    - _Requirements: 2.15, 2.16, 2.17_

  - [~] 16.6 Verify preservation tests still pass
    - **Property 8: Preservation** - CI / GitHub Actions Bugs
    - **IMPORTANT**: Re-run the SAME tests from task 10 — do NOT write new tests
    - Run the CI / GitHub Actions Bugs preservation property tests from step 10
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — exit 0 on no issues, exit 0 on no findings, root-level HTML validation preserved)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.15, 3.16, 3.17_

- [ ] 17. Fix for Code Duplications

  - [~] 17.1 Export shared helpers from ai-utils.js
    - Ensure `sanitizeLog`, `parseJson`, and `escapeHtml` are all exported from `agent/src/ai-utils.js` so consumers import rather than re-implement
    - _Bug_Condition: isDuplicationBug(input) where input IS CodeModule AND input.definesLocally IN ["sanitizeLog","parseJson","escapeHtml"]_
    - _Expected_Behavior: expectedBehavior(result) — single shared implementations exported from ai-utils.js for all three helpers_
    - _Preservation: sanitizeLog, parseJson, and escapeHtml called via the shared helper continue to return the same output (Preservation 3.18, 3.19, 3.20)_
    - _Requirements: 2.18, 2.19, 2.20, 3.18, 3.19, 3.20_

  - [~] 17.2 Remove local sanitizeLog from scanner.js and index.js
    - Replace the local `sanitizeLog` definitions in `agent/src/scanner.js` and `agent/src/index.js` with imports from `agent/src/ai-utils.js`
    - _Bug_Condition: isDuplicationBug(input) where input IS CodeModule AND input.definesLocally = "sanitizeLog"_
    - _Expected_Behavior: expectedBehavior(result) — modules import shared sanitizeLog rather than defining locally_
    - _Preservation: sanitizeLog called via the shared helper continues to return the same sanitized output (Preservation 3.18)_
    - _Requirements: 2.18, 3.18_

  - [~] 17.3 Use shared parseJson in metadata-kit.js
    - Replace the local `indexOf('{')` / `lastIndexOf('}')` + `JSON.parse` + error-logging block in `agent/src/kits/metadata-kit.js` with an import of `parseJson` from `agent/src/ai-utils.js`
    - _Bug_Condition: isDuplicationBug(input) where input IS CodeModule AND input.definesLocally = "parseJson"_
    - _Expected_Behavior: expectedBehavior(result) — metadata-kit.js imports shared parseJson instead of re-implementing_
    - _Preservation: parseJson called from existing consumers continues to return the same JSON extraction results (Preservation 3.19)_
    - _Requirements: 2.19, 3.19_

  - [~] 17.4 Extract shared escapeHtml and import in all consumers
    - Move `escapeHtml` to the shared module (`agent/src/ai-utils.js`) and import it in `agent/src/email.js`, `agent/src/diagnostic/render.js` (replacing local `esc`), and (where feasible) `tools/author-geo-audit/index.html`
    - _Bug_Condition: isDuplicationBug(input) where input IS CodeModule AND input.definesLocally = "escapeHtml"_
    - _Expected_Behavior: expectedBehavior(result) — single shared escapeHtml imported by all consumers instead of 3 separate definitions_
    - _Preservation: HTML escaping applied to user input continues to produce the same escaped output (Preservation 3.20)_
    - _Requirements: 2.20, 3.20_

  - [~] 17.5 Extract shared JSON-LD tree-walker module
    - Extract the recursive `walk`/tree-walker from `analyzeHtml` into a shared module (e.g. `agent/src/jsonld.js`) imported by `agent/src/scanner.js`, `agent/src/diagnostic/page-facts.js`, and `agent/src/semantic-extractor.js`
    - _Bug_Condition: isDuplicationBug(input) where input IS CodeModule AND input.definesLocally = "jsonLdWalker"_
    - _Expected_Behavior: expectedBehavior(result) — single shared JSON-LD tree-walker module imported by all three modules_
    - _Preservation: JSON-LD parsing continues to return the same Book/Person extraction results from all three modules (Preservation 3.22)_
    - _Requirements: 2.22, 3.22_

  - [~] 17.6 Extract shared HS256 verifier in netlify-signature.js
    - Extract a shared `verifyHs256Jws(signature, secret)` helper that splits the JWS, validates the `HS256` alg, computes the HMAC, and calls `crypto.timingSafeEqual` — both `verifyNetlifySignature` and `verifyNetlifyProxySignature` call it, then apply their own payload-specific checks (`sha256` body hash vs. `exp` expiry)
    - _Bug_Condition: isDuplicationBug(input) where input IS CodeModule AND input.definesLocally = "hs256Verify"_
    - _Expected_Behavior: expectedBehavior(result) — single shared HS256 JWS verification helper used by both functions, eliminating ~20 lines of duplicated JWT/HMAC logic_
    - _Preservation: netlify-signature.js continues to return true for valid webhook signatures and reject invalid signatures (Preservation 3.21)_
    - _Requirements: 2.21, 3.21_

  - [~] 17.7 Call npm run optimize:images from workflow
    - Replace the duplicated `optipng`/`jpegoptim`/`cwebp` shell commands in `.github/workflows/optimize-images.yml` with `npm run optimize:images`
    - _Bug_Condition: isDuplicationBug(input) where input IS WorkflowRun AND input.workflow = "optimize-images.yml" AND input.duplicatesOptimizeScript_
    - _Expected_Behavior: expectedBehavior(result) — workflow calls npm run optimize:images instead of duplicating shell commands_
    - _Preservation: npm run optimize:images continues to optimize images with the same optipng/jpegoptim/cwebp commands (Preservation 3.23)_
    - _Requirements: 2.23, 3.23_

  - [~] 17.8 Remove redundant test scripts and unused imports
    - Consolidate duplicated SSRF/live scan logic into a single shared script or remove the redundant `agent/scripts/` test files (`test-scanner.js`, `test-comprehensive.js`, `test-api-endpoints.js`) in favor of `agent/test/scanner.test.js` — remove unused imports (`http` in `test-api-endpoints.js`, `validateSSRF` in `test-scanner.js` and `test-comprehensive.js`)
    - _Bug_Condition: isDuplicationBug(input) where input IS CodeModule AND input.file IN ["test-scanner.js","test-comprehensive.js","test-api-endpoints.js"] AND input.duplicatesOfflineCoverage_
    - _Expected_Behavior: expectedBehavior(result) — redundant test scripts consolidated or removed, unused imports removed_
    - _Preservation: agent/test/scanner.test.js continues to pass and provide SSRF/scan coverage (Preservation 3.24)_
    - _Requirements: 2.24, 2.29, 3.24_

  - [~] 17.9 Consolidate logos and remove unreferenced assets
    - Consolidate logos into a single directory and delete unreferenced files (`assets/img/logo-full.png`, `assets/img/logo.png`, `Images/logo_mark_2026.png`, `Images/signal-bg.jpg`) after confirming no references
    - _Bug_Condition: isDuplicationBug(input) where input IS RepoFile AND input.isUnreferencedLogoAsset_
    - _Expected_Behavior: expectedBehavior(result) — logos consolidated into one directory, unreferenced assets removed_
    - _Preservation: referenced logo assets (Images/sonexial_logo.png, Images/favicon.png) continue to be served correctly (Preservation 3.25)_
    - _Requirements: 2.25, 3.25_

  - [~] 17.10 Verify bug condition exploration test now passes
    - **Property 9: Expected Behavior** - Code Duplications
    - **IMPORTANT**: Re-run the SAME test from task 5 — do NOT write a new test
    - The test from task 5 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run the Code Duplications bug condition exploration test from step 5
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed — single shared implementations, workflow calls npm script, redundant scripts removed, unreferenced assets removed)
    - _Requirements: 2.18, 2.19, 2.20, 2.21, 2.22, 2.23, 2.24, 2.25_

  - [~] 17.11 Verify preservation tests still pass
    - **Property 10: Preservation** - Code Duplications
    - **IMPORTANT**: Re-run the SAME tests from task 11 — do NOT write new tests
    - Run the Code Duplications preservation property tests from step 11
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — shared helper output, signature verification, JSON-LD extraction, image optimization, offline tests, logo serving all preserved)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.18, 3.19, 3.20, 3.21, 3.22, 3.23, 3.24, 3.25_

- [ ] 18. Fix for Unnecessary / Dead / Legacy Code

  - [~] 18.1 Remove dead files
    - Delete `scripts/script.js` (0-byte placeholder), `lighthouse-report.json` (558 KB generated output), `scripts/analytics-report.js` (mock data), and `scripts/email-automation.js` (stub with console.log) since real functionality lives in `agent/src/email.js` (Resend) and analytics integration is not implemented
    - _Bug_Condition: isDeadCodeBug(input) where input IS RepoFile AND input.file IN ["scripts/script.js","lighthouse-report.json","scripts/analytics-report.js","scripts/email-automation.js"]_
    - _Expected_Behavior: expectedBehavior(result) — dead files removed from repository_
    - _Preservation: `/script.js` in repo root continues to be hashed and copied to `/static/script.<hash>.js` (Preservation 3.26); real email sending via agent/src/email.js continues (Preservation 3.28)_
    - _Requirements: 2.26, 2.27, 2.28, 3.26, 3.27, 3.28_

  - [~] 18.2 Remove Audio directory config from build.js and netlify.toml
    - Remove `'Audio'` from the `assetDirs` array in `scripts/build.js` and remove the `[[headers]] for = "/Audio/*"` block from `netlify.toml` since the directory does not exist
    - _Bug_Condition: isDeadCodeBug(input) where input IS BuildConfig AND input.referencesAudioDir_
    - _Expected_Behavior: expectedBehavior(result) — Audio copy/cache configuration removed since directory does not exist_
    - _Preservation: build.js continues to copy existing directories (Images/, assets/) to dist/ (Preservation 3.31)_
    - _Requirements: 2.31, 3.31_

  - [~] 18.3 Remove dead CSS selectors from styles.css
    - Remove the ~32 unused selectors from retired sections (Testimonials, Content Vault articles, old Hero & Lead Magnet layouts, Example cards)
    - _Bug_Condition: isDeadCodeBug(input) where input IS HtmlPage AND input.loadsUnusedGoogleFont (dead CSS accumulation)_
    - _Expected_Behavior: expectedBehavior(result) — dead/retired CSS selectors removed, only active selectors remain_
    - _Preservation: styles.css continues to style live pages correctly — only dead/retired selectors are removed (Preservation 3.30)_
    - _Requirements: 2.30, 3.30_

  - [~] 18.4 Resolve inconsistent font loading
    - Either remove unused DM Serif Display / DM Mono Google Fonts loads from `about.html`, `kits.html`, `amazon-visibility-kit.html`, `calculator.html` if those fonts are not used by `styles.css` (which uses IBM Plex Mono for `--font-mono`), or align the `--font-*` variables to match what is loaded
    - _Bug_Condition: isDeadCodeBug(input) where input IS HtmlPage AND input.loadsUnusedGoogleFont_
    - _Expected_Behavior: expectedBehavior(result) — font loading consistent with CSS variable definitions, no unused Google Fonts loads_
    - _Preservation: styles.css continues to style live pages correctly (Preservation 3.30)_
    - _Requirements: 2.30, 3.30_

  - [~] 18.5 Remove unused build scripts from package.json
    - Remove `build:css`, `build:js`, `build:html`, `watch`, `watch:css`, `watch:js` scripts and the `watch` config block (they output gitignored `.min.*` files unused by build.js or any HTML file)
    - _Bug_Condition: isDeadCodeBug(input) where input IS CodeModule AND input.hasUnusedBuildScriptOrDep_
    - _Expected_Behavior: expectedBehavior(result) — unused build scripts removed from package.json_
    - _Preservation: build.js continues to hash and copy styles.css and script.js to /static/ and rewrite HTML references (Preservation 3.29)_
    - _Requirements: 2.29, 3.29_

  - [~] 18.6 Remove unused devDependencies from package.json
    - Remove `npm-watch`, `watch`, `clean-css-cli`, `terser`, `html-minifier-terser`, `linkinator` from devDependencies
    - _Bug_Condition: isDeadCodeBug(input) where input IS CodeModule AND input.hasUnusedBuildScriptOrDep_
    - _Expected_Behavior: expectedBehavior(result) — unused devDependencies removed from package.json_
    - _Preservation: build.js continues to hash/copy styles.css and script.js and rewrite HTML references (Preservation 3.29)_
    - _Requirements: 2.29, 3.29_

  - [~] 18.7 Align Node versions across .nvmrc and workflows
    - Use a consistent Node version (or a documented, intentional version split) across `.nvmrc`, `agent/.nvmrc`, and all GitHub Actions workflows — ensure `seo-monitor.yml` uses `node-version-file: '.nvmrc'` (done in task 16.2) and that `agent/.nvmrc` is either aligned or documented as intentional
    - _Bug_Condition: isDeadCodeBug(input) where input IS BuildConfig AND input.nodeVersionInconsistent_
    - _Expected_Behavior: expectedBehavior(result) — consistent Node version (or documented intentional split) across all config and workflows_
    - _Preservation: deploy.yml continues to run agent tests successfully (Preservation 3.32)_
    - _Requirements: 2.32, 3.32_

  - [~] 18.8 Clean up stale branches
    - Delete the 24 stale, uncleaned branches (`antigravity/fix-redirects` and 23 `devin/*` branches) that are no longer in active development
    - _Bug_Condition: isDeadCodeBug(input) where input IS RepoState AND input.staleBranchCount > 0_
    - _Expected_Behavior: expectedBehavior(result) — stale branches cleaned up, only active branches remain_
    - _Preservation: the `main` branch continues to be used for production deployment (Preservation 3.33)_
    - _Requirements: 2.33, 3.33_

  - [~] 18.9 Verify bug condition exploration test now passes
    - **Property 11: Expected Behavior** - Unnecessary / Dead / Legacy Code
    - **IMPORTANT**: Re-run the SAME test from task 6 — do NOT write a new test
    - The test from task 6 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run the Dead/Legacy Code bug condition exploration test from step 6
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed — dead files removed, Audio config removed, dead CSS removed, fonts consistent, unused scripts/deps removed, Node versions aligned, stale branches cleaned)
    - _Requirements: 2.26, 2.27, 2.28, 2.29, 2.30, 2.31, 2.32, 2.33_

  - [~] 18.10 Verify preservation tests still pass
    - **Property 12: Preservation** - Unnecessary / Dead / Legacy Code
    - **IMPORTANT**: Re-run the SAME tests from task 12 — do NOT write new tests
    - Run the Dead/Legacy Code preservation property tests from step 12
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — root script hashing, site file copying, real email, production build, active CSS, directory copying, agent tests, main branch all preserved)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.26, 3.27, 3.28, 3.29, 3.30, 3.31, 3.32, 3.33_

- [~] 19. Checkpoint - Ensure all tests pass
  - Run full build (`npm run build`) and verify all HTML pages (root and subdirectory) reference hashed `/static/*` assets, Intake page includes script tag, and `lighthouse-report.json` is not in `dist/`
  - Run full agent test suite (`npm test` in `agent/`) and verify all tests pass including the fixed `test-comprehensive.js` assertion
  - Run `npm run test:html` and verify all HTML files including subdirectories are validated
  - Verify all 6 bug condition exploration tests now pass (Properties 1, 3, 5, 7, 9, 11)
  - Verify all 6 preservation property tests still pass (Properties 2, 4, 6, 8, 10, 12)
  - Run integration tests: full build, full scan + diagnostic, CI simulation, workflow consistency, HTML validation
  - Ensure all tests pass, ask the user if questions arise
