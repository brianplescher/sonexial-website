const crypto = require('crypto');

const DEFAULT_TOLERANCE_SECONDS = 300;

/**
 * Verifies a Stripe-Signature header against the raw request body (Stripe's manual verification scheme).
 * Throws when the signature is missing, malformed, stale, or does not match.
 */
function verifyStripeSignature(rawBody, header, secret, { tolerance = DEFAULT_TOLERANCE_SECONDS, now = Date.now() } = {}) {
    if (!rawBody || !header || !secret) throw new Error('Missing body, signature, or secret');

    let timestamp = null;
    const signatures = [];
    for (const part of String(header).split(',')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (key === 't') timestamp = value;
        else if (key === 'v1') signatures.push(value);
    }
    if (!timestamp || !signatures.length) throw new Error('Malformed Stripe-Signature header');

    const age = Math.abs(now / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > tolerance) throw new Error('Stripe signature timestamp outside tolerance');

    const expected = crypto.createHmac('sha256', secret)
        .update(`${timestamp}.${Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody}`)
        .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const match = signatures.some(sig => {
        const buf = Buffer.from(sig, 'hex');
        return buf.length === expectedBuf.length && crypto.timingSafeEqual(buf, expectedBuf);
    });
    if (!match) throw new Error('No matching Stripe signature');

    return JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody);
}

function configuredIds(envValue) {
    return String(envValue || '').split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Whether a completed Checkout Session is a GEO Diagnostic purchase, matched by Payment Link ID.
 */
function isDiagnosticSession(session, paymentLinkIds = configuredIds(process.env.STRIPE_DIAGNOSTIC_PAYMENT_LINKS)) {
    return Boolean(session && session.payment_link && paymentLinkIds.includes(session.payment_link));
}

function normalizeSiteUrl(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const url = new URL(withScheme);
        return url.hostname.includes('.') ? url.href : null;
    } catch {
        return null;
    }
}

/**
 * Pulls the buyer, site URL, and lead reference out of a Checkout Session.
 * The URL comes from a Payment Link custom text field whose key mentions url/website/site.
 */
function extractOrder(session) {
    const field = (session.custom_fields || []).find(f => f && f.type === 'text' && /url|website|site/i.test(f.key || ''));
    return {
        sessionId: session.id,
        email: session.customer_details?.email || session.customer_email || null,
        name: session.customer_details?.name || null,
        siteUrl: normalizeSiteUrl(field?.text?.value),
        leadId: session.client_reference_id || null,
        paid: session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
    };
}

module.exports = { verifyStripeSignature, isDiagnosticSession, extractOrder, normalizeSiteUrl, configuredIds };
