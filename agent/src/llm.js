// Single OpenAI-compatible chat client for every AI call in the agent.
// Defaults to Qwen on Together AI; point LLM_BASE_URL/LLM_MODEL at any
// OpenAI-compatible provider to switch.

const DEFAULT_BASE_URL = 'https://api.together.ai/v1';
const DEFAULT_MODEL = 'Qwen/Qwen3.8-Flash';
const REQUEST_TIMEOUT_MS = 120000;

function getApiKey() {
    return process.env.LLM_API_KEY || process.env.TOGETHER_API_KEY || '';
}

function isConfigured() {
    return Boolean(getApiKey());
}

function getModel() {
    return process.env.LLM_MODEL || DEFAULT_MODEL;
}

function getBaseUrl() {
    let base = process.env.LLM_BASE_URL || DEFAULT_BASE_URL;
    while (base.endsWith('/')) base = base.slice(0, -1);
    return base;
}

/**
 * Sends a single-turn prompt and returns the assistant's text.
 * @param {string} prompt
 * @param {{ maxTokens?: number, temperature?: number }} [options]
 * @returns {Promise<string>}
 */
async function complete(prompt, options = {}) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('LLM_API_KEY (or TOGETHER_API_KEY) is required but not set');
    }

    const res = await fetch(`${getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: getModel(),
            max_tokens: options.maxTokens || 1500,
            temperature: options.temperature ?? 0.7,
            messages: [{ role: 'user', content: prompt }]
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`LLM request failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('LLM returned an empty response');
    }

    return text;
}

module.exports = { complete, isConfigured, getModel, getBaseUrl, DEFAULT_MODEL, DEFAULT_BASE_URL };
