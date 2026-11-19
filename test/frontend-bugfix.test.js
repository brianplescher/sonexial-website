const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Property 3: Bug Condition — Frontend & HTML Bugs
 * **Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**
 *
 * Bug condition exploration test. These assertions verify the CORRECT (fixed)
 * behavior. On unfixed code the bug-condition assertions FAIL, surfacing
 * counterexamples that prove the bugs exist. The preservation assertions PASS,
 * confirming that non-buggy inputs already work correctly.
 *
 * Bug conditions:
 *   1.4 — calculator.html and scripts/calculator.js reference CSS classes
 *         (.product-detail, .product-detail-grid, .result-value, .positive,
 *         .negative, .meter-track, .meter-fill) that do not exist in
 *         styles.css, so #squeezeMeter has height 0 and results lack styling.
 *   1.5 — tools/author-geo-audit/index.html uses legacy footer classes
 *         (.footer-logo / .footer-links / .footer-copy) instead of the
 *         canonical .logo-mark / .footer-bottom, and omits the script.js
 *         tag so .nav-toggle does not work on that page.
 *   1.6 — 404.html and diagnostic/start/index.html omit the
 *         <button class="nav-toggle"> element from #site-header, so mobile
 *         users have no way to open the navigation menu at <1100px.
 *   1.7 — kits.html's contact form lacks netlify-honeypot="bot-field", the
 *         hidden bot-field input, and #success-modal markup, so submission
 *         redirects to index.html instead of showing a success modal.
 *   1.8 — about.html JSON-LD sets "jobTitle": "Founder &amp; Strategist"
 *         (HTML entity inside a JSON string), so schema parsers read the
 *         literal string "Founder &amp; Strategist".
 *   1.9 — Intake/amazon-visibility.html Google Fonts URL contains a
 *         duplicate weight token (800;800), causing the CSS2 API to
 *         return HTTP 400.
 *   1.10 — diagnostic/start/index.html and tools/author-geo-audit/index.html
 *          reference var(--color-surface) and var(--color-text-dim) which are
 *          not defined in the :root block of styles.css.
 *
 * NOTE: Browser rendering (computed styles, viewport-based visibility) cannot
 * be executed in a headless environment without a browser. These tests use
 * static source analysis — reading HTML/CSS files and checking for the
 * presence/absence of required elements and class definitions — which is
 * equivalent for proving these bugs exist.
 */

const root = path.join(__dirname, '..');

// ─── Bug 1.4: Missing Calculator CSS Classes ──────────────────────────
// calculator.html and scripts/calculator.js reference classes that do not
// exist in styles.css. The assertions FAIL on unfixed code, proving the bug.

test('1.4a styles.css defines .meter-track class for the squeeze meter', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(
        css,
        /\.meter-track\s*\{/,
        'styles.css should define .meter-track so #squeezeMeter has a visible track'
    );
});

test('1.4b styles.css defines .meter-fill class for the squeeze meter bar', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(
        css,
        /\.meter-fill\s*\{/,
        'styles.css should define .meter-fill so the progress bar has visible height'
    );
});

test('1.4c styles.css defines .result-value class for calculator results', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(
        css,
        /\.result-value\s*\{/,
        'styles.css should define .result-value for calculator result styling'
    );
});

