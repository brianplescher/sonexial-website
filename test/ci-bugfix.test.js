const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Property 7: Bug Condition — CI / GitHub Actions Bugs
 * **Validates: Requirements 2.15, 2.16, 2.17**
 *
 * Bug condition exploration test. These assertions verify the CORRECT (fixed)
 * behavior. On unfixed code the bug-condition assertions FAIL, surfacing
 * counterexamples that prove the bugs exist. The preservation assertions PASS,
 * confirming that non-buggy inputs already work correctly.
 *
 * Bug conditions:
 *   1.15 — seo-monitor.yml check steps only echo ✗ messages and always exit 0,
 *          making the if: failure() "comment on commit" step dead code. Also
 *          hardcodes node-version: '18' instead of using .nvmrc (which says 22).
 *   1.16 — security-scan.yml credential grep uses `|| echo "No ... found"`
 *          which always exits 0 whether or not matches are found, so the
 *          workflow never fails on actual credential findings.
 *   1.17 — html-validate runs with glob "*.html" (non-recursive) in both
 *          package.json test:html and deploy.yml, skipping subdirectory HTML
 *          files (diagnostic/start/index.html, Intake/amazon-visibility.html,
 *          tools/author-geo-audit/index.html).
 *
 * NOTE: These tests use static source analysis — reading workflow YAML files
 * and package.json to check for the presence/absence of buggy patterns. This
 * is deterministic and reproducible.
 */

const root = path.join(__dirname, '..');

// ─── Bug 1.15a: SEO Monitor Exits Zero on Findings ─────────────────────
// The check steps in seo-monitor.yml use `if grep …; then echo "✓" else
// echo "✗" fi` and the step always exits 0. The "Comment on commit (if issues
// found)" step is guarded by `if: failure()` — but since the check steps
// never fail, that step is dead code.
//
// The CORRECT behavior is to track findings and exit non-zero (exit 1) when
// any ✗ condition is detected, so the comment step triggers.
//
// On unfixed code there is no `exit 1` in the check steps, so this assertion
// FAILS — proving the bug.

test('1.15a seo-monitor.yml exits non-zero when SEO issues are found', () => {
    const yaml = fs.readFileSync(
        path.join(root, '.github', 'workflows', 'seo-monitor.yml'),
        'utf8'
    );
    // The fixed workflow must track failures and exit non-zero (exit 1) when
    // ✗ conditions are detected. On unfixed code no such exit exists.
    assert.match(
        yaml,
        /exit\s+1/,
        'seo-monitor.yml should exit non-zero when SEO issues are found so the comment step triggers'
    );
});

// ─── Bug 1.15b: SEO Monitor Hardcodes Node Version ────────────────────
// The workflow uses `node-version: '18'` hardcoded instead of
// `node-version-file: '.nvmrc'`. The root .nvmrc specifies Node 22, so the
// workflow runs on a different version than local development.
//
// On unfixed code `node-version-file` is absent and `node-version: '18'` is
// present, so these assertions FAIL — proving the bug.

