require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const pipeline = require('./pipeline');
const scanner = require('./scanner');
const pitch = require('./pitch');
const llm = require('./llm');
const mailer = require('./email');
const stripe = require('./stripe');
const { verifyNetlifySignature } = require('./netlify-signature');
const diagnostics = require('./diagnostic/fulfill');

const app = express();
app.disable('x-powered-by'); // Prevent Express version disclosure in response headers
const PORT = process.env.PORT || 3000;
const NETLIFY_WEBHOOK_SECRET = process.env.NETLIFY_WEBHOOK_SECRET;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// Buyers normally enter their URL on the post-payment page within seconds; only chase the ones who don't.
const URL_REMINDER_DELAY_MS = 10 * 60 * 1000;

// Raw body parser for webhook signature verification and standard JSON body parsing
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// CORS middleware for public /api endpoints
// Production origins allowed: https://sonexial.com and https://www.sonexial.com
const ALLOWED_ORIGINS = ['https://sonexial.com', 'https://www.sonexial.com'];

const corsMiddleware = (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
};

app.use('/api', corsMiddleware);

// In-memory fixed-window rate limiting by IP, one window map per limiter.
// Note: In a multi-instance or high-traffic production deployment, this should move to a persistent store (e.g. Redis).
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function createRateLimiter(maxPerWindow) {
    const windows = new Map();

    setInterval(() => {
        const now = Date.now();
        for (const [ip, data] of windows) {
            if (now > data.resetTime) windows.delete(ip);
        }
    }, RATE_LIMIT_WINDOW_MS).unref();

    return function rateLimiter(req, res, next) {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
                   req.ip ||
                   req.socket.remoteAddress ||
                   'unknown';
        const now = Date.now();
        const clientData = windows.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

        if (now > clientData.resetTime) {
            clientData.count = 1;
            clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
        } else {
            clientData.count++;
        }

        windows.set(ip, clientData);

        if (clientData.count > maxPerWindow) {
            return res.status(429).json({ error: 'Too many requests. Please wait a moment before scanning again.' });
        }
        next();
    };
}

// Each scan triggers outbound fetches; the report unlock also re-scans, writes a lead, and calls the LLM.
const scanRateLimiter = createRateLimiter(10);
const reportRateLimiter = createRateLimiter(5);
const diagnosticRateLimiter = createRateLimiter(20);

// Parsed rather than pattern-matched: an email regex with adjacent unbounded character
// classes backtracks quadratically on crafted input.
function isValidEmail(value) {
    if (typeof value !== 'string') return false;

    const email = value.trim();
    if (!email || email.length > 254 || /\s/.test(email)) return false;

    const at = email.indexOf('@');
    if (at < 1 || at !== email.lastIndexOf('@')) return false;

    const domain = email.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    return dot > 0 && domain.length - dot - 1 >= 2;
}

// Strip control characters before logging so error text cannot forge log lines.
function sanitizeLog(val) {
    return String(val).replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').slice(0, 200);
}

// Free tier of the report: score, grade, and the three worst failures. The rest is emailed.
const FREE_FAILURES = 3;

function toFreeReport(report) {
    return {
        url: report.url,
        status: report.status,
        score: report.score,
        geo_grade: report.geo_grade,
        execution_time: report.execution_time,
        critical_failures: report.critical_failures.slice(0, FREE_FAILURES),
        locked_failures: Math.max(0, report.critical_failures.length - FREE_FAILURES),
        locked_recommendations: report.recommendations.length,
        locked: true
    };
}

