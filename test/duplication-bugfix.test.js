const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

/**
 * Property 9: Bug Condition — Code Duplications
 * **Validates: Requirements 2.18, 2.19, 2.20, 2.21, 2.22, 2.23, 2.24, 2.25**
 *
 * Bug condition exploration test. These assertions verify the CORRECT (fixed)
 * behavior. On unfixed code the bug-condition assertions FAIL, surfacing
 * counterexamples that prove the bugs exist. The preservation assertions PASS,
 * confirming that non-buggy inputs already work correctly.
 *
 * Bug conditions:
 *   1.18 — sanitizeLog() is defined locally in three separate files
 *          (ai-utils.js, index.js, scanner.js) instead of importing the
 *          shared helper from ai-utils.js.
 *   1.19 — metadata-kit.js re-implements parseJson() logic (indexOf('{') /
 *          lastIndexOf('}') + JSON.parse) instead of importing from ai-utils.js.
 *   1.20 — escapeHtml() is implemented separately in three files: email.js,
 *          diagnostic/render.js (as esc), and tools/author-geo-audit/index.html.
 *   1.21 — netlify-signature.js duplicates ~20 lines of JWT/HMAC verification
 *          (HS256 alg check, createHmac, timingSafeEqual) in both
 *          verifyNetlifySignature and verifyNetlifyProxySignature.
 *   1.22 — JSON-LD tree-walker (@type extraction) is implemented separately in
 *          scanner.js, diagnostic/page-facts.js, and semantic-extractor.js.
 *   1.23 — .github/workflows/optimize-images.yml duplicates the exact same
 *          optipng/jpegoptim/cwebp shell commands that scripts/optimize-images.js
 *          already runs, instead of calling `npm run optimize:images`.
 *   1.24 — agent/scripts/test-scanner.js, test-comprehensive.js, and
 *          test-api-endpoints.js duplicate SSRF target arrays and live scans
 *          against sonexial.com and example.com, already covered offline by
 *          agent/test/scanner.test.js.
 *   1.25 — Logos split across Images/ and assets/img/; four files
 *          (assets/img/logo-full.png, assets/img/logo.png,
 *          Images/logo_mark_2026.png, Images/signal-bg.jpg) are unreferenced.
 *
 * NOTE: These tests use static source analysis — reading source files and
 * grepping for duplicated patterns. This is deterministic and reproducible.
 */

const root = path.join(__dirname, '..');
const agentDir = path.join(root, 'agent');

