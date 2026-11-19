const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Property 5: Bug Condition — Backend / Agent Service Bugs
 * **Validates: Requirements 2.11, 2.12, 2.13, 2.14**
 *
 * Bug condition exploration test. These assertions verify the CORRECT (fixed)
 * behavior. On unfixed code the bug-condition assertions FAIL, surfacing
 * counterexamples that prove the bugs exist. The preservation assertions PASS,
 * confirming that non-buggy inputs already work correctly.
 *
 * Bug conditions:
 *   1.11 — agent/scripts/test-comprehensive.js asserts that
 *          repB.critical_failures includes 'llms.txt', but scanner.js treats
 *          llms.txt as optional. The test assertion is stale and must be
 *          aligned with the optional llms.txt semantics.
 *   1.12 — scanWithContent in scanner.js calls validateSSRF once for the input
 *          URL, then each of the 4 safeFetch calls re-runs validateSSRF (a DNS
 *          lookup) and guardedLookup (another DNS lookup) = up to 9 redundant
 *          lookups per hostname. Expected: at most 1 per hostname per scan.
 *   1.13 — runDiagnostic in diagnostic/index.js calls scanner.runScan(url)
 *          (which fetches homepage/robots/llms/sitemap) then calls
 *          crawlSite(scan.url) which independently re-fetches the same four
 *          resources. Expected: reuse the already-fetched results.
 *   1.14 — sendDraftEmail and sendErrorEmail in email.js check only
 *          !process.env.RESEND_API_KEY before passing to: OWNER_EMAIL
 *          (undefined when OWNER_EMAIL is unset). sendLeadNotification and
 *          sendDiagnosticOwnerNotice also check !OWNER_EMAIL. Expected: both
 *          env vars guarded consistently.
 *
 * NOTE: These tests use static source analysis — reading source files and
 * checking for the presence/absence of code patterns — which is equivalent for
 * proving these structural bugs exist. Live network scans and DNS
 * instrumentation would require external services; static analysis of the
 * exact call structure is deterministic and reproducible.
 */

const root = path.join(__dirname, '..');
const agentDir = path.join(root, 'agent');

function readSource(relPath) {
    return fs.readFileSync(path.join(agentDir, relPath), 'utf8');
}

// ─── Bug 1.11: Stale llms.txt Assertion ───────────────────────────────
// test-comprehensive.js asserts that example.com's critical_failures includes
// 'llms.txt'. But scanner.js treats llms.txt as optional — a missing llms.txt
// should not be a critical failure. The test must NOT assert llms.txt in
// critical_failures. On unfixed code this assertion EXISTS, so the test FAILS.

test('1.11 test-comprehensive.js does NOT assert llms.txt in critical_failures', () => {
    const source = readSource(path.join('scripts', 'test-comprehensive.js'));
    // The stale assertion: repB.critical_failures.some(f => f.includes('llms.txt'))
    // This line must NOT exist in the fixed test.
    assert.doesNotMatch(
        source,
        /critical_failures\.some\([^)]*llms\.txt/i,
        'test-comprehensive.js should not assert llms.txt in critical_failures (llms.txt is optional)'
    );
});

// ─── Bug 1.12: Redundant DNS Lookups Per Scan ─────────────────────────
// scanWithContent calls validateSSRF once for the input URL, then makes 4
// safeFetch calls (homepage, llms.txt, robots.txt, sitemap.xml). Each
// safeFetch independently calls validateSSRF (1 DNS lookup) and uses a
// ssrfSafeAgent whose connect.lookup is guardedLookup (another DNS lookup).
// That's 1 + 4*(1+1) = 9 DNS lookups for a single hostname.
//
// Expected: safeFetch should NOT independently re-validate SSRF; it should
// rely on a per-scan cache so validateSSRF and DNS lookup happen at most
// once per hostname. On unfixed code, safeFetch calls validateSSRF directly,
// so the test FAILS.

