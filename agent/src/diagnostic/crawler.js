const cheerio = require('cheerio');
const { safeFetch } = require('../scanner');

const DEFAULT_MAX_PAGES = 30;
const DEFAULT_CONCURRENCY = 4;
const NON_HTML_EXT = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|css|js|mjs|json|xml|txt|zip|gz|mp3|mp4|m4a|wav|mov|webm|epub|mobi|docx?|xlsx?|pptx?|woff2?|ttf|eot)$/i;

function stripWww(host) {
    return host.replace(/^www\./, '').toLowerCase();
}

/**
 * Normalizes a link to a crawlable same-site URL, or returns null when it should be skipped.
 */
function normalizeLink(href, baseUrl, siteHost) {
    if (!href || /^(mailto|tel|javascript|data):/i.test(href.trim())) return null;
    let parsed;
    try {
        parsed = new URL(href, baseUrl);
    } catch {
        return null;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (stripWww(parsed.hostname) !== siteHost) return null;
    if (NON_HTML_EXT.test(parsed.pathname)) return null;
    parsed.hash = '';
    parsed.search = '';
    let href2 = parsed.href;
    if (href2.endsWith('/') && parsed.pathname !== '/') href2 = href2.slice(0, -1);
    return href2;
}

function extractLinks(html, pageUrl, siteHost) {
    const $ = cheerio.load(html || '');
    const links = new Set();
    $('a[href]').each((_, el) => {
        const link = normalizeLink($(el).attr('href'), pageUrl, siteHost);
        if (link) links.add(link);
    });
    return [...links];
}

function parseSitemapUrls(xml) {
    const urls = [];
    const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
    let m;
    while ((m = re.exec(xml || '')) !== null) urls.push(m[1].replace(/&amp;/g, '&'));
    return urls;
}

/**
 * Breadth-first crawl of one site, seeded from the start URL and its sitemap.
 * Records click depth and internal inlinks per page so orphaned and deep pages can be reported.
 */
async function crawlSite(startUrl, options = {}) {
    const maxPages = options.maxPages || Number(process.env.DIAGNOSTIC_MAX_PAGES) || DEFAULT_MAX_PAGES;
    const concurrency = options.concurrency || DEFAULT_CONCURRENCY;

    const start = new URL(startUrl);
    const origin = `${start.protocol}//${start.host}`;
    const siteHost = stripWww(start.hostname);

    const [robotsRes, llmsRes, sitemapRes, httpProbe] = await Promise.all([
        safeFetch(`${origin}/robots.txt`),
        safeFetch(`${origin}/llms.txt`),
        safeFetch(`${origin}/sitemap.xml`),
        safeFetch(`http://${start.host}/`)
    ]);

    let sitemapUrls = sitemapRes.ok ? parseSitemapUrls(sitemapRes.text) : [];
    // A sitemap index lists child sitemaps rather than pages; expand the first few.
    if (sitemapRes.ok && /<sitemapindex/i.test(sitemapRes.text)) {
        const children = await Promise.all(sitemapUrls.slice(0, 5).map(u => safeFetch(u)));
        sitemapUrls = children.flatMap(r => (r.ok ? parseSitemapUrls(r.text) : []));
    }
    const sitemapPages = sitemapUrls
        .map(u => normalizeLink(u, origin, siteHost))
        .filter(Boolean);

    const homepage = normalizeLink(start.href, origin, siteHost) || `${origin}/`;
    const pages = new Map();
    const inlinks = new Map();
    const queue = [{ url: homepage, depth: 0, from: null }];
    const seen = new Set([homepage]);

    for (const url of sitemapPages) {
        if (!seen.has(url)) {
            seen.add(url);
            queue.push({ url, depth: null, from: 'sitemap' });
        }
    }

    async function visit(item) {
        const started = Date.now();
        const res = await safeFetch(item.url);
        const isHtml = !res.headers || !res.headers.contentType || res.headers.contentType.includes('html');
        const page = {
            url: item.url,
            finalUrl: res.url || item.url,
            status: res.status,
            ok: res.ok,
            error: res.error,
            depth: item.depth,
            isHtml,
            headers: res.headers || {},
            html: isHtml ? res.text : '',
            fetchMs: Date.now() - started,
            links: []
        };
        if (res.ok && isHtml) {
            page.links = extractLinks(res.text, page.finalUrl, siteHost);
            for (const link of page.links) {
                if (!inlinks.has(link)) inlinks.set(link, new Set());
                inlinks.get(link).add(item.url);
                if (!seen.has(link) && seen.size < maxPages * 3) {
                    seen.add(link);
                    queue.push({ url: link, depth: item.depth === null ? null : item.depth + 1, from: item.url });
                }
            }
        }
        pages.set(item.url, page);
    }

    while (queue.length && pages.size < maxPages) {
        // Prefer link-discovered pages (known depth) over sitemap-only seeds.
        queue.sort((a, b) => (a.depth ?? 99) - (b.depth ?? 99));
        const batch = queue.splice(0, Math.min(concurrency, maxPages - pages.size));
        await Promise.all(batch.map(visit));
    }

    // Depths for sitemap-seeded pages are resolved later if a crawled page links to them.
    for (const page of pages.values()) {
        if (page.depth !== null) continue;
        const parents = [...(inlinks.get(page.url) || [])]
            .map(u => pages.get(u))
            .filter(p => p && p.depth !== null);
        if (parents.length) page.depth = Math.min(...parents.map(p => p.depth)) + 1;
    }

    const results = [...pages.values()].map(p => ({
        ...p,
        inlinks: [...(inlinks.get(p.url) || [])].filter(u => u !== p.url)
    }));

    return {
        origin,
        siteHost,
        homepage,
        pages: results,
        uncrawled: queue.length,
        robotsRes,
        llmsRes,
        sitemapRes,
        sitemapPages,
        httpRedirectsToHttps: Boolean(httpProbe.url && httpProbe.url.startsWith('https://')),
        httpProbeOk: httpProbe.ok
    };
}

module.exports = { crawlSite, normalizeLink, extractLinks, parseSitemapUrls, stripWww };
