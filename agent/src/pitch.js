const llm = require('./llm');
const { sanitizeLog, parseJson } = require('./ai-utils');

function generateTemplatePitch(scanReport, recipientName = 'there', options = {}) {
    const mode = options.mode || scanReport?.mode || 'author';
    const previewUrl = options.previewUrl || 'https://sonexial.com/scan/';
    const url = scanReport?.url || 'your website';
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}

    const score = scanReport?.score ?? 0;
    const grade = scanReport?.geo_grade || 'Needs Review';
    const failures = scanReport?.critical_failures || [];
    const recs = scanReport?.recommendations || [];
    const topFindings = [...failures, ...recs].slice(0, 3);
    while (topFindings.length < 3) {
        topFindings.push('Missing structured entity connections for automated search parsers.');
    }

    if (mode === 'smb') {
        const recommendedPackage = score < 45
            ? '72-Hour GEO Implementation Sprint ($750) or Full 30-Page Diagnostic ($297)'
            : 'GEO Diagnostic + Ready-to-Paste Schema Pack ($297)';

        const subject = `AI search readiness check on ${host} (${score}/100)`;
        const emailDraft = `Hi ${recipientName},

I ran our technical GEO (Generative Engine Optimization) scanner on ${host} to check the public signals that AI search crawlers (ChatGPT Search, Perplexity, Claude, and Google AI Overviews) use to verify businesses and services.

${host} currently scores ${score}/100 (${grade}). Three specific technical gaps stood out:
1. ${topFindings[0]}
2. ${topFindings[1]}
3. ${topFindings[2]}

You can view the technical snapshot here: ${previewUrl}

If you have an in-house web person, you can order the full 30-page GEO Diagnostic ($297)—which includes ready-to-paste Organization/Service JSON-LD schema, robots.txt crawler rules, and a prioritized 30-day fix plan.

Or, if you want my studio to simply build and install the complete AI-readiness fix pack for ${host} in 72 hours ($750 flat, 100% credited if you ever rebuild), just reply "FIX" and I will send the 1-page scope.

Best,
Brian Plescher
Founder, Sonexial (Grand Haven, MI)
https://sonexial.com`;

        return {
            subject,
            email_draft: emailDraft,
            recommended_package: recommendedPackage,
            key_findings_summary: topFindings,
            generated_by: 'template'
        };
    }

    const recommendedPackage = score < 45
        ? 'Author Starter ($497) or GEO Diagnostic ($297)'
        : 'GEO Diagnostic ($297)';

    const subject = `Quick note on ${host}'s AI discoverability signals (${score}/100)`;
    const emailDraft = `Hi ${recipientName},

As a fellow author and founder of Sonexial, I ran a quick technical readiness scan on ${host} to see what public entity and book signals search crawlers can currently parse.

Your site scored ${score}/100 (${grade}). The main technical gaps detected were:
1. ${topFindings[0]}
2. ${topFindings[1]}
3. ${topFindings[2]}

You can review the scan details here: ${previewUrl}

If you manage your own site, our 30-page GEO Diagnostic ($297) generates the exact ready-to-paste Person & Book JSON-LD schema, robots.txt rules, and llms.txt file for your catalog. Or if you'd rather have us handle the implementation or build a clean AI-ready author site ($497 Author Starter), just reply to this email and I'll point you in the right direction.

Warmly,
Brian Plescher
Founder, Sonexial
https://sonexial.com`;

    return {
        subject,
        email_draft: emailDraft,
        recommended_package: recommendedPackage,
        key_findings_summary: topFindings,
        generated_by: 'template'
    };
}

async function generatePitch(scanReport, recipientName = 'Author', options = {}) {
    const mode = options.mode || scanReport?.mode || 'author';
    const useLlm = options.useLlm !== false;
    const fallback = generateTemplatePitch(scanReport, recipientName, { ...options, mode });

    if (!useLlm) {
        return fallback;
    }

    console.log(`Starting ${mode} pitch generation for ${sanitizeLog(recipientName)} (${sanitizeLog(scanReport?.url || 'unknown url')})...`);

    const url = scanReport?.url || 'their website';
    const score = scanReport?.score ?? 0;
    const grade = scanReport?.geo_grade || 'Needs Review';
    const criticalFailures = scanReport?.critical_failures || [];
    const recommendations = scanReport?.recommendations || [];

    const roleContext = mode === 'smb'
        ? `You are Brian Plescher, founder of Sonexial (MS Management/Strategy, former Amazon Operations & HRBP leader). You help SMBs, consultancies, and professional practices structure their websites for AI-era discovery (Generative Engine Optimization / GEO).`
        : `You are Brian Plescher, founder of Sonexial and fellow author. You build done-for-you author websites and GEO diagnostics structured for AI-era discovery.`;

    const packageOptions = mode === 'smb'
        ? `GEO Diagnostic with ready-to-paste schema/crawler code ($297), 72-Hour Done-For-You GEO Implementation Sprint ($750), or Full AI-Ready Website Build ($1,500-$3,000)`
        : `GEO Diagnostic ($297), Author Starter ($497), or Author Platform ($3,000)`;

    const prompt = `
${roleContext}
We ran a technical GEO readiness audit on ${recipientName}'s website: ${url}.

Audit Findings:
- Technical readiness (heuristic): ${score}/100 (${grade})
- Critical Failures: ${JSON.stringify(criticalFailures)}
- Key Recommendations: ${JSON.stringify(recommendations)}

Write a short, punchy, peer-to-peer outreach note to ${recipientName} (<180 words):
- Describe ONLY the documented page or crawl issues above and their practical consequences.
- Do NOT claim any AI assistant has indexed, ignored, or ranked the site. Do NOT pitch llms.txt as mandatory.
- Recommend the most natural package from: ${packageOptions}.
- Give a frictionless reply CTA (e.g., reply "FIX" or check the self-serve diagnostic).

Output valid JSON ONLY — no markdown fences:
{
  "subject": "Specific, non-spammy subject line referencing their domain and score",
  "email_draft": "Full text of the personalized outreach email (<180 words).",
  "recommended_package": "Recommended package name and price",
  "key_findings_summary": ["Finding 1", "Finding 2", "Finding 3"]
}
`;

    try {
        const raw = await llm.complete(prompt, { maxTokens: 1000 });
        const deliverables = parseJson(raw, 'scan pitch deliverables');
        return {
            subject: deliverables.subject || fallback.subject,
            email_draft: deliverables.email_draft || fallback.email_draft,
            recommended_package: deliverables.recommended_package || fallback.recommended_package,
            key_findings_summary: deliverables.key_findings_summary || fallback.key_findings_summary,
            generated_by: 'llm'
        };
    } catch (err) {
        console.warn('LLM pitch unavailable, using deterministic template:', sanitizeLog(err.message));
        return fallback;
    }
}

module.exports = { generatePitch, generateTemplatePitch };