// Admin middleware
const requireAdmin = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!ADMIN_TOKEN || !auth || auth !== `Bearer ${ADMIN_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Public GEO Scanner endpoint (synchronous, stateless, no DB or email coupling).
// Returns the free tier only; the full breakdown is unlocked by POST /api/scan/report.
app.post('/api/scan', scanRateLimiter, async (req, res) => {
    try {
        const { url } = req.body || {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid "url" field.' });
        }

        const report = await scanner.runScan(url);
        res.status(200).json(toFreeReport(report));
    } catch (err) {
        console.error('Scan error:', err.message);
        const isClientError = err.message.includes('SSRF') ||
                              err.message.includes('Invalid URL') ||
                              err.message.includes('Forbidden protocol') ||
                              err.message.includes('Unable to fetch') ||
                              err.message.includes('DNS resolution failed');
        res.status(isClientError ? 400 : 500).json({ error: err.message });
    }
});

// Email gate: exchanges an email address for the full report.
// The scan itself is free; /api/scan returns the score and critical failures, and this route is
// what unlocks the detailed breakdown, mails a copy, and records the lead.
app.post('/api/scan/report', reportRateLimiter, async (req, res) => {
    try {
        const { email, name, honeypot, scanReport } = req.body || {};

        // Honeypot field is hidden from humans; any value means a bot filled the form.
        if (honeypot) {
            return res.status(200).json({ ok: true });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'A valid email address is required.' });
        }

        if (!scanReport || !scanReport.url || typeof scanReport.score !== 'number') {
            return res.status(400).json({ error: 'Run a scan before requesting the full report.' });
        }

        // Re-run the scan server-side: the client-supplied report is untrusted and may be stale.
        const report = await scanner.runScan(scanReport.url);
        const lead = {
            email: email.trim().toLowerCase(),
            name: typeof name === 'string' ? name.trim().slice(0, 120) : null,
            scannedUrl: report.url,
            score: report.score,
            geoGrade: report.geo_grade,
            report
        };

        await db.createLead(crypto.randomUUID(), lead);

        // Delivery must not block the unlock; a Resend outage should still reveal the report.
        void Promise.allSettled([
            mailer.sendScanReportEmail(lead.email, lead.name, report),
            mailer.sendLeadNotification(lead)
        ]).then(results => {
            results.filter(r => r.status === 'rejected')
                .forEach(r => console.error('Lead email failed:', sanitizeLog(r.reason?.message || r.reason)));
        });

        let pitchDraft = null;
        if (llm.isConfigured()) {
            try {
                pitchDraft = await pitch.generatePitch(report, lead.name || 'Author');
            } catch (err) {
                console.error('Pitch generation error:', sanitizeLog(err.message));
            }
        }

        res.status(200).json({
            ok: true,
            report,
            pitch: pitchDraft
        });
    } catch (err) {
        console.error('Report unlock error:', sanitizeLog(err.message));
        res.status(500).json({ error: 'Could not generate your report. Please try again.' });
    }
});

// Netlify Webhook receiver (asynchronous, DB job queue + email fulfillment)
app.post('/webhooks/netlify', async (req, res) => {
    if (!NETLIFY_WEBHOOK_SECRET) {
        return res.status(503).json({ error: 'Netlify webhook not configured' });
    }
    if (!verifyNetlifySignature(req.rawBody, req.headers['x-webhook-signature'], NETLIFY_WEBHOOK_SECRET)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
        
        const payload = req.body;
        const kitType = payload.form_name || 'amazon-visibility-kit';
        const jobId = crypto.randomUUID();
        
        await db.createJob(jobId, kitType, payload);
        res.status(202).json({ message: 'Accepted', jobId });
        
        void pipeline.processJob(jobId, kitType, payload);
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stripe fulfillment for the GEO Diagnostic. Verified against req.rawBody (captured by the global JSON parser).
app.post('/webhooks/stripe', async (req, res) => {
    if (!STRIPE_WEBHOOK_SECRET) {
        return res.status(503).json({ error: 'Stripe webhook not configured' });
    }

    let event;
    try {
        event = stripe.verifyStripeSignature(req.rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Stripe signature rejected:', sanitizeLog(err.message));
        return res.status(400).json({ error: 'Invalid signature' });
    }

    const fulfillable = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
    const session = event.data && event.data.object;
    if (!fulfillable.includes(event.type) || !stripe.isDiagnosticSession(session)) {
        return res.status(200).json({ received: true, ignored: true });
    }

    try {
        const order = stripe.extractOrder(session);
        if (!order.paid) {
            return res.status(200).json({ received: true, pending: true });
        }

        if ((!order.siteUrl || !order.email) && order.leadId) {
            const lead = await db.getLead(order.leadId).catch(() => null);
            if (lead) {
                order.siteUrl = order.siteUrl || stripe.normalizeSiteUrl(lead.scanned_url);
                order.email = order.email || lead.email;
                order.name = order.name || lead.name;
            }
        }

        const record = await diagnostics.createOrder({
            stripeSessionId: order.sessionId,
            email: order.email,
            name: order.name,
            siteUrl: order.siteUrl,
            source: 'stripe'
        });
        if (!record) {
            return res.status(200).json({ received: true, duplicate: true });
        }

        res.status(200).json({ received: true });

        if (record.status === 'needs_url') {
            setTimeout(() => { void remindMissingUrl(record); }, URL_REMINDER_DELAY_MS).unref();
            return;
        }
        void diagnostics.fulfillOrder(record);
    } catch (err) {
        console.error('Stripe webhook error:', sanitizeLog(err.message));
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
});

async function remindMissingUrl(record) {
    try {
        const row = await db.getDiagnostic(record.id);
        if (!row || row.status !== 'needs_url') return;
        const startUrl = diagnostics.publicStartUrl(row.stripe_session_id);
        const emailed = row.email
            ? await mailer.sendDiagnosticUrlRequest(row.email, row.name, startUrl).catch(err => {
                console.error('Diagnostic URL request failed:', sanitizeLog(err.message));
                return false;
            })
            : false;
        await mailer.sendDiagnosticOwnerNotice(`Waiting on a URL: ${row.email || row.stripe_session_id}`, [
            `Order: ${row.id}`,
            `Buyer: ${row.email || '(unknown)'}`,
            emailed ? `Buyer was emailed the start link: ${startUrl}` : `Could not email the buyer. Send them: ${startUrl}`,
            'Or set it yourself: POST /diagnostics/:id/retry with {"url": "..."}.'
        ]);
    } catch (err) {
        console.error('Diagnostic URL reminder failed:', sanitizeLog(err.message));
    }
}

// Post-payment step: the buyer names the site for an order whose checkout did not collect one.
// The Checkout Session ID arrives via the Payment Link redirect and is only known to the buyer.
app.post('/api/diagnostic/start', diagnosticRateLimiter, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const { sessionId, url } = req.body || {};
    if (!stripe.isCheckoutSessionId(sessionId)) {
        return res.status(400).json({ error: 'This link is missing a valid checkout reference. Reply to your receipt email and we will sort it out.' });
    }
    try {
        const row = await db.getDiagnosticBySession(sessionId);
        if (!row) {
            return res.status(404).json({ error: 'We have not received payment confirmation from Stripe yet.', retry: true });
        }
        const reportUrl = diagnostics.publicReportUrl(row.token);
        if (row.status !== 'needs_url') {
            return res.status(200).json({ status: row.status, reportUrl });
        }
        const siteUrl = stripe.normalizeSiteUrl(url);
        if (!siteUrl) {
            return res.status(400).json({ error: 'Enter your website address, for example yourname.com.' });
        }
        if (!await db.claimDiagnosticUrl(row.id, siteUrl)) {
            return res.status(200).json({ status: 'queued', reportUrl });
        }
        res.status(202).json({ status: 'queued', reportUrl });
        void diagnostics.fulfillOrder({ id: row.id, token: row.token, email: row.email, name: row.name, siteUrl });
    } catch (err) {
        console.error('Diagnostic start error:', sanitizeLog(err.message));
        if (!res.headersSent) res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// Hosted diagnostic report. The token is the only credential, so it is long and random.
app.get('/api/diagnostic/:token', async (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'private, no-store');
    if (!/^[a-f0-9]{48}$/.test(req.params.token)) {
        return res.status(404).send('Not found');
    }
    try {
        const row = await db.getDiagnosticByToken(req.params.token);
        if (!row) return res.status(404).send('Not found');
        if (row.html) return res.status(200).type('html').send(row.html);
        if (row.status === 'failed') {
            return res.status(200).type('html').send('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>GEO Diagnostic</title></head><body style="font-family:sans-serif;max-width:600px;margin:60px auto;"><h1>We hit a problem generating your diagnostic.</h1><p>We have been notified and will email you as soon as it is ready.</p></body></html>');
        }
        res.status(200).type('html').send('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="15"><title>GEO Diagnostic</title></head><body style="font-family:sans-serif;max-width:600px;margin:60px auto;"><h1>Your diagnostic is being generated.</h1><p>This usually takes a minute or two. This page refreshes automatically, and we will also email you when it is ready.</p></body></html>');
    } catch (err) {
        console.error('Diagnostic page error:', sanitizeLog(err.message));
        res.status(500).send('Error');
    }
});

// Admin: run a diagnostic without a Stripe purchase (comps, previews, manual orders).
app.post('/diagnostics', requireAdmin, async (req, res) => {
    try {
        const { url, email, name } = req.body || {};
        const siteUrl = stripe.normalizeSiteUrl(url);
        if (!siteUrl) return res.status(400).json({ error: 'A valid "url" is required.' });
        if (email !== undefined && !isValidEmail(email)) {
            return res.status(400).json({ error: '"email" is not a valid address.' });
        }

        const record = await diagnostics.createOrder({
            stripeSessionId: null,
            email: email ? email.trim().toLowerCase() : null,
            name: typeof name === 'string' ? name.trim().slice(0, 120) : null,
            siteUrl,
            source: 'admin'
        });
        res.status(202).json({ id: record.id, reportUrl: diagnostics.publicReportUrl(record.token) });
        void diagnostics.fulfillOrder(record);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/diagnostics/:id', requireAdmin, async (req, res) => {
    try {
        const row = await db.getDiagnostic(req.params.id);
        if (!row) return res.status(404).json({ error: 'Not found' });
        const { token, ...rest } = row;
        res.json({ ...rest, reportUrl: diagnostics.publicReportUrl(token) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/diagnostics/:id/retry', requireAdmin, async (req, res) => {
    try {
        const row = await db.getDiagnostic(req.params.id);
        if (!row) return res.status(404).json({ error: 'Not found' });
        const siteUrl = req.body && req.body.url ? stripe.normalizeSiteUrl(req.body.url) : row.site_url;
        if (!siteUrl) return res.status(400).json({ error: 'This order has no URL; pass {"url": "..."}.' });

        await db.updateDiagnostic(row.id, { status: 'queued', siteUrl });
        const order = { id: row.id, token: row.token, email: row.email, name: row.name, siteUrl };
        res.status(202).json({ id: row.id, reportUrl: diagnostics.publicReportUrl(row.token) });
        void diagnostics.fulfillOrder(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin endpoints
app.get('/jobs', requireAdmin, async (req, res) => {
    try {
        const jobs = await db.getRecentJobs();
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/leads', requireAdmin, async (req, res) => {
    try {
        res.json(await db.getRecentLeads());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/jobs/:id', requireAdmin, async (req, res) => {
    try {
        const job = await db.getJob(req.params.id);
        if (!job) return res.status(404).json({ error: 'Not found' });
        
        if (job.payload) job.payload = JSON.parse(job.payload);
        if (job.draft) job.draft = JSON.parse(job.draft);
        
        res.json(job);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/jobs/:id/retry', requireAdmin, async (req, res) => {
    try {
        const job = await db.getJob(req.params.id);
        if (!job) return res.status(404).json({ error: 'Not found' });
        
        const payload = JSON.parse(job.payload);
        await db.updateJobStatus(job.id, 'received', null, null);
        
        res.status(202).json({ message: 'Retry accepted', jobId: job.id });
        
        void pipeline.processJob(job.id, job.kit_type, payload);
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Agent service listening on port ${PORT}`);
    console.log(`Config: llm=${llm.isConfigured() ? llm.getModel() : 'off'} resend=${process.env.RESEND_API_KEY ? 'on' : 'off'} owner=${process.env.OWNER_EMAIL ? 'set' : 'unset'} from=${process.env.SCANNER_FROM_EMAIL || 'reports@sonexial.com'}`);
});
