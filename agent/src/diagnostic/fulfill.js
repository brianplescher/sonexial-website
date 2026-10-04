const crypto = require('crypto');
const db = require('../db');
const mailer = require('../email');
const { sanitizeLog } = require('../ai-utils');
const { runDiagnostic } = require('./index');
const { renderDiagnosticHtml } = require('./render');

function publicBaseUrl() {
    return (process.env.PUBLIC_BASE_URL || 'https://sonexial.com').replace(/\/+$/, '');
}

function publicReportUrl(token) {
    return `${publicBaseUrl()}/api/diagnostic/${token}`;
}

/**
 * Where a buyer whose checkout had no website URL enters one. Stripe's post-payment redirect lands here too.
 */
function publicStartUrl(stripeSessionId) {
    return `${publicBaseUrl()}/diagnostic/start/?session_id=${encodeURIComponent(stripeSessionId)}`;
}

function newToken() {
    return crypto.randomBytes(24).toString('hex');
}

/**
 * Records an order. Returns null when the Stripe session was already recorded (webhook retry).
 */
async function createOrder({ stripeSessionId, email, name, siteUrl, source }) {
    const order = {
        id: crypto.randomUUID(),
        token: newToken(),
        stripeSessionId,
        email,
        name,
        siteUrl,
        status: siteUrl ? 'queued' : 'needs_url',
        source
    };
    const inserted = await db.createDiagnostic(order);
    return inserted ? order : null;
}

/**
 * Runs the diagnostic for a recorded order, stores the HTML, and emails the buyer when an email is known.
 */
async function fulfillOrder(order) {
    const reportUrl = publicReportUrl(order.token);
    try {
        await db.updateDiagnostic(order.id, { status: 'running' });
        const diag = await runDiagnostic(order.siteUrl);
        const html = renderDiagnosticHtml(diag, { name: order.name });
        await db.updateDiagnostic(order.id, { status: 'ready', result: diag, html });

        if (order.email && await mailer.sendDiagnosticEmail(order.email, order.name, diag, html, reportUrl)) {
            await db.updateDiagnostic(order.id, { status: 'delivered' });
        }
        await mailer.sendDiagnosticOwnerNotice(`Delivered: ${diag.url}`, [
            `Buyer: ${order.email || '(none — admin run)'}`,
            `Report: ${reportUrl}`,
            `AI Readiness ${diag.scores.aiReadiness}/100, Site Health ${diag.scores.siteHealth}%, ${diag.issues.length} issues, ${diag.pagesCrawled} pages`
        ]).catch(err => console.error('Diagnostic owner notice failed:', sanitizeLog(err.message)));
        return { reportUrl, diag };
    } catch (err) {
        console.error('Diagnostic fulfillment failed:', sanitizeLog(err.message));
        await db.updateDiagnostic(order.id, { status: 'failed', error: String(err.message).slice(0, 500) });
        await mailer.sendDiagnosticOwnerNotice(`FAILED: ${order.siteUrl}`, [
            `Order: ${order.id}`,
            `Buyer: ${order.email || '(none)'}`,
            `Error: ${err.message}`,
            'Re-run with POST /diagnostics/:id/retry once fixed.'
        ]).catch(e => console.error('Diagnostic owner notice failed:', sanitizeLog(e.message)));
        return { reportUrl, error: err.message };
    }
}

module.exports = { createOrder, fulfillOrder, publicReportUrl, publicStartUrl };