test('1.15b seo-monitor.yml uses .nvmrc for Node version instead of hardcoding 18', () => {
    const yaml = fs.readFileSync(
        path.join(root, '.github', 'workflows', 'seo-monitor.yml'),
        'utf8'
    );
    assert.match(
        yaml,
        /node-version-file:\s*['"]\.nvmrc['"]/,
        'seo-monitor.yml should use node-version-file: .nvmrc instead of hardcoding a version'
    );
    assert.doesNotMatch(
        yaml,
        /node-version:\s*['"]18['"]/,
        'seo-monitor.yml should NOT hardcode node-version: 18 (should use .nvmrc)'
    );
});

// ─── Bug 1.16a: Security Grep Swallows Matches ─────────────────────────
// The "Scan for hardcoded credentials" step uses:
//   grep -r -l "password\s*=" … || echo "No hardcoded passwords found"
// The `|| echo` forces exit 0 even when grep finds matches. The CORRECT
// behavior (already used by the "Check for common secret patterns" step) is
// `&& echo "::error::…" && exit 1` when matches are found.
//
// On unfixed code the credential grep uses `|| echo "No hardcoded passwords
// found"`, so this doesNotMatch assertion FAILS — proving the bug.

test('1.16a security-scan.yml does not swallow credential grep matches with || echo', () => {
    const yaml = fs.readFileSync(
        path.join(root, '.github', 'workflows', 'security-scan.yml'),
        'utf8'
    );
    // The credential scan step must not use `|| echo "No hardcoded passwords
    // found"` which always forces exit 0. Instead it should exit non-zero on
    // match. On unfixed code this string IS present, so doesNotMatch FAILS.
    assert.doesNotMatch(
        yaml,
        /\|\|\s*echo\s+"No hardcoded passwords found"/,
        'security-scan.yml should not swallow password grep with || echo (should fail on match)'
    );
});

// ─── Bug 1.16b: Security Credential Scan Exits Non-Zero on Match ────────
// The "Scan for hardcoded credentials" step has no `exit 1` — it only uses
// `|| echo` which always exits 0. The CORRECT behavior (already used by the
// "Check for common secret patterns" step) is to use `&& exit 1` when
// matches are found.
//
// On unfixed code the credential scan step has no `exit 1`, so this assertion
// FAILS — proving the bug.

test('1.16b security-scan.yml credential scan exits non-zero (exit 1) when matches are found', () => {
    const yaml = fs.readFileSync(
        path.join(root, '.github', 'workflows', 'security-scan.yml'),
        'utf8'
    );
    // Find the "Scan for hardcoded credentials" step and check it uses exit 1
    const stepIndex = yaml.indexOf('Scan for hardcoded credentials');
    assert.ok(stepIndex !== -1, 'security-scan.yml should have a "Scan for hardcoded credentials" step');
    // Find the next step to bound our search to just this step's content
    const nextStepIndex = yaml.indexOf('- name:', stepIndex + 1);
    const stepContent = yaml.slice(stepIndex, nextStepIndex !== -1 ? nextStepIndex : undefined);
    assert.match(
        stepContent,
        /exit\s+1/,
        'security-scan.yml "Scan for hardcoded credentials" step should exit 1 when matches are found'
    );
});

// ─── Bug 1.17a: package.json test:html Uses Non-Recursive Glob ─────────
// The `test:html` script uses `html-validate '*.html'` which only matches
// root-level HTML files. Subdirectory files like diagnostic/start/index.html
// are skipped. The CORRECT behavior is `html-validate '**/*.html'` (recursive).
//
// On unfixed code the glob is '*.html' (non-recursive), so this assertion
// FAILS — proving the bug.

test('1.17a package.json test:html uses recursive glob to include subdirectories', () => {
    const pkg = JSON.parse(
        fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    );
    const testHtml = pkg.scripts['test:html'];
    assert.ok(testHtml, 'package.json should have a test:html script');
    assert.match(
        testHtml,
        /\*\*\/\*\.html/,
        'test:html should use recursive glob **/*.html to validate subdirectory HTML files'
    );
});

// ─── Bug 1.17b: deploy.yml html-validate Uses Non-Recursive Glob ────────
// The deploy workflow uses `npx html-validate "*.html"` which only matches
// root-level HTML files. The CORRECT behavior is `html-validate "**/*.html"`.
//
// On unfixed code the glob is "*.html" (non-recursive), so this assertion
// FAILS — proving the bug.

test('1.17b deploy.yml html-validate uses recursive glob to include subdirectories', () => {
    const yaml = fs.readFileSync(
        path.join(root, '.github', 'workflows', 'deploy.yml'),
        'utf8'
    );
    // Look for the html-validate line and check it uses a recursive glob
    const lines = yaml.split('\n');
    const validateLine = lines.find(l => l.includes('html-validate'));
    assert.ok(validateLine, 'deploy.yml should contain an html-validate command');
    assert.match(
        validateLine,
        /\*\*\/\*\.html/,
        'deploy.yml html-validate should use recursive glob **/*.html to validate subdirectory HTML files'
    );
});

// ─── Preservation Baseline: Subdirectory HTML Files Exist ──────────────
// These confirm that subdirectory HTML files exist in the repo. They would
// be skipped by the non-recursive glob '*.html' but should be included by
// the recursive glob '**/*.html'. These PASS on unfixed code, establishing
// the preservation baseline and proving the glob bug has real impact.

test('preservation: subdirectory HTML files exist (would be skipped by non-recursive glob)', () => {
    const subdirHtmlFiles = [
        path.join(root, 'diagnostic', 'start', 'index.html'),
        path.join(root, 'Intake', 'amazon-visibility.html'),
        path.join(root, 'tools', 'author-geo-audit', 'index.html'),
    ];
    for (const f of subdirHtmlFiles) {
        assert.ok(
            fs.existsSync(f),
            `subdirectory HTML file should exist: ${path.relative(root, f)} (skipped by non-recursive glob)`
        );
    }
});

// ─── Preservation Baseline: Security-Scan Uses .nvmrc ──────────────────
// The security-scan.yml already correctly uses node-version-file: '.nvmrc'.
// This PASSES on unfixed code, confirming that not all workflows have the
// Node version bug (only seo-monitor.yml does).

test('preservation: security-scan.yml already uses .nvmrc for Node version', () => {
    const yaml = fs.readFileSync(
        path.join(root, '.github', 'workflows', 'security-scan.yml'),
        'utf8'
    );
    assert.match(
        yaml,
        /node-version-file:\s*['"]\.nvmrc['"]/,
        'security-scan.yml should use node-version-file: .nvmrc (already correct)'
    );
});

// ─── Preservation Baseline: Root-Level HTML Files Exist ────────────────
// These confirm that root-level HTML files exist and would be validated by
// the non-recursive glob. They PASS on unfixed code.

test('preservation: root-level HTML files exist (validated by any glob)', () => {
    const rootHtmlFiles = [
        path.join(root, 'index.html'),
        path.join(root, 'about.html'),
        path.join(root, 'kits.html'),
    ];
    for (const f of rootHtmlFiles) {
        assert.ok(
            fs.existsSync(f),
            `root-level HTML file should exist: ${path.relative(root, f)}`
        );
    }
});
