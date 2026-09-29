const db = require('./db');
const email = require('./email');
const amazonVisibilityKit = require('./kits/amazon-visibility-kit');

// Maps every kit_type value sent by intake forms to its processor.
// Intake form hidden fields use these exact values:
//   amazon-visibility-kit → Intake/amazon-visibility.html
// Legacy values from kits retired in the Phase 1.5 consolidation (metadata-kit,
// bisac-kit, optimization-kit) still resolve to the merged kit so in-flight
// submissions are not dropped.
const KIT_PROCESSORS = {
    'amazon-visibility-kit': amazonVisibilityKit.processAmazonVisibilityKit,
    'metadata-kit':          amazonVisibilityKit.processAmazonVisibilityKit,
    'bisac-kit':             amazonVisibilityKit.processAmazonVisibilityKit,
    'optimization-kit':      amazonVisibilityKit.processAmazonVisibilityKit,
};

async function processJob(jobId, kitType, payload) {
    try {
        await db.updateJobStatus(jobId, 'analyzing');

        const processor = KIT_PROCESSORS[kitType];
        if (!processor) {
            throw new Error(`Unsupported kit type: ${kitType}`);
        }

        const draft = await processor(payload);

        await db.updateJobStatus(jobId, 'drafted', null, draft);
        await email.sendDraftEmail(jobId, kitType, draft);
        await db.updateJobStatus(jobId, 'awaiting_review', null, draft);

    } catch (error) {
        console.error(`Job ${jobId} failed:`, error);
        await db.updateJobStatus(jobId, 'failed', error.message);
        await email.sendErrorEmail(jobId, kitType, error.message);
    }
}

module.exports = { processJob };
