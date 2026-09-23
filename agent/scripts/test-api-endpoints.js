require('dotenv').config();
const http = require('http');

async function testEndpoints() {
    console.log('--- Starting API Endpoints Verification ---');
    
    // We can test scanner directly and pitch directly
    const { runScan } = require('../src/scanner');
    const { generatePitch } = require('../src/pitch');
    const llm = require('../src/llm');

    console.log('1. Testing runScan on https://sonexial.com ...');
    const report = await runScan('https://sonexial.com');
    console.log('Scan Report result:', {
        url: report.url,
        score: report.score,
        grade: report.geo_grade,
        critical_failures: report.critical_failures.length,
        recommendations: report.recommendations.length
    });

    if (llm.isConfigured()) {
        console.log(`\n2. Testing generatePitch with ${llm.getModel()} ...`);
        try {
            const pitchResult = await generatePitch(report, 'Brian Plescher');
            console.log('Pitch Result:', JSON.stringify(pitchResult, null, 2));
        } catch (err) {
            console.error('Pitch generation error:', err.message);
        }
    } else {
        console.log('\n2. Skipping pitch test (LLM_API_KEY not in local .env)');
    }

    console.log('\nVerification complete.');
}

testEndpoints().catch(console.error);
