const dnsCallback = require('dns');
const dns = dnsCallback.promises;
const cheerio = require('cheerio');
const { Agent, fetch } = require('undici');

// Pages below this word count are flagged as thin: too little text for an AI engine to quote.
const THIN_CONTENT_WORDS = 300;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

// AI crawlers whose robots.txt access is reported by the scanner.
// Bots used for search discovery. Training controls (GPTBot, ClaudeBot,
// Google-Extended) are independent from search inclusion and do not belong here.
const AI_BOTS = ['oai-searchbot', 'claude-searchbot', 'perplexitybot'];

// Versioned, heuristic weights for observable *technical* readiness, not
// likelihood of being cited or recommended by any particular AI product.
const SCORE_WEIGHTS = Object.freeze({
    schema: 25,
    headings: 15,
    entity_links: 10,
    open_graph: 10,
    canonical: 15,
    content: 10,
    bot_access: 10,
    sitemap: 5
});

// Sanitize a value before logging
function sanitizeLog(val) {
    return String(val).replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').slice(0, 200);
}

/**
 * A canonical tag is correct when it resolves and points at the same host as the page it sits on.
 */
function isCanonicalCorrect(canonicalHref, pageUrl) {
    if (!canonicalHref || !pageUrl) return false;

    const stripWww = host => host.replace(/^www\./, '');
    const normalizedPath = pathname => {
        const withoutIndex = pathname.replace(/\/index\.html$/i, '/');
        return withoutIndex.replace(/\/+$/, '') || '/';
    };

    try {
        const canonical = new URL(canonicalHref, pageUrl);
        const page = new URL(pageUrl);
        return ['http:', 'https:'].includes(canonical.protocol) &&
            stripWww(canonical.hostname.toLowerCase()) === stripWww(page.hostname.toLowerCase()) &&
            normalizedPath(canonical.pathname) === normalizedPath(page.pathname);
    } catch {
        return false;
    }
}

/**
 * Checks if an IPv4 address is in a private, loopback, or reserved range.
 */
function isPrivateIPv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) {
        return true; // Malformed -> treat as unsafe
    }
    const [a, b, c, d] = parts;

    // 0.0.0.0/8 (current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (private)
    if (a === 10) return true;
    // 100.64.0.0/10 (carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local, cloud metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 (IETF protocol assignments)
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;
    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 (benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;
    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;
    // 224.0.0.0/4 (multicast)
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 (reserved) & 255.255.255.255 (broadcast)
    if (a >= 240) return true;

    return false;
}

/**
 * Checks if an IPv6 address is in a private, loopback, or reserved range.
 */
function isPrivateIPv6(ip) {
    const normalized = ip.toLowerCase().trim();

    // Loopback & unspecified
    if (normalized === '::1' || normalized === '::' || normalized === '0:0:0:0:0:0:0:1' || normalized === '0:0:0:0:0:0:0:0') {
        return true;
    }

    // IPv4-mapped IPv6 address (::ffff:x.x.x.x)
    if (normalized.startsWith('::ffff:')) {
        const v4Part = normalized.slice(7);
        return isPrivateIPv4(v4Part);
    }

    // Unique Local (fc00::/7 -> starts with fc or fd)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
        return true;
    }

    // Link-local (fe80::/10 -> starts with fe8, fe9, fea, feb)
    if (/^fe[89ab]/i.test(normalized)) {
        return true;
    }

    // Documentation (2001:db8::/32)
    if (normalized.startsWith('2001:db8') || normalized.startsWith('2001:0db8')) {
        return true;
    }

    // Multicast (ff00::/8)
    if (normalized.startsWith('ff')) {
        return true;
    }

    return false;
}

/**
 * Validates a target IP address for SSRF protection.
 */
function isPrivateOrReservedIP(ip) {
    if (ip.includes(':')) {
        return isPrivateIPv6(ip);
    }
    return isPrivateIPv4(ip);
}

/**
 * Validates a URL and resolves DNS to ensure it is not targeting internal or private infrastructure.
 */