test('1.4d styles.css defines .positive / .negative classes for profit coloring', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(
        css,
        /\.positive\s*\{/,
        'styles.css should define .positive for profitable result coloring'
    );
    assert.match(
        css,
        /\.negative\s*\{/,
        'styles.css should define .negative for loss result coloring'
    );
});

test('1.4e styles.css defines .product-detail-grid class for calculator layout', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(
        css,
        /\.product-detail-grid\s*\{/,
        'styles.css should define .product-detail-grid for the calculator grid layout'
    );
});

// ─── Bug 1.5: Legacy Footer Classes + Missing Script (author-geo-audit) ─
// tools/author-geo-audit/index.html uses .footer-logo / .footer-links /
// .footer-copy instead of the canonical .logo-mark / .footer-bottom, and
// omits the script.js tag. The assertions FAIL on unfixed code.

test('1.5a tools/author-geo-audit footer uses canonical .logo-mark class', () => {
    const html = fs.readFileSync(
        path.join(root, 'tools', 'author-geo-audit', 'index.html'),
        'utf8'
    );
    assert.match(
        html,
        /class="[^"]*\blogo-mark\b[^"]*"/,
        'author-geo-audit footer should use .logo-mark for the logo image (canonical class)'
    );
});

test('1.5b tools/author-geo-audit footer uses canonical .footer-bottom class', () => {
    const html = fs.readFileSync(
        path.join(root, 'tools', 'author-geo-audit', 'index.html'),
        'utf8'
    );
    assert.match(
        html,
        /class="[^"]*\bfooter-bottom\b[^"]*"/,
        'author-geo-audit footer should use .footer-bottom (canonical class)'
    );
});

test('1.5c tools/author-geo-audit does not use legacy .footer-logo class', () => {
    const html = fs.readFileSync(
        path.join(root, 'tools', 'author-geo-audit', 'index.html'),
        'utf8'
    );
    assert.doesNotMatch(
        html,
        /class="[^"]*\bfooter-logo\b[^"]*"/,
        'author-geo-audit footer should not use legacy .footer-logo class'
    );
});

test('1.5d tools/author-geo-audit loads script.js for nav-toggle support', () => {
    const html = fs.readFileSync(
        path.join(root, 'tools', 'author-geo-audit', 'index.html'),
        'utf8'
    );
    assert.match(
        html,
        /<script\s+src="(?:\.\.\/)*script\.js"/,
        'author-geo-audit page should include a <script src="...script.js"> tag so .nav-toggle works'
    );
});

// ─── Bug 1.6: Missing Nav-Toggle Button ───────────────────────────────
// 404.html and diagnostic/start/index.html omit <button class="nav-toggle">
// from #site-header. The assertions FAIL on unfixed code.

test('1.6a 404.html #site-header includes a nav-toggle button', () => {
    const html = fs.readFileSync(path.join(root, '404.html'), 'utf8');
    assert.match(
        html,
        /<button[^>]*class="[^"]*\bnav-toggle\b[^"]*"/,
        '404.html should include a <button class="nav-toggle"> in #site-header for mobile navigation'
    );
});

test('1.6b diagnostic/start/index.html #site-header includes a nav-toggle button', () => {
    const html = fs.readFileSync(
        path.join(root, 'diagnostic', 'start', 'index.html'),
        'utf8'
    );
    assert.match(
        html,
        /<button[^>]*class="[^"]*\bnav-toggle\b[^"]*"/,
        'diagnostic/start/index.html should include a <button class="nav-toggle"> in #site-header'
    );
});

// ─── Bug 1.7: Missing Honeypot and Success Modal on kits.html ──────────
// kits.html's contact form lacks netlify-honeypot="bot-field", the hidden
// bot-field input, and #success-modal markup. The assertions FAIL on
// unfixed code.

test('1.7a kits.html contact form includes netlify-honeypot attribute', () => {
    const html = fs.readFileSync(path.join(root, 'kits.html'), 'utf8');
    assert.match(
        html,
        /netlify-honeypot="bot-field"/,
        'kits.html contact form should include netlify-honeypot="bot-field"'
    );
});

test('1.7b kits.html contact form includes hidden bot-field input', () => {
    const html = fs.readFileSync(path.join(root, 'kits.html'), 'utf8');
    assert.match(
        html,
        /name="bot-field"/,
        'kits.html contact form should include a hidden bot-field honeypot input'
    );
});

test('1.7c kits.html includes #success-modal markup', () => {
    const html = fs.readFileSync(path.join(root, 'kits.html'), 'utf8');
    assert.match(
        html,
        /id="success-modal"/,
        'kits.html should include #success-modal markup so submission shows a success modal'
    );
});

// ─── Bug 1.8: HTML Entity in JSON-LD String (about.html) ────────────────
// about.html JSON-LD has "jobTitle": "Founder &amp; Strategist" — the HTML
// entity inside a JSON string value is not HTML-decoded by schema parsers.
// The assertion FAILS on unfixed code.

test('1.8 about.html JSON-LD jobTitle uses literal ampersand (not HTML entity)', () => {
    const html = fs.readFileSync(path.join(root, 'about.html'), 'utf8');

    // Extract the JSON-LD block
    const jsonLdMatch = html.match(
        /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/
    );
    assert.ok(jsonLdMatch, 'about.html should contain a JSON-LD script block');

    // Parse the JSON-LD to check the jobTitle value
    const jsonLd = JSON.parse(jsonLdMatch[1]);
    assert.equal(
        jsonLd.jobTitle,
        'Founder & Strategist',
        'JSON-LD jobTitle should be "Founder & Strategist" with a literal ampersand, not the HTML entity'
    );

    // Also assert the raw source does not contain the HTML entity in jobTitle
    assert.doesNotMatch(
        jsonLdMatch[1],
        /"jobTitle"\s*:\s*"Founder &amp; Strategist"/,
        'JSON-LD source should not contain &amp; in jobTitle'
    );
});

// ─── Bug 1.9: Duplicate Font Weight in Google Fonts URL ────────────────
// Intake/amazon-visibility.html Google Fonts URL has DM+Sans:wght@...;800;800
// (duplicate 800), causing the CSS2 API to return HTTP 400. The assertion
// FAILS on unfixed code.

test('1.9 Intake/amazon-visibility.html Google Fonts URL has no duplicate weight', () => {
    const html = fs.readFileSync(
        path.join(root, 'Intake', 'amazon-visibility.html'),
        'utf8'
    );

    // Extract the Google Fonts CSS2 URL
    const fontsMatch = html.match(
        /https:\/\/fonts\.googleapis\.com\/css2\?[^"']+DM\+Sans[^"']+/
    );
    assert.ok(fontsMatch, 'Intake page should contain a Google Fonts CSS2 URL with DM Sans');

    const fontsUrl = fontsMatch[0];

    // Extract the DM Sans weight axis
    const dmSansWeightMatch = fontsUrl.match(/DM\+Sans:wght@([0-9;]+)/);
    assert.ok(dmSansWeightMatch, 'Google Fonts URL should specify DM Sans weights');

    const weights = dmSansWeightMatch[1].split(';');
    const uniqueWeights = [...new Set(weights)];

    assert.equal(
        weights.length,
        uniqueWeights.length,
        `DM Sans weights should have no duplicates; found: ${weights.join(';')}`
    );
});

// ─── Bug 1.10: Undefined CSS Custom Properties ─────────────────────────
// diagnostic/start/index.html and tools/author-geo-audit/index.html reference
// var(--color-surface) and var(--color-text-dim) which are not defined in the
// :root block of styles.css. The assertions FAIL on unfixed code.

test('1.10a styles.css defines --color-surface custom property', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(
        css,
        /--color-surface\s*:/,
        'styles.css :root should define --color-surface (used by diagnostic/start and author-geo-audit)'
    );
});

test('1.10b styles.css defines --color-text-dim custom property', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(
        css,
        /--color-text-dim\s*:/,
        'styles.css :root should define --color-text-dim (used by diagnostic/start and author-geo-audit)'
    );
});

