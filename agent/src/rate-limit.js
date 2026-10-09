const net = require('node:net');

const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function getClientIp(req) {
    // The /api proxy is authenticated with Netlify's signed proxy token before this runs.
    // Netlify overwrites this header with the visitor address; X-Forwarded-For is caller-controlled.
    const netlifyIp = req.headers['x-nf-client-connection-ip'];
    if (typeof netlifyIp === 'string' && net.isIP(netlifyIp.trim())) {
        return netlifyIp.trim();
    }

    // Direct Railway requests are still tied to Railway's edge-provided address.
    const railwayIp = req.headers['x-real-ip'];
    if (typeof railwayIp === 'string' && net.isIP(railwayIp.trim())) {
        return railwayIp.trim();
    }

    return req.socket.remoteAddress || 'unknown';
}

function createRateLimiter(maxPerWindow) {
    const windows = new Map();

    setInterval(() => {
        const now = Date.now();
        for (const [ip, data] of windows) {
            if (now > data.resetTime) windows.delete(ip);
        }
    }, RATE_LIMIT_WINDOW_MS).unref();

    return function rateLimiter(req, res, next) {
        const ip = getClientIp(req);
        const now = Date.now();
        const clientData = windows.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

        if (now > clientData.resetTime) {
            clientData.count = 1;
            clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
        } else {
            clientData.count++;
        }

        windows.set(ip, clientData);

        if (clientData.count > maxPerWindow) {
            return res.status(429).json({ error: 'Too many requests. Please wait a moment before scanning again.' });
        }
        next();
    };
}

module.exports = { createRateLimiter, getClientIp };
