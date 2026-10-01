const scanner = require('../scanner');
const { crawlSite } = require('./crawler');
const { analyzePage } = require('./page-facts');
const { buildIssues, computeScores } = require('./issues');
const { buildArtifacts } = require('./artifacts');
const { generateWriteup } = require('./writeup');
const { renderDiagnosticHtml } = require('./render');

/**
 * Runs the full paid diagnostic: the free scan for continuity, a multi-page crawl,
 * prioritized issues, ready-to-paste fixes, and the written analysis.
 */
async function runDiagnostic(url, options = {}) {
    const started = Date.now();
    const scan = await scanner.runScan(url);
    const crawl = await crawlSite(scan.url, options);
    const facts = crawl.pages
        .filter(p => p.isHtml || !p.ok)
        .map(p => ({ ...analyzePage(p), depth: p.depth, inlinks: p.inlinks }));
    const { issues, bots, profiles } = buildIssues(crawl, facts);
    const scores = computeScores(issues, facts);
    const artifacts = buildArtifacts({ origin: crawl.origin, homepageUrl: crawl.homepage, facts, profiles });
    const homepage = facts.find(f => f.url === crawl.homepage);

    const diag = {
        url: scan.url,
        generatedAt: new Date().toISOString(),
        freeScan: { score: scan.score, grade: scan.geo_grade },
        pagesCrawled: facts.length,
        pagesUncrawled: crawl.uncrawled,
        sitemapPageCount: crawl.sitemapPages.length,
        scores,
        issues,
        bots,
        profiles,
        artifacts,
        homepageDescription: homepage?.metaDescription || '',
        pages: facts.map(f => ({
            url: f.url,
            status: f.status,
            title: f.title,
            wordCount: f.wordCount,
            depth: f.depth,
            schema: f.jsonLdTypes,
            issueCount: issues.filter(i => i.pages.some(p => p.split(' ')[0] === f.url)).length
        }))
    };
    diag.writeup = await generateWriteup(diag);
    diag.durationMs = Date.now() - started;
    return diag;
}

module.exports = { runDiagnostic, renderDiagnosticHtml };
