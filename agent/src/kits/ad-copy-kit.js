const llm = require('../llm');

// Sanitize a value before interpolating into log output — strips newlines/control chars
// that could be used to forge fake log lines.
function sanitizeLog(val) {
    return String(val).replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').slice(0, 200);
}

function parseJson(raw, label) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
        console.error(`Raw AI response (no JSON found) [${sanitizeLog(label)}]:`, sanitizeLog(raw));
        throw new Error(`AI response for ${label} did not contain valid JSON`);
    }
    try {
        return JSON.parse(raw.slice(start, end + 1));
    } catch (err) {
        console.error(`JSON parse failed [${sanitizeLog(label)}]:`, sanitizeLog(raw.slice(start, end + 1)));
        throw new Error(`Failed to parse AI response for ${label}: ${err.message}`);
    }
}

async function processAdCopyKit(payload) {
    console.log('Starting ad-copy-suite processing...');

    // Step 1 — Hook Strategy Brief
    const step1Prompt = `
You are a direct-response book advertising strategist. An author has submitted the following intake for an Ad Copy Suite:

${JSON.stringify(payload, null, 2)}

Produce a Hook Strategy Brief containing:
1. Core Hook Mechanism — the single strongest emotional or curiosity lever this book offers
2. Reader Trigger Points — 3–5 specific pain points, desires, or emotions the ideal reader brings to an ad
3. Tone Profile — the exact voice and register the ad copy should use (e.g. urgent, wry, wistful, visceral)
4. Platform Notes — any differences in approach between Amazon Sponsored Products, Facebook/Meta, and BookBub for this specific book
5. Angles to Avoid — any framings that would mislead or underperform for this genre/audience
`;

    const step1Text = await llm.complete(step1Prompt, { maxTokens: 1500 });

    const hookBrief = step1Text;
    console.log('Ad copy step 1 complete.');

    // Step 2 — Deliverables
    const step2Prompt = `
You are a direct-response book ad copywriter. Using the Hook Strategy Brief and Author Input below, generate the full Ad Copy Suite deliverables.

Author Input:
${JSON.stringify(payload, null, 2)}

Hook Strategy Brief:
${hookBrief}

Output valid JSON ONLY — no markdown fences, no commentary:
{
  "amazonHeadlines": [
    "Headline 1 (max 150 chars, Amazon Sponsored Products format)",
    "Headline 2",
    "Headline 3",
    "Headline 4",
    "Headline 5"
  ],
  "facebookAdVariants": [
    {
      "hook": "Opening line (scroll-stopper, 1–2 sentences)",
      "body": "Ad body copy (3–5 sentences, ends with CTA)",
      "angle": "Brief label for this variant's angle (e.g. 'curiosity gap', 'reader identity')"
    },
    { "hook": "...", "body": "...", "angle": "..." },
    { "hook": "...", "body": "...", "angle": "..." }
  ],
  "hookLibrary": [
    "Opening line 1",
    "Opening line 2",
    "Opening line 3",
    "Opening line 4",
    "Opening line 5",
    "Opening line 6",
    "Opening line 7",
    "Opening line 8",
    "Opening line 9",
    "Opening line 10"
  ],
  "genreConversionNotes": "2–3 paragraphs explaining why these hooks work for this specific genre and reader, including any A/B testing priorities."
}
`;

    const step2Text = await llm.complete(step2Prompt, { maxTokens: 3000 });

    const deliverables = parseJson(step2Text, 'ad-copy deliverables');
    console.log('Ad copy step 2 complete.');

    return { hookBrief, deliverables };
}

module.exports = { processAdCopyKit };
