require('dotenv').config();
const { runScan, validateSSRF } = require('../src/scanner');

async function testSSRF() {
    console.log('--- Testing SSRF Guards ---');
    const blockedTargets = [
        'http://localhost:3000',
        'http://127.0.0.1:8000',
        'http://169.254.169.254/latest/meta-data/',
        'http://10.0.0.1',
        'http://192.168.1.1',
        'http://[::1]:8080',
        'ftp://example.com',
        'file:///etc/passwd'
    ];

    for (const target of blockedTargets) {
        try {
            await runScan(target);
            console.error(`FAIL: ${target} was NOT blocked!`);
        } catch (err) {
            console.log(`PASS: ${target} correctly rejected: ${err.message}`);
        }
    }
}

async function testScans() {
    console.log('\n--- Testing Real Scans ---');
    
    // 1. A real URL with valid structure (e.g. https://sonexial.com or https://example.com)
    try {
        console.log('Scanning https://sonexial.com ...');
        const report = await runScan('https://sonexial.com');
        console.log('Sonexial Scan Score:', report.score, report.geo_grade);
        console.log('Checks:', JSON.stringify(report.checks, null, 2));
    } catch (err) {
        console.log('Sonexial scan error (network dependent):', err.message);
    }

    // 2. A site with no llms.txt (e.g. https://example.com)
    try {
        console.log('\nScanning https://example.com (No llms.txt expected) ...');
        const report = await runScan('https://example.com');
        console.log('Example.com Scan Score:', report.score, report.geo_grade);
        console.log('Critical failures:', report.critical_failures);
    } catch (err) {
        console.log('Example.com scan error:', err.message);
    }

    // 3. A non-existent domain / 404
    try {
        console.log('\nScanning non-existent domain ...');
        await runScan('https://this-domain-does-not-exist-1234567890.org');
        console.error('FAIL: Non-existent domain did not throw');
    } catch (err) {
        console.log('PASS: Non-existent domain caught cleanly:', err.message);
    }
}

async function main() {
    await testSSRF();
    await testScans();
}

main();
