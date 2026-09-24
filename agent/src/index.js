require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const pipeline = require('./pipeline');
const scanner = require('./scanner');
const pitch = require('./pitch');
const mailer = require('./email');

const app = express();
app.disable('x-powered-by'); // Prevent Express version disclosure in response headers
const PORT = process.env.PORT || 3000;
const NETLIFY_WEBHOOK_SECRET = process.env.NETLIFY_WEBHOOK_SECRET;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

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

// In-memory rate limiting by IP (token bucket / fixed window).
// Note: In a multi-instance or high-traffic production deployment, this should move to a persistent store (e.g. Redis).
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX = 20; // max 20 requests per minute per IP

function rateLimiter(req, res, next) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
               req.ip ||
               req.socket.remoteAddress ||
               'unknown';
    const now = Date.now();
    const clientData = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

    if (now > clientData.resetTime) {
        clientData.count = 1;
        clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
    } else {
        clientData.count++;
    }

    rateLimitMap.set(ip, clientData);

    if (clientData.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests. Please wait a moment before scanning again.' });
    }
    next();
}

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
app.post('/api/scan', rateLimiter, async (req, res) => {
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
app.post('/api/scan/report', rateLimiter, async (req, res) => {
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
        Promise.allSettled([
            mailer.sendScanReportEmail(lead.email, lead.name, report),
            mailer.sendLeadNotification(lead)
        ]).then(results => {
            results.filter(r => r.status === 'rejected')
                .forEach(r => console.error('Lead email failed:', sanitizeLog(r.reason?.message || r.reason)));
        });

        let pitchDraft = null;
        if (process.env.ANTHROPIC_API_KEY) {
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
    try {
        // Verify signature if secret is set
        if (NETLIFY_WEBHOOK_SECRET) {
            const signature = req.headers['x-webhook-signature'];
            if (!signature) return res.status(400).json({ error: 'Missing signature' });

            const hmac = crypto.createHmac('sha256', NETLIFY_WEBHOOK_SECRET);
            hmac.update(req.rawBody);
            const expected = hmac.digest('hex');
            if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }
        
        const payload = req.body;
        const kitType = payload.form_name || 'KIT-02';
        const jobId = crypto.randomUUID();
        
        await db.createJob(jobId, kitType, payload);
        res.status(202).json({ message: 'Accepted', jobId });
        
        pipeline.processJob(jobId, kitType, payload);
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        
        pipeline.processJob(job.id, job.kit_type, payload);
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Agent service listening on port ${PORT}`);
});
