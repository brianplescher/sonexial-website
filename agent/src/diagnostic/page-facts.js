const cheerio = require('cheerio');

const PROFILE_PATTERNS = {
    amazon_author: /amazon\.[a-z.]+\/(stores\/|author\/|.*\/e\/|-\/e\/)/i,
    amazon: /(amazon\.[a-z.]+|amzn\.to)/i,
    goodreads: /goodreads\.com/i,
    bookbub: /bookbub\.com/i,
    wikipedia: /wikipedia\.org/i,
    wikidata: /wikidata\.org/i,
    instagram: /instagram\.com/i,
    facebook: /facebook\.com/i,
    x_twitter: /(twitter\.com|x\.com)\//i,
    tiktok: /tiktok\.com/i,
    linkedin: /linkedin\.com/i,
    youtube: /youtube\.com|youtu\.be/i,
    substack: /substack\.com/i
};

const SEMANTIC_TAGS = ['main', 'article', 'section', 'nav', 'header', 'footer', 'aside'];

function collectJsonLd($) {
    const items = [];
    let invalid = 0;
    $('script[type="application/ld+json"]').each((_, el) => {
        let data;
        try {
            data = JSON.parse($(el).text());
        } catch {
            invalid++;
            return;
        }
        (function walk(obj) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) return obj.forEach(walk);
            if (obj['@type']) items.push(obj);
            Object.values(obj).forEach(v => {
                if (v && typeof v === 'object') walk(v);
            });
        })(data);
    });
    return { items, invalid };
}

function typesOf(item) {
    return Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
}

function asArray(v) {
    if (v === undefined || v === null) return [];
    return Array.isArray(v) ? v : [v];
}

/**
 * Extracts every fact the diagnostic checks need from one crawled page.
 */
function analyzePage(page) {
    const $ = cheerio.load(page.html || '');
    const { items, invalid } = collectJsonLd($);
    const types = new Set(items.flatMap(typesOf));
    const persons = items.filter(i => typesOf(i).includes('Person'));
    const books = items.filter(i => typesOf(i).some(t => t === 'Book' || t === 'BookSeries'));
    const sameAs = new Set(items.flatMap(i => asArray(i.sameAs)).filter(s => typeof s === 'string'));

    const outbound = [];
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (/^https?:\/\//i.test(href)) outbound.push(href);
    });

    const og = {};
    $('meta[property^="og:"]').each((_, el) => {
        og[$(el).attr('property').toLowerCase()] = $(el).attr('content') || '';
    });

    const metaRobots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
    const xRobots = (page.headers?.xRobotsTag || '').toLowerCase();

    const body = $('body').clone();
    body.find('script, style, noscript, template, svg').remove();
    const text = body.text().replace(/\s+/g, ' ').trim();
    const wordCount = text ? text.split(' ').length : 0;

    const images = $('img');
    let imgMissingAlt = 0;
    images.each((_, el) => {
        if ($(el).attr('alt') === undefined) imgMissingAlt++;
    });

    const isHttps = (page.finalUrl || page.url).startsWith('https://');
    let mixedContent = 0;
    if (isHttps) {
        $('img[src], script[src], link[href][rel="stylesheet"], iframe[src], source[src]').each((_, el) => {
            const ref = $(el).attr('src') || $(el).attr('href') || '';
            if (ref.startsWith('http://')) mixedContent++;
        });
    }

    const semanticTagCount = SEMANTIC_TAGS.reduce((n, t) => n + $(t).length, 0);
    const scriptCount = $('script[src]').length + $('script:not([src]):not([type="application/ld+json"])').length;
    const appShell = $('#root, #__next, #app, [data-reactroot]').length > 0;

    const lastModified = page.headers?.lastModified ? new Date(page.headers.lastModified) : null;

    return {
        url: page.url,
        status: page.status,
        title: $('title').first().text().trim(),
        metaDescription: ($('meta[name="description"]').attr('content') || '').trim(),
        h1s: $('h1').map((_, el) => $(el).text().trim()).get(),
        h2Count: $('h2').length,
        canonical: $('link[rel="canonical"]').first().attr('href') || '',
        noindex: metaRobots.includes('noindex') || xRobots.includes('noindex'),
        hasViewport: $('meta[name="viewport"]').length > 0,
        lang: $('html').attr('lang') || '',
        wordCount,
        imageCount: images.length,
        imgMissingAlt,
        mixedContent,
        semanticTagCount,
        hasMainOrArticle: $('main, article').length > 0,
        scriptCount,
        appShell,
        jsonLdTypes: [...types],
        invalidJsonLd: invalid,
        persons: persons.map(p => ({ name: p.name || '', sameAs: asArray(p.sameAs), url: p.url || '' })),
        books: books.map(b => ({
            name: b.name || '',
            hasAuthor: Boolean(b.author),
            hasIsbn: Boolean(b.isbn || asArray(b.workExample).some(w => w && w.isbn)),
            hasImage: Boolean(b.image),
            hasSameAs: asArray(b.sameAs).length > 0 || Boolean(b.url)
        })),
        sameAs: [...sameAs],
        outbound,
        og,
        lastModified: lastModified && !isNaN(lastModified) ? lastModified.toISOString() : null
    };
}

/**
 * Classifies profile URLs (from sameAs and outbound links) into known author platforms.
 */
function detectProfiles(urls) {
    const found = {};
    for (const url of urls) {
        for (const [key, re] of Object.entries(PROFILE_PATTERNS)) {
            if (re.test(url) && !found[key]) found[key] = url;
        }
    }
    return found;
}

module.exports = { analyzePage, detectProfiles, PROFILE_PATTERNS };
