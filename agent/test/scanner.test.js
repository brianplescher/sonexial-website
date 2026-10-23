const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseRobots,
    evaluateRootAccess,
    analyzeHtml,
    analyzeFiles,
    AI_BOTS,
    SCORE_WEIGHTS,
    isCanonicalCorrect,
    isPrivateOrReservedIP,
    readLimitedResponseText
} = require('../src/scanner');

const okRes = text => ({ ok: true, status: 200, text, error: null });
const missingRes = () => ({ ok: false, status: 404, text: '', error: null });

test('parseRobots starts a new group when a User-agent line follows a directive', () => {
    const { groups } = parseRobots([
        'User-agent: OAI-SearchBot',
        'Disallow: /',
        'User-agent: *',
        'Allow: /'
    ].join('\n'));

    assert.deepEqual(groups['oai-searchbot'], [{ action: 'disallow', path: '/' }]);
    assert.deepEqual(groups['*'], [{ action: 'allow', path: '/' }]);
});

test('parseRobots keeps consecutive User-agent lines in one group', () => {
    const { groups } = parseRobots([
        'User-agent: OAI-SearchBot',
        'User-agent: Claude-SearchBot',
        'Disallow: /drafts'
    ].join('\n'));

    assert.deepEqual(groups['oai-searchbot'], [{ action: 'disallow', path: '/drafts' }]);
    assert.deepEqual(groups['claude-searchbot'], [{ action: 'disallow', path: '/drafts' }]);
});

test('parseRobots strips comments and collects sitemaps', () => {
    const { groups, sitemaps } = parseRobots([
        '# global rules',
        'User-agent: *   # everyone',
        'Disallow: /private',
        'Sitemap: https://example.com/sitemap.xml'
    ].join('\n'));

    assert.deepEqual(groups['*'], [{ action: 'disallow', path: '/private' }]);
    assert.deepEqual(sitemaps, ['https://example.com/sitemap.xml']);
});

test('robots.txt group order does not change the reported result', () => {
    const blockedFirst = [
        'User-agent: OAI-SearchBot',
        'Disallow: /',
        '',
        'User-agent: *',
        'Allow: /'
    ].join('\n');

    const blockedLast = [
        'User-agent: *',
        'Allow: /',
        '',
        'User-agent: OAI-SearchBot',
        'Disallow: /'
    ].join('\n');

    const first = analyzeFiles(missingRes(), okRes(blockedFirst), missingRes());
    const last = analyzeFiles(missingRes(), okRes(blockedLast), missingRes());

    assert.deepEqual(first.checks.ai_bot_access.blocked, ['oai-searchbot']);
    assert.deepEqual(last.checks.ai_bot_access.blocked, ['oai-searchbot']);
    assert.deepEqual(first.checks.ai_bot_access.allowed, AI_BOTS.filter(bot => bot !== 'oai-searchbot'));
    assert.equal(first.score, last.score);
});

test('a wildcard block marks every AI crawler as blocked', () => {
    const { checks } = analyzeFiles(missingRes(), okRes('User-agent: *\nDisallow: /'), missingRes());

    assert.deepEqual(checks.ai_bot_access.blocked, [
        ...AI_BOTS
    ]);
    assert.equal(checks.ai_bot_access.has_explicit_ai_rules, false);
});

test('a bot-specific allow overrides a wildcard block', () => {
    const { checks } = analyzeFiles(missingRes(), okRes([
        'User-agent: *',
        'Disallow: /',
        '',
        'User-agent: OAI-SearchBot',
        'Allow: /'
    ].join('\n')), missingRes());

    assert.deepEqual(checks.ai_bot_access.allowed, ['oai-searchbot']);
    assert.ok(!checks.ai_bot_access.blocked.includes('oai-searchbot'));
    assert.ok(checks.ai_bot_access.blocked.includes('claude-searchbot'));
});

test('evaluateRootAccess treats an empty Disallow as full access', () => {
    assert.equal(evaluateRootAccess([{ action: 'disallow', path: '' }]), 'allowed');
    assert.equal(evaluateRootAccess([{ action: 'disallow', path: '/' }]), 'blocked');
    assert.equal(evaluateRootAccess([{ action: 'disallow', path: '/admin' }]), 'allowed');
});

