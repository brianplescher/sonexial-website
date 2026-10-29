const cheerio = require('cheerio');
const {
    safeFetch,
    analyzeHtml: analyzeAuthorHtml,
    analyzeFiles,
    isCanonicalCorrect,
    SCORE_WEIGHTS,
    THIN_CONTENT_WORDS
} = require('./scanner');

const SMB_SCHEMA_TYPES = new Set([
    'Organization',
    'Corporation',
    'LocalBusiness',
    'ProfessionalService',
    'LegalService',
    'Attorney',
    'AccountingService',
    'FinancialService',
    'MedicalBusiness',
    'MedicalClinic',
    'Dentist',
    'Physician',
    'HealthAndBeautyBusiness',
    'DaySpa',
    'HomeAndConstructionBusiness',
    'HVACBusiness',
    'Plumber',
    'Electrician',
    'GeneralContractor',
    'RealEstateAgent',
    'Store',
    'SoftwareApplication'
]);

const SMB_OFFER_TYPES = new Set([
    'Service',
    'Product',
    'Offer',
    'AggregateOffer',
    'Course',
    'ConsultingService'
]);

const SMB_ENTITY_DOMAINS = [
    { key: 'linkedin', domains: ['linkedin.com'] },
    { key: 'google_maps', domains: ['google.com', 'goo.gl', 'g.page'] },
    { key: 'yelp', domains: ['yelp.com'] },
    { key: 'bbb', domains: ['bbb.org'] },
    { key: 'trustpilot', domains: ['trustpilot.com'] },
    { key: 'clutch', domains: ['clutch.co'] },
    { key: 'youtube', domains: ['youtube.com', 'youtu.be'] },
    { key: 'facebook', domains: ['facebook.com'] },
    { key: 'instagram', domains: ['instagram.com'] }
];

