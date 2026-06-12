const db = require('./db');
const email = require('./email');
const metadataKit = require('./kits/metadata-kit');

async function processJob(jobId, kitType, payload) {
    try {
        await db.updateJobStatus(jobId, 'analyzing');
        
        let draft;
        if (kitType === 'KIT-02' || kitType === 'metadata-kit') {
            draft = await metadataKit.processMetadataKit(payload);
        } else {
            throw new Error(`Unsupported kit type: ${kitType}`);
        }
        
        await db.updateJobStatus(jobId, 'drafted', null, draft);
        await email.sendDraftEmail(jobId, kitType, draft);
        await db.updateJobStatus(jobId, 'awaiting_review', null, draft);
        
    } catch (error) {
        console.error(`Job ${jobId} failed:`, error);
        await db.updateJobStatus(jobId, 'failed', error.message);
        await email.sendErrorEmail(jobId, kitType, error.message);
    }
}

module.exports = {
    processJob
};
