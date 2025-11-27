// Simple in-memory rate limiter and IP helper
// Purpose: satisfy imports in `index.js` and provide a lightweight rate limiter

const ipStore = new Map();

// Configuration: allow X requests per windowMs for AI endpoints
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 20; // max requests per IP per window

function getRealIP(req) {
    // Common headers used by proxies/CDNs
    const cf = req.headers['cf-connecting-ip'];
    const xReal = req.headers['x-real-ip'];
    const xForwarded = req.headers['x-forwarded-for'];

    if (cf) return cf.split(',')[0].trim();
    if (xReal) return xReal.split(',')[0].trim();
    if (xForwarded) return xForwarded.split(',')[0].trim();

    // fallback to connection remote address
    return (req.connection && req.connection.remoteAddress) || req.ip || null;
}

function rateLimitAI(req, res, next) {
    try {
        const ip = getRealIP(req) || 'unknown';
        const now = Date.now();

        let entry = ipStore.get(ip);
        if (!entry || (now - entry.first) > WINDOW_MS) {
            entry = { count: 1, first: now };
            ipStore.set(ip, entry);
            return next();
        }

        entry.count += 1;
        ipStore.set(ip, entry);

        if (entry.count > MAX_REQUESTS) {
            res.status(429).json({
                success: false,
                message: `Terlalu banyak permintaan. Maks ${MAX_REQUESTS} request per ${WINDOW_MS/1000} detik.`
            });
            return;
        }

        return next();
    } catch (err) {
        // If rate limiter fails for any reason, allow the request but log minimal info
        console.error('rateLimitAI error:', err && err.message);
        return next();
    }
}

module.exports = { rateLimitAI, getRealIP };