test('1.12a safeFetch does NOT independently call validateSSRF (should use cached validation)', () => {
    const source = readSource(path.join('src', 'scanner.js'));

    // Extract the safeFetch function body to check for internal validateSSRF calls.
    // We look for validateSSRF being called inside safeFetch (not just the export).
    const safeFetchMatch = source.match(/async\s+function\s+safeFetch\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(safeFetchMatch, 'safeFetch function should exist in scanner.js');
    const safeFetchBody = safeFetchMatch[1];

    // The fixed code should not call validateSSRF inside safeFetch —
    // validation should be cached per hostname per scan.
    assert.doesNotMatch(
        safeFetchBody,
        /\bvalidateSSRF\s*\(/,
        'safeFetch should not call validateSSRF directly (should use per-hostname cache to avoid redundant DNS lookups)'
    );
});

test('1.12b scanWithContent does NOT call validateSSRF separately from safeFetch', () => {
    const source = readSource(path.join('src', 'scanner.js'));

    // Extract scanWithContent function body.
    const scanMatch = source.match(/async\s+function\s+scanWithContent\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(scanMatch, 'scanWithContent function should exist in scanner.js');
    const scanBody = scanMatch[1];

    // The fixed code should perform validation at most once per hostname.
    // On unfixed code, scanWithContent calls validateSSRF(urlToScan) AND then
    // each safeFetch re-validates — redundant. The fix should eliminate the
    // separate validateSSRF call in scanWithContent (validation happens via
    // safeFetch's cache, or a shared cache is used).
    //
    // We count validateSSRF calls in scanWithContent. On unfixed code there
    // is 1 explicit call + 4 indirect calls through safeFetch = 5 validation
    // points. The fix should reduce this to at most 1 (or 0 if safeFetch
    // handles it via cache).
    const directCalls = (scanBody.match(/\bvalidateSSRF\s*\(/g) || []).length;
    assert.ok(
        directCalls === 0,
        `scanWithContent should not call validateSSRF directly (found ${directCalls} calls); validation should be cached per hostname`
    );
});

test('1.12c guardedLookup is not invoked on every fetch (DNS lookup redundancy)', () => {
    const source = readSource(path.join('src', 'scanner.js'));

    // The ssrfSafeAgent uses guardedLookup as its connect.lookup, which means
    // every fetch through that agent triggers a DNS lookup. Combined with
    // validateSSRF's own dns.lookup, that's 2 lookups per safeFetch call.
    //
    // On unfixed code, the agent is created with: new Agent({ connect: { lookup: guardedLookup } })
    // and safeFetch uses dispatcher: ssrfSafeAgent. This is correct for SSRF
    // protection but redundant when combined with per-call validateSSRF.
    //
    // The fix should ensure guardedLookup consults the same per-hostname cache
    // so it doesn't re-resolve DNS on every fetch. We verify that the source
    // does NOT have both a direct validateSSRF call in safeFetch AND a
    // guardedLookup dispatcher — at least one must use caching.
    //
    // For the exploration test, we assert the total DNS-lookup surface is
    // minimized: safeFetch should not both call validateSSRF AND use
    // guardedLookup (which would be 2 lookups per fetch).
    const safeFetchMatch = source.match(/async\s+function\s+safeFetch\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(safeFetchMatch, 'safeFetch function should exist in scanner.js');
    const safeFetchBody = safeFetchMatch[1];

    const callsValidateSSRF = /\bvalidateSSRF\s*\(/.test(safeFetchBody);
    const usesGuardedAgent = /ssrfSafeAgent/.test(safeFetchBody);

    // On unfixed code: both are true → 2 DNS lookups per fetch.
    // The fix should eliminate the direct validateSSRF call in safeFetch
    // (guardedLookup already provides DNS-rebinding protection).
    assert.ok(
        !(callsValidateSSRF && usesGuardedAgent),
        'safeFetch should not both call validateSSRF and use guardedLookup agent (redundant double DNS lookup per fetch)'
    );
});

// ─── Bug 1.13: Double-Fetch in Diagnostic Flow ────────────────────────
// runDiagnostic calls scanner.runScan(url) which internally calls
// scanWithContent — fetching homepage, llms.txt, robots.txt, and sitemap.xml.
// Then it calls crawlSite(scan.url) which independently fetches robots.txt,
// llms.txt, sitemap.xml, BingSiteAuth.xml, and the homepage via HTTP probe.
// The 4 overlapping resources (homepage, robots, llms, sitemap) are fetched
// twice.
//
// Expected: runDiagnostic should reuse the fetched results from runScan by
// calling scanWithContent (which returns HTML) and passing pre-fetched content
// to crawlSite, so each resource is fetched only once. On unfixed code,
// runDiagnostic calls runScan (not scanWithContent) and does not pass
// pre-fetched content to crawlSite, so the test FAILS.

test('1.13a runDiagnostic reuses fetched results (calls scanWithContent, not runScan)', () => {
    const source = readSource(path.join('src', 'diagnostic', 'index.js'));

    // On unfixed code: const scan = await scanner.runScan(url);
    // Fixed code should use scanWithContent to get the HTML back, or pass
    // pre-fetched results into the crawl.
    assert.doesNotMatch(
        source,
        /scanner\.runScan\s*\(/,
        'runDiagnostic should call scanWithContent (not runScan) so fetched HTML/results can be reused by crawlSite'
    );
});

test('1.13b crawlSite receives pre-fetched results (avoids double-fetch)', () => {
    const source = readSource(path.join('src', 'diagnostic', 'index.js'));

    // On unfixed code: const crawl = await crawlSite(scan.url, options);
    // The crawl independently re-fetches homepage/robots/llms/sitemap.
    // Fixed code should pass the already-fetched content into crawlSite.
    // We assert the unfixed pattern — crawlSite called with just scan.url
    // and options — does NOT appear. On unfixed code this exact pattern
    // exists, so the test FAILS.
    assert.doesNotMatch(
        source,
        /crawlSite\s*\(\s*scan\.url\s*,\s*options\s*\)/,
        'crawlSite should receive pre-fetched content (not just scan.url + options) to avoid double-fetching homepage/robots/llms/sitemap'
    );
});

// ─── Bug 1.14: Missing OWNER_EMAIL Guard ──────────────────────────────
// sendDraftEmail and sendErrorEmail check only !process.env.RESEND_API_KEY
// but NOT !OWNER_EMAIL. When OWNER_EMAIL is unset, they pass to: OWNER_EMAIL
// (undefined) to Resend, causing an API error. sendLeadNotification and
// sendDiagnosticOwnerNotice correctly check both.
//
// Expected: sendDraftEmail and sendErrorEmail should check both
// !process.env.RESEND_API_KEY and !OWNER_EMAIL. On unfixed code they only
// check RESEND_API_KEY, so the test FAILS.

test('1.14c sendDraftEmail guard checks OWNER_EMAIL is set (not just RESEND_API_KEY)', () => {
    const source = readSource(path.join('src', 'email.js'));

    // Extract the guard block from sendDraftEmail (the first if statement).
    const draftMatch = source.match(/async\s+function\s+sendDraftEmail\s*\([^)]*\)\s*\{([\s\S]*?)\nasync\s+function\s+sendErrorEmail/);
    assert.ok(draftMatch, 'sendDraftEmail function should exist in email.js');
    const draftBody = draftMatch[1];

    // The guard should be: if (!process.env.RESEND_API_KEY || !OWNER_EMAIL)
    // On unfixed code it's: if (!process.env.RESEND_API_KEY)
    // We check that OWNER_EMAIL appears in an if-condition (guard), not just
    // as a to: field value.
    const guardMatch = draftBody.match(/if\s*\(([^)]+)\)\s*\{/);
    assert.ok(guardMatch, 'sendDraftEmail should have a guard condition');
    const guardCondition = guardMatch[1];

    assert.ok(
        guardCondition.includes('OWNER_EMAIL'),
        `sendDraftEmail guard should check OWNER_EMAIL (guard: "${guardCondition.trim()}")`
    );
});

test('1.14d sendErrorEmail guard checks OWNER_EMAIL is set (not just RESEND_API_KEY)', () => {
    const source = readSource(path.join('src', 'email.js'));

    // Extract the guard block from sendErrorEmail.
    const errorMatch = source.match(/async\s+function\s+sendErrorEmail\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(errorMatch, 'sendErrorEmail function should exist in email.js');
    const errorBody = errorMatch[1];

    const guardMatch = errorBody.match(/if\s*\(([^)]+)\)\s*\{/);
    assert.ok(guardMatch, 'sendErrorEmail should have a guard condition');
    const guardCondition = guardMatch[1];

    assert.ok(
        guardCondition.includes('OWNER_EMAIL'),
        `sendErrorEmail guard should check OWNER_EMAIL (guard: "${guardCondition.trim()}")`
    );
});

// ─── Preservation Baseline: Non-Buggy Backend Behavior ─────────────────
// These confirm that existing correct behavior is preserved on unfixed code.
// They PASS, establishing the preservation baseline.

test('preservation: sendLeadNotification checks both RESEND_API_KEY and OWNER_EMAIL', () => {
    const source = readSource(path.join('src', 'email.js'));

    // Extract sendLeadNotification function body.
    const leadMatch = source.match(/async\s+function\s+sendLeadNotification\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(leadMatch, 'sendLeadNotification function should exist in email.js');
    const leadBody = leadMatch[1];

    // This function already has the correct guard — both env vars checked.
    assert.match(
        leadBody,
        /!process\.env\.RESEND_API_KEY\s*\|\|\s*!OWNER_EMAIL/,
        'sendLeadNotification should guard both RESEND_API_KEY and OWNER_EMAIL (preservation baseline)'
    );
});

test('preservation: sendDiagnosticOwnerNotice checks both RESEND_API_KEY and OWNER_EMAIL', () => {
    const source = readSource(path.join('src', 'email.js'));

    // Extract sendDiagnosticOwnerNotice function body.
    const noticeMatch = source.match(/async\s+function\s+sendDiagnosticOwnerNotice\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(noticeMatch, 'sendDiagnosticOwnerNotice function should exist in email.js');
    const noticeBody = noticeMatch[1];

    // This function already has the correct guard — both env vars checked.
    assert.match(
        noticeBody,
        /!process\.env\.RESEND_API_KEY\s*\|\|\s*!OWNER_EMAIL/,
        'sendDiagnosticOwnerNotice should guard both RESEND_API_KEY and OWNER_EMAIL (preservation baseline)'
    );
});

test('preservation: scanner exports scanWithContent for diagnostic reuse', () => {
    const source = readSource(path.join('src', 'scanner.js'));

    // scanWithContent is already exported — the fix just needs to use it
    // instead of runScan in runDiagnostic. This confirms the export exists.
    assert.match(
        source,
        /scanWithContent/,
        'scanner.js should export scanWithContent (available for diagnostic reuse)'
    );
});

test('preservation: analyzeFiles treats llms.txt as present/optional (not always critical)', () => {
    const source = readSource(path.join('src', 'scanner.js'));

    // The analyzeFiles function already sets checks.llms_txt = true when
    // llms.txt is present and valid. This confirms the optional semantics
    // exist for the present case.
    const analyzeMatch = source.match(/function\s+analyzeFiles\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(analyzeMatch, 'analyzeFiles function should exist in scanner.js');
    const analyzeBody = analyzeMatch[2];

    assert.match(
        analyzeBody,
        /checks\.llms_txt\s*=\s*true/,
        'analyzeFiles should set llms_txt=true when llms.txt is present (preservation baseline)'
    );
});
