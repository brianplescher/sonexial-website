const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/**
 * Property 1: Bug Condition — Build & Asset Rewriting
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * Bug condition exploration test. These assertions verify the CORRECT (fixed)
 * behavior. On unfixed code the bug-condition assertions FAIL, surfacing
 * counterexamples that prove the bugs exist. The preservation assertions PASS,
 * confirming that non-buggy inputs already work correctly.
 *
 * Bug conditions:
 *   1.1 — rewriteHtml in scripts/build.js uses a regex that only matches
 *         single-level relative (../) and root-relative (/) asset paths,
 *         leaving deeper nested paths (../../styles.css) un-rewritten so
 *         those pages never receive hashed /static/* references.
 *   1.2 — Intake/amazon-visibility.html omits the <script src="...script.js">
 *         tag entirely, so no client-side JavaScript runs on that page.
 *   1.3 — netlify.toml enables post-processing flags (css/js bundle, html
 *         pretty_urls) that rewrite asset URLs away from the immutable
 *         /static/* cache paths established by build.js.
 */

const root = path.join(__dirname, '..');

// Replicates the exact regex from scripts/build.js rewriteHtml() so we can
// test its behavior against deep-nested paths. The module itself executes the
// full build on import, so we isolate the regex logic here.
function rewriteWithBuildRegex(html, cssAsset, jsAsset) {
    html = html.replace(/href="(?:\.\.\/|\/)?styles\.css"/g, `href="/${cssAsset}"`);
    html = html.replace(/src="(?:\.\.\/|\/)?script\.js"/g, `src="/${jsAsset}"`);
    return html;
}

const CSS = 'static/styles.abc123def0.css';
const JS = 'static/script.fedcba9876.js';

// ─── Bug 1.1: Deep Nested Path Rewriting ──────────────────────────────
// These test the regex that build.js uses. On unfixed code the regex only
// matches zero or one ../ prefix, so ../../ and deeper paths are left
// un-rewritten. These assertions FAIL, proving the bug.

test('1.1a deep nested CSS path (../../styles.css) is rewritten to /static/*', () => {
    const input = '<link rel="stylesheet" href="../../styles.css">';
    const result = rewriteWithBuildRegex(input, CSS, JS);
    assert.equal(
        result,
        `<link rel="stylesheet" href="/${CSS}">`,
        'deep nested ../../styles.css should be rewritten to hashed /static/ path'
    );
});

test('1.1b three-level nested CSS path (../../../styles.css) is rewritten to /static/*', () => {
    const input = '<link rel="stylesheet" href="../../../styles.css">';
    const result = rewriteWithBuildRegex(input, CSS, JS);
    assert.equal(
        result,
        `<link rel="stylesheet" href="/${CSS}">`,
        'three-level nested styles.css should be rewritten to hashed /static/ path'
    );
});

test('1.1c deep nested JS path (../../script.js) is rewritten to /static/*', () => {
    const input = '<script src="../../script.js" defer></script>';
    const result = rewriteWithBuildRegex(input, CSS, JS);
    assert.equal(
        result,
        `<script src="/${JS}" defer></script>`,
        'deep nested ../../script.js should be rewritten to hashed /static/ path'
    );
});

// ─── Bug 1.2: Intake Page Missing Script Tag ──────────────────────────
// On unfixed code Intake/amazon-visibility.html has no <script src="...script.js">
// tag. The assertion FAILS, proving the bug.

test('1.2 Intake/amazon-visibility.html includes a <script src="...script.js"> tag', () => {
    const intakePath = path.join(root, 'Intake', 'amazon-visibility.html');
    const html = fs.readFileSync(intakePath, 'utf8');
    assert.match(
        html,
        /<script\s+src="(?:\.\.\/)*script\.js"/,
        'Intake page should include a <script src="...script.js"> tag for client-side JS'
    );
});

// ─── Bug 1.3: Netlify Post-Processing Flags ───────────────────────────
// On unfixed code netlify.toml enables bundle and pretty_urls flags. The
// assertions FAIL, proving the bug.

test('1.3a netlify.toml does not enable CSS/JS bundle post-processing', () => {
    const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
    assert.doesNotMatch(
        toml,
        /bundle\s*=\s*true/,
        'netlify.toml should not enable css/js bundle (bypasses /static/* immutable cache)'
    );
});

test('1.3b netlify.toml does not enable HTML pretty_urls post-processing', () => {
    const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
    assert.doesNotMatch(
        toml,
        /pretty_urls\s*=\s*true/,
        'netlify.toml should not enable html.pretty_urls (bypasses build output)'
    );
});

// ─── Preservation Baseline: Non-Buggy Paths Work ──────────────────────
// These confirm that single-level, root-relative, and bare asset references
// ARE rewritten by the current regex. They PASS on unfixed code, establishing
// the preservation baseline.

test('preservation: single-level relative CSS path (../styles.css) is rewritten', () => {
    const input = '<link rel="stylesheet" href="../styles.css">';
    const result = rewriteWithBuildRegex(input, CSS, JS);
    assert.equal(
        result,
        `<link rel="stylesheet" href="/${CSS}">`,
        'single-level ../styles.css should be rewritten (preservation baseline)'
    );
});

test('preservation: root-relative CSS path (/styles.css) is rewritten', () => {
    const input = '<link rel="stylesheet" href="/styles.css">';
    const result = rewriteWithBuildRegex(input, CSS, JS);
    assert.equal(
        result,
        `<link rel="stylesheet" href="/${CSS}">`,
        'root-relative /styles.css should be rewritten (preservation baseline)'
    );
});

test('preservation: bare CSS path (styles.css) is rewritten', () => {
    const input = '<link rel="stylesheet" href="styles.css">';
    const result = rewriteWithBuildRegex(input, CSS, JS);
    assert.equal(
        result,
        `<link rel="stylesheet" href="/${CSS}">`,
        'bare styles.css should be rewritten (preservation baseline)'
    );
});

// ─── Preservation Baseline: Build Output ─────────────────────────────
// Builds the actual site and confirms the Intake page's single-level
// ../styles.css is rewritten to the hashed /static/ path. PASSES on unfixed
// code, confirming the build pipeline works for non-buggy inputs.

test('preservation: built dist/Intake/amazon-visibility.html has ../styles.css rewritten', () => {
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
    const builtPath = path.join(root, 'dist', 'Intake', 'amazon-visibility.html');
    assert.ok(fs.existsSync(builtPath), 'dist/Intake/amazon-visibility.html should exist after build');
    const html = fs.readFileSync(builtPath, 'utf8');
    assert.match(
        html,
        /href="\/static\/styles\.[a-f0-9]+\.css"/,
        'built Intake page should reference hashed /static/styles.<hash>.css'
    );
    assert.doesNotMatch(
        html,
        /href="\.\.\/styles\.css"/,
        'built Intake page should NOT retain un-rewritten ../styles.css'
    );
});
