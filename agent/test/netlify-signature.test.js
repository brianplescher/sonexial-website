const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { verifyNetlifySignature } = require('../src/netlify-signature');
const { guardedLookup } = require('../src/scanner');

const SECRET = 'test-secret';
const body = Buffer.from('{"form_name":"amazon-visibility-kit"}');

function sign(payload, secret = SECRET, alg = 'HS256') {
    const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url');
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(`${header}.${data}`).digest('base64url');
    return `${header}.${data}.${sig}`;
}

const bodyHash = crypto.createHash('sha256').update(body).digest('hex');

test('verifyNetlifySignature accepts a valid Netlify JWS', () => {
    assert.equal(verifyNetlifySignature(body, sign({ iss: 'netlify', sha256: bodyHash }), SECRET), true);
});

test('verifyNetlifySignature rejects wrong secret, tampered body, wrong issuer and wrong alg', () => {
    assert.equal(verifyNetlifySignature(body, sign({ iss: 'netlify', sha256: bodyHash }, 'other'), SECRET), false);
    assert.equal(verifyNetlifySignature(Buffer.from('{}'), sign({ iss: 'netlify', sha256: bodyHash }), SECRET), false);
    assert.equal(verifyNetlifySignature(body, sign({ iss: 'someone', sha256: bodyHash }), SECRET), false);
    assert.equal(verifyNetlifySignature(body, sign({ iss: 'netlify', sha256: bodyHash }, SECRET, 'none'), SECRET), false);
});

test('verifyNetlifySignature returns false instead of throwing on malformed or short signatures', () => {
    for (const sig of [undefined, '', 'abc', 'a.b.c', 'x.y', bodyHash]) {
        assert.equal(verifyNetlifySignature(body, sig, SECRET), false);
    }
});

test('guardedLookup refuses to connect to a hostname that resolves to loopback', (t, done) => {
    guardedLookup('localhost', {}, err => {
        assert.match(err.message, /SSRF validation failed/);
        done();
    });
});
