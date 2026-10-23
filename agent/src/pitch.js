const llm = require('./llm');
const { sanitizeLog, parseJson } = require('./ai-utils');

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
- Technical readiness (heuristic): ${score}/100 (${grade})
- Critical Failures: ${JSON.stringify(criticalFailures)}
- Key Recommendations: ${JSON.stringify(recommendations)}

Analyze these audit results and formulate an outreach strategy:
1. Which technical issues were actually observed? Do NOT infer that an AI engine has failed to cite or recommend the author; this audit cannot measure that.
2. What verifiable, high-impact improvements would make the site more accessible and accurate (for example, valid canonicals, crawl rules, schema consistent with the page, or meaningful content)? llms.txt is optional, not a ranking factor.
3. Which Sonexial package is the natural solution (GEO Diagnostic for $297, Author Starter for $497, or Author Platform for $3,000)?
4. What tone will resonate best with this author (empathetic, authoritative, peer-to-peer author-to-author, direct)?
`;

    const positioningBrief = await llm.complete(step1Prompt, { maxTokens: 1500 });
    console.log('Pitch generation step 1 complete.');

    // Step 2 — Structured Pitch Deliverables
    const step2Prompt = `
You are Brian Plescher, founder of Sonexial. Using the Positioning Brief and audit data below, write a short, punchy, empathetic outreach note to ${authorName}.

Positioning Brief:
${positioningBrief}

Audit Summary:
- Website: ${url}
- Technical readiness (heuristic): ${score}/100 (${grade})
- Critical Failures: ${JSON.stringify(criticalFailures)}
- Recommendations: ${JSON.stringify(recommendations)}

Requirements:
- Professional, peer-to-peer (author to author), authoritative, but empathetic.
- Under 200 words.
- Describe only documented page or crawl issues and explain their practical consequences. Do not claim any AI assistant has indexed, ignored, or ranked the site. Do not pitch llms.txt as necessary.
- Suggest a Sonexial package only if it reasonably addresses the observed findings; avoid guaranteed citations, rankings or sales.

Output valid JSON ONLY — no markdown fences, no commentary:
{
  "subject": "Quick note regarding your AI discoverability (GEO Audit)",
  "email_draft": "The full text of the personalized outreach email (under 200 words).",
  "recommended_package": "GEO Diagnostic ($297), Author Starter ($497), or Author Platform ($3,000)",
  "key_findings_summary": ["Point 1", "Point 2", "Point 3"]
}
`;

    const step2Text = await llm.complete(step2Prompt, { maxTokens: 1500 });
    const deliverables = parseJson(step2Text, 'scan pitch deliverables');
    console.log('Pitch generation step 2 complete.');

    return {
        subject: deliverables.subject,
        email_draft: deliverables.email_draft,
        recommended_package: deliverables.recommended_package,
        key_findings_summary: deliverables.key_findings_summary || []
    };
}

module.exports = { generatePitch };
