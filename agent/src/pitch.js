const Anthropic = require('@anthropic-ai/sdk');

let anthropicClient = null;
function getAnthropicClient() {
    if (!anthropicClient) {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('ANTHROPIC_API_KEY is required but not set');
        }
        anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return anthropicClient;
}
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

// Sanitize a value before logging
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

/**
 * Generates an agentic pitch and outreach draft from scan report findings.
 * @param {object} scanReport - The GEO scan report object.
 * @param {string} [authorName='Author'] - The author's name.
 * @returns {Promise<object>} Pitch deliverables.
 */
async function generatePitch(scanReport, authorName = 'Author') {
    console.log(`Starting pitch generation for ${sanitizeLog(authorName)} (${sanitizeLog(scanReport?.url || 'unknown url')})...`);

    const url = scanReport?.url || 'their website';
    const score = scanReport?.score ?? 0;
    const grade = scanReport?.geo_grade || 'Needs Review';
    const criticalFailures = scanReport?.critical_failures || [];
    const recommendations = scanReport?.recommendations || [];

    // Step 1 — Positioning & Assessment Brief
    const step1Prompt = `
You are Brian Plescher, founder of Sonexial. You build done-for-you author websites structured for AI-era discovery (Generative Engine Optimization / GEO).
An author (${authorName}) recently ran a free GEO audit on their website: ${url}.

Audit Findings:
- GEO Score: ${score}/100 (${grade})
- Critical Failures: ${JSON.stringify(criticalFailures)}
- Key Recommendations: ${JSON.stringify(recommendations)}

Analyze these audit results and formulate an outreach strategy:
1. What is the core reason AI engines (ChatGPT, Perplexity, Claude, Google AI Overviews) are struggling to recommend or cite this author?
2. What are the specific high-leverage fixes needed (e.g. llms.txt roadmap, JSON-LD Schema entity mapping, semantic heading hierarchy)?
3. Which Sonexial package is the natural solution (Author Foundation for $1,500 or Author Platform for $3,000)?
4. What tone will resonate best with this author (empathetic, authoritative, peer-to-peer author-to-author, direct)?
`;

    const step1Res = await getAnthropicClient().messages.create({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: step1Prompt }]
    });

    const positioningBrief = step1Res.content[0].text;
    console.log('Pitch generation step 1 complete.');

    // Step 2 — Structured Pitch Deliverables
    const step2Prompt = `
You are Brian Plescher, founder of Sonexial. Using the Positioning Brief and audit data below, write a short, punchy, empathetic outreach note to ${authorName}.

Positioning Brief:
${positioningBrief}

Audit Summary:
- Website: ${url}
- GEO Score: ${score}/100 (${grade})
- Critical Failures: ${JSON.stringify(criticalFailures)}
- Recommendations: ${JSON.stringify(recommendations)}

Requirements:
- Professional, peer-to-peer (author to author), authoritative, but empathetic.
- Under 200 words.
- Clearly explain the specific discovery obstacles detected (mention llms.txt, Schema, or entity links where relevant).
- Present the appropriate Sonexial package as the solution.

Output valid JSON ONLY — no markdown fences, no commentary:
{
  "subject": "Quick note regarding your AI discoverability (GEO Audit)",
  "email_draft": "The full text of the personalized outreach email (under 200 words).",
  "recommended_package": "Author Foundation ($1,500) or Author Platform ($3,000)",
  "key_findings_summary": ["Point 1", "Point 2", "Point 3"]
}
`;

    const step2Res = await getAnthropicClient().messages.create({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: step2Prompt }]
    });

    const deliverables = parseJson(step2Res.content[0].text, 'scan pitch deliverables');
    console.log('Pitch generation step 2 complete.');

    return {
        subject: deliverables.subject,
        email_draft: deliverables.email_draft,
        recommended_package: deliverables.recommended_package,
        key_findings_summary: deliverables.key_findings_summary || []
    };
}

module.exports = { generatePitch };
