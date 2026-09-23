const dns = require('dns').promises;
const cheerio = require('cheerio');

// Sanitize a value before logging
function sanitizeLog(val) {
    return String(val).replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').slice(0, 200);
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

            const text = await res.text();
            return {
                ok: res.ok,
                status: res.status,
                text: text || '',
                error: null
            };
        }

        return { ok: false, status: 0, text: '', error: 'Too many redirects' };
    } catch (err) {
        return {
            ok: false,
            status: 0,
            text: '',
            error: err.message
        };
    }
}

/**
 * Analyzes target page HTML for schema, headings, entity connectivity, and Open Graph tags.
 */
function analyzeHtml(htmlText) {
    const $ = cheerio.load(htmlText || '');
    const checks = {};
    let score = 0;
    const critical_failures = [];
    const recommendations = [];

    // 1. JSON-LD Schema (Book, Person, FAQPage)
    let hasBook = false;
    let hasPerson = false;
    let hasFaq = false;

    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const content = $(el).text();
            const data = JSON.parse(content);
            const items = [];

            function extractTypes(obj) {
                if (!obj) return;
                if (Array.isArray(obj)) {
                    obj.forEach(extractTypes);
                } else if (typeof obj === 'object') {
                    if (obj['@type']) {
                        const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
                        items.push(...types);
                    }
                    if (obj['@graph']) {
                        extractTypes(obj['@graph']);
                    }
                }
            }

            extractTypes(data);

            if (items.includes('Book')) hasBook = true;
            if (items.includes('Person')) hasPerson = true;
            if (items.includes('FAQPage')) hasFaq = true;
        } catch {
            // Invalid JSON in schema tag
        }
    });

    checks.schema_markup = { book: hasBook, person: hasPerson, faq: hasFaq };

    if (hasBook && hasPerson) {
        score += 30;
    } else if (hasBook || hasPerson) {
        score += 15;
        recommendations.push("Missing complete Author/Book entity mapping in JSON-LD Schema.");
    } else {
        critical_failures.push("Missing core JSON-LD Schema (Person/Book).");
        recommendations.push("Add 'Person' and 'Book' JSON-LD schema to define your author entity for AI discovery.");
    }

    // 2. Semantic HTML Hierarchy
    const h1Tags = $('h1');
    const h2Tags = $('h2');
    const h1Count = h1Tags.length;
    const h2Count = h2Tags.length;

    checks.semantic_html = { h1_count: h1Count, h2_count: h2Count };

    if (h1Count === 1 && h2Count > 0) {
        score += 15;
    } else if (h1Count === 0) {
        critical_failures.push("Missing H1 heading. Semantic hierarchy requires exactly one H1.");
        recommendations.push("Add a single H1 tag defining your primary author entity or book.");
    } else if (h1Count > 1) {
        critical_failures.push("Multiple H1 headings detected. Semantic hierarchy requires exactly one H1.");
        recommendations.push("Consolidate multiple H1 tags into a single H1 so AI crawlers parse your core topic correctly.");
    } else {
        recommendations.push("Add H2 subheadings to organize your content hierarchy for AI crawler comprehension.");
    }

    // 3. Entity Connectivity (Amazon, Goodreads, BookBub)
    const links = [];
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) links.push(href.toLowerCase());
    });

    const hasAmazon = links.some(l => l.includes('amazon.') || l.includes('amzn.to'));
    const hasGoodreads = links.some(l => l.includes('goodreads.com'));
    const hasBookbub = links.some(l => l.includes('bookbub.com'));

    checks.entity_links = { amazon: hasAmazon, goodreads: hasGoodreads, bookbub: hasBookbub };

    if (hasAmazon || hasGoodreads || hasBookbub) {
        score += 15;
    } else {
        recommendations.push("Add outbound entity links to Amazon, Goodreads, or BookBub to connect your knowledge graph.");
    }

    // 4. Open Graph / Meta Tags
    let ogCount = 0;
    $('meta').each((_, el) => {
        const prop = $(el).attr('property') || $(el).attr('name') || '';
        if (prop.toLowerCase().startsWith('og:')) {
            ogCount++;
        }
    });

    checks.open_graph = ogCount >= 3;
    if (ogCount >= 3) {
        score += 10;
    } else {
        recommendations.push("Add Open Graph meta tags (og:title, og:description, og:image) for rich AI and social previews.");
    }

    return { score, checks, critical_failures, recommendations };
}

/**
 * Analyzes llms.txt and robots.txt (AI bot rules for GPTBot, ClaudeBot, PerplexityBot, Anthropic-ai).
 */
