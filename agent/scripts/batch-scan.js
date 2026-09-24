#!/usr/bin/env node

/**
 * Batch GEO scanner for the AI visibility study.
 *
 * Reads a list of URLs (one per line, or the first column of a CSV) and writes one CSV row
 * per site with every field the study reports on. Failures are recorded as rows with
 * status=error rather than aborting the run.
 *
 * Usage:
 *   node scripts/batch-scan.js urls.txt results.csv [--concurrency 4] [--delay 1000]
 */

const fs = require('fs');
const path = require('path');
const { runScan } = require('../src/scanner');

const COLUMNS = [
    'url',
    'status',
    'score',
    'geo_grade',
    'has_book_schema',
    'has_person_schema',
    'has_faq_schema',
    'sameas_count',
    'h1_count',
    'h2_count',
    'has_amazon_link',
    'has_goodreads_link',
    'has_bookbub_link',
    'has_open_graph',
    'has_llms_txt',
    'blocked_ai_bots',
    'allowed_ai_bots',
    'has_explicit_ai_rules',
    'has_sitemap',
    'canonical_correct',
    'word_count',
    'thin_content_flag',
    'execution_time',
    'error'
];

function parseArgs(argv) {
    const positional = [];
    const options = { concurrency: 4, delay: 1000 };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--concurrency' || arg === '--delay') {
            const value = Number(argv[++i]);
            if (!Number.isFinite(value) || value < 0) {
                throw new Error(`${arg} requires a non-negative number`);
            }
            options[arg.slice(2)] = value;
        } else {
            positional.push(arg);
        }
    }

    const [input, output] = positional;
    if (!input) {
        throw new Error('Usage: node scripts/batch-scan.js <urls.txt> [results.csv] [--concurrency N] [--delay MS]');
    }

    return { input, output: output || 'scan-results.csv', ...options };
}

function readUrls(inputPath) {
    const raw = fs.readFileSync(inputPath, 'utf8');
    const seen = new Set();

    return raw
        .split(/\r?\n/)
        .map(line => line.split(',')[0].trim().replace(/^["']|["']$/g, ''))
        .filter(line => line && !line.startsWith('#'))
        .filter(line => line.toLowerCase() !== 'url')
        .filter(line => {
            const key = line.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function csvCell(value) {
    if (value === null || value === undefined) return '';
    const str = Array.isArray(value) ? value.join('|') : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toRow(url, report, error) {
    if (error) {
        return { url, status: 'error', error: error.message };
    }

    const c = report.checks || {};
    const schema = c.schema_markup || {};
    const semantic = c.semantic_html || {};
    const entity = c.entity_links || {};
    const bots = c.ai_bot_access || {};

    return {
        url,
        status: 'success',
        score: report.score,
        geo_grade: report.geo_grade,
        has_book_schema: schema.book,
        has_person_schema: schema.person,
        has_faq_schema: schema.faq,
        sameas_count: c.sameas_count,
        h1_count: semantic.h1_count,
        h2_count: semantic.h2_count,
        has_amazon_link: entity.amazon,
        has_goodreads_link: entity.goodreads,
        has_bookbub_link: entity.bookbub,
        has_open_graph: c.open_graph,
        has_llms_txt: c.llms_txt,
        blocked_ai_bots: bots.blocked,
        allowed_ai_bots: bots.allowed,
        has_explicit_ai_rules: bots.has_explicit_ai_rules,
        has_sitemap: c.has_sitemap,
        canonical_correct: c.canonical_correct,
        word_count: c.word_count,
        thin_content_flag: c.thin_content_flag,
        execution_time: report.execution_time,
        error: ''
    };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** One retry, because a single timeout on a slow host should not drop a site from the sample. */
async function scanWithRetry(url) {
    try {
        return await runScan(url);
    } catch (firstError) {
        await sleep(2000);
        try {
            return await runScan(url);
        } catch {
            throw firstError;
        }
    }
}

async function main() {
    const { input, output, concurrency, delay } = parseArgs(process.argv.slice(2));
    const urls = readUrls(input);

    if (urls.length === 0) {
        console.error(`No URLs found in ${input}`);
        process.exit(1);
    }

    const outPath = path.resolve(output);
    const stream = fs.createWriteStream(outPath);
    stream.write(`${COLUMNS.join(',')}\n`);

    console.log(`Scanning ${urls.length} sites (concurrency ${concurrency}, ${delay}ms between scans)...`);

    let completed = 0;
    let failed = 0;
    const queue = [...urls];

    async function worker() {
        while (queue.length > 0) {
            const url = queue.shift();
            let row;

            try {
                row = toRow(url, await scanWithRetry(url), null);
            } catch (err) {
                failed++;
                row = toRow(url, null, err);
            }

            stream.write(`${COLUMNS.map(col => csvCell(row[col])).join(',')}\n`);

            completed++;
            const label = row.status === 'error' ? `ERROR ${row.error}` : `${row.score} ${row.geo_grade}`;
            console.log(`[${completed}/${urls.length}] ${url} -> ${label}`);

            if (delay > 0 && queue.length > 0) await sleep(delay);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
    await new Promise(resolve => stream.end(resolve));

    console.log(`\nDone. ${completed - failed} scanned, ${failed} failed. Wrote ${outPath}`);
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
