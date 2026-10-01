const { parseRobots, evaluateRootAccess, isCanonicalCorrect, THIN_CONTENT_WORDS } = require('../scanner');
const { detectProfiles } = require('./page-facts');

// Bots that fetch pages to answer or cite in live AI search results. Blocking these removes the site from answers.
const UTILITY_PATH = /^\/(404|500|privacy|terms|cookies?|refund|legal|disclaimer)(\.html)?\/?$|-policy\/?$/i;

const SEARCH_BOTS = [
    { agent: 'oai-searchbot', label: 'OAI-SearchBot', engine: 'ChatGPT search' },
    { agent: 'chatgpt-user', label: 'ChatGPT-User', engine: 'ChatGPT browsing' },
    { agent: 'claude-searchbot', label: 'Claude-SearchBot', engine: 'Claude search' },
    { agent: 'claude-user', label: 'Claude-User', engine: 'Claude browsing' },
    { agent: 'perplexitybot', label: 'PerplexityBot', engine: 'Perplexity' },
    { agent: 'perplexity-user', label: 'Perplexity-User', engine: 'Perplexity browsing' },
    { agent: 'googlebot', label: 'Googlebot', engine: 'Google Search + AI Overviews' },
    { agent: 'bingbot', label: 'Bingbot', engine: 'Bing + Copilot (and ChatGPT web results)' }
];

// Bots that collect model-training data. Blocking them is a legitimate rights choice, so it is only a notice.
const TRAINING_BOTS = [
    { agent: 'gptbot', label: 'GPTBot', engine: 'OpenAI model training' },
    { agent: 'claudebot', label: 'ClaudeBot', engine: 'Anthropic model training' },
    { agent: 'google-extended', label: 'Google-Extended', engine: 'Gemini training/grounding' },
    { agent: 'applebot-extended', label: 'Applebot-Extended', engine: 'Apple Intelligence training' },
    { agent: 'ccbot', label: 'CCBot', engine: 'Common Crawl (feeds many models)' }
];

const SEVERITY_WEIGHT = { error: 3, warning: 2, notice: 1 };
const STALE_DAYS = 365;
const LONG_CONTENT_WORDS = 5000;
const MAX_CLICK_DEPTH = 3;

function botAccess(groups, agent) {
    const rules = groups[agent] && groups[agent].length ? groups[agent] : (groups['*'] || []);
    if (!rules.length) return 'allowed';
    const access = evaluateRootAccess(rules);
    return access === 'blocked' ? 'blocked' : 'allowed';
}

function evaluateBots(robotsRes) {
    const groups = robotsRes && robotsRes.ok ? parseRobots(robotsRes.text).groups : {};
    const sitemaps = robotsRes && robotsRes.ok ? parseRobots(robotsRes.text).sitemaps : [];
    const rows = [
        ...SEARCH_BOTS.map(b => ({ ...b, kind: 'search', access: botAccess(groups, b.agent) })),
        ...TRAINING_BOTS.map(b => ({ ...b, kind: 'training', access: botAccess(groups, b.agent) }))
    ];
    return { rows, sitemaps };
}

/**
 * Impact (1-5) vs effort (1-5) quadrant, the same framing a developer uses to sequence work.
 */
function quadrant(impact, effort) {
    if (impact >= 3 && effort <= 2) return 'Quick win';
    if (impact >= 3) return 'Major project';
    if (effort <= 2) return 'Fill-in';
    return 'Deprioritize';
}

function priorityScore(issue) {
    return Math.round((issue.impact * SEVERITY_WEIGHT[issue.severity] * 10) / issue.effort);
}

function finalize(issue) {
    return { ...issue, quadrant: quadrant(issue.impact, issue.effort), priority: priorityScore(issue) };
}

