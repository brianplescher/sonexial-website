const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'jobs.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize DB schema
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            kit_type TEXT NOT NULL,
            payload JSON,
            draft JSON,
            error TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            name TEXT,
            scanned_url TEXT,
            score INTEGER,
            geo_grade TEXT,
            report JSON,
            source TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email)');

    // stripe_session_id is UNIQUE so a retried Stripe webhook cannot start a second fulfillment.
    db.run(`
        CREATE TABLE IF NOT EXISTS diagnostics (
            id TEXT PRIMARY KEY,
            token TEXT NOT NULL UNIQUE,
            stripe_session_id TEXT UNIQUE,
            email TEXT,
            name TEXT,
            site_url TEXT,
            status TEXT NOT NULL,
            source TEXT,
            result JSON,
            html TEXT,
            error TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

const getJob = (id) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM jobs WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const createJob = (id, kitType, payload) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO jobs (id, status, kit_type, payload) VALUES (?, ?, ?, ?)',
            [id, 'received', kitType, JSON.stringify(payload)],
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
};

const updateJobStatus = (id, status, error = null, draft = null) => {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE jobs SET status = ?, error = ?, draft = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        db.run(query, [status, error, draft ? JSON.stringify(draft) : null, id], function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
};

const getRecentJobs = (limit = 50) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT id, status, kit_type, created_at, updated_at FROM jobs ORDER BY created_at DESC LIMIT ?', [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const createLead = (id, { email, name, scannedUrl, score, geoGrade, report, source }) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO leads (id, email, name, scanned_url, score, geo_grade, report, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, email, name || null, scannedUrl || null, score ?? null, geoGrade || null, report ? JSON.stringify(report) : null, source || 'scanner'],
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
};

const getRecentLeads = (limit = 200) => {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT id, email, name, scanned_url, score, geo_grade, source, created_at FROM leads ORDER BY created_at DESC LIMIT ?',
            [limit],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
};

const getLead = (id) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT id, email, name, scanned_url FROM leads WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

/**
 * Inserts a diagnostic order. Resolves false when the Stripe session was already recorded.
 */
const createDiagnostic = ({ id, token, stripeSessionId, email, name, siteUrl, status, source }) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR IGNORE INTO diagnostics (id, token, stripe_session_id, email, name, site_url, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, token, stripeSessionId || null, email || null, name || null, siteUrl || null, status, source || null],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            }
        );
    });
};

const updateDiagnostic = (id, { status, result, html, error, siteUrl }) => {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE diagnostics SET status = ?, result = COALESCE(?, result), html = COALESCE(?, html),
             site_url = COALESCE(?, site_url), error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, result ? JSON.stringify(result) : null, html || null, siteUrl || null, error || null, id],
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
};

const getDiagnostic = (id) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT id, token, stripe_session_id, email, name, site_url, status, source, error, created_at, updated_at FROM diagnostics WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const getDiagnosticByToken = (token) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT id, status, site_url, html FROM diagnostics WHERE token = ?', [token], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

module.exports = {
    db,
    getLead,
    createDiagnostic,
    updateDiagnostic,
    getDiagnostic,
    getDiagnosticByToken,
    getJob,
    createJob,
    updateJobStatus,
    getRecentJobs,
    createLead,
    getRecentLeads
};
