const llm = require('../llm');
const { parseJson, sanitizeLog } = require('../ai-utils');

function topIssues(issues, n) {
    return issues.slice(0, n).map(i => ({
        title: i.title,
        severity: i.severity,
        quadrant: i.quadrant,
        why: i.why,
        pages: i.pages.slice(0, 3)
    }));
}

const BLOCK_WORDS = /\b((un)?block(s|ed|ing)?|ignor(e|es|ed|ing)|shut(s|ting)? out|lock(s|ed|ing)? out)\b/i;
const CRAWLER_WORDS = /\b(crawl\w*|bots?|AI|discover\w*)\b/i;

/**
 * Whether text claims AI crawlers are blocked or told to ignore the site.
 * Small models conflate noindex with crawler blocking; this keeps that claim out when robots.txt allows every bot.
 */
function claimsCrawlerBlocking(text) {
    return String(text || '').split(/(?<=[.!?])\s+/)
        .some(sentence => BLOCK_WORDS.test(sentence) && CRAWLER_WORDS.test(sentence));
}

/**
 * Deterministic write-up used when no LLM is configured or the model call fails.
 */
function fallbackWriteup(diag) {
    const { scores, issues, artifacts } = diag;
    const quick = issues.filter(i => i.quadrant === 'Quick win');
    const major = issues.filter(i => i.quadrant === 'Major project');
    const top = issues[0];
    return {
        executive_summary: `${artifacts.authorName}'s site scored ${scores.aiReadiness}/100 for AI readiness and ${scores.siteHealth}% site health across ${diag.pagesCrawled} crawled pages. We found ${scores.counts.error} errors, ${scores.counts.warning} warnings, and ${scores.counts.notice} notices. ${quick.length} of them are quick wins that can be fixed in an afternoon${top ? `, starting with: ${top.title}` : ''}.`,
        why_ai_misses_you: issues.some(i => i.category === 'Entity & schema')
            ? 'AI engines answer questions about authors by matching a name to a known entity and then quoting the most authoritative page about it. Your site is not yet giving them the machine-readable signals (Person and Book schema, sameAs links to your book listings) that mark it as the official source, so they lean on retailer and review pages instead.'
            : 'Your entity signals are in place. The remaining gaps are about access and content depth: making sure every AI crawler can read your pages and that each page gives them something specific to quote.',
        thirty_day_plan: [
            { week: 'Week 1', focus: 'Quick wins', tasks: quick.slice(0, 5).map(i => i.title) },
            { week: 'Week 2', focus: 'Entity and schema', tasks: ['Publish the Person JSON-LD on the homepage and About page', 'Add Book JSON-LD to every book page', 'Publish llms.txt'] },
            { week: 'Weeks 3-4', focus: 'Major projects', tasks: major.slice(0, 4).map(i => i.title) }
        ].filter(w => w.tasks.length),
        positioning: {
            one_line_bio: `${artifacts.authorName} is the author of … (one sentence: genre, best-known book, and what readers get).`,
            entity_statement: `Use the same name, photo, and one-line bio on your site, Amazon author page, Goodreads, and BookBub so engines treat them as one person.`
        },
        generated_by: 'template'
    };
}

/**
 * Replaces any LLM section that contradicts the crawl data with its template equivalent.
 */
function guardWriteup(writeup, fallback, blockedBots) {
    if (blockedBots.length) return writeup;
    const guarded = { ...writeup };
    for (const key of ['executive_summary', 'why_ai_misses_you']) {
        if (claimsCrawlerBlocking(guarded[key])) guarded[key] = fallback[key];
    }
    if (claimsCrawlerBlocking(guarded.thirty_day_plan.map(w => [w.focus, ...(w.tasks || [])].join('. ')).join('. '))) {
        guarded.thirty_day_plan = fallback.thirty_day_plan;
    }
    return guarded;
}

/**
 * Narrative layer of the diagnostic. Optional: falls back to a template when the LLM is off or fails.
 */
async function generateWriteup(diag) {
    const fallback = fallbackWriteup(diag);
    if (!llm.isConfigured()) return fallback;
    const blocked = diag.bots.filter(b => b.access === 'blocked').map(b => b.label);

    const prompt = `
You are a Generative Engine Optimization (GEO) consultant writing a paid diagnostic for an author's website.
Write in plain, direct English for a non-technical author. No hype, no emojis.

Site: ${diag.url}
Author (best guess): ${diag.artifacts.authorName}
Pages crawled: ${diag.pagesCrawled}
AI readiness: ${diag.scores.aiReadiness}/100, Site health: ${diag.scores.siteHealth}%
Issue counts: ${JSON.stringify(diag.scores.counts)}
Top issues (highest priority first): ${JSON.stringify(topIssues(diag.issues, 12))}
AI crawlers blocked by robots.txt: ${JSON.stringify(blocked)}${blocked.length ? '' : ` (none: all ${diag.bots.length} AI crawlers are allowed)`}
Profiles found: ${JSON.stringify(Object.keys(diag.profiles))}
Homepage description: ${JSON.stringify(diag.homepageDescription || '')}

Accuracy rules (this is a paid report; a wrong claim destroys trust):
- Only state problems that appear in the issue list above. Do not invent issues.
- "noindex" means a page asks search engines not to list it. It is NOT crawler blocking; never describe it as blocking AI crawlers.
- If the "AI crawlers blocked" list is empty, say AI crawlers can currently reach the site.
- When an issue affects specific pages, name them instead of implying the whole site.

Output valid JSON ONLY, no markdown fences:
{
  "executive_summary": "3-4 sentences: overall state, the single biggest problem, and what fixing it unlocks.",
  "why_ai_misses_you": "One paragraph explaining, specifically for this site, why ChatGPT, Perplexity, Claude, and Google AI Overviews may not cite or recommend this author.",
  "thirty_day_plan": [{"week": "Week 1", "focus": "short label", "tasks": ["task", "task"]}],
  "positioning": {
    "one_line_bio": "A one-sentence third-person bio the author could use everywhere (fill with what you can infer, use … for unknowns).",
    "entity_statement": "One or two sentences on how to keep their name and identity consistent across their site and book platforms."
  }
}
`;
    try {
        const raw = await llm.complete(prompt, { maxTokens: 1800, temperature: 0.4 });
        const parsed = parseJson(raw, 'diagnostic writeup');
        return guardWriteup({
            executive_summary: parsed.executive_summary || fallback.executive_summary,
            why_ai_misses_you: parsed.why_ai_misses_you || fallback.why_ai_misses_you,
            thirty_day_plan: Array.isArray(parsed.thirty_day_plan) && parsed.thirty_day_plan.length ? parsed.thirty_day_plan : fallback.thirty_day_plan,
            positioning: {
                one_line_bio: parsed.positioning?.one_line_bio || fallback.positioning.one_line_bio,
                entity_statement: parsed.positioning?.entity_statement || fallback.positioning.entity_statement
            },
            generated_by: 'llm'
        }, fallback, blocked);
    } catch (err) {
        console.error('Diagnostic writeup error:', sanitizeLog(err.message));
        return fallback;
    }
}

module.exports = { generateWriteup, fallbackWriteup, guardWriteup, claimsCrawlerBlocking };
