require('dotenv').config();
const { runScan, validateSSRF } = require('../src/scanner');
const { generatePitch } = require('../src/pitch');

async function runAllVerificationTests() {
    console.log('==============================================');
    console.log('      RUNNING CONSOLIDATION TEST SUITE        ');
    console.log('==============================================\n');

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passedTests++;
        } else {
            console.error(`  [FAIL] ${message}`);
            failedTests++;
        }
    }

    // 1. SSRF Tests
    console.log('1. SSRF Protection Tests:');
    const ssrfTargets = [
        { url: 'http://localhost:3000', label: 'Localhost port 3000' },
        { url: 'http://127.0.0.1:8000', label: 'Loopback 127.0.0.1' },
        { url: 'http://169.254.169.254/latest/meta-data/', label: 'AWS/Cloud Metadata 169.254.169.254' },
        { url: 'http://10.0.0.1', label: 'Private IP 10.0.0.1' },
        { url: 'http://192.168.1.1', label: 'Private IP 192.168.1.1' },
        { url: 'ftp://example.com', label: 'Non-HTTP scheme (ftp://)' }
    ];

    for (const target of ssrfTargets) {
        try {
            await runScan(target.url);
            assert(false, `${target.label} was NOT blocked!`);
        } catch (err) {
            assert(true, `${target.label} successfully blocked (${err.message})`);
        }
    }

    // 2. Real Scans
    console.log('\n2. Live Website Scans:');

    // Case A: Real site (sonexial.com)
    try {
        const repA = await runScan('https://sonexial.com');
        assert(repA.status === 'success', `sonexial.com scan returned status: ${repA.status}`);
        assert(typeof repA.score === 'number' && repA.score >= 0 && repA.score <= 100, `sonexial.com score is valid: ${repA.score} (${repA.geo_grade})`);
        assert(repA.checks.llms_txt === true, `sonexial.com llms.txt detected properly: ${repA.checks.llms_txt}`);
    } catch (err) {
        console.error('  Error scanning sonexial.com:', err.message);
        failedTests++;
    }

    // Case B: Real site with NO llms.txt (example.com)
    try {
        const repB = await runScan('https://example.com');
        assert(repB.status === 'success', `example.com scan returned status: ${repB.status}`);
        assert(repB.checks.llms_txt === false, `example.com correctly identified missing llms.txt`);
        assert(repB.critical_failures.some(f => f.includes('llms.txt')), `example.com includes missing llms.txt in critical failures`);
    } catch (err) {
        console.error('  Error scanning example.com:', err.message);
        failedTests++;
    }

    // Case C: Non-existent domain / 404
    try {
        await runScan('https://nonexistent-test-domain-1234567890.xyz');
        assert(false, 'Non-existent domain did not throw an error');
    } catch (err) {
        assert(true, `Non-existent domain threw expected error (${err.message})`);
    }

    // 3. Pitch Generator Structure
    console.log('\n3. Pitch Generator Module:');
    assert(typeof generatePitch === 'function', 'generatePitch is exported as an async function');

    console.log('\n==============================================');
    console.log(`RESULTS: ${passedTests} passed, ${failedTests} failed`);
    console.log('==============================================');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runAllVerificationTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