async function validateSSRF(urlString) {
    let parsedUrl;
    try {
        parsedUrl = new URL(urlString);
    } catch {
        throw new Error(`Invalid URL format: ${sanitizeLog(urlString)}`);
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error(`Forbidden protocol: ${parsedUrl.protocol}. Only http and https are permitted.`);
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Explicit blocklist for common loopback and metadata names
    if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname === 'metadata.google.internal' ||
        hostname === 'instance-data'
    ) {
        throw new Error(`SSRF validation failed: Access to ${hostname} is blocked.`);
    }

    // Resolve hostname to IP addresses
    let addresses;
    try {
        addresses = await dns.lookup(hostname, { all: true });
    } catch (err) {
        throw new Error(`DNS resolution failed for hostname ${hostname}: ${err.message}`);
    }

    if (!addresses || addresses.length === 0) {
        throw new Error(`No IP addresses found for hostname: ${hostname}`);
    }

    for (const record of addresses) {
        if (isPrivateOrReservedIP(record.address)) {
            throw new Error(`SSRF validation failed: Hostname ${hostname} resolved to restricted IP ${record.address}.`);
        }
    }

    return parsedUrl;
}

/**
 * Socket-level DNS lookup that rejects private/reserved addresses, so the IP actually connected to
 * is the one validated (closes the DNS-rebinding gap between validateSSRF and the fetch).
 */
function guardedLookup(hostname, options, callback) {
    dnsCallback.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err);
        const blocked = addresses.find(record => isPrivateOrReservedIP(record.address));
        if (blocked) {
            return callback(new Error(`SSRF validation failed: Hostname ${hostname} resolved to restricted IP ${blocked.address}.`));
        }
        if (options.all) return callback(null, addresses);
        callback(null, addresses[0].address, addresses[0].family);
    });
}

const ssrfSafeAgent = new Agent({ connect: { lookup: guardedLookup } });

async function readLimitedResponseText(response, maxBytes = MAX_RESPONSE_BYTES) {
    const contentLength = Number(response.headers.get('content-length'));
    if (contentLength > maxBytes) {
        await response.body?.cancel();
        throw new Error(`Upstream response exceeds the ${maxBytes}-byte limit.`);
    }

    if (!response.body) return '';

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            totalBytes += value.byteLength;
            if (totalBytes > maxBytes) {
                await reader.cancel().catch(() => {});
                throw new Error(`Upstream response exceeds the ${maxBytes}-byte limit.`);
            }
            chunks.push(Buffer.from(value));
        }
    } finally {
        reader.releaseLock();
    }

    return Buffer.concat(chunks, totalBytes).toString('utf8');
}

/**
 * Safe fetch wrapper with SSRF validation, 5s timeout, and secure redirect following.
 */
async function safeFetch(targetUrl, maxRedirects = 3) {
    try {
        let currentUrl = targetUrl;
        let redirectCount = 0;

        while (redirectCount <= maxRedirects) {
            // Validate URL and resolve IP before each network request (guards against redirect-based SSRF)
            const parsed = await validateSSRF(currentUrl);

            const res = await fetch(parsed.href, {
                method: 'GET',
                redirect: 'manual',
                dispatcher: ssrfSafeAgent,
                signal: AbortSignal.timeout(5000),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Sonexial GEO Scanner 1.0; +https://sonexial.com)'
                }
            });

            // Handle manual redirect following with SSRF check on destination
            if ([301, 302, 303, 307, 308].includes(res.status)) {
                const location = res.headers.get('location');
                if (!location) {
                    return { ok: false, status: res.status, text: '', error: 'Redirect missing Location header' };
                }
                currentUrl = new URL(location, currentUrl).href;
                redirectCount++;
                continue;
            }

            const text = await readLimitedResponseText(res);
            return {
                ok: res.ok,
                status: res.status,
                text: text || '',
                error: null,
                url: currentUrl,
                headers: {
                    contentType: res.headers.get('content-type') || '',
                    lastModified: res.headers.get('last-modified') || '',
                    xRobotsTag: res.headers.get('x-robots-tag') || ''
                }
            };
        }

        return { ok: false, status: 0, text: '', error: 'Too many redirects' };
    } catch (err) {
        return {
            ok: false,
            status: 0,
            text: '',
            error: err.cause?.message || err.message
        };
    }
}