function llmsTxtProblems(text) {
    const problems = [];
    if (!/^#\s+\S/m.test(text)) problems.push('no "# Title" heading on the first line');
    if (!/^>\s+\S/m.test(text)) problems.push('no "> summary" blockquote describing who you are');
    if (!/\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(text)) problems.push('no markdown links to your key pages');
    return problems;
}

function groupDuplicates(facts, key) {
    const map = new Map();
    for (const f of facts) {
        const v = (f[key] || '').trim().toLowerCase();
        if (!v) continue;
        if (!map.has(v)) map.set(v, []);
        map.get(v).push(f.url);
    }
    return [...map.values()].filter(urls => urls.length > 1).flat();
}

/**
 * Turns crawl data and per-page facts into the prioritized issue list.
 */
function buildIssues(crawl, facts, now = new Date()) {
    const issues = [];
    const add = (issue, pages = []) => issues.push(finalize({ ...issue, pages }));
    const ok = facts.filter(f => f.status >= 200 && f.status < 300);
    // Error and legal pages are expected to be short, unlisted, and plain; content checks skip them.
    const content = ok.filter(f => !UTILITY_PATH.test(new URL(f.url).pathname));
    const homepage = facts.find(f => f.url === crawl.homepage) || ok[0];
    const bots = evaluateBots(crawl.robotsRes);

    // --- AI crawler access ---
    const blockedSearch = bots.rows.filter(b => b.kind === 'search' && b.access === 'blocked');
    if (blockedSearch.length) {
        add({
            id: 'ai_search_bot_blocked', category: 'AI access', severity: 'error', impact: 5, effort: 1,
            title: `robots.txt blocks ${blockedSearch.length} AI search crawler(s): ${blockedSearch.map(b => b.label).join(', ')}`,
            why: 'These crawlers fetch pages at answer time. When they are blocked, the engine cannot read or cite your site, so it answers questions about you and your books from third-party pages instead.',
            fix: `Remove the Disallow rules for ${blockedSearch.map(b => b.label).join(', ')} or add an explicit "Allow: /" group for each (see the ready-to-paste robots.txt block).`
        });
    }
    const blockedTraining = bots.rows.filter(b => b.kind === 'training' && b.access === 'blocked');
    if (blockedTraining.length) {
        add({
            id: 'ai_training_bot_blocked', category: 'AI access', severity: 'notice', impact: 2, effort: 1,
            title: `Model-training crawlers blocked: ${blockedTraining.map(b => b.label).join(', ')}`,
            why: 'Blocking training crawlers is a legitimate rights decision. The trade-off is that future model versions learn less about you from your own site, so their built-in knowledge leans on retailer and review pages.',
            fix: 'Keep the block if protecting your text matters more than baseline model awareness; otherwise allow them. Either way, keep the search crawlers above allowed.'
        });
    }
    if (!crawl.robotsRes || !crawl.robotsRes.ok) {
        add({
            id: 'robots_missing', category: 'AI access', severity: 'warning', impact: 2, effort: 1,
            title: 'No robots.txt file',
            why: 'Crawlers treat a missing robots.txt as "allow everything", but you lose the one place that tells every crawler where your sitemap lives and that AI search bots are welcome.',
            fix: 'Publish the ready-to-paste robots.txt below at /robots.txt.'
        });
    }
    if (!crawl.llmsRes || !crawl.llmsRes.ok || (crawl.llmsRes.text || '').length < 50) {
        add({
            id: 'llms_txt_missing', category: 'AI access', severity: 'warning', impact: 3, effort: 1,
            title: 'No llms.txt file',
            why: 'llms.txt is a proposed plain-text map that tells AI systems who you are and which pages matter. It is cheap to add and removes guesswork about which page is canonical for you and each book.',
            fix: 'Publish the drafted llms.txt below at /llms.txt and keep it updated when you release a book.'
        });
    } else {
        const problems = llmsTxtProblems(crawl.llmsRes.text);
        if (problems.length) {
            add({
                id: 'llms_txt_malformed', category: 'AI access', severity: 'notice', impact: 2, effort: 1,
                title: `llms.txt does not follow the spec: ${problems.join('; ')}`,
                why: 'Tools that parse llms.txt expect a title, a one-line summary, and linked sections. A free-form file is read as unstructured text.',
                fix: 'Restructure it to match the drafted llms.txt below.'
            });
        }
    }

    // --- Entity & schema ---
    const allPersons = ok.flatMap(f => f.persons);
    const allBooks = ok.flatMap(f => f.books);
    const allSameAs = [...new Set(allPersons.flatMap(p => p.sameAs))];
    const profiles = detectProfiles([...allSameAs, ...ok.flatMap(f => f.outbound)]);

    if (!allPersons.length) {
        add({
            id: 'person_schema_missing', category: 'Entity & schema', severity: 'error', impact: 5, effort: 2,
            title: 'No Person schema anywhere on the site',
            why: 'Person JSON-LD is how you tell machines "this site is the official home of this author" and connect it to your Amazon, Goodreads, and social profiles. Without it, AI engines have to guess which pages about you are authoritative.',
            fix: 'Add the drafted Person JSON-LD below to your homepage and About page.'
        }, homepage ? [homepage.url] : []);
    } else if (allSameAs.length < 3) {
        add({
            id: 'sameas_thin', category: 'Entity & schema', severity: 'warning', impact: 4, effort: 1,
            title: `Person schema links only ${allSameAs.length} external profile(s) via sameAs`,
            why: 'sameAs links are what let an engine merge your site, Amazon author page, Goodreads, and socials into one entity. Fewer than three makes it easy to confuse you with someone of the same name.',
            fix: 'Extend sameAs with every official profile (the drafted Person JSON-LD lists the ones found on your site).'
        });
    }
    if (!allBooks.length) {
        add({
            id: 'book_schema_missing', category: 'Entity & schema', severity: 'error', impact: 4, effort: 2,
            title: 'No Book schema anywhere on the site',
            why: 'Book JSON-LD states the title, author, ISBN, and where to buy. It is what makes your site the citable source when someone asks an AI "what books has this author written?"',
            fix: 'Add a Book JSON-LD block to each book page (template below), including ISBN and retailer links in sameAs.'
        });
    } else {
        const incomplete = ok.filter(f => f.books.some(b => !b.hasAuthor || !b.hasIsbn || !b.hasImage));
        if (incomplete.length) {
            add({
                id: 'book_schema_incomplete', category: 'Entity & schema', severity: 'warning', impact: 3, effort: 2,
                title: 'Book schema is missing author, ISBN, or cover image',
                why: 'An incomplete Book block cannot be matched to the edition on Amazon or Goodreads, so engines treat it as a weak, unverified claim.',
                fix: 'Fill author (linked to your Person @id), isbn, and image on every Book block.'
            }, incomplete.map(f => f.url));
        }
    }
    const invalidJson = ok.filter(f => f.invalidJsonLd > 0);
    if (invalidJson.length) {
        add({
            id: 'jsonld_invalid', category: 'Entity & schema', severity: 'error', impact: 4, effort: 1,
            title: 'JSON-LD blocks that fail to parse',
            why: 'A syntax error makes the whole block invisible to every parser. The markup you paid for is doing nothing.',
            fix: 'Run the block through validator.schema.org and fix the JSON syntax (usually a trailing comma or smart quotes).'
        }, invalidJson.map(f => f.url));
    }
    const retailer = ['amazon', 'goodreads', 'bookbub'].filter(k => profiles[k]);
    if (retailer.length < 2) {
        add({
            id: 'retailer_links_thin', category: 'Entity & schema', severity: 'warning', impact: 3, effort: 1,
            title: `Links to book platforms: ${retailer.length ? retailer.join(', ') : 'none'} (Amazon, Goodreads, BookBub expected)`,
            why: 'AI engines cross-check authors against the big book databases. Linking to your listings confirms that the books on your site are the same ones they already know about.',
            fix: 'Link each book to its Amazon, Goodreads, and BookBub pages, and your author profile on each.'
        });
    }
    const noOg = content.filter(f => !f.og['og:title'] || !f.og['og:description'] || !f.og['og:image']);
    if (noOg.length) {
        add({
            id: 'open_graph_missing', category: 'Entity & schema', severity: 'notice', impact: 2, effort: 1,
            title: 'Pages missing Open Graph title, description, or image',
            why: 'Open Graph tags control how your pages appear when shared and are a secondary summary signal for crawlers.',
            fix: 'Add og:title, og:description, and og:image (use the book cover on book pages).'
        }, noOg.map(f => f.url));
    }

    // --- Content ---
    const thin = content.filter(f => f.wordCount < THIN_CONTENT_WORDS);
    if (thin.length) {
        add({
            id: 'thin_content', category: 'Content', severity: 'warning', impact: 3, effort: 3,
            title: `Thin pages (under ${THIN_CONTENT_WORDS} words)`,
            why: 'AI answers quote passages. A page with a cover and a buy button gives the engine nothing to quote, so it quotes a review site instead.',
            fix: 'Give each book page a real description, themes, comparable titles, series order, and a short excerpt or Q&A.'
        }, thin.map(f => f.url));
    }
    const long = ok.filter(f => f.wordCount > LONG_CONTENT_WORDS);
    if (long.length) {
        add({
            id: 'content_too_long', category: 'Content', severity: 'notice', impact: 2, effort: 3,
            title: `Very long pages (over ${LONG_CONTENT_WORDS} words)`,
            why: 'Long pages can be truncated when an AI system pulls them into its context window, so the key facts at the bottom never get read.',
            fix: 'Move the key facts (who you are, books, series order) to the top, or split the page.'
        }, long.map(f => f.url));
    }
    const lowSemantic = content.filter(f => !f.hasMainOrArticle && f.semanticTagCount < 2);
    if (lowSemantic.length) {
        add({
            id: 'low_semantic_html', category: 'Content', severity: 'notice', impact: 2, effort: 3,
            title: 'Pages with little semantic HTML (no <main>/<article>, few landmarks)',
            why: 'Semantic elements tell a parser which text is the content and which is navigation. Without them, menus and footers get mixed into what the engine thinks the page says.',
            fix: 'Wrap the primary content in <main> and each book or post in <article>.'
        }, lowSemantic.map(f => f.url));
    }
    const stale = ok.filter(f => f.lastModified && (now - new Date(f.lastModified)) / 86400000 > STALE_DAYS);
    if (stale.length) {
        add({
            id: 'stale_last_modified', category: 'Content', severity: 'notice', impact: 2, effort: 2,
            title: `Pages whose Last-Modified header is over ${STALE_DAYS} days old`,
            why: 'Freshness is a tie-breaker. An author site that looks untouched for a year signals the information (latest book, events) may be out of date.',
            fix: 'Update these pages (new release, events, reading order) and make sure your host sends an accurate Last-Modified header.'
        }, stale.map(f => f.url));
    }
    if (!facts.some(f => /\/(about|bio|author|meet)/i.test(new URL(f.url).pathname))) {
        add({
            id: 'about_page_missing', category: 'Content', severity: 'warning', impact: 3, effort: 2,
            title: 'No About / Bio page found',
            why: 'The About page is the page AI engines most often use to answer "who is this author?". Without one, they summarize you from whatever else they find.',
            fix: 'Publish an About page with a 150-300 word bio in the third person, your genres, books, awards, and Person schema.'
        });
    }

    // --- On-page ---
    const noTitle = ok.filter(f => !f.title);
    if (noTitle.length) {
        add({ id: 'title_missing', category: 'On-page', severity: 'error', impact: 4, effort: 1,
            title: 'Pages without a <title>', why: 'The title is the first thing every search and AI engine reads to label a page.',
            fix: 'Give each page a unique title, e.g. "Book Title — A Genre Novel by Author Name".' }, noTitle.map(f => f.url));
    }
    const dupTitle = groupDuplicates(ok, 'title');
    if (dupTitle.length) {
        add({ id: 'title_duplicate', category: 'On-page', severity: 'warning', impact: 3, effort: 1,
            title: 'Duplicate page titles', why: 'Identical titles make pages compete with each other and blur which one is about which book.',
            fix: 'Make each title unique and include the book or topic name.' }, dupTitle);
    }
    const badTitleLen = ok.filter(f => f.title && (f.title.length < 10 || f.title.length > 70));
    if (badTitleLen.length) {
        add({ id: 'title_length', category: 'On-page', severity: 'notice', impact: 1, effort: 1,
            title: 'Titles shorter than 10 or longer than 70 characters', why: 'Very short titles carry no context; long ones get cut off in results.',
            fix: 'Aim for 30-65 characters.' }, badTitleLen.map(f => f.url));
    }
    const noDesc = ok.filter(f => !f.metaDescription);
    if (noDesc.length) {
        add({ id: 'meta_description_missing', category: 'On-page', severity: 'warning', impact: 3, effort: 1,
            title: 'Pages without a meta description', why: 'The meta description is a ready-made summary engines can reuse verbatim. Without one they improvise.',
            fix: 'Write a 120-155 character description per page that names you, the book, and the genre.' }, noDesc.map(f => f.url));
    }
    const dupDesc = groupDuplicates(ok, 'metaDescription');
    if (dupDesc.length) {
        add({ id: 'meta_description_duplicate', category: 'On-page', severity: 'warning', impact: 2, effort: 1,
            title: 'Duplicate meta descriptions', why: 'Copy-pasted descriptions tell engines the pages are interchangeable.',
            fix: 'Write a unique description for each page.' }, dupDesc);
    }
    const noH1 = ok.filter(f => f.h1s.length === 0);
    if (noH1.length) {
        add({ id: 'h1_missing', category: 'On-page', severity: 'warning', impact: 3, effort: 1,
            title: 'Pages without an H1 heading', why: 'The H1 is the page\'s stated topic. Without it, engines infer the topic from the layout.',
            fix: 'Add one H1 per page naming the book or the page topic.' }, noH1.map(f => f.url));
    }
    const multiH1 = ok.filter(f => f.h1s.length > 1);
    if (multiH1.length) {
        add({ id: 'h1_multiple', category: 'On-page', severity: 'notice', impact: 2, effort: 1,
            title: 'Pages with more than one H1', why: 'Several H1s make it ambiguous which heading is the page topic.',
            fix: 'Keep one H1 and demote the rest to H2.' }, multiH1.map(f => f.url));
    }
    const altMissing = ok.filter(f => f.imgMissingAlt > 0);
    if (altMissing.length) {
        add({ id: 'img_alt_missing', category: 'On-page', severity: 'warning', impact: 2, effort: 2,
            title: 'Images without alt text', why: 'Alt text is the only way a text-based crawler knows an image is your book cover or author photo. It is also an accessibility requirement.',
            fix: 'Describe each image, e.g. alt="Cover of Book Title by Author Name".' }, altMissing.map(f => f.url));
    }
    const offsiteCanonical = ok.filter(f => f.canonical && !isCanonicalCorrect(f.canonical, f.url));
    if (offsiteCanonical.length) {
        add({ id: 'canonical_offsite', category: 'On-page', severity: 'error', impact: 4, effort: 1,
            title: 'Canonical tags pointing to another domain', why: 'A canonical tag tells engines "the real version of this page is over there". Pointing it off-site hands your authority to that site.',
            fix: 'Point each canonical at the page\'s own URL on your domain.' }, offsiteCanonical.map(f => f.url));
    }
    const noCanonical = ok.filter(f => !f.canonical);
    if (noCanonical.length) {
        add({ id: 'canonical_missing', category: 'On-page', severity: 'notice', impact: 2, effort: 1,
            title: 'Pages without a canonical tag', why: 'Without a canonical, URL variants (www, trailing slash, tracking parameters) can be treated as separate pages.',
            fix: 'Add <link rel="canonical"> with the preferred URL to every page.' }, noCanonical.map(f => f.url));
    }

    // --- Crawlability & technical ---
    const noindex = content.filter(f => f.noindex);
    if (noindex.length) {
        add({ id: 'noindex', category: 'Crawlability', severity: 'error', impact: 5, effort: 1,
            title: 'Pages marked noindex', why: 'noindex removes a page from search indexes, and AI search features built on those indexes will not cite it.',
            fix: 'Remove the noindex robots meta tag / X-Robots-Tag header. If the page is intentionally hidden (e.g. a 404 page), remove it from the sitemap and navigation instead.' }, noindex.map(f => f.url));
    }
    const broken = facts.filter(f => f.status >= 400 && f.status < 500);
    if (broken.length) {
        add({ id: 'broken_internal_links', category: 'Crawlability', severity: 'error', impact: 4, effort: 2,
            title: 'Internal links to pages that return 4xx', why: 'Broken links waste crawl budget and signal neglect. If the dead page was a book page, that book has no home on your site.',
            fix: 'Restore the pages or update/redirect the links (the pages linking to each broken URL are listed).' },
        broken.map(f => `${f.url} (HTTP ${f.status}${f.inlinks && f.inlinks.length ? `, linked from ${f.inlinks.slice(0, 3).join(', ')}` : ''})`));
    }
    const serverErr = facts.filter(f => f.status >= 500 || f.status === 0);
    if (serverErr.length) {
        add({ id: 'server_errors', category: 'Crawlability', severity: 'error', impact: 5, effort: 3,
            title: 'Pages that failed to load (5xx or timeout)', why: 'A crawler that hits an error or a slow page gives up and may not return for days.',
            fix: 'Check hosting logs for these URLs; slow plugins and expired hosting plans are the usual causes.' }, serverErr.map(f => f.url));
    }
    const deep = ok.filter(f => f.depth !== null && f.depth > MAX_CLICK_DEPTH);
    if (deep.length) {
        add({ id: 'deep_pages', category: 'Crawlability', severity: 'notice', impact: 2, effort: 2,
            title: `Pages more than ${MAX_CLICK_DEPTH} clicks from the homepage`, why: 'Crawlers prioritize pages close to the homepage. Deep pages get crawled rarely.',
            fix: 'Link important pages (especially books) from the main navigation or homepage.' }, deep.map(f => f.url));
    }
    const sitemapSet = new Set(crawl.sitemapPages);
    // Inlinks are only complete when every discovered page was crawled.
    const orphans = crawl.uncrawled ? [] : ok.filter(f => sitemapSet.has(f.url) && f.url !== crawl.homepage && f.inlinks.length === 0);
    if (orphans.length) {
        add({ id: 'orphan_pages', category: 'Crawlability', severity: 'warning', impact: 2, effort: 2,
            title: 'Orphan pages (in the sitemap but not linked from any crawled page)', why: 'A page nothing links to looks unimportant, even if it is your newest book.',
            fix: 'Link each orphan from a relevant page (Books, homepage, or series page).' }, orphans.map(f => f.url));
    }
    if (!crawl.sitemapRes || !crawl.sitemapRes.ok) {
        add({ id: 'sitemap_missing', category: 'Crawlability', severity: 'warning', impact: 3, effort: 1,
            title: 'No sitemap.xml', why: 'A sitemap is the complete list of pages you want found. Without it, new book pages wait until a crawler stumbles onto a link.',
            fix: 'Generate /sitemap.xml (most site builders have a setting) and reference it in robots.txt.' });
    } else if (!bots.sitemaps.length) {
        add({ id: 'sitemap_not_in_robots', category: 'Crawlability', severity: 'notice', impact: 1, effort: 1,
            title: 'Sitemap is not referenced in robots.txt', why: 'Crawlers that do not guess /sitemap.xml find it through the robots.txt Sitemap line.',
            fix: `Add "Sitemap: ${crawl.origin}/sitemap.xml" to robots.txt.` });
    }
    const sitemapBroken = facts.filter(f => sitemapSet.has(f.url) && !(f.status >= 200 && f.status < 300));
    if (sitemapBroken.length) {
        add({ id: 'sitemap_broken_urls', category: 'Crawlability', severity: 'warning', impact: 3, effort: 2,
            title: 'Sitemap lists URLs that do not return 200', why: 'A sitemap full of dead URLs teaches crawlers to trust it less.',
            fix: 'Remove or fix these URLs in the sitemap.' }, sitemapBroken.map(f => f.url));
    }
    if (!crawl.homepage.startsWith('https://')) {
        add({ id: 'not_https', category: 'Technical', severity: 'error', impact: 4, effort: 3,
            title: 'Site is served over HTTP, not HTTPS', why: 'Browsers flag HTTP sites as "Not secure" and engines prefer HTTPS sources.',
            fix: 'Enable HTTPS with your host (usually a free certificate) and redirect all HTTP traffic.' });
    } else if (crawl.httpProbeOk && !crawl.httpRedirectsToHttps) {
        add({ id: 'http_not_redirected', category: 'Technical', severity: 'warning', impact: 3, effort: 2,
            title: 'HTTP version does not redirect to HTTPS', why: 'Two live versions of the site split signals between duplicates.',
            fix: 'Add a permanent (301) redirect from http:// to https://.' });
    }
    const mixed = ok.filter(f => f.mixedContent > 0);
    if (mixed.length) {
        add({ id: 'mixed_content', category: 'Technical', severity: 'warning', impact: 3, effort: 2,
            title: 'HTTPS pages loading HTTP resources', why: 'Browsers block or warn on mixed content, and the page can render broken.',
            fix: 'Change those image/script URLs to https://.' }, mixed.map(f => f.url));
    }
    const noViewport = ok.filter(f => !f.hasViewport);
    if (noViewport.length) {
        add({ id: 'viewport_missing', category: 'Technical', severity: 'warning', impact: 3, effort: 1,
            title: 'Pages without a mobile viewport tag', why: 'Google indexes the mobile version first. Without a viewport tag the page renders as a shrunken desktop page.',
            fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' }, noViewport.map(f => f.url));
    }
    const noLang = ok.filter(f => !f.lang);
    if (noLang.length) {
        add({ id: 'lang_missing', category: 'Technical', severity: 'notice', impact: 1, effort: 1,
            title: 'Pages without a lang attribute', why: 'The lang attribute tells engines and screen readers which language the page is in.',
            fix: 'Add lang="en" (or your language) to the <html> tag.' }, noLang.map(f => f.url));
    }
    const jsShell = ok.filter(f => f.wordCount < 50 && (f.appShell || f.scriptCount >= 5));
    if (jsShell.length) {
        add({ id: 'js_rendered_shell', category: 'Technical', severity: 'error', impact: 5, effort: 4,
            title: 'Pages that are almost empty without JavaScript', why: 'Many AI crawlers read the raw HTML and do not run JavaScript. To them, these pages are blank.',
            fix: 'Enable server-side rendering or static export in your site builder, or move key text into the HTML.' }, jsShell.map(f => f.url));
    }

    issues.sort((a, b) => b.priority - a.priority || SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]);
    return { issues, bots: bots.rows, profiles };
}

/**
 * Site Health mirrors the "share of pages without errors" idea; AI Readiness weights the AI-specific checks.
 */
function computeScores(issues, facts) {
    const total = facts.length || 1;
    const pagesWithErrors = new Set(
        issues.filter(i => i.severity === 'error').flatMap(i => i.pages.map(p => p.split(' ')[0]))
    );
    const siteWideErrors = issues.filter(i => i.severity === 'error' && i.pages.length === 0).length;
    const siteHealth = Math.max(0, Math.round(100 * (total - pagesWithErrors.size) / total) - siteWideErrors * 10);

    const aiCategories = new Set(['AI access', 'Entity & schema', 'Content']);
    const aiPenalty = issues
        .filter(i => aiCategories.has(i.category) || i.id === 'js_rendered_shell' || i.id === 'noindex')
        .reduce((sum, i) => sum + i.impact * SEVERITY_WEIGHT[i.severity], 0);
    const aiReadiness = Math.max(0, 100 - aiPenalty);

    const counts = { error: 0, warning: 0, notice: 0 };
    issues.forEach(i => { counts[i.severity]++; });
    return { siteHealth, aiReadiness, counts };
}

module.exports = { buildIssues, computeScores, evaluateBots, quadrant, priorityScore, llmsTxtProblems, SEARCH_BOTS, TRAINING_BOTS };
