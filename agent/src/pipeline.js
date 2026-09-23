const db = require('./db');
const email = require('./email');
const amazonVisibilityKit = require('./kits/amazon-visibility-kit');
const positioningKit = require('./kits/positioning-kit');

// Maps every kit_type value sent by intake forms to its processor.
// Intake form hidden fields use these exact values:
//   amazon-visibility-kit → Intake/amazon-kit.html  (merged Metadata + BISAC + Description)
//   positioning-kit       → (no live intake form yet; retained for internal use)
// NOTE: The former numeric kit aliases (the "KIT-nn" style keys) were removed —
// they never matched the numbering printed on kits.html and no live form
// referenced them. Do not reintroduce numeric aliases.
const KIT_PROCESSORS = {
    'amazon-visibility-kit': amazonVisibilityKit.processAmazonVisibilityKit,
    'positioning-kit':       positioningKit.processPositioningKit,
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