/**
 * Analyzes target page HTML for schema, headings, entity connectivity, and Open Graph tags.
 * @param {string} htmlText - Raw HTML of the scanned page.
 * @param {string} [pageUrl] - URL the HTML was fetched from, used to validate the canonical tag.
 */
function analyzeHtml(htmlText, pageUrl) {
    const $ = cheerio.load(htmlText || '');
    const checks = {};
    const points = {};
    const critical_failures = [];
    const recommendations = [];

    // 1. Author/book JSON-LD provides explicit entity facts; it is not a
    // guarantee that AI systems will retrieve or recommend a book.
    let hasBook = false;
    let hasPerson = false;
    let hasFaq = false;
    const sameAsUrls = new Set();

    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const data = JSON.parse($(el).text());
            const items = [];

            function walk(obj) {
                if (!obj) return;
                if (Array.isArray(obj)) {
                    obj.forEach(walk);
                } else if (typeof obj === 'object') {
                    if (obj['@type']) {
                        const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
                        items.push(...types);
                    }
                    if (obj.sameAs) {
                        const refs = Array.isArray(obj.sameAs) ? obj.sameAs : [obj.sameAs];
                        refs.filter(r => typeof r === 'string' && r.trim())
                            .forEach(r => sameAsUrls.add(r.trim().toLowerCase()));
                    }
                    Object.values(obj).forEach(v => {
                        if (v && typeof v === 'object') walk(v);
                    });
                }
            }

            walk(data);
            if (items.includes('Book')) hasBook = true;
            if (items.includes('Person')) hasPerson = true;
            if (items.includes('FAQPage')) hasFaq = true;
        } catch {
            // Invalid JSON-LD is ignored and will not earn schema points.
        }
    });

    checks.schema_markup = { book: hasBook, person: hasPerson, faq: hasFaq };
    checks.sameas_count = sameAsUrls.size;
    points.schema = hasBook && hasPerson ? SCORE_WEIGHTS.schema :
        (hasBook || hasPerson ? 12 : 0);
    if (hasBook !== hasPerson) {
        recommendations.push('Add the missing Person or Book schema and connect the author to the books.');
    } else if (!hasBook) {
        recommendations.push('Add valid Person and Book JSON-LD to describe your author and titles explicitly.');
    }
    if (!sameAsUrls.size) {
        recommendations.push('Add relevant sameAs URLs to verified author profiles where available.');
    }

    // 2. Meaningful headings help readers and parsers understand page sections.
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    checks.semantic_html = { h1_count: h1Count, h2_count: h2Count };
    points.headings = h1Count === 1 ? (h2Count ? SCORE_WEIGHTS.headings : 10) :
        (h1Count > 1 ? 5 : 0);
    if (h1Count === 0) {
        critical_failures.push('No H1 heading found on the scanned page.');
        recommendations.push('Add a descriptive H1 heading for the main page topic.');
    } else if (h1Count > 1) {
        recommendations.push('Consider one clear top-level H1 heading and logical subheadings.');
    } else if (h2Count === 0) {
        recommendations.push('Add meaningful H2 headings if the page has distinct sections.');
    }

    // 3. Check actual URL hostnames, not substrings (which can be spoofed).
    const links = new Set();
    $('a[href]').each((_, el) => {
        try {
            const href = $(el).attr('href');
            const url = new URL(href, pageUrl || 'https://example.invalid/');
            if (['http:', 'https:'].includes(url.protocol)) links.add(url.hostname.toLowerCase());
        } catch {
            // Ignore malformed and non-HTTP links.
        }
    });
    const isHost = (host, domain) => host === domain || host.endsWith('.' + domain);
    const hasAmazon = [...links].some(h => h === 'amzn.to' || /^amazon\.[a-z.]+$/.test(h) ||
        /^[a-z0-9-]+\.amazon\.[a-z.]+$/.test(h));
    const hasGoodreads = [...links].some(h => isHost(h, 'goodreads.com'));
    const hasBookbub = [...links].some(h => isHost(h, 'bookbub.com'));
    checks.entity_links = { amazon: hasAmazon, goodreads: hasGoodreads, bookbub: hasBookbub };
    points.entity_links = hasAmazon || hasGoodreads || hasBookbub ? SCORE_WEIGHTS.entity_links : 0;
    if (!points.entity_links) {
        recommendations.push('Link to an official book listing or author profile where one exists.');
    }

    // 4. Check actual social preview fields rather than counting any three OG tags.
    const ogFields = new Set();
    $('meta[property]').each((_, el) => {
        const prop = ($(el).attr('property') || '').trim().toLowerCase();
        const content = ($(el).attr('content') || '').trim();
        if (content) ogFields.add(prop);
    });
    const essentialOg = ['og:title', 'og:description', 'og:image'];
    const presentOg = essentialOg.filter(field => ogFields.has(field)).length;
    checks.open_graph = presentOg === essentialOg.length;
    points.open_graph = checks.open_graph ? SCORE_WEIGHTS.open_graph : (presentOg ? 5 : 0);
    if (!checks.open_graph) {
        recommendations.push('Add complete og:title, og:description and og:image tags for reliable social previews.');
    }

    // 5. A canonical is useful only when it resolves to this page, not merely this domain.
    const canonicalHref = $('link[rel="canonical"]').first().attr('href');
    checks.canonical_correct = isCanonicalCorrect(canonicalHref, pageUrl);
    points.canonical = checks.canonical_correct ? SCORE_WEIGHTS.canonical : 0;
    if (!canonicalHref) {
        recommendations.push('Add a self-referencing canonical URL for the scanned page.');
    } else if (!checks.canonical_correct) {
        recommendations.push('Review the canonical URL: it should identify this page, not a different path or domain.');
    }

    // 6. Word count is a rough completeness signal, not a search-engine rule.
    const bodyText = $('body').clone().find('script, style, noscript, template').remove().end().text();
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    checks.word_count = wordCount;
    checks.thin_content_flag = wordCount < THIN_CONTENT_WORDS;
    points.content = wordCount >= THIN_CONTENT_WORDS ? SCORE_WEIGHTS.content : (wordCount >= 150 ? 5 : 0);
    if (checks.thin_content_flag) {
        recommendations.push('Review whether the page gives readers enough useful, original information about the author and books; word count alone is not a ranking rule.');
    }

    return {
        score: Object.values(points).reduce((a, b) => a + b, 0),
        score_breakdown: points, checks, critical_failures, recommendations
    };
}

