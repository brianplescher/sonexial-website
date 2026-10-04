const { SEARCH_BOTS } = require('./issues');

const UTILITY_PATH = /\/(privacy|terms|cookie|refund|cart|checkout|login|account|404)/i;

function guessAuthorName(facts, homepage) {
    const person = facts.flatMap(f => f.persons).find(p => p.name);
    if (person) return person.name;
    if (homepage?.og?.['og:site_name']) return homepage.og['og:site_name'];
    const title = homepage?.title || '';
    return title.split(/\s[|–—-]\s/)[0].trim() || 'Author Name';
}

function profileUrls(profiles) {
    return [...new Set(Object.values(profiles))];
}

function personJsonLd({ origin, authorName, description, profiles }) {
    const sameAs = profileUrls(profiles);
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': `${origin}/#author`,
        name: authorName,
        url: `${origin}/`,
        jobTitle: 'Author',
        description: description || `${authorName} is the author of …`,
        image: `${origin}/path-to-author-photo.jpg`,
        sameAs: sameAs.length ? sameAs : ['https://www.amazon.com/stores/author/…', 'https://www.goodreads.com/author/show/…', 'https://www.bookbub.com/authors/…']
    }, null, 2);
}

function bookJsonLd({ origin, bookName }) {
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Book',
        name: bookName,
        author: { '@id': `${origin}/#author` },
        isbn: '978-…',
        bookFormat: 'https://schema.org/Paperback',
        image: `${origin}/path-to-cover.jpg`,
        url: `${origin}/books/…`,
        genre: '…',
        datePublished: 'YYYY-MM-DD',
        sameAs: ['https://www.amazon.com/dp/…', 'https://www.goodreads.com/book/show/…']
    }, null, 2);
}

function classifyPages(facts) {
    const ok = facts.filter(f => f.status >= 200 && f.status < 300 && !UTILITY_PATH.test(new URL(f.url).pathname));
    const books = ok.filter(f => f.books.length || /\/(books?|novels?|series)(\/|$)/i.test(new URL(f.url).pathname));
    const about = ok.filter(f => /\/(about|bio|author|meet)/i.test(new URL(f.url).pathname));
    const other = ok.filter(f => !books.includes(f) && !about.includes(f));
    return { books, about, other };
}

function linkLine(f) {
    const label = (f.h1s[0] || f.title || new URL(f.url).pathname).replace(/[[\]]/g, '');
    const desc = f.metaDescription ? `: ${f.metaDescription}` : '';
    return `- [${label}](${f.url})${desc}`;
}

function llmsTxt({ authorName, description, facts, homepageUrl, profiles }) {
    const { books, about, other } = classifyPages(facts);
    const lines = [`# ${authorName}`, '', `> ${description || `${authorName} is an author. This file lists the official pages for ${authorName} and their books.`}`, ''];
    lines.push(`Official website of ${authorName}: ${homepageUrl}`, '');
    if (books.length) lines.push('## Books', ...books.slice(0, 15).map(linkLine), '');
    if (about.length) lines.push('## About', ...about.slice(0, 3).map(linkLine), '');
    const rest = other.filter(f => f.url !== homepageUrl).slice(0, 10);
    if (rest.length) lines.push('## Pages', ...rest.map(linkLine), '');
    const profileLines = Object.entries(profiles).map(([k, url]) => `- [${k.replace(/_/g, ' ')}](${url})`);
    if (profileLines.length) lines.push('## Official profiles', ...profileLines, '');
    return lines.join('\n');
}

function robotsTxt({ origin }) {
    const lines = ['User-agent: *', 'Allow: /', ''];
    for (const bot of SEARCH_BOTS) lines.push(`User-agent: ${bot.label}`, 'Allow: /', '');
    lines.push(`Sitemap: ${origin}/sitemap.xml`);
    return lines.join('\n');
}

/**
 * Ready-to-paste fixes built from what the crawl found, so the buyer leaves with code, not just a list.
 */
function buildArtifacts({ origin, homepageUrl, facts, profiles }) {
    const homepage = facts.find(f => f.url === homepageUrl) || facts[0];
    const authorName = guessAuthorName(facts, homepage);
    const description = homepage?.metaDescription || '';
    const bookNames = [...new Set(facts.flatMap(f => f.books.map(b => b.name)).filter(Boolean))];
    return {
        authorName,
        personJsonLd: personJsonLd({ origin, authorName, description, profiles }),
        bookJsonLd: bookJsonLd({ origin, bookName: bookNames[0] || 'Book Title' }),
        llmsTxt: llmsTxt({ authorName, description, facts, homepageUrl, profiles }),
        robotsTxt: robotsTxt({ origin })
    };
}

module.exports = { buildArtifacts, guessAuthorName, classifyPages, llmsTxt, robotsTxt };
