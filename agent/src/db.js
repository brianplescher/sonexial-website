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

module.exports = {
    db,
    getJob,
    createJob,
    updateJobStatus,
    getRecentJobs
};
