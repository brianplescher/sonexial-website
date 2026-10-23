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
        executive_summary: `${artifacts.authorName}'s site scored ${scores.aiReadiness}/100 for technical discovery readiness and ${scores.siteHealth}% site health across ${diag.pagesCrawled} crawled pages. We found ${scores.counts.error} errors, ${scores.counts.warning} warnings, and ${scores.counts.notice} notices. ${quick.length} of them are quick wins that can be fixed in an afternoon${top ? `, starting with: ${top.title}` : ''}.`,
        why_ai_misses_you: issues.some(i => i.category === 'Entity & schema')
            ? 'The audit found missing or inconsistent entity markup on checked pages. Accurate Person and Book schema and official links may help search systems interpret the catalog, but this scan has not measured any engine\'s actual citations or recommendations.'
            : 'The checked pages have some useful entity information. Remaining technical findings may involve crawl rules or page content; actual AI search visibility has not been measured by this diagnostic.',
        thirty_day_plan: [
            { week: 'Week 1', focus: 'Quick wins', tasks: quick.slice(0, 5).map(i => i.title) },
            { week: 'Week 2', focus: 'Entity and schema', tasks: ['Verify the visible author and book facts are consistent', 'Add or correct Person and Book JSON-LD where relevant', 'Review official catalog and retailer links'] },
            { week: 'Weeks 3-4', focus: 'Major projects', tasks: major.slice(0, 4).map(i => i.title) }
        ].filter(w => w.tasks.length),
        positioning: {
            one_line_bio: `${artifacts.authorName} is the author of … (one sentence: genre, best-known book, and what readers get).`,
            entity_statement: `Use the same name, photo, and one-line bio on your site, Amazon author page, Goodreads, and BookBub to reduce identity confusion across these sources.`
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
    const blocked = diag.bots.filter(b => b.kind === 'search' && b.access === 'blocked').map(b => b.label);

    const prompt = `
You are a Generative Engine Optimization (GEO) consultant writing a paid diagnostic for an author's website.
Write in plain, direct English for a non-technical author. No hype, no emojis.

Site: ${diag.url}
Author (best guess): ${diag.artifacts.authorName}
Pages crawled: ${diag.pagesCrawled}
Technical discovery readiness (heuristic): ${diag.scores.aiReadiness}/100, Site health: ${diag.scores.siteHealth}%
Issue counts: ${JSON.stringify(diag.scores.counts)}
Top issues (highest priority first): ${JSON.stringify(topIssues(diag.issues, 12))}
Automated search-crawler restrictions at the root URL: ${JSON.stringify(blocked)}
Profiles found: ${JSON.stringify(Object.keys(diag.profiles))}
Homepage description: ${JSON.stringify(diag.homepageDescription || '')}

Accuracy rules (this is a paid report; a wrong claim destroys trust):
- Only state problems that appear in the issue list above. Do not invent issues.
- "noindex" means a page asks search engines not to list it. It is NOT crawler blocking; never describe it as blocking AI crawlers.
- A lack of robots.txt blocking does not prove that real crawlers can access, index or cite the site; avoid stating they definitely can.
- When an issue affects specific pages, name them instead of implying the whole site.
- Treat llms.txt as an optional format, never a technical prerequisite or ranking signal.
- The diagnostic does NOT test AI assistants or their internal indexes. Do not infer that any engine has ignored, indexed, cited or recommended this author.

Output valid JSON ONLY, no markdown fences:
{
  "executive_summary": "3-4 sentences: overall state, the single biggest problem, and what fixing it unlocks.",
  "why_ai_misses_you": "One paragraph describing observed page and crawler signals that could affect discoverability, clearly avoiding claims about measured ChatGPT, Claude, Perplexity or Google results.",
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
