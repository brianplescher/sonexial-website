const db = require('./db');
const email = require('./email');
const metadataKit = require('./kits/metadata-kit');
const adCopyKit = require('./kits/ad-copy-kit');
const bisacKit = require('./kits/bisac-kit');
const coverAuditKit = require('./kits/cover-audit-kit');
const websiteSeoKit = require('./kits/website-seo-kit');
const positioningKit = require('./kits/positioning-kit');

// Maps every kit_type value sent by intake forms to its processor.
// Intake form hidden fields use these exact values:
//   metadata-kit        → Intake/metadata.html
//   ad-copy-suite       → Intake/ad-copy.html
//   bisac-kit           → Intake/bisac.html
//   cover-audit         → Intake/cover-audit.html
//   website-seo-audit   → Intake/website-seo.html
//   optimization-kit    → Intake/optimization-intake.html (legacy)
const KIT_PROCESSORS = {
    'metadata-kit':      metadataKit.processMetadataKit,
    'optimization-kit':  metadataKit.processMetadataKit,
    'ad-copy-suite':     adCopyKit.processAdCopyKit,
    'bisac-kit':         bisacKit.processBisacKit,
    'cover-audit':       coverAuditKit.processCoverAuditKit,
    'website-seo-audit': websiteSeoKit.processWebsiteSeoKit,

    // Positioning Kit (no intake form yet)
    'positioning-kit':   positioningKit.processPositioningKit,
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
