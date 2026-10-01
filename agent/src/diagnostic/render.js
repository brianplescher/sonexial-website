const QUADRANTS = [
    { name: 'Quick win', blurb: 'High impact, low effort. Do these first.' },
    { name: 'Major project', blurb: 'High impact, more effort. Schedule these.' },
    { name: 'Fill-in', blurb: 'Lower impact, low effort. Batch them when convenient.' },
    { name: 'Deprioritize', blurb: 'Lower impact, more effort. Only after everything else.' }
];

const EFFORT_LABEL = ['', 'Minutes', 'Under an hour', 'Half a day', 'A day or two', 'Developer project'];

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function scoreClass(n) {
    if (n >= 80) return 'good';
    if (n >= 55) return 'mid';
    return 'bad';
}

function renderPages(pages) {
    if (!pages.length) return '<p class="muted">Site-wide issue.</p>';
    const shown = pages.slice(0, 12).map(p => `<li><code>${esc(p)}</code></li>`).join('');
    const more = pages.length > 12 ? `<li class="muted">…and ${pages.length - 12} more</li>` : '';
    return `<ul class="pages">${shown}${more}</ul>`;
}

function renderIssue(issue, n) {
    return `
    <article class="issue sev-${esc(issue.severity)}">
      <header>
        <span class="num">${n}</span>
        <h3>${esc(issue.title)}</h3>
      </header>
      <p class="tags">
        <span class="tag sev">${esc(issue.severity)}</span>
        <span class="tag">${esc(issue.category)}</span>
        <span class="tag">${esc(issue.quadrant)}</span>
        <span class="tag">Impact ${issue.impact}/5</span>
        <span class="tag">Effort: ${esc(EFFORT_LABEL[issue.effort])}</span>
      </p>
      <p><strong>Why it matters.</strong> ${esc(issue.why)}</p>
      <p><strong>How to fix it.</strong> ${esc(issue.fix)}</p>
      <details${issue.pages.length && issue.pages.length <= 3 ? ' open' : ''}><summary>Affected pages (${issue.pages.length || 'site-wide'})</summary>${renderPages(issue.pages)}</details>
    </article>`;
}

function renderMatrix(issues) {
    return QUADRANTS.map(q => {
        const items = issues.filter(i => i.quadrant === q.name);
        const list = items.length
            ? `<ol>${items.map(i => `<li>${esc(i.title)}</li>`).join('')}</ol>`
            : '<p class="muted">Nothing here.</p>';
        return `<div class="quad"><h3>${esc(q.name)} <span class="count">${items.length}</span></h3><p class="muted">${esc(q.blurb)}</p>${list}</div>`;
    }).join('');
}

