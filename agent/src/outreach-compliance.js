// Shared safeguards for Sonexial commercial outreach. Never send without configured compliance details.
const crypto = require('node:crypto');
const SITE = 'https://sonexial.com';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    return email.length <= 254 && emailPattern.test(email) ? email : null;
}

function secret() {
    const value = process.env.UNSUBSCRIBE_SECRET;
    if (!value || value.length < 32) throw new Error('UNSUBSCRIBE_SECRET must be set (at least 32 characters) before outreach');
    return value;
}
function makeToken(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error('Valid recipient email required');
    const body = Buffer.from(normalized, 'utf8').toString('base64url');
    const signature = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
    return body + '.' + signature;
}
function parseToken(token) {
    if (typeof token !== 'string' || token.length > 600) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
    const expected = crypto.createHmac('sha256', secret()).update(parts[0]).digest();
    const given = Buffer.from(parts[1], 'base64url');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const email = normalizeEmail(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return email && Buffer.from(email, 'utf8').toString('base64url') === parts[0] ? email : null;
}
function mailingAddress() {
    const address = String(process.env.BUSINESS_POSTAL_ADDRESS || '').trim();
    // This only checks configuration, not that the address is legally valid/registered.
    if (address.length < 12 || !/\d/.test(address) || !/,/.test(address)) {
        throw new Error('Set BUSINESS_POSTAL_ADDRESS to a valid street or registered mailbox address before outreach');
    }
    return address;
}
function footer(email) {
    const address = mailingAddress();
    const link = SITE + '/api/unsubscribe?token=' + encodeURIComponent(makeToken(email));
    return '\n\n---\nBusiness solicitation from Sonexial Labs\n' + address +
        '\nTo stop these emails, reply "unsubscribe" or visit: ' + link;
}
module.exports = { normalizeEmail, makeToken, parseToken, mailingAddress, footer };
