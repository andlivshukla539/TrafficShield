/**
 * Geo-Blocking Middleware
 *
 * Blocks or allows requests based on the geographic origin of the client IP.
 * Uses `geoip-lite` for offline IP → country resolution (no external API calls).
 *
 * Supports two modes:
 *   - allowedCountries: Only these countries can access (strict allowlist)
 *   - blockedCountries: These countries are blocked (denylist)
 *
 * Usage:
 *   const { createGeoBlocker } = require('@andliv/rate-limiter');
 *
 *   // Block specific countries
 *   app.use(createGeoBlocker({
 *     blockedCountries: ['CN', 'RU', 'KP'],
 *   }));
 *
 *   // Or allow only specific countries
 *   app.use(createGeoBlocker({
 *     allowedCountries: ['US', 'CA', 'GB', 'IN'],
 *   }));
 */

let geoip;
try {
  geoip = require('geoip-lite');
} catch (e) {
  // geoip-lite is an optional dependency
  geoip = null;
}

/**
 * Creates a geo-blocking Express middleware.
 *
 * @param {Object} options
 * @param {string[]} [options.allowedCountries] - ISO 3166-1 alpha-2 codes to allow (whitelist mode)
 * @param {string[]} [options.blockedCountries] - ISO 3166-1 alpha-2 codes to block (blacklist mode)
 * @param {Function} [options.getIp]            - Custom IP extractor: (req) => string
 * @param {boolean}  [options.allowPrivate=true] - Allow private/local IPs (127.x, 10.x, 192.168.x)
 * @returns {Function} Express middleware
 */
function createGeoBlocker(options = {}) {
  const {
    allowedCountries = [],
    blockedCountries = [],
    getIp,
    allowPrivate = true,
  } = options;

  const allowSet = new Set(allowedCountries.map(c => c.toUpperCase()));
  const blockSet = new Set(blockedCountries.map(c => c.toUpperCase()));
  const isAllowlistMode = allowSet.size > 0;

  /**
   * Check if an IP is private/local.
   */
  function isPrivateIp(ip) {
    if (!ip) return true;
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === 'localhost' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('172.') ||
      ip === '::ffff:127.0.0.1'
    );
  }

  /**
   * Extract IP from request.
   */
  function extractIp(req) {
    if (getIp) return getIp(req);
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.connection?.remoteAddress
      || req.ip
      || 'unknown';
  }

  return (req, res, next) => {
    if (!geoip) {
      // If geoip-lite is not installed, skip geo-blocking
      return next();
    }

    const ip = extractIp(req);

    // Allow private IPs (localhost, Docker, etc.)
    if (allowPrivate && isPrivateIp(ip)) {
      return next();
    }

    const geo = geoip.lookup(ip);
    const country = geo ? geo.country : null;

    // Attach geo data to request for downstream use
    req.geoip = {
      ip,
      country: country || 'UNKNOWN',
      region: geo ? geo.region : null,
      city: geo ? geo.city : null,
      ll: geo ? geo.ll : null,
    };

    if (!country) {
      // Cannot determine country — allow by default
      return next();
    }

    if (isAllowlistMode) {
      // Allowlist mode: block if country is NOT in the allowed set
      if (!allowSet.has(country)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Access from your region (${country}) is not permitted.`,
          country,
        });
      }
    } else if (blockSet.size > 0) {
      // Blocklist mode: block if country IS in the blocked set
      if (blockSet.has(country)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Access from your region (${country}) has been restricted.`,
          country,
        });
      }
    }

    next();
  };
}

module.exports = { createGeoBlocker };