function renderBots(bots) {
    const rows = bots.map(b => `
      <tr>
        <td><code>${esc(b.label)}</code></td>
        <td>${esc(b.engine)}</td>
        <td>${b.kind === 'search' ? 'AI search / answers' : 'Model training'}</td>
        <td class="${b.access === 'blocked' ? (b.kind === 'search' ? 'bad' : 'mid') : 'good'}">${b.access === 'blocked' ? 'Blocked' : 'Allowed'}</td>
      </tr>`).join('');
    return `<table><thead><tr><th>Crawler</th><th>Feeds</th><th>Purpose</th><th>Access</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPlan(plan) {
    return plan.map(w => `
      <div class="week">
        <h3>${esc(w.week)}: ${esc(w.focus)}</h3>
        <ul>${(w.tasks || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>`).join('');
}

function renderInventory(pages) {
    const rows = pages.map(p => `
      <tr>
        <td><code>${esc(p.url)}</code></td>
        <td class="${p.status >= 200 && p.status < 300 ? '' : 'bad'}">${esc(p.status || 'ERR')}</td>
        <td>${esc(p.wordCount)}</td>
        <td>${p.depth === null || p.depth === undefined ? '—' : esc(p.depth)}</td>
        <td>${esc((p.schema || []).join(', ') || '—')}</td>
        <td>${esc(p.issueCount)}</td>
      </tr>`).join('');
    return `<table class="inventory"><thead><tr><th>Page</th><th>Status</th><th>Words</th><th>Clicks from home</th><th>Schema</th><th>Issues</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function codeBlock(title, filename, body, note) {
    return `
    <div class="artifact">
      <h3>${esc(title)}</h3>
      <p class="muted">${esc(note)}</p>
      <p class="filename">${esc(filename)}</p>
      <pre><code>${esc(body)}</code></pre>
    </div>`;
}

const CSS = `
:root{--ink:#111;--muted:#5b6470;--line:#e3e6ea;--accent:#0097a7;--bad:#c62828;--mid:#b26a00;--good:#2e7d32;--bg:#fff}
*{box-sizing:border-box}body{margin:0;background:#f4f6f8;color:var(--ink);font:16px/1.6 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
.doc{max-width:960px;margin:0 auto;background:var(--bg)}
.cover{background:#000;color:#fff;padding:48px 48px 40px}
.cover .brand{font:600 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;color:#00f0ff;text-transform:uppercase}
.cover h1{font-size:34px;line-height:1.2;margin:16px 0 8px}.cover p{color:#b3b3b3;margin:0}
.scores{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:32px}
.score{border:1px solid rgba(255,255,255,.15);padding:16px;border-radius:4px}
.score .v{font-size:32px;font-weight:700}.score .l{font-size:13px;color:#b3b3b3}
.score .v.good{color:#69f0ae}.score .v.mid{color:#ffd54f}.score .v.bad{color:#ff8a80}
section{padding:36px 48px;border-bottom:1px solid var(--line)}
h2{font-size:24px;margin:0 0 16px}h3{font-size:17px;margin:0 0 6px}
.muted{color:var(--muted)}.good{color:var(--good)}.mid{color:var(--mid)}.bad{color:var(--bad)}
.matrix{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.quad{border:1px solid var(--line);border-radius:4px;padding:16px}.quad ol{margin:8px 0 0;padding-left:20px}
.count{background:var(--ink);color:#fff;border-radius:10px;padding:0 8px;font-size:13px;margin-left:6px}
.issue{border:1px solid var(--line);border-left:4px solid var(--line);border-radius:4px;padding:16px 20px;margin:0 0 16px;break-inside:avoid}
.issue.sev-error{border-left-color:var(--bad)}.issue.sev-warning{border-left-color:var(--mid)}.issue.sev-notice{border-left-color:var(--accent)}
.issue header{display:flex;gap:12px;align-items:baseline}.num{font:600 13px ui-monospace,Menlo,monospace;color:var(--muted)}
.tags{margin:6px 0 10px}.tag{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:3px;padding:1px 8px;margin:0 4px 4px 0;text-transform:capitalize}
.sev-error .tag.sev{background:var(--bad);color:#fff;border-color:var(--bad)}.sev-warning .tag.sev{background:var(--mid);color:#fff;border-color:var(--mid)}.sev-notice .tag.sev{background:var(--accent);color:#fff;border-color:var(--accent)}
.pages{margin:8px 0 0;padding-left:20px;font-size:14px}code{font:13px ui-monospace,Menlo,monospace;word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
pre{background:#0d1117;color:#e6edf3;padding:16px;border-radius:4px;overflow:auto;font-size:13px;line-height:1.5}
.filename{font:600 13px ui-monospace,Menlo,monospace;margin:8px 0 4px}.artifact{margin-bottom:28px}
.week{margin-bottom:16px}.cta{background:#000;color:#fff}.cta a{color:#00f0ff}.cta .muted{color:#b3b3b3}
blockquote{margin:0;padding:12px 16px;border-left:3px solid var(--accent);background:#f4fbfc}
@media (max-width:700px){section,.cover{padding:28px 20px}.scores,.matrix{grid-template-columns:1fr 1fr}}
@media print{body{background:#fff}details{display:block}details>summary{list-style:none}section{break-inside:auto}.cover,.cta{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

/**
 * Renders the diagnostic as one self-contained HTML document (hosted page and email attachment).
 */
function renderDiagnosticHtml(diag, { name } = {}) {
    const { scores, writeup, artifacts } = diag;
    const date = new Date(diag.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const quickWins = diag.issues.filter(i => i.quadrant === 'Quick win').length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>GEO Diagnostic — ${esc(diag.url)}</title>
<style>${CSS}</style>
</head>
<body>
<main class="doc">
  <header class="cover">
    <div class="brand">Sonexial GEO Diagnostic</div>
    <h1>${esc(artifacts.authorName)}</h1>
    <p><code>${esc(diag.url)}</code> · ${esc(date)}${name ? ` · Prepared for ${esc(name)}` : ''}</p>
    <div class="scores">
      <div class="score"><div class="v ${scoreClass(scores.aiReadiness)}">${scores.aiReadiness}</div><div class="l">AI Readiness / 100</div></div>
      <div class="score"><div class="v ${scoreClass(scores.siteHealth)}">${scores.siteHealth}%</div><div class="l">Site Health</div></div>
      <div class="score"><div class="v">${scores.counts.error} / ${scores.counts.warning} / ${scores.counts.notice}</div><div class="l">Errors / Warnings / Notices</div></div>
      <div class="score"><div class="v">${quickWins}</div><div class="l">Quick wins</div></div>
    </div>
  </header>

  <section>
    <h2>Executive summary</h2>
    <p>${esc(writeup.executive_summary)}</p>
    <p class="muted">Free scan score for the homepage: ${esc(diag.freeScan.score)}/100 (${esc(diag.freeScan.grade)}). This diagnostic crawled ${diag.pagesCrawled} page(s)${diag.sitemapPageCount ? ` (sitemap lists ${diag.sitemapPageCount})` : ''} and ran every check on each one.</p>
  </section>

  <section>
    <h2>Why AI engines may be missing you</h2>
    <p>${esc(writeup.why_ai_misses_you)}</p>
  </section>

  <section>
    <h2>Priority matrix</h2>
    <p class="muted">Every issue is scored for impact on AI visibility (1-5) and effort to fix (1-5), then placed in one of four groups.</p>
    <div class="matrix">${renderMatrix(diag.issues)}</div>
  </section>

  <section>
    <h2>AI crawler access</h2>
    <p class="muted">Search crawlers fetch your pages when someone asks a question; training crawlers collect data for future models. Blocking search crawlers removes you from answers. Blocking training crawlers is your call.</p>
    ${renderBots(diag.bots)}
  </section>

  <section>
    <h2>Your 30-day plan</h2>
    ${renderPlan(writeup.thirty_day_plan)}
  </section>

  <section>
    <h2>Every issue, in priority order</h2>
    ${diag.issues.length ? diag.issues.map((i, n) => renderIssue(i, n + 1)).join('') : '<p>No issues found. Your site passes every check in this diagnostic.</p>'}
  </section>

  <section>
    <h2>Ready-to-paste fixes</h2>
    <p class="muted">Drafted from what we found on your site. Replace anything marked … before publishing, then check JSON-LD at validator.schema.org.</p>
    ${codeBlock('Author identity (Person schema)', 'Paste inside <head> on your homepage and About page', `<script type="application/ld+json">\n${artifacts.personJsonLd}\n</script>`, 'Tells AI engines this site is the official home of this author and links your profiles into one entity.')}
    ${codeBlock('Book schema template', 'Paste inside <head> on each book page', `<script type="application/ld+json">\n${artifacts.bookJsonLd}\n</script>`, 'One block per book. The author @id links each book back to you.')}
    ${codeBlock('llms.txt', `${new URL(diag.url).origin}/llms.txt`, artifacts.llmsTxt, 'A plain-text map of your site for AI systems.')}
    ${codeBlock('robots.txt', `${new URL(diag.url).origin}/robots.txt`, artifacts.robotsTxt, 'Allows every AI search crawler and points to your sitemap. Add Disallow groups for training crawlers only if you want to opt out of training.')}
  </section>

  <section>
    <h2>Positioning</h2>
    <h3>One-line bio</h3>
    <blockquote>${esc(writeup.positioning.one_line_bio)}</blockquote>
    <h3 style="margin-top:16px">Keeping your identity consistent</h3>
    <p>${esc(writeup.positioning.entity_statement)}</p>
  </section>

  <section>
    <h2>Page inventory</h2>
    ${renderInventory(diag.pages)}
    ${diag.pagesUncrawled ? `<p class="muted">${diag.pagesUncrawled} more URL(s) were discovered but not crawled in this pass.</p>` : ''}
  </section>

  <section class="cta">
    <h2>Next steps</h2>
    <p>Hand this document to whoever manages your site. Every issue includes the reason and the fix.</p>
    <p>Want it done for you? <a href="https://sonexial.com/kits">Author Platform</a> rebuilds your site with all of this in place, and the <a href="https://sonexial.com/kits">GEO Retainer</a> ($300/month) implements these fixes and re-runs this diagnostic every month so you can see the score move.</p>
    <p class="muted">Reply to the delivery email with any questions about this report.</p>
  </section>

  <section>
    <p class="muted" style="font-size:13px">Method: Sonexial crawled up to ${diag.pagesCrawled} pages starting from your homepage and sitemap, reading raw HTML the way most AI crawlers do (no JavaScript execution). Checks cover AI crawler access, llms.txt, structured data, author entity signals, content depth, on-page tags, crawlability, and HTTPS. Written analysis ${writeup.generated_by === 'llm' ? 'drafted with AI from the crawl data' : 'generated from the crawl data'}.</p>
  </section>
</main>
</body>
</html>`;
}

module.exports = { renderDiagnosticHtml, esc };
