const llm = require('../llm');
const { parseJson } = require('../ai-utils');

async function processCoverAuditKit(payload) {
    console.log('Starting cover-audit processing...');

    // Step 1 — Genre Signal Brief
    // Note: we cannot fetch the cover_link URL directly, but we use all available
    // contextual signals (genre, comp covers, placement contexts, author concerns)
    // to produce a thorough genre-convention analysis.
    const step1Prompt = `
You are an expert in book cover design, genre visual conventions, and reader psychology. An author has submitted the following intake for a Cover Design Signal Audit:

${JSON.stringify(payload, null, 2)}

Note: You do not have direct image access to the cover. Produce a Genre Signal Framework covering:
1. Current Genre Visual Conventions — what the top 20 bestselling covers in this genre reliably signal (typography style, color palette, composition, imagery type)
2. Thumbnail Legibility Standards — what must be readable and recognizable at 80px × 120px for this genre on Amazon mobile
3. Comp Cover Analysis — based on the comp covers/authors listed, what specific visual patterns are they using that readers of this genre expect
4. Common Failure Modes — the 3–5 most common ways covers in this genre fail to convert clicks (be specific, not generic)
5. Platform-Specific Considerations — any notable differences for the placements indicated (Amazon ebook thumbnail vs. Facebook ad square crop vs. BookBub banner)
`;

    const step1Text = await llm.complete(step1Prompt, { maxTokens: 1500 });

    const genreFramework = step1Text;
    console.log('Cover audit step 1 complete.');

    // Step 2 — Audit Deliverables
    const step2Prompt = `
You are an expert book cover design auditor. Using the Genre Signal Framework and Author Input below, produce a Cover Design Signal Audit.

Author Input:
${JSON.stringify(payload, null, 2)}

Genre Signal Framework:
${genreFramework}

Important: You do not have direct image access. Base your audit on the author's described concerns, the genre framework, and the comp covers provided. Flag this clearly where relevant.

Output valid JSON ONLY — no markdown fences, no commentary:
{
  "overallSignalScore": "A letter grade (A–F) with a one-sentence justification based on available information",
  "typographyAssessment": {
    "finding": "Assessment of likely typography approach for this genre",
    "thumbnailRisk": "Low / Medium / High",
    "recommendation": "Specific, actionable recommendation"
  },
  "genreAlignmentAssessment": {
    "finding": "How well the described cover aligns with genre conventions",
    "misalignmentRisks": ["Risk 1", "Risk 2"],
    "recommendation": "Specific, actionable recommendation"
  },
  "thumbnailTestAssessment": {
    "finding": "What likely works and what likely fails at 80px thumbnail size for this genre",
    "criticalElements": ["Element that must be legible 1", "Element that must be legible 2"],
    "recommendation": "Specific, actionable recommendation"
  },
  "platformSpecificNotes": [
    {
      "platform": "Platform name",
      "note": "Specific note for this placement"
    }
  ],
  "prioritizedRevisions": [
    {
      "priority": 1,
      "issue": "The most critical issue to fix",
      "fix": "Exact instruction for a designer"
    },
    {
      "priority": 2,
      "issue": "...",
      "fix": "..."
    },
    {
      "priority": 3,
      "issue": "...",
      "fix": "..."
    }
  ],
  "designerBrief": "A 2–3 paragraph brief the author can hand directly to a cover designer, written in plain language, describing the required changes and the genre-specific rationale behind each.",
  "dataLimitation": "Brief note acknowledging that this audit is based on genre conventions and author-provided context, not direct image analysis, and what to do if they want image-level feedback."
}
`;

    const step2Text = await llm.complete(step2Prompt, { maxTokens: 2500 });

    const deliverables = parseJson(step2Text, 'cover-audit deliverables');
    console.log('Cover audit step 2 complete.');

    return { genreFramework, deliverables };
}

module.exports = { processCoverAuditKit };