/**
 * Parses robots.txt into per-user-agent directive groups.
 *
 * A group is a run of consecutive User-agent lines followed by its directives. The first
 * non-User-agent line closes the agent list, so the next User-agent line opens a new group
 * and its directives apply only to that group.
 *
 * @param {string} content - Raw robots.txt body.
 * @returns {{groups: Record<string, Array<{action: string, path: string}>>, sitemaps: string[]}}
 */
function parseRobots(content) {
    const groups = {};
    const sitemaps = [];

    let currentAgents = [];
    let collectingAgents = true;

    for (const rawLine of String(content || '').split(/\r?\n/)) {
        const line = rawLine.split('#')[0].trim();
        if (!line) continue;

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const val = line.slice(colonIdx + 1).trim();

        if (key === 'user-agent') {
            if (!collectingAgents) {
                currentAgents = [];
                collectingAgents = true;
            }
            currentAgents.push(val.toLowerCase());
            continue;
        }

        collectingAgents = false;

        if (key === 'sitemap') {
            sitemaps.push(val);
        } else if (key === 'disallow' || key === 'allow') {
            for (const agent of currentAgents) {
                if (!groups[agent]) groups[agent] = [];
                groups[agent].push({ action: key, path: val });
            }
        }
    }

    return { groups, sitemaps };
}

/**
 * Resolves whether a directive group grants a crawler access to the site root.
 * @returns {'blocked'|'allowed'|'partial'}
 */
