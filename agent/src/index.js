require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const pipeline = require('./pipeline');

const app = express();
const PORT = process.env.PORT || 3000;
const NETLIFY_WEBHOOK_SECRET = process.env.NETLIFY_WEBHOOK_SECRET;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Raw body parser for webhook signature verification
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Admin middleware
const requireAdmin = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${ADMIN_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Netlify Webhook receiver
app.post('/webhooks/netlify', async (req, res) => {
    try {
        // Verify signature if secret is set
        if (NETLIFY_WEBHOOK_SECRET) {
            const signature = req.headers['x-webhook-signature'];
            if (!signature) return res.status(400).json({ error: 'Missing signature' });
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