function analyzeFiles(llmsRes, robotsRes) {
    let score = 0;
    const checks = {};
    const critical_failures = [];
    const recommendations = [];

    // llms.txt Check
    if (llmsRes && llmsRes.ok && llmsRes.text && llmsRes.text.length > 50) {
        checks.llms_txt = true;
        score += 20;
    } else {
        checks.llms_txt = false;
        critical_failures.push("Missing llms.txt AI roadmap file.");
        recommendations.push("Create an llms.txt file to guide AI crawlers (ChatGPT, Claude, Perplexity) directly to your key author data.");
    }

    // robots.txt AI Bot Check
    const blockedBots = [];
    const allowedBots = [];
    let hasExplicitAiRules = false;

    if (robotsRes && robotsRes.ok && robotsRes.text) {
        const content = robotsRes.text;
        const lines = content.split('\n').map(l => l.trim());
        const aiBots = ['gptbot', 'claudebot', 'perplexitybot', 'anthropic-ai', 'google-extended'];

        let currentUserAgents = [];
        const botDirectives = {};

        for (const line of lines) {
            if (!line || line.startsWith('#')) continue;

            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) continue;

            const key = line.slice(0, colonIdx).trim().toLowerCase();
            const val = line.slice(colonIdx + 1).trim().toLowerCase();

            if (key === 'user-agent') {
                currentUserAgents.push(val);
            } else if (key === 'disallow' || key === 'allow') {
                if (currentUserAgents.length > 0) {
                    for (const ua of currentUserAgents) {
                        if (!botDirectives[ua]) botDirectives[ua] = [];
                        botDirectives[ua].push({ action: key, path: val });
                    }
                }
            } else {
                // Other directive resets current agent group if blank line wasn't used
            }
        }

        // Check each AI bot for blocking or explicit allow
        for (const bot of aiBots) {
            const specificRules = botDirectives[bot] || [];
            const globalRules = botDirectives['*'] || [];

            if (specificRules.length > 0) {
                hasExplicitAiRules = true;
                const isBlocked = specificRules.some(r => r.action === 'disallow' && (r.path === '/' || r.path === '/*'));
                const isAllowed = specificRules.some(r => r.action === 'allow' && (r.path === '/' || r.path === '/*'));

                if (isBlocked && !isAllowed) {
                    blockedBots.push(bot);
                } else if (isAllowed) {
                    allowedBots.push(bot);
                }
            } else if (globalRules.length > 0) {
                const isBlocked = globalRules.some(r => r.action === 'disallow' && (r.path === '/' || r.path === '/*'));
                const isAllowed = globalRules.some(r => r.action === 'allow' && (r.path === '/' || r.path === '/*'));
                if (isBlocked && !isAllowed) {
                    blockedBots.push(bot);
                }
            }
        }

        checks.ai_bot_access = {
            blocked: blockedBots,
            allowed: allowedBots,
            has_explicit_ai_rules: hasExplicitAiRules
        };

        if (blockedBots.length > 0) {
            score -= 20; // Heavy penalty for blocking AI crawlers
            critical_failures.push(`CRITICAL: Blocking AI crawlers (${blockedBots.join(', ')}).`);
            recommendations.push(`Update robots.txt to permit AI discovery bots (${blockedBots.join(', ')}).`);
        } else if (hasExplicitAiRules && allowedBots.length > 0) {
            score += 10; // Explicit bonus for AI crawler optimization
        }
    } else {
        checks.ai_bot_access = {
            blocked: [],
            allowed: [],
            has_explicit_ai_rules: false
        };
        recommendations.push("Add a robots.txt file with explicit allow rules for AI bots (GPTBot, ClaudeBot, PerplexityBot).");
    }

    return { score, checks, critical_failures, recommendations };
}

/**
 * Main scanner function.
 * @param {string} inputUrl - Target URL to scan.
 * @returns {Promise<object>} GEOReport
 */
async function runScan(inputUrl) {
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

    // Concurrent fetching with Promise.all
    const [htmlRes, llmsRes, robotsRes] = await Promise.all([
        safeFetch(urlToScan),
        safeFetch(llmsUrl),
        safeFetch(robotsUrl)
    ]);

    if (!htmlRes.ok && !htmlRes.text) {
        throw new Error(`Unable to fetch website (${urlToScan}): ${htmlRes.error || `HTTP ${htmlRes.status}`}`);
    }

    // Analyze HTML
    const htmlAnalysis = analyzeHtml(htmlRes.text);

    // Analyze llms.txt & robots.txt
    const fileAnalysis = analyzeFiles(llmsRes, robotsRes);

    // Aggregate Score & Grade
    const rawScore = htmlAnalysis.score + fileAnalysis.score;
    const totalScore = Math.max(0, Math.min(100, rawScore));

    let grade = 'F (Ghost in the Machine)';
    if (totalScore >= 80) grade = 'A (AI-Ready)';
    else if (totalScore >= 60) grade = 'B (Needs Tuning)';
    else if (totalScore >= 40) grade = 'C (Invisible to AI)';

    const executionTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

    return {
        url: urlToScan,
        status: 'success',
        score: totalScore,
        geo_grade: grade,
        execution_time: executionTime,
        checks: {
            ...htmlAnalysis.checks,
            ...fileAnalysis.checks
        },
        critical_failures: [...htmlAnalysis.critical_failures, ...fileAnalysis.critical_failures],
        recommendations: [...htmlAnalysis.recommendations, ...fileAnalysis.recommendations]
    };
}

module.exports = {
    runScan,
    validateSSRF,
    isPrivateOrReservedIP
};