test('analyzeFiles reports a sitemap from robots.txt when /sitemap.xml is absent', () => {
    const withDirective = analyzeFiles(
        missingRes(),
        okRes('User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap_index.xml'),
        missingRes()
    );
    assert.equal(withDirective.checks.has_sitemap, true);

    const withFile = analyzeFiles(
        missingRes(),
        missingRes(),
        okRes('<?xml version="1.0"?><urlset></urlset>')
    );
    assert.equal(withFile.checks.has_sitemap, true);

    const withNeither = analyzeFiles(missingRes(), missingRes(), missingRes());
    assert.equal(withNeither.checks.has_sitemap, false);
});

test('analyzeHtml counts unique sameAs entries across nested schema', () => {
    const html = `
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[
          {"@type":"Person","name":"A. Author","sameAs":["https://goodreads.com/a","https://amazon.com/a"]},
          {"@type":"Book","author":{"@type":"Person","sameAs":"https://goodreads.com/a"}}
        ]}
        </script>`;

    const { checks } = analyzeHtml(html, 'https://example.com/');
    assert.equal(checks.sameas_count, 2);
    assert.equal(checks.schema_markup.person, true);
    assert.equal(checks.schema_markup.book, true);
});

test('isCanonicalCorrect ignores www and rejects off-site canonicals', () => {
    assert.equal(isCanonicalCorrect('https://www.example.com/', 'https://example.com/'), true);
    assert.equal(isCanonicalCorrect('/about', 'https://example.com/about'), true);
    assert.equal(isCanonicalCorrect('https://squarespace.com/x', 'https://example.com/'), false);
    assert.equal(isCanonicalCorrect(undefined, 'https://example.com/'), false);
});

test('analyzeHtml flags thin content', () => {
    const thin = analyzeHtml('<html><body><h1>Hi</h1><p>Short page.</p></body></html>', 'https://example.com/');
    assert.equal(thin.checks.thin_content_flag, true);
    assert.ok(thin.checks.word_count < 300);

    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    const thick = analyzeHtml(`<html><body><p>${words}</p></body></html>`, 'https://example.com/');
    assert.equal(thick.checks.thin_content_flag, false);
});

test('analyzeHtml excludes script and style text from the word count', () => {
    const script = `<script>${Array.from({ length: 500 }, (_, i) => `v${i}`).join(' ')}</script>`;
    const { checks } = analyzeHtml(`<html><body>${script}<p>Two words</p></body></html>`, 'https://example.com/');
    assert.equal(checks.word_count, 2);
});

test('isPrivateOrReservedIP rejects loopback, private, and metadata addresses', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.169.254', '::1', 'fd00::1']) {
        assert.equal(isPrivateOrReservedIP(ip), true, `${ip} should be rejected`);
    }
    for (const ip of ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']) {
        assert.equal(isPrivateOrReservedIP(ip), false, `${ip} should be allowed`);
    }
});

test('readLimitedResponseText accepts bodies within the byte limit', async () => {
    const response = new Response('small response');
    assert.equal(await readLimitedResponseText(response, 32), 'small response');
});

test('readLimitedResponseText rejects bodies that exceed the byte limit', async () => {
    const response = new Response('response is too large');
    await assert.rejects(readLimitedResponseText(response, 8), /exceeds the 8-byte limit/);
});

test('scoring weights total 100 and missing optional llms.txt does not reduce score', () => {
    assert.equal(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0), 100);
    const allowed = okRes('User-agent: *\nAllow: /');
    const sitemap = okRes('<urlset></urlset>');
    const withFile = analyzeFiles(okRes('# Site overview\n' + 'More information'.repeat(12)),
        allowed, sitemap);
    const withoutFile = analyzeFiles(missingRes(), allowed, sitemap);
    assert.equal(withFile.score, withoutFile.score);
    assert.equal(withoutFile.checks.llms_txt, false);
    assert.deepEqual(withoutFile.critical_failures, []);
    assert.equal(withoutFile.score, SCORE_WEIGHTS.bot_access + SCORE_WEIGHTS.sitemap);
});

test('explicit bot allow rules do not earn more points than default permission', () => {
    const defaultAllowed = analyzeFiles(missingRes(), okRes('User-agent: *\nAllow: /'), missingRes());
    const explicitAllowed = analyzeFiles(missingRes(), okRes([
        'User-agent: OAI-SearchBot', 'User-agent: Claude-SearchBot',
        'User-agent: PerplexityBot', 'User-agent: Googlebot',
        'Allow: /'
    ].join('\n')), missingRes());
    assert.equal(defaultAllowed.score, explicitAllowed.score);
    assert.equal(defaultAllowed.score, SCORE_WEIGHTS.bot_access);
});

