const test = require('node:test');
const assert = require('node:assert/strict');
const compliance = require('../src/outreach-compliance');

test('unsubscribe tokens validate and reject tampering', () => {
    const old = process.env.UNSUBSCRIBE_SECRET;
    process.env.UNSUBSCRIBE_SECRET = 'test-secret-at-least-thirty-two-characters';
    try {
        const token = compliance.makeToken(' Person@Example.COM ');
        assert.equal(compliance.parseToken(token), 'person@example.com');
        assert.equal(compliance.parseToken(token + 'x'), null);
        assert.equal(compliance.parseToken('invalid'), null);
    } finally {
        if (old === undefined) delete process.env.UNSUBSCRIBE_SECRET;
        else process.env.UNSUBSCRIBE_SECRET = old;
    }
});
test('commercial footer requires configured business mailing address', () => {
    const oldAddress = process.env.BUSINESS_POSTAL_ADDRESS;
    const oldSecret = process.env.UNSUBSCRIBE_SECRET;
    try {
        process.env.UNSUBSCRIBE_SECRET = 'test-secret-at-least-thirty-two-characters';
        delete process.env.BUSINESS_POSTAL_ADDRESS;
        assert.throws(() => compliance.footer('person@example.com'), /BUSINESS_POSTAL_ADDRESS/);
        process.env.BUSINESS_POSTAL_ADDRESS = 'P.O. Box 123, Grand Haven, MI 49417';
        const footer = compliance.footer('person@example.com');
        assert.match(footer, /P.O. Box 123/);
        assert.match(footer, /unsubscribe\?token=/);
    } finally {
        if (oldAddress === undefined) delete process.env.BUSINESS_POSTAL_ADDRESS;
        else process.env.BUSINESS_POSTAL_ADDRESS = oldAddress;
        if (oldSecret === undefined) delete process.env.UNSUBSCRIBE_SECRET;
        else process.env.UNSUBSCRIBE_SECRET = oldSecret;
    }
});
