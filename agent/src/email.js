const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const SCANNER_FROM = process.env.SCANNER_FROM_EMAIL || 'reports@sonexial.com';

// The Resend SDK resolves with `{ data, error }` instead of rejecting, so an unverified
// sender or bad key looks like a success to callers unless the error is rethrown.
async function send(payload) {
    const { data, error } = await resend.emails.send(payload);
    if (error) {
        throw new Error(`Resend rejected ${payload.subject}: ${error.name || error.statusCode}: ${error.message}`);
    }
    return data;
}

async function sendDraftEmail(jobId, kitType, draft) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set, skipping draft email for job:', jobId);
        return;
    }

    // Map kit types to their intake form URLs
    const intakeUrls = {
        'amazon-visibility-kit': 'https://sonexial.com/Intake/amazon-visibility.html',
        'metadata-kit':          'https://sonexial.com/Intake/amazon-visibility.html',
        'bisac-kit':             'https://sonexial.com/Intake/amazon-visibility.html',
        'optimization-kit':      'https://sonexial.com/Intake/amazon-visibility.html',
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

    await send({
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

    await send({
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

/**
 * Delivers the paid GEO Diagnostic: a summary in the body, the full report as an HTML attachment, and a hosted link.
 */
async function sendDiagnosticEmail(toEmail, name, diag, html, reportUrl) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set, skipping diagnostic email');
        return false;
    }

    const quickWins = diag.issues.filter(i => i.quadrant === 'Quick win').slice(0, 5)
        .map(i => `<li style="margin-bottom:6px;">${escapeHtml(i.title)}</li>`).join('');

    await send({
        from: SCANNER_FROM,
        to: toEmail,
        reply_to: OWNER_EMAIL || undefined,
        subject: `Your GEO Diagnostic for ${diag.url} is ready`,
        html: `
            <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color:#111; max-width:640px;">
                <p>${name ? `${escapeHtml(name)},` : 'Hi,'}</p>
                <p>Your GEO Diagnostic for <strong>${escapeHtml(diag.url)}</strong> is ready.</p>
                <p style="font-size:18px; margin:20px 0;">
                    <strong>AI Readiness: ${escapeHtml(diag.scores.aiReadiness)}/100</strong> &nbsp;&middot;&nbsp;
                    Site Health: ${escapeHtml(diag.scores.siteHealth)}% &nbsp;&middot;&nbsp;
                    ${escapeHtml(diag.issues.length)} issues across ${escapeHtml(diag.pagesCrawled)} pages
                </p>
                <p>${escapeHtml(diag.writeup.executive_summary)}</p>
                ${quickWins ? `<h3>Start with these quick wins</h3><ol>${quickWins}</ol>` : ''}
                <p style="margin:28px 0;">
                    <a href="${escapeHtml(reportUrl)}" style="background:#000; color:#00f0ff; padding:12px 20px; text-decoration:none; border-radius:3px;">Open the full diagnostic</a>
                </p>
                <p>The complete report is also attached as an HTML file you can keep, print to PDF, or forward to whoever manages your site.</p>
                <p style="color:#666; font-size:13px; margin-top:32px;">Questions? Reply to this email.</p>
            </div>`,
        attachments: [{
            filename: 'Sonexial-GEO-Diagnostic.html',
            content: Buffer.from(html, 'utf8')
        }]
    });
    return true;
}

/**
 * Tells the owner about a diagnostic order or a fulfillment problem that needs a manual look.
 */
async function sendDiagnosticOwnerNotice(subject, lines) {
    if (!process.env.RESEND_API_KEY || !OWNER_EMAIL) {
        console.warn('RESEND_API_KEY or OWNER_EMAIL not set, skipping diagnostic owner notice');
        return;
    }

    await send({
        from: SCANNER_FROM,
        to: OWNER_EMAIL,
        subject: `[Diagnostic] ${subject}`,
        html: `<ul>${lines.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
    });
}

module.exports = {
    sendDiagnosticEmail,
    sendDiagnosticOwnerNotice,
    sendDraftEmail,
    sendErrorEmail,
    sendScanReportEmail,
    sendLeadNotification
};
