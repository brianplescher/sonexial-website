#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { runMultiModeScan } = require('../src/smb-scanner');
const { generatePitch } = require('../src/pitch');

function parseArgs(argv) {
    const positional = [];
    const opts = { mode: 'smb', maxScore: 70, useLlm: false, concurrency: 4 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--mode') opts.mode = argv[++i] || 'smb';
        else if (a === '--max-score') opts.maxScore = Number(argv[++i] ?? 70);
        else if (a === '--concurrency') opts.concurrency = Number(argv[++i] ?? 4);
        else if (a === '--llm') opts.useLlm = true;
        else positional.push(a);
    }
    return {
        input: positional[0],
        output: positional[1] || 'outreach-ready.csv',
        ...opts
    };
}

function parseProspectCsv(filePath, defaultMode) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
        if (i === 0 && parts[0].toLowerCase() === 'url') continue;
        const [url, name, email, mode] = parts;
        if (!url) continue;
        rows.push({
            url,
            name: name || 'Founder',
            email: email || '',
            mode: (mode || defaultMode || 'smb').toLowerCase()
        });
    }
    return rows;
}

function csvCell(val) {
    if (val === null || val === undefined) return '';
    const str = Array.isArray(val) ? val.join(' | ') : String(val);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const OUT_COLUMNS = [
    'url',
    'name',
    'email',
    'mode',
    'qualified',
    'score',
    'geo_grade',
    'recommended_package',
    'top_findings',
    'email_subject',
    'email_body',
    'error'
];

async function main() {
    const { input, output, mode, maxScore, useLlm, concurrency } = parseArgs(process.argv.slice(2));
    if (!input) {
        console.error('Usage: node scripts/batch-outreach.js <prospects.csv> [outreach-ready.csv] [--mode smb|author] [--max-score 70] [--llm]');
        process.exit(1);
    }

    const prospects = parseProspectCsv(input, mode);
    const outPath = path.resolve(output);
    const stream = fs.createWriteStream(outPath);
    stream.write(OUT_COLUMNS.join(',') + '\n');

    const queue = [...prospects];
    let qualifiedCount = 0;

    async function worker() {
        while (queue.length) {
            const p = queue.shift();
            try {
                const report = await runMultiModeScan(p.url, { mode: p.mode });
                const qualified = report.score < maxScore;
                let pitch = { subject: '', email_draft: '', recommended_package: '', key_findings_summary: [] };
                if (qualified) {
                    qualifiedCount++;
                    pitch = await generatePitch(report, p.name, { mode: p.mode, useLlm });
                }
                const row = {
                    url: report.url,
                    name: p.name,
                    email: p.email,
                    mode: p.mode,
                    qualified: qualified ? 'YES' : 'NO_SCORE_TOO_HIGH',
                    score: report.score,
                    geo_grade: report.geo_grade,
                    recommended_package: pitch.recommended_package,
                    top_findings: pitch.key_findings_summary,
                    email_subject: pitch.subject,
                    email_body: pitch.email_draft,
                    error: ''
                };
                stream.write(OUT_COLUMNS.map(c => csvCell(row[c])).join(',') + '\n');
            } catch (err) {
                const row = {
                    url: p.url,
                    name: p.name,
                    email: p.email,
                    mode: p.mode,
                    qualified: 'ERROR',
                    error: err.message
                };
                stream.write(OUT_COLUMNS.map(c => csvCell(row[c])).join(',') + '\n');
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, prospects.length || 1) }, worker));
    await new Promise(r => stream.end(r));
    console.log(`Complete! ${qualifiedCount} qualified outreach drafts written to ${outPath}`);
}

if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { parseProspectCsv };
