// Shared helpers for modules that consume LLM output.

// Strips newlines/control chars that could be used to forge fake log lines.
function sanitizeLog(val) {
    return String(val).replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').slice(0, 200);
}

// Extracts the outermost JSON object from a model response.
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

module.exports = { sanitizeLog, parseJson };
