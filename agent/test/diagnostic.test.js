const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { verifyStripeSignature, isDiagnosticSession, extractOrder, normalizeSiteUrl } = require('../src/stripe');
const { analyzePage, detectProfiles } = require('../src/diagnostic/page-facts');
const { buildIssues, computeScores, evaluateBots, quadrant, llmsTxtProblems } = require('../src/diagnostic/issues');
const { normalizeLink, parseSitemapUrls } = require('../src/diagnostic/crawler');
const { buildArtifacts } = require('../src/diagnostic/artifacts');
const { fallbackWriteup } = require('../src/diagnostic/writeup');
const { renderDiagnosticHtml } = require('../src/diagnostic/render');

const SECRET = 'whsec_test_secret';

function sign(body, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
    const sig = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    return `t=${t},v1=${sig},v0=deadbeef`;
}

test('verifyStripeSignature accepts a valid v1 signature over the raw body', () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
    const event = verifyStripeSignature(Buffer.from(body), sign(body), SECRET);
    assert.equal(event.id, 'evt_1');
});

test('verifyStripeSignature rejects a tampered body, wrong secret, and stale timestamp', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    assert.throws(() => verifyStripeSignature(Buffer.from(body + ' '), sign(body), SECRET));
    assert.throws(() => verifyStripeSignature(Buffer.from(body), sign(body, 'whsec_other'), SECRET));
    const old = Math.floor(Date.now() / 1000) - 3600;
    assert.throws(() => verifyStripeSignature(Buffer.from(body), sign(body, SECRET, old), SECRET), /tolerance/);
    assert.throws(() => verifyStripeSignature(Buffer.from(body), 't=1', SECRET), /Malformed/);
});

test('isDiagnosticSession matches only the configured Payment Link IDs', () => {
    assert.equal(isDiagnosticSession({ payment_link: 'plink_diag' }, ['plink_diag']), true);
    assert.equal(isDiagnosticSession({ payment_link: 'plink_kit' }, ['plink_diag']), false);
    assert.equal(isDiagnosticSession({ payment_link: null }, ['plink_diag']), false);
});

test('extractOrder reads the website custom field, buyer, and client_reference_id', () => {
    const order = extractOrder({
        id: 'cs_test_1',
        payment_status: 'paid',
        client_reference_id: 'lead-123',
        customer_details: { email: 'reader@example.com', name: 'Jane Author' },
        custom_fields: [{ key: 'websiteurl', type: 'text', text: { value: 'janeauthor.com' } }]
    });
    assert.deepEqual(order, {
        sessionId: 'cs_test_1',
        email: 'reader@example.com',
        name: 'Jane Author',
        siteUrl: 'https://janeauthor.com/',
        leadId: 'lead-123',
        paid: true
    });
    assert.equal(extractOrder({ id: 'cs_2', payment_status: 'unpaid', custom_fields: [] }).paid, false);
});

test('normalizeSiteUrl adds a scheme and rejects non-hosts', () => {
    assert.equal(normalizeSiteUrl(' example.com/books '), 'https://example.com/books');
    assert.equal(normalizeSiteUrl('not a url'), null);
    assert.equal(normalizeSiteUrl(''), null);
});

test('normalizeLink keeps same-site HTML links and drops assets, fragments, and other hosts', () => {
    const base = 'https://www.author.com/';
    assert.equal(normalizeLink('/books/one/#buy', base, 'author.com'), 'https://www.author.com/books/one');
    assert.equal(normalizeLink('https://author.com/about?utm=x', base, 'author.com'), 'https://author.com/about');
    assert.equal(normalizeLink('/cover.jpg', base, 'author.com'), null);
    assert.equal(normalizeLink('https://amazon.com/dp/1', base, 'author.com'), null);
    assert.equal(normalizeLink('mailto:me@author.com', base, 'author.com'), null);
});

test('parseSitemapUrls extracts loc entries', () => {
    const xml = '<urlset><url><loc>https://a.com/</loc></url><url><loc> https://a.com/b?x=1&amp;y=2 </loc></url></urlset>';
    assert.deepEqual(parseSitemapUrls(xml), ['https://a.com/', 'https://a.com/b?x=1&y=2']);
});

