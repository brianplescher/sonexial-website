const llm = require('../llm');

// Sanitize a value before interpolating into log output — strips newlines/control chars
// that could be used to forge fake log lines.
function sanitizeLog(val) {
    return String(val).replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').slice(0, 200);
}

async function processMetadataKit(payload) {
    console.log('Starting KIT-02 processing...');
    
    const step1Prompt = `
You are an expert book marketing strategist. We are preparing a Metadata Kit (KIT-02) for a book.
Analyze the following book details provided by the author:
${JSON.stringify(payload, null, 2)}

Create a Positioning Brief containing:
1. The Hook (1-2 sentences)
2. Reader Avatar (Who is the ideal reader? Demographics, psychographics, pain points)
3. Search Behavior (What terms are they typing into Amazon to find a book like this?)
4. Tone Calibration (What tone should the description and subtitles strike?)
`;

    const step1Text = await llm.complete(step1Prompt, { maxTokens: 1500 });
    
    const positioningBrief = step1Text;
    console.log('Step 1 complete.');

    const step2Prompt = `
You are an expert Amazon book copywriter. Using the following Positioning Brief and Author Input, generate the deliverables for a Metadata Kit.

Author Input:
${JSON.stringify(payload, null, 2)}

Positioning Brief:
${positioningBrief}

Please provide exactly the following deliverables in valid JSON format ONLY, without any other text or markdown wrapping the JSON:
{
  "amazonDescription": "HTML formatted description for KDP, using bold, italics, and heading tags appropriately.",
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
  "authorBio": "A compelling 1-2 paragraph author bio based on the input."
}

Ensure the backend keyword lengths are accurate character counts. Do not output anything except the JSON.
`;

    const step2Text = await llm.complete(step2Prompt, { maxTokens: 2500 });

    let draftContent = step2Text;

    // Extract JSON robustly — find outermost { } regardless of markdown fencing
    const jsonStart = draftContent.indexOf('{');
    const jsonEnd = draftContent.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
        console.error('Raw AI response (no JSON found):', sanitizeLog(draftContent));
        throw new Error('AI response did not contain valid JSON');
    }
    draftContent = draftContent.slice(jsonStart, jsonEnd + 1);

    let deliverables;
    try {
        deliverables = JSON.parse(draftContent);
    } catch (parseErr) {
        console.error('JSON parse failed. Raw extracted content:', sanitizeLog(draftContent));
        throw new Error(`Failed to parse AI response as JSON: ${parseErr.message}`);
    }
    console.log('Step 2 complete.');
    
    return {
        positioningBrief,
        deliverables
    };
}

module.exports = {
    processMetadataKit
};