test('training bot opt-outs do not count as search crawler restrictions', () => {
    const analysis = analyzeFiles(missingRes(), okRes([
        'User-agent: GPTBot', 'Disallow: /',
        'User-agent: ClaudeBot', 'Disallow: /',
        'User-agent: Google-Extended', 'Disallow: /',
        'User-agent: *', 'Allow: /'
    ].join('\n')), missingRes());
    assert.deepEqual(analysis.checks.ai_bot_access.blocked, []);
    assert.equal(analysis.score, SCORE_WEIGHTS.bot_access);
});

test('robots matching evaluates the scanned page path and specific allow precedence', () => {
    const rules = [
        { action: 'disallow', path: '/books/' },
        { action: 'allow', path: '/books/public/' }
    ];
    assert.equal(evaluateRootAccess(rules, '/books/private/'), 'blocked');
    assert.equal(evaluateRootAccess(rules, '/books/public/book1'), 'allowed');
    assert.equal(evaluateRootAccess(rules, '/'), 'allowed');
    assert.equal(evaluateRootAccess([
        { action: 'disallow', path: '/books/*' },
        { action: 'allow', path: '/books/open$' }
    ], '/books/open'), 'allowed');
    assert.equal(evaluateRootAccess([
        { action: 'disallow', path: '/' },
        { action: 'allow', path: '/public/' }
    ], '/public/author'), 'allowed');
});

test('a blocked target URL is a real critical crawler issue, not a training preference', () => {
    const rules = okRes('User-agent: *\nDisallow: /private/');
    const blocked = analyzeFiles(missingRes(), rules, missingRes(), 'https://author.example/private/books');
    const allowed = analyzeFiles(missingRes(), rules, missingRes(), 'https://author.example/public');
    assert.equal(blocked.checks.ai_bot_access.status, 'blocked');
    assert.equal(blocked.checks.ai_bot_access.blocked.length, AI_BOTS.length);
    assert.equal(blocked.critical_failures.length, 1);
    assert.equal(allowed.checks.ai_bot_access.status, 'unrestricted');
    assert.deepEqual(allowed.checks.ai_bot_access.blocked, []);
});

test('robots access unknown is not reported as allowed', () => {
    const unknown = analyzeFiles(missingRes(), { ok: false, status: 503, text: '' }, missingRes());
    assert.equal(unknown.checks.ai_bot_access.status, 'unknown');
    assert.equal(unknown.score, 0);
});

test('canonical check requires same page path as well as same domain', () => {
    assert.equal(isCanonicalCorrect('https://example.com/books/other', 'https://example.com/books/mine'), false);
    assert.equal(isCanonicalCorrect('https://www.example.com/books/mine/', 'https://example.com/books/mine'), true);
});

test('entity link spoofing and incomplete Open Graph tags do not receive full credit', () => {
    const html = '<html><head><meta property="og:title" content="Author">' +
        '<meta property="og:url" content="https://example.com/"></head>' +
        '<body><h1>Author</h1><a href="https://amazon.com.evil.example/b">Not Amazon</a></body></html>';
    const analysis = analyzeHtml(html, 'https://example.com/');
    assert.equal(analysis.checks.entity_links.amazon, false);
    assert.equal(analysis.checks.open_graph, false);
    assert.ok(analysis.score_breakdown.open_graph < SCORE_WEIGHTS.open_graph);
});

test('complete observable technical signals can attain the full heuristic score', () => {
    const words = Array.from({ length: 310 }, () => 'useful').join(' ');
    const html = '<!doctype html><html><head>' +
        '<script type="application/ld+json">{"@type":"Person","name":"Author","book":{"@type":"Book","name":"Book"}}</script>' +
        '<link rel="canonical" href="https://example.com/">' +
        '<meta property="og:title" content="Author"><meta property="og:description" content="A description">' +
        '<meta property="og:image" content="https://example.com/image.jpg"></head>' +
        '<body><h1>Author</h1><h2>Books</h2><a href="https://www.goodreads.com/book">Book</a>' + words + '</body></html>';
    const page = analyzeHtml(html, 'https://example.com/');
    const files = analyzeFiles(missingRes(), okRes('User-agent: *\nAllow: /'), okRes('<urlset></urlset>'));
    assert.equal(page.score + files.score, 100);
    assert.deepEqual([...page.critical_failures, ...files.critical_failures], []);
});
