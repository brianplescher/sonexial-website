const llm = require('./llm');
const { sanitizeLog, parseJson } = require('./ai-utils');

const SIGNATURE = `Best,

Brian L. Plescher
Founder & Principal Consultant, Sonexial
616.502.5320
www.sonexial.com`;

function generateTemplatePitch(scanReport, recipientName = 'there', options = {}) {
    const mode = options.mode || scanReport?.mode || 'smb';
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
        topFindings.push('No FAQPage JSON-LD schema to feed direct answers into Google AI Overviews and ChatGPT Search.');
    }

    if (mode === 'smb') {
        const recommendedPackage = score < 60
            ? '72-Hour Done-For-You GEO Fix Sprint ($750) or 30-Page GEO Diagnostic ($297)'
            : '30-Page GEO Diagnostic ($297) or 72-Hour Done-For-You GEO Fix Sprint ($750)';

        const subject = `AI search readiness check on ${host} (${score}/100 vs local benchmark)`;
        const emailDraft = `Hi ${recipientName},

I recently ran our technical GEO (Generative Engine Optimization) scanner on ${host} to check the public signals that AI search systems (ChatGPT Search, Perplexity, Claude, and Google AI Overviews) use when prospective clients ask who to recommend.

Your site currently scores a ${score}/100 (${grade}). Three specific technical gaps stood out that could be costing you AI-driven inquiries:

• Primary Identity & Heading Signals: ${topFindings[0]}
• Missing Service Schema: ${topFindings[1]}
• No AI-Ready FAQs: ${topFindings[2]}

You have two zero-hassle ways to resolve this without changing your website's visual design:

• Option 1 ($297 — DIY Diagnostic): Get our full 30-page GEO Diagnostic, which delivers ready-to-paste Organization, Service, and FAQ JSON-LD schema, plus a prioritized 30-day fix plan you can hand to your web developer: https://sonexial.com/kits

• Option 2 ($750 — Done-For-You in 72 Hours): My studio in Grand Haven will engineer and install the complete AI-readiness schema & semantic fix pack directly on ${host} this week, including a before/after verification scan. (This is the most popular choice for busy business owners and partners).

If you'd like to see a 1-page scope of exactly what the 72-hour fix includes, just reply "yes" to this email. I’ll have my system send it right over, no strings attached.

${SIGNATURE}`;

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

As a fellow author and founder of Sonexial, I ran a quick technical readiness scan on ${host} to see what public entity and book signals AI search crawlers can currently read.

Your site scored ${score}/100 (${grade}). Three specific gaps stood out:
• ${topFindings[0]}
• ${topFindings[1]}
• ${topFindings[2]}

If you manage your own site, our 30-page GEO Diagnostic ($297) generates the exact ready-to-paste Person & Book JSON-LD schema, robots.txt rules, and llms.txt file for your catalog. Or if you'd rather have us handle the implementation or build a clean AI-ready author site ($497 Author Starter), just reply "yes" to this email and I’ll have my system send the details right over, no strings attached.

${SIGNATURE}`;

    return {
        subject,
        email_draft: emailDraft,
        recommended_package: recommendedPackage,
        key_findings_summary: topFindings,
        generated_by: 'template'
    };
}

async function generatePitch(scanReport, recipientName = 'there', options = {}) {
    const mode = options.mode || scanReport?.mode || 'smb';
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
        ? `You are Brian L. Plescher, Founder & Principal Consultant of Sonexial (Grand Haven, MI). You help businesses and professional practices structure their websites for AI-era discovery (Generative Engine Optimization / GEO).`
        : `You are Brian L. Plescher, Founder & Principal Consultant of Sonexial and fellow author.`;

    const packageOptions = mode === 'smb'
        ? `Option 1 ($297 — DIY 30-Page GEO Diagnostic) or Option 2 ($750 — Done-For-You in 72 Hours)`
        : `GEO Diagnostic ($297), Author Starter ($497), or Author Platform ($3,000)`;

    const prompt = `
${roleContext}
We ran a technical GEO readiness audit on ${recipientName}'s website: ${url}.

Audit Findings:
- Technical readiness (heuristic): ${score}/100 (${grade})
- Critical Failures: ${JSON.stringify(criticalFailures)}
- Key Recommendations: ${JSON.stringify(recommendations)}

Write a clear, business-friendly outreach note to ${recipientName} (<190 words):
- Use plain-English bold labels for the 3 gaps so a non-technical owner immediately understands why it costs them AI-driven inquiries, while keeping exact technical proof (H1, JSON-LD, FAQPage) so their web developer respects it.
- Recommend ${packageOptions}.
- End the body with: 'If you'd like to see a 1-page scope of exactly what the 72-hour fix includes, just reply "yes" to this email. I’ll have my system send it right over, no strings attached.'
- End with this exact signature:
${SIGNATURE}

Output valid JSON ONLY — no markdown fences:
{
  "subject": "AI search readiness check on domain (${score}/100 vs local benchmark)",
  "email_draft": "Full text of the personalized outreach email.",
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

module.exports = { generatePitch, generateTemplatePitch, SIGNATURE };