/**
 * Resolve the specific scanned path using longest-matching robots rules.
 * Ties go to Allow. Missing rules allow crawling by default.
 * This tests published rules, not real crawler success or indexing.
 */
function evaluateRootAccess(rules, pathname = '/') {
    let winner = null;
    for (const rule of rules) {
        if (!rule.path) continue;
        const anchored = rule.path.endsWith('$');
        const pattern = anchored ? rule.path.slice(0, -1) : rule.path;
        const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '.*');
        const regex = new RegExp('^' + escaped + (anchored ? '$' : ''));
        if (!regex.test(pathname)) continue;
        const specificity = pattern.replace(/\*/g, '').length;
        if (!winner || specificity > winner.specificity ||
            (specificity === winner.specificity && rule.action === 'allow')) {
            winner = { specificity, action: rule.action };
        }
    }
    return winner && winner.action === 'disallow' ? 'blocked' : 'allowed';
}

/**
 * Analyze published access rules and discovery metadata for the scanned page.
 * llms.txt is optional and never earns points or counts as a critical failure.
 */
function analyzeFiles(llmsRes, robotsRes, sitemapRes, pageUrl = 'https://example.invalid/') {
    const checks = {};
    const points = {};
    const critical_failures = [];
    const recommendations = [];

    checks.llms_txt = Boolean(llmsRes?.ok && llmsRes.text?.trim());
    // This emerging format may help some tools but is not a search requirement.
    // Do not prescribe it as necessary for appearing in AI-generated answers.

    const blockedBots = [];
    const allowedBots = [];
    let hasExplicitAiRules = false;
    let robotsSitemaps = [];
    let status = 'unrestricted';
    let pagePath = '/';
    try {
        const page = new URL(pageUrl);
        pagePath = page.pathname + page.search;
    } catch {
        // Invalid/absent URL: assess the root.
    }

    // A missing robots.txt (404/410) does not block crawling.
    const robotsUnavailable = !robotsRes?.ok && ![404, 410].includes(robotsRes?.status);
    if (robotsUnavailable) {
        status = 'unknown';
        recommendations.push('Verify robots.txt availability; crawler access could not be assessed.');
    } else {
        const { groups, sitemaps } = parseRobots(robotsRes?.ok ? robotsRes.text : '');
        robotsSitemaps = sitemaps;
        for (const bot of AI_BOTS) {
            const specificRules = groups[bot] || [];
            const rules = specificRules.length ? specificRules : (groups['*'] || []);
            if (specificRules.length) hasExplicitAiRules = true;
            if (evaluateRootAccess(rules, pagePath) === 'blocked') blockedBots.push(bot);
            else allowedBots.push(bot);
        }
        if (blockedBots.length === AI_BOTS.length) {
            status = 'blocked';
            critical_failures.push('The scanned page is disallowed for all checked AI search crawlers in robots.txt.');
        } else if (blockedBots.length) {
            status = 'partially_blocked';
        }

        if (blockedBots.length) {
            recommendations.push('Review the robots.txt restrictions for ' + blockedBots.join(', ') +
                '. Different crawler policies may be intentional; allow search crawlers only if you want their access.');
        }
    }

    checks.ai_bot_access = {
        blocked: blockedBots,
        allowed: allowedBots,
        has_explicit_ai_rules: hasExplicitAiRules,
        checked: AI_BOTS,
        status
    };
    // Explicit Allow has no ranking bonus: the wildcard/default permission is
    // sufficient. Give partial credit when only some search bots are restricted.
    points.bot_access = status === 'unknown' ? 0 :
        Math.round(SCORE_WEIGHTS.bot_access * allowedBots.length / AI_BOTS.length);

    const sitemapBody = sitemapRes?.ok ? sitemapRes.text || '' : '';
    const servesSitemap = /<urlset\b|<sitemapindex\b/i.test(sitemapBody);
    checks.has_sitemap = servesSitemap || robotsSitemaps.length > 0;
    points.sitemap = checks.has_sitemap ? SCORE_WEIGHTS.sitemap : 0;
    if (!checks.has_sitemap) {
        recommendations.push('Publish a sitemap.xml and reference it from robots.txt to improve page discovery.');
    }

    return {
        score: Object.values(points).reduce((a, b) => a + b, 0),
        score_breakdown: points, checks, critical_failures, recommendations
    };
}

