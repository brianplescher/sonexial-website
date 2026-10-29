const { SEARCH_BOTS } = require('./issues');

const UTILITY_PATH = /\/(privacy|terms|cookie|refund|cart|checkout|login|account|404)/i;

function guessBusinessName(facts, homepage) {
    if (homepage?.og?.['og:site_name']) return homepage.og['og:site_name'];
    const title = homepage?.title || '';
    return title.split(/\s[|–—-]\s/)[0].trim() || 'Business Name';
}

function organizationJsonLd({ origin, businessName, description, schemaType = 'ProfessionalService', profiles = {} }) {
    const sameAs = [...new Set(Object.values(profiles))];
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@type': schemaType,
        '@id': `${origin}/#organization`,
        name: businessName,
        url: `${origin}/`,
        description: description || `${businessName} provides specialized services in …`,
        image: `${origin}/path-to-logo-or-featured-image.jpg`,
        telephone: '+1-XXX-XXX-XXXX',
        address: {
            '@type': 'PostalAddress',
            addressLocality: 'City',
            addressRegion: 'State',
            postalCode: 'XXXXX',
            addressCountry: 'US'
        },
        areaServed: '…',
        sameAs: sameAs.length ? sameAs : [
            'https://www.linkedin.com/company/…',
            'https://www.google.com/maps?cid=…'
        ]
    }, null, 2);
}

function serviceFaqJsonLd({ origin, businessName }) {
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Service',
                '@id': `${origin}/#primary-service`,
                name: 'Primary Service / Core Offering',
                provider: { '@id': `${origin}/#organization` },
                description: `Clear factual summary of what ${businessName} delivers, for whom, and expected outcomes.`,
                areaServed: '…'
            },
            {
                '@type': 'FAQPage',
                mainEntity: [
                    {
                        '@type': 'Question',
                        name: `What does ${businessName} specialize in?`,
                        acceptedAnswer: {
                            '@type': 'Answer',
                            text: 'Replace with a concise, factual 2-3 sentence answer that AI search tools can quote directly.'
                        }
                    },
                    {
                        '@type': 'Question',
                        name: 'How does the engagement process or pricing work?',
                        acceptedAnswer: {
                            '@type': 'Answer',
                            text: 'Replace with transparent scope, turnaround time, and starting price or consultation process.'
                        }
                    }
                ]
            }
        ]
    }, null, 2);
}

function smbLlmsTxt({ businessName, description, facts, homepageUrl }) {
    const ok = (facts || []).filter(f => f.status >= 200 && f.status < 300 && !UTILITY_PATH.test(new URL(f.url).pathname));
    const services = ok.filter(f => /\/(services?|solutions?|offerings?|pricing|packages?|practice-areas?)(\/|$)/i.test(new URL(f.url).pathname));
    const about = ok.filter(f => /\/(about|team|company|leadership|who-we-are)/i.test(new URL(f.url).pathname));
    const other = ok.filter(f => !services.includes(f) && !about.includes(f) && f.url !== homepageUrl);

    const linkLine = f => {
        const label = ((f.h1s && f.h1s[0]) || f.title || new URL(f.url).pathname).replace(/[[\]]/g, '');
        const desc = f.metaDescription ? `: ${f.metaDescription}` : '';
        return `- [${label}](${f.url})${desc}`;
    };

    const lines = [
        `# ${businessName}`,
        '',
        `> ${description || `${businessName} official site overview for human readers and automated retrieval systems.`}`,
        '',
        `Official website: ${homepageUrl}`,
        ''
    ];
    if (services.length) lines.push('## Core Services & Offerings', ...services.slice(0, 12).map(linkLine), '');
    if (about.length) lines.push('## About & Credentials', ...about.slice(0, 5).map(linkLine), '');
    if (other.length) lines.push('## Key Pages', ...other.slice(0, 10).map(linkLine), '');
    return lines.join('\n');
}

function robotsTxt({ origin }) {
    const bots = SEARCH_BOTS || [
        { label: 'OAI-SearchBot' },
        { label: 'Claude-SearchBot' },
        { label: 'PerplexityBot' },
        { label: 'Googlebot' },
        { label: 'Bingbot' }
    ];
    const lines = ['User-agent: *', 'Allow: /', ''];
    for (const bot of bots) lines.push(`User-agent: ${bot.label}`, 'Allow: /', '');
    lines.push(`Sitemap: ${origin}/sitemap.xml`);
    return lines.join('\n');
}

function buildSmbArtifacts({ origin, homepageUrl, facts = [], profiles = {}, schemaType = 'ProfessionalService' }) {
    const homepage = facts.find(f => f.url === homepageUrl) || facts[0] || {};
    const businessName = guessBusinessName(facts, homepage);
    const description = homepage.metaDescription || '';
    return {
        businessName,
        organizationJsonLd: organizationJsonLd({ origin, businessName, description, schemaType, profiles }),
        serviceFaqJsonLd: serviceFaqJsonLd({ origin, businessName }),
        llmsTxt: smbLlmsTxt({ businessName, description, facts, homepageUrl }),
        robotsTxt: robotsTxt({ origin })
    };
}

function renderSelfServeConversionBanner({ diagnosticCheckoutUrl, dfySprintCheckoutUrl, mode = 'smb' }) {
    const diagUrl = diagnosticCheckoutUrl || 'https://sonexial.com/kits';
    const sprintUrl = dfySprintCheckoutUrl || 'https://sonexial.com/#contact';
    const sprintLabel = mode === 'smb'
        ? 'Done-For-You 72-Hour GEO Fix Sprint — $750'
        : 'Done-For-You Author GEO Implementation — $497';

    return `
  <section class="cta" style="background:#0a0f18;color:#fff;padding:32px 48px;border-bottom:2px solid #00f0ff">
    <div style="font:600 12px/1 ui-monospace,Menlo,monospace;color:#00f0ff;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">
      Immediate Resolution Options · No Sales Call Required
    </div>
    <h2 style="margin:0 0 12px;font-size:22px">Fix these AI discoverability gaps this week</h2>
    <p style="color:#cbd5e1;margin:0 0 20px">
      Choose Option 1 to get the complete 30-page crawl and ready-to-paste code blocks immediately, or Option 2 to have Sonexial engineer and install every fix for you in 72 hours.
    </p>
    <div style="display:flex;flex-wrap:wrap;gap:12px">
      <a href="${diagUrl}" style="background:#00f0ff;color:#000;font-weight:700;padding:12px 20px;border-radius:4px;text-decoration:none">
        1. Unlock Full 30-Page Diagnostic + Code Pack ($297) →
      </a>
      <a href="${sprintUrl}" style="border:1px solid #00f0ff;color:#00f0ff;font-weight:600;padding:12px 20px;border-radius:4px;text-decoration:none">
        2. ${sprintLabel} (100% Diagnostic Credit) →
      </a>
    </div>
  </section>`;
}

module.exports = {
    buildSmbArtifacts,
    guessBusinessName,
    organizationJsonLd,
    serviceFaqJsonLd,
    smbLlmsTxt,
    renderSelfServeConversionBanner
};