// ─── Preservation Baseline: Non-Buggy Pages Work ───────────────────────
// These confirm that pages NOT in the bug condition already work correctly.
// They PASS on unfixed code, establishing the preservation baseline.

test('preservation: index.html contact form has honeypot', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(
        html,
        /netlify-honeypot="bot-field"/,
        'index.html form should have the honeypot (preservation baseline)'
    );
});

test('preservation: index.html has #success-modal markup', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(
        html,
        /id="success-modal"/,
        'index.html should have #success-modal markup (preservation baseline)'
    );
});

test('preservation: about.html includes a nav-toggle button', () => {
    const html = fs.readFileSync(path.join(root, 'about.html'), 'utf8');
    assert.match(
        html,
        /<button[^>]*class="[^"]*\bnav-toggle\b[^"]*"/,
        'about.html should include nav-toggle button (preservation baseline)'
    );
});

test('preservation: kits.html includes a nav-toggle button', () => {
    const html = fs.readFileSync(path.join(root, 'kits.html'), 'utf8');
    assert.match(
        html,
        /<button[^>]*class="[^"]*\bnav-toggle\b[^"]*"/,
        'kits.html should include nav-toggle button (preservation baseline)'
    );
});

test('preservation: styles.css defines existing custom properties', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /--bg-card\s*:/, 'styles.css should define --bg-card (preservation baseline)');
    assert.match(css, /--text-1\s*:/, 'styles.css should define --text-1 (preservation baseline)');
    assert.match(css, /--text-2\s*:/, 'styles.css should define --text-2 (preservation baseline)');
});

test('preservation: styles.css defines canonical footer classes', () => {
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.match(css, /\.logo-mark\s*\{/, 'styles.css should define .logo-mark (preservation baseline)');
    assert.match(css, /\.footer-bottom\s*\{/, 'styles.css should define .footer-bottom (preservation baseline)');
});

test('preservation: index.html footer uses canonical .logo-mark / .footer-bottom', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(
        html,
        /class="[^"]*\blogo-mark\b[^"]*"/,
        'index.html footer should use .logo-mark (preservation baseline)'
    );
    assert.match(
        html,
        /class="[^"]*\bfooter-bottom\b[^"]*"/,
        'index.html footer should use .footer-bottom (preservation baseline)'
    );
});