function readSource(relPath) {
    return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readAgent(relPath) {
    return fs.readFileSync(path.join(agentDir, relPath), 'utf8');
}

/**
 * Counts the number of `function sanitizeLog` definitions across agent/src/.
 * On unfixed code this returns 3 (ai-utils.js, index.js, scanner.js).
 * After the fix it should return 1 (only ai-utils.js).
 */
function countSanitizeLogDefinitions() {
    const files = ['src/ai-utils.js', 'src/index.js', 'src/scanner.js'];
    let count = 0;
    for (const f of files) {
        const src = readAgent(f);
        if (/function\s+sanitizeLog\s*\(/.test(src)) count++;
    }
    return count;
}

// ─── Bug 1.18: SanitizeLog Duplication ─────────────────────────────────
// sanitizeLog is defined locally in ai-utils.js (shared export), index.js,
// and scanner.js. The CORRECT behavior is a single shared implementation in
// ai-utils.js, imported by index.js and scanner.js.
//
// On unfixed code there are 3 definitions, so this assertion FAILS — proving
// the bug.

test('1.18 sanitizeLog defined only once in agent/src/ (shared in ai-utils.js)', () => {
    const count = countSanitizeLogDefinitions();
    assert.equal(
        count,
        1,
        `sanitizeLog should be defined only once (in ai-utils.js) but found ${count} definitions across agent/src/`
    );
});

// ─── Bug 1.18b: index.js imports sanitizeLog ──────────────────────────
// On unfixed code index.js defines sanitizeLog locally instead of importing
// it, so this assertion FAILS — proving the bug.

test('1.18b index.js imports sanitizeLog from ai-utils instead of defining locally', () => {
    const src = readAgent('src/index.js');
    assert.doesNotMatch(
        src,
        /function\s+sanitizeLog\s*\(/,
        'index.js should not define sanitizeLog locally (should import from ai-utils.js)'
    );
    assert.match(
        src,
        /require\(['"][^'"]*ai-utils['"]\)/,
        'index.js should import from ai-utils.js'
    );
});

// ─── Bug 1.18c: scanner.js imports sanitizeLog ───────────────────────
// On unfixed code scanner.js defines sanitizeLog locally instead of importing
// it, so this assertion FAILS — proving the bug.

test('1.18c scanner.js imports sanitizeLog from ai-utils instead of defining locally', () => {
    const src = readAgent('src/scanner.js');
    assert.doesNotMatch(
        src,
        /function\s+sanitizeLog\s*\(/,
        'scanner.js should not define sanitizeLog locally (should import from ai-utils.js)'
    );
    assert.match(
        src,
        /require\(['"][^'"]*ai-utils['"]\)/,
        'scanner.js should import from ai-utils.js'
    );
});

// ─── Bug 1.19: ParseJson Duplication in metadata-kit.js ──────────────
// metadata-kit.js manually re-implements the same indexOf('{') /
// lastIndexOf('}') + JSON.parse block that is already exported as parseJson()
// in ai-utils.js. The CORRECT behavior is to import parseJson from ai-utils.js.
//
// On unfixed code the local re-implementation exists, so this assertion FAILS
// — proving the bug.

test('1.19 metadata-kit.js imports parseJson from ai-utils instead of re-implementing', () => {
    const src = readAgent('src/kits/metadata-kit.js');
    assert.doesNotMatch(
        src,
        /\.indexOf\(['"]\{['"]\)/,
        'metadata-kit.js should not re-implement JSON extraction with indexOf("{") (should use shared parseJson)'
    );
    assert.match(
        src,
        /require\(['"][^'"]*ai-utils['"]\)/,
        'metadata-kit.js should import parseJson from ai-utils.js'
    );
});

// ─── Bug 1.20a: EscapeHtml Duplication ────────────────────────────────
// escapeHtml is implemented separately in three files: email.js (line 78),
// diagnostic/render.js (as `esc`, line 10), and tools/author-geo-audit/index.html
// (line 717). The CORRECT behavior is a single shared implementation imported
// everywhere.
//
// On unfixed code there are 3 definitions across agent modules, so this
// assertion FAILS — proving the bug.

test('1.20a escapeHtml defined only once across agent/src/ (shared module)', () => {
    const agentFiles = [
        'src/email.js',
        'src/diagnostic/render.js',
        'src/ai-utils.js',
    ];
    let count = 0;
    for (const f of agentFiles) {
        const src = readAgent(f);
        if (/function\s+(escapeHtml|esc)\s*\(/.test(src)) count++;
    }
    assert.equal(
        count,
        1,
        `escapeHtml/esc should be defined only once (in a shared module) but found ${count} definitions across agent/src/`
    );
});

// ─── Bug 1.20b: email.js imports escapeHtml ───────────────────────────
// On unfixed code email.js defines escapeHtml locally instead of importing it,
// so this assertion FAILS — proving the bug.

test('1.20b email.js imports escapeHtml from shared module instead of defining locally', () => {
    const src = readAgent('src/email.js');
    assert.doesNotMatch(
        src,
        /function\s+escapeHtml\s*\(/,
        'email.js should not define escapeHtml locally (should import from shared module)'
    );
});

// ─── Bug 1.20c: render.js imports escapeHtml ──────────────────────────
// On unfixed code render.js defines `esc` locally instead of importing the
// shared escapeHtml, so this assertion FAILS — proving the bug.

test('1.20c render.js imports escapeHtml from shared module instead of defining esc locally', () => {
    const src = readAgent('src/diagnostic/render.js');
    assert.doesNotMatch(
        src,
        /function\s+esc\s*\(/,
        'render.js should not define esc locally (should import escapeHtml from shared module)'
    );
});

// ─── Bug 1.20d: author-geo-audit imports shared escapeHtml ────────────
// On unfixed code author-geo-audit/index.html defines escapeHtml locally in
// an inline <script>, so this assertion FAILS — proving the bug.

test('1.20d author-geo-audit/index.html does not define escapeHtml inline', () => {
    const src = readSource(
        path.join('tools', 'author-geo-audit', 'index.html')
    );
    assert.doesNotMatch(
        src,
        /function\s+escapeHtml\s*\(/,
        'tools/author-geo-audit/index.html should not define escapeHtml inline (should use shared implementation)'
    );
});

// ─── Bug 1.21: HS256 Verification Duplication ─────────────────────────
// netlify-signature.js duplicates ~20 lines of JWT header parsing, HS256 alg
// check, HMAC-SHA256 digest computation, and crypto.timingSafeEqual in both
// verifyNetlifySignature and verifyNetlifyProxySignature. The CORRECT behavior
// is a single shared verifyHs256Jws helper called by both functions.
//
// On unfixed code the HS256/timingSafeEqual pattern appears twice (once per
// function), so this assertion FAILS — proving the bug.

test('1.21 netlify-signature.js uses a single shared HS256 verify helper', () => {
    const src = readAgent('src/netlify-signature.js');
    // Count occurrences of the HS256 verification pattern. On unfixed code
    // it appears twice (once in each function); after fix it appears once
    // in a shared helper.
    const matches = src.match(/timingSafeEqual/g) || [];
    assert.ok(
        matches.length <= 1,
        `netlify-signature.js should use a single shared HS256 helper (timingSafeEqual should appear at most once in the shared helper, found ${matches.length} occurrences)`
    );
    // The shared helper should exist and be called by both functions
    assert.match(
        src,
        /verifyHs256|verifyHs256Jws|verifyJws/i,
        'netlify-signature.js should have a shared HS256 JWS verification helper'
    );
});

// ─── Bug 1.22: JSON-LD Walker Duplication ─────────────────────────────
// The recursive JSON-LD tree-walker (parsing @type from script[type="application/ld+json"])
// is implemented separately in scanner.js, diagnostic/page-facts.js, and
// semantic-extractor.js. The CORRECT behavior is a single shared module
// imported by all three.
//
// On unfixed code each file has its own `walk` function that recursively
// traverses JSON-LD data, so the count of files with local walk definitions
// is 3. After the fix it should be 0 (all import from a shared module).

test('1.22 JSON-LD tree-walker is shared (not duplicated in 3 modules)', () => {
    const files = [
        { rel: 'src/scanner.js', label: 'scanner.js' },
        { rel: 'src/diagnostic/page-facts.js', label: 'page-facts.js' },
        { rel: 'src/semantic-extractor.js', label: 'semantic-extractor.js' },
    ];
    let localWalkerCount = 0;
    for (const { rel, label } of files) {
        const src = readAgent(rel);
        // Each file has a local recursive `walk` function that traverses
        // JSON-LD objects. After the fix these should be replaced with an
        // import from a shared jsonld module.
        const hasLocalWalk =
            /function\s+walk\s*\(/.test(src) ||
            /\(function\s+walk\s*\(/.test(src);
        if (hasLocalWalk) localWalkerCount++;
    }
    assert.equal(
        localWalkerCount,
        0,
        `JSON-LD tree-walker should be imported from a shared module, but ${localWalkerCount} of 3 files still define a local walk() function`
    );
});

// ─── Bug 1.23: Image Optimization Duplication in Workflow ──────────────
// .github/workflows/optimize-images.yml duplicates the exact same optipng,
// jpegoptim, and cwebp shell commands that scripts/optimize-images.js already
// runs. The CORRECT behavior is for the workflow to call
// `npm run optimize:images` instead of duplicating the commands.
//
// On unfixed code the workflow has raw optipng/jpegoptim/cwebp commands and
// does NOT call npm run optimize:images, so these assertions FAIL — proving
// the bug.

test('1.23 optimize-images.yml calls npm run optimize:images instead of duplicating commands', () => {
    const yaml = readSource(
        path.join('.github', 'workflows', 'optimize-images.yml')
    );
    // The fixed workflow should call `npm run optimize:images`
    assert.match(
        yaml,
        /npm\s+run\s+optimize:images/,
        'optimize-images.yml should call `npm run optimize:images` instead of duplicating shell commands'
    );
    // The fixed workflow should NOT contain raw optipng/jpegoptim/cwebp commands
    assert.doesNotMatch(
        yaml,
        /\boptipng\b/,
        'optimize-images.yml should not duplicate optipng commands (should call npm script)'
    );
    assert.doesNotMatch(
        yaml,
        /\bjpegoptim\b/,
        'optimize-images.yml should not duplicate jpegoptim commands (should call npm script)'
    );
    assert.doesNotMatch(
        yaml,
        /\bcwebp\b/,
        'optimize-images.yml should not duplicate cwebp commands (should call npm script)'
    );
});

// ─── Bug 1.24: Redundant Test Scripts ──────────────────────────────────
// agent/scripts/test-scanner.js, test-comprehensive.js, and
// test-api-endpoints.js duplicate SSRF target arrays and live scans against
// sonexial.com and example.com, already covered offline by
// agent/test/scanner.test.js. The CORRECT behavior is to consolidate or remove
// these redundant scripts.
//
// On unfixed code these files exist with duplicated SSRF arrays and live scans,
// so this assertion FAILS — proving the bug.

test('1.24 redundant agent/scripts/ test scripts are removed or consolidated', () => {
    const redundantScripts = [
        path.join(agentDir, 'scripts', 'test-scanner.js'),
        path.join(agentDir, 'scripts', 'test-comprehensive.js'),
        path.join(agentDir, 'scripts', 'test-api-endpoints.js'),
    ];
    // After the fix, these redundant scripts should NOT exist (removed in
    // favor of the offline agent/test/scanner.test.js coverage).
    // On unfixed code they all exist, so this assertion FAILS.
    for (const f of redundantScripts) {
        assert.ok(
            !fs.existsSync(f),
            `redundant test script should be removed: ${path.relative(root, f)}`
        );
    }
});

// ─── Bug 1.25: Unreferenced Logo Assets ────────────────────────────────
// Four logo/image files are unreferenced anywhere in the codebase:
//   - assets/img/logo-full.png
//   - assets/img/logo.png
//   - Images/logo_mark_2026.png
//   - Images/signal-bg.jpg
// The CORRECT behavior is to remove these unreferenced assets.
//
// On unfixed code these files exist, so this assertion FAILS — proving the bug.

test('1.25 unreferenced logo assets are removed', () => {
    const unreferencedAssets = [
        path.join(root, 'assets', 'img', 'logo-full.png'),
        path.join(root, 'assets', 'img', 'logo.png'),
        path.join(root, 'Images', 'logo_mark_2026.png'),
        path.join(root, 'Images', 'signal-bg.jpg'),
    ];
    for (const f of unreferencedAssets) {
        assert.ok(
            !fs.existsSync(f),
            `unreferenced logo asset should be removed: ${path.relative(root, f)}`
        );
    }
});

// ─── Preservation: ai-utils.js exports shared helpers ──────────────────
// ai-utils.js is the canonical shared module for sanitizeLog and parseJson.
// This PASSES on unfixed code (the export already exists), confirming the
// shared module is already in place and just needs to be used by others.

test('preservation: ai-utils.js exports sanitizeLog and parseJson', () => {
    const src = readAgent('src/ai-utils.js');
    assert.match(
        src,
        /module\.exports\s*[=.]/,
        'ai-utils.js should export its helpers'
    );
    assert.match(
        src,
        /function\s+sanitizeLog\s*\(/,
        'ai-utils.js should define sanitizeLog (the shared implementation)'
    );
    assert.match(
        src,
        /function\s+parseJson\s*\(/,
        'ai-utils.js should define parseJson (the shared implementation)'
    );
});

// ─── Preservation: scripts/optimize-images.js exists ──────────────────
// The npm script that the workflow should call points to this file. It
// already exists and works. This PASSES on unfixed code.

test('preservation: scripts/optimize-images.js exists (workflow should call it)', () => {
    assert.ok(
        fs.existsSync(path.join(root, 'scripts', 'optimize-images.js')),
        'scripts/optimize-images.js should exist (the npm script the workflow should call)'
    );
});

// ─── Preservation: agent/test/scanner.test.js provides offline coverage ─
// The offline test suite already covers SSRF/scan logic, which is why the
// redundant live-scan scripts can be removed. This PASSES on unfixed code.

test('preservation: agent/test/scanner.test.js exists (provides offline coverage)', () => {
    assert.ok(
        fs.existsSync(path.join(agentDir, 'test', 'scanner.test.js')),
        'agent/test/scanner.test.js should exist (provides offline SSRF/scan coverage)'
    );
});

// ─── Preservation: Referenced logo assets still exist ──────────────────
// Images/sonexial_logo.png and Images/favicon.png are referenced by pages and
// must continue to be served. This PASSES on unfixed code, confirming that
// only unreferenced assets are targeted for removal.

test('preservation: referenced logo assets still exist', () => {
    const referencedAssets = [
        path.join(root, 'Images', 'sonexial_logo.png'),
        path.join(root, 'Images', 'favicon.png'),
    ];
    for (const f of referencedAssets) {
        assert.ok(
            fs.existsSync(f),
            `referenced logo asset should still exist: ${path.relative(root, f)}`
        );
    }
});
