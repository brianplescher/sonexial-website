const crypto = require('crypto');

// Netlify signs outgoing webhooks with an HS256 JWS in X-Webhook-Signature whose payload is
// { iss: 'netlify', sha256: <hex SHA-256 of the raw request body> }.
function verifyNetlifySignature(rawBody, signature, secret) {
    if (!rawBody || typeof signature !== 'string' || !secret) return false;

    const parts = signature.split('.');
    if (parts.length !== 3) return false;
    const [encodedHeader, encodedPayload, encodedSig] = parts;

    try {
        const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
        if (header.alg !== 'HS256') return false;

        const expected = crypto.createHmac('sha256', secret)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest();
        const received = Buffer.from(encodedSig, 'base64url');
        if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
            return false;
        }

        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
        const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
        return payload.iss === 'netlify' && payload.sha256 === bodyHash;
    } catch {
        return false;
    }
}

module.exports = { verifyNetlifySignature };
