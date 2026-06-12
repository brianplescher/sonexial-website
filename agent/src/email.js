const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER_EMAIL = process.env.OWNER_EMAIL;

async function sendDraftEmail(jobId, kitType, draft) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set, skipping draft email for job:', jobId);
        return;
    }
    
    try {
        await resend.emails.send({
            from: 'agent@sonexial.com',
            to: OWNER_EMAIL,
            subject: `[Agent] New Draft Ready: ${kitType} (${jobId})`,
            html: `
                <h2>Draft Ready for Review</h2>
                <p>Job ID: ${jobId}</p>
                <p>Kit Type: ${kitType}</p>
                <hr />
                <h3>Draft Content:</h3>
                <pre style="white-space: pre-wrap; background: #f4f4f4; padding: 10px; border-radius: 5px;">${JSON.stringify(draft, null, 2)}</pre>
            `
        });
        console.log(\`Draft email sent for job \${jobId}\`);
    } catch (error) {
        console.error('Failed to send draft email:', error);
    }
}

async function sendErrorEmail(jobId, kitType, errorMsg) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set, skipping error email for job:', jobId);
        return;
    }
    
    try {
        await resend.emails.send({
            from: 'agent@sonexial.com',
            to: OWNER_EMAIL,
            subject: `[Agent] ERROR: ${kitType} Failed (${jobId})`,
            html: `
                <h2>Agent Pipeline Failed</h2>
                <p>Job ID: ${jobId}</p>
                <p>Kit Type: ${kitType}</p>
                <hr />
                <h3>Error Details:</h3>
                <pre style="white-space: pre-wrap; background: #ffeeee; padding: 10px; border-radius: 5px;">${errorMsg}</pre>
            `
        });
        console.log(\`Error email sent for job \${jobId}\`);
    } catch (error) {
        console.error('Failed to send error email:', error);
    }
}

module.exports = {
    sendDraftEmail,
    sendErrorEmail
};
