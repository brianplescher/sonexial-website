const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const SCANNER_FROM = process.env.SCANNER_FROM_EMAIL || 'reports@sonexial.com';

async function sendDraftEmail(jobId, kitType, draft) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set, skipping draft email for job:', jobId);
        return;
    }

    // Map kit types to their intake form URLs
    const intakeUrls = {
        'metadata-kit':  'https://sonexial.com/Intake/metadata.html',
        'KIT-01':        'https://sonexial.com/Intake/ad-copy.html',
        'KIT-02':        'https://sonexial.com/Intake/metadata.html',
        'KIT-03':        'https://sonexial.com/Intake/bisac.html',
        'KIT-04':        'https://sonexial.com/Intake/website-seo.html',
        'KIT-05':        'https://sonexial.com/Intake/cover-audit.html',
    };
    const intakeUrl = intakeUrls[kitType] || null;
    const intakeSection = intakeUrl
        ? `<p><strong>Intake form:</strong> <a href="${intakeUrl}">${intakeUrl}</a></p>`
        : '';

    try {
        await resend.emails.send({
            from: 'agent@sonexial.com',
            to: OWNER_EMAIL,
            subject: `[Agent] New Draft Ready: ${kitType} (${jobId})`,
            html: `
                <h2>Draft Ready for Review</h2>
                <p>Job ID: ${jobId}</p>
                <p>Kit Type: ${kitType}</p>
                ${intakeSection}
                <hr />
                <h3>Draft Content:</h3>
                <pre style="white-space: pre-wrap; background: #f4f4f4; padding: 10px; border-radius: 5px;">${JSON.stringify(draft, null, 2)}</pre>
            `
        });
        console.log(`Draft email sent for job ${jobId}`);
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
        console.log(`Error email sent for job ${jobId}`);
    } catch (error) {
        console.error('Failed to send error email:', error);
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function buildReportHtml(name, report) {
    const failures = (report.critical_failures || [])
        .map(f => `<li style="margin-bottom:6px;">${escapeHtml(f)}</li>`).join('');
    const recommendations = (report.recommendations || [])
        .map(r => `<li style="margin-bottom:10px;">${escapeHtml(r)}</li>`).join('');

    return `
        <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color:#111; max-width:640px;">
            <p>${name ? `${escapeHtml(name)},` : 'Hi,'}</p>
            <p>Here is the full AI visibility report for <strong>${escapeHtml(report.url)}</strong>.</p>
            <p style="font-size:20px; margin:24px 0;">
                <strong>Score: ${escapeHtml(report.score)}/100</strong> &nbsp;&mdash;&nbsp; ${escapeHtml(report.geo_grade)}
            </p>
            ${failures ? `<h3>Critical failures</h3><ul>${failures}</ul>` : '<p>No critical failures detected.</p>'}
            ${recommendations ? `<h3>Every fix, in priority order</h3><ol>${recommendations}</ol>` : ''}
            <p style="margin-top:32px;">
                Want these fixed for you? The
                <a href="https://sonexial.com/kits">Sonexial kits</a> cover metadata, schema, and full author platforms.
            </p>
            <p style="color:#666; font-size:13px; margin-top:32px;">
                You received this because you requested a scan at
                <a href="https://sonexial.com/tools/author-geo-audit/">sonexial.com</a>.
            </p>
        </div>`;
}

/**
 * Sends the full scan report to the person who requested it.
 */
async function sendScanReportEmail(toEmail, name, report) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set, skipping scan report email');
        return;
    }

    await resend.emails.send({
        from: SCANNER_FROM,
        to: toEmail,
        subject: `Your AI visibility report: ${report.score}/100 for ${report.url}`,
        html: buildReportHtml(name, report)
    });
}

/**
 * Notifies the owner of a new scanner lead. Keeps a durable copy of the lead outside SQLite.
 */
async function sendLeadNotification(lead) {
    if (!process.env.RESEND_API_KEY || !OWNER_EMAIL) {
        console.warn('RESEND_API_KEY or OWNER_EMAIL not set, skipping lead notification');
        return;
    }

    await resend.emails.send({
        from: SCANNER_FROM,
        to: OWNER_EMAIL,
        subject: `[Lead] ${lead.email} scanned ${lead.scannedUrl} (${lead.score}/100)`,
        html: `
            <h2>New scanner lead</h2>
            <p><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
            <p><strong>Name:</strong> ${escapeHtml(lead.name || '—')}</p>
            <p><strong>Site:</strong> ${escapeHtml(lead.scannedUrl)}</p>
            <p><strong>Score:</strong> ${escapeHtml(lead.score)} (${escapeHtml(lead.geoGrade)})</p>
        `
    });
}

module.exports = {
    sendDraftEmail,
    sendErrorEmail,
    sendScanReportEmail,
    sendLeadNotification
};
