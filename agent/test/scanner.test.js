const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseRobots,
    evaluateRootAccess,
    analyzeHtml,
    analyzeFiles,
    isCanonicalCorrect,
    isPrivateOrReservedIP
} = require('../src/scanner');

const okRes = text => ({ ok: true, status: 200, text, error: null });
const missingRes = () => ({ ok: false, status: 404, text: '', error: null });

test('parseRobots starts a new group when a User-agent line follows a directive', () => {
    const { groups } = parseRobots([
        'User-agent: GPTBot',
        'Disallow: /',
        'User-agent: *',
        'Allow: /'
    ].join('\n'));

    assert.deepEqual(groups['gptbot'], [{ action: 'disallow', path: '/' }]);
    assert.deepEqual(groups['*'], [{ action: 'allow', path: '/' }]);
});

test('parseRobots keeps consecutive User-agent lines in one group', () => {
    const { groups } = parseRobots([
        'User-agent: GPTBot',
        'User-agent: ClaudeBot',
        'Disallow: /drafts'
    ].join('\n'));

    assert.deepEqual(groups['gptbot'], [{ action: 'disallow', path: '/drafts' }]);
    assert.deepEqual(groups['claudebot'], [{ action: 'disallow', path: '/drafts' }]);
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
        'User-agent: GPTBot',
        'Disallow: /',
        '',
        'User-agent: *',
        'Allow: /'
    ].join('\n');

    const blockedLast = [
        'User-agent: *',
        'Allow: /',
        '',
        'User-agent: GPTBot',
        'Disallow: /'
    ].join('\n');

    const first = analyzeFiles(missingRes(), okRes(blockedFirst), missingRes());
    const last = analyzeFiles(missingRes(), okRes(blockedLast), missingRes());

    assert.deepEqual(first.checks.ai_bot_access.blocked, ['gptbot']);
    assert.deepEqual(last.checks.ai_bot_access.blocked, ['gptbot']);
    assert.deepEqual(first.checks.ai_bot_access.allowed, []);
    assert.equal(first.score, last.score);
});

test('a wildcard block marks every AI crawler as blocked', () => {
    const { checks } = analyzeFiles(missingRes(), okRes('User-agent: *\nDisallow: /'), missingRes());

    assert.deepEqual(checks.ai_bot_access.blocked, [
        'gptbot', 'claudebot', 'perplexitybot', 'anthropic-ai', 'google-extended'
    ]);
    assert.equal(checks.ai_bot_access.has_explicit_ai_rules, false);
});

test('a bot-specific allow overrides a wildcard block', () => {
    const { checks } = analyzeFiles(missingRes(), okRes([
        'User-agent: *',
        'Disallow: /',
        '',
        'User-agent: GPTBot',
        'Allow: /'
    ].join('\n')), missingRes());

    assert.deepEqual(checks.ai_bot_access.allowed, ['gptbot']);
    assert.ok(!checks.ai_bot_access.blocked.includes('gptbot'));
    assert.ok(checks.ai_bot_access.blocked.includes('claudebot'));
});

test('evaluateRootAccess treats an empty Disallow as full access', () => {
    assert.equal(evaluateRootAccess([{ action: 'disallow', path: '' }]), 'allowed');
    assert.equal(evaluateRootAccess([{ action: 'disallow', path: '/' }]), 'blocked');
    assert.equal(evaluateRootAccess([{ action: 'disallow', path: '/admin' }]), 'partial');
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
