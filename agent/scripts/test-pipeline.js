require('dotenv').config();
const pipeline = require('../src/pipeline');
const crypto = require('crypto');

const mockPayload = {
    form_name: "amazon-visibility-kit",
    title: "The Silent Orbit",
    author: "Jane Doe",
    genre: "Science Fiction",
    synopsis: "A lone astronaut discovers an ancient alien artifact orbiting a distant gas giant, but interacting with it causes her to experience memories of a long-dead civilization.",
    targetAudience: "Adults who enjoy hard sci-fi and mystery.",
    comparableAuthors: "Andy Weir, Arthur C. Clarke"
};

async function runTest() {
    console.log('Testing the pipeline locally...');
    const jobId = crypto.randomUUID();
    console.log(`Job ID: ${jobId}`);
    
    try {
        await pipeline.processJob(jobId, 'amazon-visibility-kit', mockPayload);
        console.log('Test completed successfully.');
    } catch (e) {
        console.error('Test failed:', e);
    }
}

runTest();
