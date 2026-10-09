const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter, getClientIp } = require('../src/rate-limit');

function request({ netlifyIp, xRealIp, xForwardedFor, remoteAddress = '127.0.0.1' } = {}) {
    return {
        headers: {
            ...(netlifyIp ? { 'x-nf-client-connection-ip': netlifyIp } : {}),
            ...(xRealIp ? { 'x-real-ip': xRealIp } : {}),
            ...(xForwardedFor ? { 'x-forwarded-for': xForwardedFor } : {})
        },
        socket: { remoteAddress }
    };
}

function applyLimiter(limiter, req) {
    let allowed = false;
    let statusCode = null;
    limiter(req, {
        status(code) {
            statusCode = code;
            return this;
        },
        json() {}
    }, () => { allowed = true; });
    return { allowed, statusCode };
}

test('rate limits use the verified Netlify client IP and ignore caller-supplied X-Forwarded-For', () => {
    const limiter = createRateLimiter(1);
    const client = '203.0.113.5';

    assert.deepEqual(applyLimiter(limiter, request({
        netlifyIp: client,
        xRealIp: '198.51.100.10',
        xForwardedFor: '198.51.100.1'
    })), { allowed: true, statusCode: null });

    assert.deepEqual(applyLimiter(limiter, request({
        netlifyIp: client,
        xRealIp: '198.51.100.11',
        xForwardedFor: '198.51.100.2'
    })), { allowed: false, statusCode: 429 });
});

test('rate limiting falls back to the socket address for invalid or missing X-Real-IP', () => {
    assert.equal(getClientIp(request({
        netlifyIp: 'not-an-ip',
        xRealIp: 'not-an-ip',
        xForwardedFor: '198.51.100.1',
        remoteAddress: '192.0.2.10'
    })), '192.0.2.10');
    assert.equal(getClientIp(request({
        xForwardedFor: '198.51.100.1',
        remoteAddress: '192.0.2.11'
    })), '192.0.2.11');
    assert.equal(getClientIp(request({
        xRealIp: '192.0.2.12',
        remoteAddress: '192.0.2.13'
    })), '192.0.2.12');
});