function analyzeSmbHtml(htmlText, pageUrl) {
    const $ = cheerio.load(htmlText || '');
    const checks = {};
    const points = {};
    const critical_failures = [];
    const recommendations = [];

    let hasOrgOrLocal = false;
    let hasServiceOrProduct = false;
    let hasFaq = false;
    let hasPerson = false;
    const detectedSchemaTypes = new Set();
    const sameAsUrls = new Set();

    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const data = JSON.parse($(el).text());
            function walk(obj) {
                if (!obj) return;
                if (Array.isArray(obj)) {
                    obj.forEach(walk);
                } else if (typeof obj === 'object') {
                    if (obj['@type']) {
                        const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
                        for (const t of types) {
                            const clean = String(t).replace(/^https?:\/\/schema\.org\//i, '');
                            detectedSchemaTypes.add(clean);
                            if (SMB_SCHEMA_TYPES.has(clean)) hasOrgOrLocal = true;
                            if (SMB_OFFER_TYPES.has(clean)) hasServiceOrProduct = true;
                            if (clean === 'FAQPage') hasFaq = true;
                            if (clean === 'Person') hasPerson = true;
                        }
                    }
                    if (obj.sameAs) {
                        const refs = Array.isArray(obj.sameAs) ? obj.sameAs : [obj.sameAs];
                        refs.filter(r => typeof r === 'string' && r.trim())
                            .forEach(r => sameAsUrls.add(r.trim().toLowerCase()));
                    }
                    if (obj.hasOfferCatalog || obj.makesOffer || obj.areaServed) {
                        hasServiceOrProduct = true;
                    }
                    Object.values(obj).forEach(v => {
                        if (v && typeof v === 'object') walk(v);
                    });
                }
            }
            walk(data);
        } catch {
            // Ignore malformed JSON-LD
        }
    });

    checks.schema_markup = {
        organization_or_local: hasOrgOrLocal,
        service_or_product: hasServiceOrProduct,
        faq: hasFaq,
        person: hasPerson,
        detected_types: [...detectedSchemaTypes]
    };
    checks.sameas_count = sameAsUrls.size;

    if (hasOrgOrLocal && (hasServiceOrProduct || hasFaq)) {
        points.schema = SCORE_WEIGHTS.schema;
    } else if (hasOrgOrLocal || hasServiceOrProduct || hasPerson) {
        points.schema = 12;
    } else {
        points.schema = 0;
        critical_failures.push('No Organization, LocalBusiness, or Service JSON-LD schema found on the page.');
    }

    if (!hasOrgOrLocal) {
        recommendations.push('Add Organization or LocalBusiness JSON-LD with verified business identity, areaServed, and credentials.');
    }
    if (!hasServiceOrProduct) {
        recommendations.push('Add Service or OfferCatalog JSON-LD so AI search systems can parse your core offerings and pricing/scope.');
    }
    if (!hasFaq) {
        recommendations.push('Add FAQPage JSON-LD answering common buyer questions directly on high-intent service pages.');
    }
    if (!sameAsUrls.size) {
        recommendations.push('Add sameAs URLs inside your JSON-LD linking to LinkedIn, Google Business Profile, BBB, or industry directories.');
    }

    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    checks.semantic_html = { h1_count: h1Count, h2_count: h2Count };
    points.headings = h1Count === 1 ? (h2Count ? SCORE_WEIGHTS.headings : 10) : (h1Count > 1 ? 5 : 0);
    if (h1Count === 0) {
        critical_failures.push('No H1 heading found on the scanned page.');
        recommendations.push('Add a single clear H1 heading stating what the business does and who it serves.');
    } else if (h1Count > 1) {
        recommendations.push(`Consolidate ${h1Count} H1 tags into one primary H1 heading and structure sections with H2/H3 tags.`);
    } else if (h2Count === 0) {
        recommendations.push('Add descriptive H2 headings for services, proof/credentials, and FAQs.');
    }

    const hosts = new Set();
    let hasTel = false;
    let hasMailto = false;
    $('a[href]').each((_, el) => {
        const raw = ($(el).attr('href') || '').trim();
        if (raw.toLowerCase().startsWith('tel:')) hasTel = true;
        if (raw.toLowerCase().startsWith('mailto:')) hasMailto = true;
        try {
            const u = new URL(raw, pageUrl || 'https://example.invalid/');
            if (['http:', 'https:'].includes(u.protocol)) {
                hosts.add(u.hostname.toLowerCase());
            }
        } catch {
            // ignore
        }
    });

    const isHost = (host, domain) => host === domain || host.endsWith('.' + domain);
    const foundProfiles = {};
    for (const item of SMB_ENTITY_DOMAINS) {
        foundProfiles[item.key] = [...hosts].some(h => item.domains.some(d => isHost(h, d)));
    }
    const profileCount = Object.values(foundProfiles).filter(Boolean).length;

    checks.entity_links = {
        ...foundProfiles,
        has_phone_link: hasTel,
        has_email_link: hasMailto,
        verified_profile_count: profileCount
    };

    if (profileCount >= 2 || (profileCount >= 1 && (hasTel || hasMailto))) {
        points.entity_links = SCORE_WEIGHTS.entity_links;
    } else if (profileCount >= 1 || hasTel || hasMailto) {
        points.entity_links = 5;
    } else {
        points.entity_links = 0;
        recommendations.push('Link to official external entity profiles (LinkedIn, Google Business, BBB, Clutch) and include machine-readable contact links.');
    }

    const ogFields = new Set();
    $('meta[property]').each((_, el) => {
        const prop = ($(el).attr('property') || '').trim().toLowerCase();
        const content = ($(el).attr('content') || '').trim();
        if (content) ogFields.add(prop);
    });
    const essentialOg = ['og:title', 'og:description', 'og:image'];
    const presentOg = essentialOg.filter(f => ogFields.has(f)).length;
    checks.open_graph = presentOg === essentialOg.length;
    points.open_graph = checks.open_graph ? SCORE_WEIGHTS.open_graph : (presentOg ? 5 : 0);
    if (!checks.open_graph) {
        recommendations.push('Add complete og:title, og:description, and og:image tags for accurate link previews.');
    }

    const canonicalHref = $('link[rel="canonical"]').first().attr('href');
    checks.canonical_correct = isCanonicalCorrect(canonicalHref, pageUrl);
    points.canonical = checks.canonical_correct ? SCORE_WEIGHTS.canonical : 0;
    if (!canonicalHref) {
        recommendations.push('Add a self-referencing canonical URL on the page.');
    } else if (!checks.canonical_correct) {
        recommendations.push('Fix the canonical tag so it resolves to this exact page URL.');
    }

    const bodyText = $('body').clone().find('script, style, noscript, template').remove().end().text();
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    checks.word_count = wordCount;
    checks.thin_content_flag = wordCount < THIN_CONTENT_WORDS;
    points.content = wordCount >= THIN_CONTENT_WORDS ? SCORE_WEIGHTS.content : (wordCount >= 150 ? 5 : 0);
    if (checks.thin_content_flag) {
        recommendations.push('Expand on-page copy with clear, factual descriptions of services, service areas, credentials, and buyer FAQs.');
    }

    return {
        score: Object.values(points).reduce((a, b) => a + b, 0),
        score_breakdown: points,
        checks,
        critical_failures,
        recommendations
    };
}