/**
 * Main scanner function.
 * @param {string} inputUrl - Target URL to scan.
 * @returns {Promise<object>} GEOReport
 */
async function runScan(inputUrl) {
    return (await scanWithContent(inputUrl)).report;
}

/**
 * Same as runScan, but also returns the fetched page HTML for follow-up analysis
 * (semantic extraction). The HTML is kept out of the report so it is never stored or sent.
 * @returns {Promise<{report: object, html: string}>}
 */
async function scanWithContent(inputUrl) {
    const startTime = Date.now();

    if (!inputUrl || typeof inputUrl !== 'string') {
        throw new Error('A valid URL is required.');
    }

    let urlToScan = inputUrl.trim();
    if (!urlToScan.includes('://')) {
        urlToScan = `https://${urlToScan}`;
    }

    // SSRF pre-check on input URL
    const parsed = await validateSSRF(urlToScan);
    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    const llmsUrl = `${baseUrl}/llms.txt`;
    const robotsUrl = `${baseUrl}/robots.txt`;
    const sitemapUrl = `${baseUrl}/sitemap.xml`;

    // Concurrent fetching with Promise.all
    const [htmlRes, llmsRes, robotsRes, sitemapRes] = await Promise.all([
        safeFetch(urlToScan),
        safeFetch(llmsUrl),
        safeFetch(robotsUrl),
        safeFetch(sitemapUrl)
    ]);

    if (!htmlRes.ok && !htmlRes.text) {
        throw new Error(`Unable to fetch website (${urlToScan}): ${htmlRes.error || `HTTP ${htmlRes.status}`}`);
    }

    // Analyze HTML
    const analyzedPageUrl = htmlRes.url || urlToScan;
    const htmlAnalysis = analyzeHtml(htmlRes.text, analyzedPageUrl);

    // Analyze llms.txt, robots.txt & sitemap.xml
    const fileAnalysis = analyzeFiles(llmsRes, robotsRes, sitemapRes, analyzedPageUrl);

    // Aggregate Score & Grade
    const rawScore = htmlAnalysis.score + fileAnalysis.score;
    const totalScore = Math.max(0, Math.min(100, rawScore));

    // Grades describe on-page technical signals, not measured AI visibility.
    let grade = 'D (Limited Signals)';
    if (totalScore >= 85) grade = 'A (Strong Foundations)';
    else if (totalScore >= 70) grade = 'B (Good, Some Gaps)';
    else if (totalScore >= 50) grade = 'C (Major Gaps)';

    const executionTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

    const report = {
        url: urlToScan,
        status: 'success',
        score: totalScore,
        geo_grade: grade,
        scoring_model: 'technical-readiness-v2',
        scoring_basis: 'Heuristic check of publicly observable technical signals; not a measure of actual AI search rankings, citations or recommendations.',
        score_breakdown: { ...htmlAnalysis.score_breakdown, ...fileAnalysis.score_breakdown },
        execution_time: executionTime,
        checks: {
            ...htmlAnalysis.checks,
            ...fileAnalysis.checks
        },
        critical_failures: [...htmlAnalysis.critical_failures, ...fileAnalysis.critical_failures],
        recommendations: [...htmlAnalysis.recommendations, ...fileAnalysis.recommendations]
    };
    return { report, html: htmlRes.text || '' };
}

module.exports = {
    runScan,
    scanWithContent,
    safeFetch,
    validateSSRF,
    guardedLookup,
    readLimitedResponseText,
    MAX_RESPONSE_BYTES,
    isPrivateOrReservedIP,
    parseRobots,
    evaluateRootAccess,
    analyzeHtml,
    analyzeFiles,
    isCanonicalCorrect,
    AI_BOTS,
    SCORE_WEIGHTS,
    THIN_CONTENT_WORDS
};
