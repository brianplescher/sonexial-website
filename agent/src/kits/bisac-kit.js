const llm = require('../llm');
const { parseJson } = require('../ai-utils');

async function processBisacKit(payload) {
    console.log('Starting bisac-kit processing...');

    // Step 1 — Category Analysis Brief
    const step1Prompt = `
You are an expert in book retail categorization and Amazon browse taxonomy. An author has submitted the following intake for a BISAC & Category Strategy Kit:

${JSON.stringify(payload, null, 2)}

Produce a Category Analysis Brief containing:
1. Primary Genre Assessment — what the book actually is versus how it may be miscategorized
2. Competitive Category Landscape — which BISAC nodes are overcrowded vs. underserved for this content
3. Bestseller List Eligibility — which Amazon bestseller charts this book could realistically compete on within 30 days of launch
4. Thematic Crossover Opportunities — non-obvious BISAC codes unlocked by the book's themes (beyond the main genre)
5. Platform Differences — any notable differences in category strategy between Amazon KDP, IngramSpark/Kobo/Apple if relevant
`;

    const step1Text = await llm.complete(step1Prompt, { maxTokens: 1500 });

    const categoryBrief = step1Text;
    console.log('BISAC step 1 complete.');

    // Step 2 — Deliverables
    const step2Prompt = `
You are an expert in book retail categorization. Using the Category Analysis Brief and Author Input below, generate the BISAC Kit deliverables.

Author Input:
${JSON.stringify(payload, null, 2)}

Category Analysis Brief:
${categoryBrief}

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
  "implementationNotes": "Step-by-step instructions for uploading these codes in KDP, including where to enter them and how to request the additional Amazon browse categories via support."
}
`;

    const step2Text = await llm.complete(step2Prompt, { maxTokens: 2500 });

    const deliverables = parseJson(step2Text, 'bisac deliverables');
    console.log('BISAC step 2 complete.');

    return { categoryBrief, deliverables };
}

module.exports = { processBisacKit };
