const Anthropic = require('@anthropic-ai/sdk');

if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required but not set');
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

function parseJson(raw, label) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
        console.error(`Raw AI response (no JSON found) [${label}]:`, raw);
        throw new Error(`AI response for ${label} did not contain valid JSON`);
    }
    try {
        return JSON.parse(raw.slice(start, end + 1));
    } catch (err) {
        console.error(`JSON parse failed [${label}]:`, raw.slice(start, end + 1));
        throw new Error(`Failed to parse AI response for ${label}: ${err.message}`);
    }
}

async function processPositioningKit(payload) {
    console.log('Starting positioning-kit processing...');

    // Step 1 — Market Position Analysis
    // Handles both the new optimization-kit-intake and any future positioning-kit intake.
    // Field names are normalized: falls back gracefully between old and new form fields.
    const step1Prompt = `
You are a book market positioning strategist. An author has submitted the following intake:

${JSON.stringify(payload, null, 2)}

Produce a Market Position Analysis covering:
1. Competitive White Space — where this book sits relative to the market, and what positioning angles are overcrowded vs. open
2. Reader Identity Mapping — who buys this book and more importantly, how they describe themselves and what they're reaching for when they pick it up
3. The Differentiator — what makes this book the right choice over the nearest alternatives, in terms a reader (not an author) would recognize
4. Channel Fit — which marketing channels and contexts this positioning will resonate in most strongly (Amazon search, social ads, podcast pitches, newsletter swaps, etc.)
5. Positioning Risk — any angles that sound appealing but will attract the wrong readers or create expectation gaps
`;

    const step1Res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: step1Prompt }]
    });

    const marketAnalysis = step1Res.content[0].text;
    console.log('Positioning step 1 complete.');

    // Step 2 — Deliverables
    const step2Prompt = `
You are a book market positioning strategist. Using the Market Position Analysis and Author Input below, produce the Positioning Kit deliverables.

Author Input:
${JSON.stringify(payload, null, 2)}

Market Position Analysis:
${marketAnalysis}

Output valid JSON ONLY — no markdown fences, no commentary:
{
  "positioningStatement": "The definitive 3-sentence positioning statement for this book. Sentence 1: what the book is and for whom. Sentence 2: what problem it solves or desire it fulfills. Sentence 3: what makes it the right choice over alternatives.",
  "positioningVariants": [
    {
      "context": "Amazon product page",
      "statement": "Adapted 1–2 sentence positioning for this context"
    },
    {
      "context": "Author bio (third person)",
      "statement": "Adapted 1–2 sentence positioning for this context"
    },
    {
      "context": "Podcast pitch / media outreach",
      "statement": "Adapted 1–2 sentence positioning for this context"
    },
    {
      "context": "Social media / newsletter",
      "statement": "Adapted 1–2 sentence positioning for this context"
    }
  ],
  "promptGuide": [
    {
      "useCase": "Rewrite for a different genre",
      "prompt": "Ready-to-use AI prompt the author can run themselves"
    },
    {
      "useCase": "Adapt for a speaking bio",
      "prompt": "Ready-to-use AI prompt"
    },
    {
      "useCase": "Create a tagline variation",
      "prompt": "Ready-to-use AI prompt"
    },
    {
      "useCase": "Localize for a specific reader community",
      "prompt": "Ready-to-use AI prompt"
    }
  ],
  "competitiveGapSummary": "2–3 sentences on the open positioning space this book can credibly own, and why the recommended statement claims it.",
  "revisionsNote": "One sentence reminding the author that one revision round is included — they should reply to this email with specific feedback."
}
`;

    const step2Res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2500,
        messages: [{ role: 'user', content: step2Prompt }]
    });

    const deliverables = parseJson(step2Res.content[0].text, 'positioning deliverables');
    console.log('Positioning step 2 complete.');

    return { marketAnalysis, deliverables };
}

module.exports = { processPositioningKit };