test('evaluateBots separates AI search crawlers from training crawlers', () => {
    const robots = { ok: true, text: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /\n\nUser-agent: *\nAllow: /' };
    const { rows } = evaluateBots(robots);
    const by = Object.fromEntries(rows.map(r => [r.label, r]));
    assert.equal(by.GPTBot.access, 'blocked');
    assert.equal(by.GPTBot.kind, 'training');
    assert.equal(by.PerplexityBot.access, 'blocked');
    assert.equal(by.PerplexityBot.kind, 'search');
    assert.equal(by['OAI-SearchBot'].access, 'allowed');
});

test('quadrant places issues by impact and effort', () => {
    assert.equal(quadrant(5, 1), 'Quick win');
    assert.equal(quadrant(4, 4), 'Major project');
    assert.equal(quadrant(2, 1), 'Fill-in');
    assert.equal(quadrant(2, 4), 'Deprioritize');
});

test('llmsTxtProblems flags a file without title, summary, or links', () => {
    assert.equal(llmsTxtProblems('# Jane\n\n> Author of things\n\n- [Books](https://jane.com/books)').length, 0);
    assert.equal(llmsTxtProblems('just some text about me').length, 3);
});

const authorHtml = `<!DOCTYPE html><html lang="en"><head>
<title>Jane Author — Official Site</title>
<meta name="viewport" content="width=device-width">
<meta name="description" content="Jane Author writes cozy mysteries.">
<link rel="canonical" href="https://jane.com/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","name":"Jane Author","sameAs":["https://www.goodreads.com/author/show/1"]}</script>
</head><body><main><h1>Jane Author</h1><p>${'word '.repeat(400)}</p>
<a href="https://www.amazon.com/stores/author/B01">Amazon</a><img src="/me.jpg"></main></body></html>`;

function fakeCrawl(overrides = {}) {
    return {
        origin: 'https://jane.com',
        homepage: 'https://jane.com/',
        robotsRes: { ok: true, text: 'User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /' },
        llmsRes: { ok: false, text: '' },
        sitemapRes: { ok: true, text: '' },
        sitemapPages: [],
        uncrawled: 0,
        httpRedirectsToHttps: true,
        httpProbeOk: true,
        ...overrides
    };
}

function homeFacts() {
    return { ...analyzePage({ url: 'https://jane.com/', finalUrl: 'https://jane.com/', status: 200, html: authorHtml, headers: {} }), depth: 0, inlinks: [] };
}

test('analyzePage extracts schema, entity links, and on-page facts', () => {
    const f = homeFacts();
    assert.equal(f.title, 'Jane Author — Official Site');
    assert.deepEqual(f.jsonLdTypes, ['Person']);
    assert.equal(f.persons[0].name, 'Jane Author');
    assert.equal(f.imgMissingAlt, 1);
    assert.equal(f.hasMainOrArticle, true);
    assert.ok(f.wordCount > 400);
    const profiles = detectProfiles([...f.sameAs, ...f.outbound]);
    assert.ok(profiles.goodreads && profiles.amazon_author);
});

test('buildIssues reports blocked search bots, missing Book schema, and thin sameAs, ordered by priority', () => {
    const { issues } = buildIssues(fakeCrawl(), [homeFacts()]);
    const ids = issues.map(i => i.id);
    assert.ok(ids.includes('ai_search_bot_blocked'));
    assert.ok(ids.includes('book_schema_missing'));
    assert.ok(ids.includes('sameas_thin'));
    assert.ok(ids.includes('llms_txt_missing'));
    assert.ok(ids.includes('img_alt_missing'));
    assert.ok(!ids.includes('person_schema_missing'));
    assert.equal(issues[0].id, 'ai_search_bot_blocked');
    for (let i = 1; i < issues.length; i++) assert.ok(issues[i - 1].priority >= issues[i].priority);
});

test('buildIssues skips orphan detection when the crawl was truncated', () => {
    const orphan = { ...homeFacts(), url: 'https://jane.com/books/one', inlinks: [] };
    const crawl = fakeCrawl({ sitemapPages: ['https://jane.com/books/one'] });
    assert.ok(buildIssues(crawl, [homeFacts(), orphan]).issues.some(i => i.id === 'orphan_pages'));
    assert.ok(!buildIssues({ ...crawl, uncrawled: 10 }, [homeFacts(), orphan]).issues.some(i => i.id === 'orphan_pages'));
});

test('computeScores counts severities and stays within 0-100', () => {
    const facts = [homeFacts()];
    const { issues } = buildIssues(fakeCrawl(), facts);
    const scores = computeScores(issues, facts);
    assert.equal(scores.counts.error + scores.counts.warning + scores.counts.notice, issues.length);
    assert.ok(scores.aiReadiness >= 0 && scores.aiReadiness <= 100);
    assert.ok(scores.siteHealth >= 0 && scores.siteHealth <= 100);
});

test('rendered diagnostic escapes site content and includes the ready-to-paste fixes', () => {
    const facts = [homeFacts()];
    facts[0].title = '<script>alert(1)</script>';
    const { issues, bots, profiles } = buildIssues(fakeCrawl(), facts);
    const artifacts = buildArtifacts({ origin: 'https://jane.com', homepageUrl: 'https://jane.com/', facts, profiles });
    assert.match(artifacts.llmsTxt, /^# Jane Author/);
    assert.match(artifacts.robotsTxt, /User-agent: OAI-SearchBot\nAllow: \//);
    assert.match(artifacts.personJsonLd, /goodreads/);

    const diag = {
        url: 'https://jane.com/', generatedAt: new Date().toISOString(), freeScan: { score: 40, grade: 'D' },
        pagesCrawled: 1, pagesUncrawled: 0, sitemapPageCount: 0, scores: computeScores(issues, facts),
        issues, bots, profiles, artifacts,
        pages: [{ url: 'https://jane.com/', status: 200, title: facts[0].title, wordCount: 400, depth: 0, schema: ['Person'], issueCount: 2 }]
    };
    diag.writeup = fallbackWriteup(diag);
    const html = renderDiagnosticHtml(diag, { name: '<b>Jane</b>' });
    assert.ok(!html.includes('<b>Jane</b>'));
    assert.ok(html.includes('&lt;b&gt;Jane&lt;/b&gt;'));
    assert.ok(html.includes('Ready-to-paste fixes'));
    assert.ok(html.includes('noindex, nofollow'));
});
