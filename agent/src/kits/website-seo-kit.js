const llm = require('../llm');
const { parseJson } = require('../ai-utils');

async function processWebsiteSeoKit(payload) {
    console.log('Starting website-seo-audit processing...');

    // Step 1 — SEO & GEO Strategy Brief
    const step1Prompt = `
You are an expert in author website SEO and Generative Engine Optimization (GEO) — the practice of structuring web content so AI systems (ChatGPT, Perplexity, Google AI Overviews, Claude) cite it as a source.

An author has submitted the following intake for a Website SEO & AI Visibility Audit:

${JSON.stringify(payload, null, 2)}

Produce a Strategy Brief covering:
1. Search Intent Mapping — what queries this author's ideal reader types into Google and AI tools, and whether the current site structure is likely to capture them
2. GEO Readiness Assessment — what entity clarity, schema markup, and semantic structure signals AI crawlers need, and how likely this type of site/platform is to be providing them
3. Content Gap Analysis — what high-value content the site is almost certainly missing given the author's genre, goals, and target reader
4. Platform-Specific Constraints — known SEO limitations of the platform they're using (WordPress, Squarespace, Wix, etc.) and how to work around them
5. Priority Signal — given their stated primary goal (${payload.primary_goal || 'not specified'}), what is the single highest-leverage change they could make this week
`;

    const step1Text = await llm.complete(step1Prompt, { maxTokens: 1500 });

    const strategyBrief = step1Text;
    console.log('Website SEO step 1 complete.');

    // Step 2 — Audit Deliverables
    const step2Prompt = `
You are an expert in author website SEO and GEO. Using the Strategy Brief and Author Input below, produce the Website SEO & AI Visibility Audit deliverables.

Author Input:
${JSON.stringify(payload, null, 2)}

Strategy Brief:
${strategyBrief}

Note: You cannot directly crawl the site URL. Base your audit on the platform, goals, and context provided. Flag this where relevant.

Output valid JSON ONLY — no markdown fences, no commentary:
{
  "prioritizedFixList": [
    {
      "priority": 1,
      "category": "Category (e.g. Schema Markup, Page Title, Internal Linking, GEO, Content Gap)",
      "issue": "What is wrong or missing",
      "fix": "Exact instruction — specific enough to implement without further research",
      "impact": "High / Medium / Low",
      "effort": "Low / Medium / High"
    },
    {
      "priority": 2,
      "category": "...",
      "issue": "...",
      "fix": "...",
      "impact": "...",
      "effort": "..."
    },
    {
      "priority": 3,
      "category": "...",
      "issue": "...",
      "fix": "...",
      "impact": "...",
      "effort": "..."
    },
    {
      "priority": 4,
      "category": "...",
      "issue": "...",
      "fix": "...",
      "impact": "...",
      "effort": "..."
    },
    {
      "priority": 5,
      "category": "...",
      "issue": "...",
      "fix": "...",
      "impact": "...",
      "effort": "..."
    }
  ],
  "metaRewrites": [
    {
      "page": "Page name (e.g. Homepage, About, Books)",
      "currentIssue": "What is likely wrong with the current meta based on the platform and goals",
      "suggestedTitle": "Optimized title tag (50–60 characters)",
      "suggestedDescription": "Optimized meta description (140–155 characters)"
    }
  ],
  "schemaMarkupRecommendations": [
    {
      "schemaType": "Schema.org type (e.g. Person, Book, WebSite, BreadcrumbList)",
      "page": "Where to add it",
      "why": "Why this schema type improves AI and Google discoverability for this author"
    }
  ],
  "geoReadinessScore": "A letter grade (A–F) for AI crawler discoverability readiness, with a 2-sentence explanation",
  "contentGaps": [
    {
      "contentType": "Type of content (e.g. FAQ page, author bio structured data, series page, genre landing page)",
      "searchIntent": "The query this content would capture",
      "priority": "High / Medium / Low"
    }
  ],
  "platformNotes": "2–3 sentences on specific limitations or opportunities of their platform (${payload.site_platform || 'their platform'}) for SEO.",
  "dataLimitation": "Brief note that this audit is based on provided context and platform knowledge, not a live crawl, and what additional tools (Search Console, Screaming Frog, etc.) the author should use for a live technical audit."
}
`;

    const step2Text = await llm.complete(step2Prompt, { maxTokens: 3000 });

    const deliverables = parseJson(step2Text, 'website-seo deliverables');
    console.log('Website SEO step 2 complete.');

    return { strategyBrief, deliverables };
}

module.exports = { processWebsiteSeoKit };
