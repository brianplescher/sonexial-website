const Anthropic = require('@anthropic-ai/sdk');

if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required but not set');
}

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

// Sanitize a value before interpolating into log output — strips newlines/control chars
// that could be used to forge fake log lines.
function sanitizeLog(val) {
    return String(val).replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').slice(0, 200);
}

function parseJson(raw, label) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
        console.error(`Raw AI response (no JSON found) [${label}]:`, sanitizeLog(raw));
        throw new Error(`AI response for ${label} did not contain valid JSON`);
    }
    try {
        return JSON.parse(raw.slice(start, end + 1));
    } catch (err) {
        console.error(`JSON parse failed [${label}]:`, sanitizeLog(raw.slice(start, end + 1)));
        throw new Error(`Failed to parse AI response for ${label}: ${err.message}`);
    }
}

// Amazon Visibility Kit — merged replacement for the former Metadata Kit,
// BISAC Kit, and Description Kit. Two-step pattern preserved from the proven
// kit processors: Step 1 builds a combined strategy brief, Step 2 produces
// all deliverables (BISAC categories + backend keywords + description
// variants) in a single run instead of three separate kit purchases.
async function processAmazonVisibilityKit(payload) {
    console.log('Starting amazon-visibility-kit processing...');

    // Step 1 — Combined Category & Positioning Brief
    const step1Prompt = `
You are an expert book marketing strategist who specializes in both Amazon retail
categorization (BISAC codes, browse taxonomy, A9 search) and conversion copywriting.
An author has submitted the following intake for an Amazon Visibility Kit:

${JSON.stringify(payload, null, 2)}

Produce a Visibility Strategy Brief containing:
1. The Hook (1-2 sentences) — what makes this book sellable
2. Reader Avatar (Who is the ideal reader? Demographics, psychographics, pain points)
3. Search Behavior (What terms are they typing into Amazon to find a book like this?)
4. Tone Calibration (What tone should the description and subtitles strike?)
5. Competitive Category Landscape — which BISAC nodes are overcrowded vs. underserved for this content
6. Bestseller List Eligibility — which Amazon bestseller charts this book could realistically compete on within 30 days of launch
7. Thematic Crossover Opportunities — non-obvious BISAC codes unlocked by the book's themes (beyond the main genre)
`;

    const step1Res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1800,
        messages: [{ role: 'user', content: step1Prompt }]
    });

    const strategyBrief = step1Res.content[0].text;
    console.log('Amazon Visibility Kit step 1 complete.');

    // Step 2 — All Deliverables in One Run
    const step2Prompt = `
You are an expert Amazon book copywriter and categorization specialist. Using the
following Visibility Strategy Brief and Author Input, generate ALL deliverables for
an Amazon Visibility Kit in one pass.

Author Input:
${JSON.stringify(payload, null, 2)}

Visibility Strategy Brief:
${strategyBrief}

Output valid JSON ONLY — no markdown fences, no commentary:
{
  "primaryBisac": {
    "code": "BISAC code (e.g. FIC022060)",
    "label": "Full BISAC label",
    "rationale": "Why this is the strongest primary code for this book"
  },
  "secondaryBisac": [
    {
      "code": "BISAC code",
      "label": "Full BISAC label",
      "rationale": "Why this secondary code adds value"
    },
    {
      "code": "BISAC code",
      "label": "Full BISAC label",
      "rationale": "Why this secondary code adds value"
    }
  ],
  "amazonBrowseCategories": [
    {
      "path": "Full browse path (e.g. Books > Mystery, Thriller & Suspense > Cozy Mysteries)",
      "competitionLevel": "Low / Medium / High",
      "bestseller100Threshold": "Estimated BSR needed to reach top 100 in this category",
      "rationale": "Why this category is recommended"
    },
    {
      "path": "...",
      "competitionLevel": "...",
      "bestseller100Threshold": "...",
      "rationale": "..."
    },
    {
      "path": "...",
      "competitionLevel": "...",
      "bestseller100Threshold": "...",
      "rationale": "..."
    }
  ],
  "kdpSupportScript": "Ready-to-send message for KDP support requesting additional browse category placements. Formal tone, includes the specific category paths.",
  "amazonDescription": "HTML formatted description for KDP, using bold, italics, and heading tags appropriately.",
  "descriptionVariants": [
    "Alternate full description variant 2 (plain text, hook-led)",
    "Alternate full description variant 3 (plain text, comp-positioned)",
    "Alternate full description variant 4 (plain text, benefit-led)"
  ],
  "subtitleVariants": ["Variant 1", "Variant 2", "Variant 3", "Variant 4", "Variant 5"],
  "backendKeywords": [
    {"phrase": "keyword phrase 1", "length": 45},
    {"phrase": "keyword phrase 2", "length": 40},
    {"phrase": "keyword phrase 3", "length": 35},
    {"phrase": "keyword phrase 4", "length": 42},
    {"phrase": "keyword phrase 5", "length": 38},
    {"phrase": "keyword phrase 6", "length": 44},
    {"phrase": "keyword phrase 7", "length": 49}
  ],
  "authorBio": "A compelling 1-2 paragraph author bio based on the input.",
  "implementationNotes": "Step-by-step instructions for uploading these codes and copy in KDP, including where to enter BISAC codes, how to paste the HTML description, and how to request the additional Amazon browse categories via support."
}

Ensure the backend keyword lengths are accurate character counts. Do not output anything except the JSON.
`;

    const step2Res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: step2Prompt }]
    });

    const deliverables = parseJson(step2Res.content[0].text, 'amazon-visibility-kit deliverables');
    console.log('Amazon Visibility Kit step 2 complete.');

    return {
        strategyBrief,
        deliverables
    };
}

module.exports = {
    processAmazonVisibilityKit
};
