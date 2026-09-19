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
//   metadata-kit        → Intake/metadata.html        (KIT-02)
//   ad-copy-suite       → Intake/ad-copy.html          (KIT-01)
//   bisac-kit           → Intake/bisac.html             (KIT-03)
//   cover-audit         → Intake/cover-audit.html       (KIT-05)
//   website-seo-audit   → Intake/website-seo.html       (KIT-04)
//   optimization-kit    → Intake/optimization-intake.html (legacy)
const KIT_PROCESSORS = {
    // Metadata Kit — primary and legacy aliases
    'metadata-kit':      metadataKit.processMetadataKit,
    'KIT-02':            metadataKit.processMetadataKit,
    'optimization-kit':  metadataKit.processMetadataKit,

    // Ad Copy Suite
    'ad-copy-suite':     adCopyKit.processAdCopyKit,
    'KIT-01':            adCopyKit.processAdCopyKit,

    // BISAC & Category Strategy Kit
    'bisac-kit':         bisacKit.processBisacKit,
    'KIT-03':            bisacKit.processBisacKit,

    // Cover Design Signal Audit
    'cover-audit':       coverAuditKit.processCoverAuditKit,
    'KIT-05':            coverAuditKit.processCoverAuditKit,

    // Website SEO & GEO Audit
    'website-seo-audit': websiteSeoKit.processWebsiteSeoKit,
    'KIT-04':            websiteSeoKit.processWebsiteSeoKit,

    // Positioning Kit (future intake form)
    'positioning-kit':   positioningKit.processPositioningKit,
    'KIT-06':            positioningKit.processPositioningKit,
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
