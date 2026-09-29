const { processBisacKit } = require('./bisac-kit');
const { processMetadataKit } = require('./metadata-kit');

// The Amazon Visibility Kit is the merged BISAC + Metadata + Description deliverable:
// category placement from the BISAC processor, keywords and description from the metadata processor.
async function processAmazonVisibilityKit(payload) {
    console.log('Starting amazon-visibility-kit processing...');

    const [categories, listing] = await Promise.all([
        processBisacKit(payload),
        processMetadataKit(payload),
    ]);

    return {
        categoryBrief: categories.categoryBrief,
        positioningBrief: listing.positioningBrief,
        deliverables: {
            ...categories.deliverables,
            ...listing.deliverables,
        },
    };
}

module.exports = { processAmazonVisibilityKit };