async function runMultiModeScan(urlInput, { mode = 'smb' } = {}) {
    const startTime = Date.now();
    let urlToScan = String(urlInput || '').trim();
    if (!/^https?:\/\//i.test(urlToScan)) urlToScan = 'https://' + urlToScan;

    const parsedUrl = new URL(urlToScan);
    const origin = parsedUrl.origin;

    const [htmlRes, llmsRes, robotsRes, sitemapRes] = await Promise.all([
        safeFetch(urlToScan),
        safeFetch(`${origin}/llms.txt`),
        safeFetch(`${origin}/robots.txt`),
        safeFetch(`${origin}/sitemap.xml`)
    ]);

    if (!htmlRes.ok) {
        throw new Error(`Unable to reach ${urlToScan} (${htmlRes.error || `HTTP ${htmlRes.status}`})`);
    }

    const analyzedPageUrl = htmlRes.url || urlToScan;
    const resolvedMode = mode === 'author' ? 'author' : 'smb';
    const htmlAnalysis = resolvedMode === 'smb'
        ? analyzeSmbHtml(htmlRes.text, analyzedPageUrl)
        : analyzeAuthorHtml(htmlRes.text, analyzedPageUrl);

    const fileAnalysis = analyzeFiles(llmsRes, robotsRes, sitemapRes, analyzedPageUrl);

    const rawScore = htmlAnalysis.score + fileAnalysis.score;
    const totalScore = Math.max(0, Math.min(100, rawScore));

    let grade = 'D (Limited Signals)';
    if (totalScore >= 85) grade = 'A (Strong Foundations)';
    else if (totalScore >= 70) grade = 'B (Good, Some Gaps)';
    else if (totalScore >= 50) grade = 'C (Major Gaps)';

    return {
        url: urlToScan,
        mode: resolvedMode,
        status: 'success',
        score: totalScore,
        geo_grade: grade,
        scoring_model: resolvedMode === 'smb' ? 'smb-technical-readiness-v1' : 'technical-readiness-v2',
        score_breakdown: { ...htmlAnalysis.score_breakdown, ...fileAnalysis.score_breakdown },
        execution_time: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        checks: { ...htmlAnalysis.checks, ...fileAnalysis.checks },
        critical_failures: [...htmlAnalysis.critical_failures, ...fileAnalysis.critical_failures],
        recommendations: [...htmlAnalysis.recommendations, ...fileAnalysis.recommendations]
    };
}

module.exports = {
    analyzeSmbHtml,
    runMultiModeScan,
    SMB_SCHEMA_TYPES,
    SMB_OFFER_TYPES
};
