/**
 * DDoS Protection Middleware
 *
 * Automatically detects and bans IPs that repeatedly trigger rate limits.
 * Acts as a secondary defense layer on top of the core rate limiter.
 *
 * How it works:
 *   1. Tracks per-IP rate limit violations in Redis (rl:ddos:violations:{ip})
 *   2. When violations exceed `maxViolations` within `trackingWindowSecs`, the IP is auto-banned
 *   3. Banned IPs are stored in Redis (rl:ddos:ban:{ip}) with a TTL of `banDurationSecs`
 *   4. Banned IPs receive an immediate 403 without reaching the rate limiter
 *
 * Usage:
 *   const { createDdosProtection } = require('@andliv/rate-limiter');
 *
 *   const ddos = createDdosProtection({
 *     redisClient,
 *     maxViolations: 10,
 *     trackingWindowSecs: 60,
 *     banDurationSecs: 86400,  // 24 hours
 *   });
 *
 *   app.use(ddos.middleware());
 *
 *   // After rate limiter rejects a request, record the violation:
 *   ddos.recordViolation(req.ip);
 */

const BAN_KEY_PREFIX = 'rl:ddos:ban:';
const VIOLATION_KEY_PREFIX = 'rl:ddos:violations:';

/**
 * Creates a DDoS protection system.
 *
 * @param {Object} options
 * @param {Redis}  options.redisClient         - ioredis client instance
 * @param {number} [options.maxViolations=10]     - Max violations before auto-ban
 * @param {number} [options.trackingWindowSecs=60] - Time window to track violations
 * @param {number} [options.banDurationSecs=86400] - Ban duration in seconds (default: 24h)
 * @param {Function} [options.getIp]              - Custom IP extractor
 * @param {boolean}  [options.logBans=true]       - Log auto-bans to console
 */
function createDdosProtection(options = {}) {
  const {
    redisClient,
    maxViolations = 10,
    trackingWindowSecs = 60,
    banDurationSecs = 86400,
    getIp,
    logBans = true,
  } = options;

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

  /**
   * Express middleware that checks if an IP is banned.
   * This should be mounted BEFORE the rate limiter.
   */
  function middleware() {
    return async (req, res, next) => {
      if (!redisClient) return next();

      const ip = extractIp(req);

      try {
        const banKey = `${BAN_KEY_PREFIX}${ip}`;
        const isBanned = await redisClient.exists(banKey);

        if (isBanned) {
          const ttl = await redisClient.ttl(banKey);
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Your IP has been temporarily banned due to excessive rate limit violations.',
            reason: 'ddos_auto_ban',
            bannedFor: `${ttl} seconds remaining`,
            ip,
          });
        }

        // Attach ddos helper to request so downstream middleware can record violations
        req.ddos = {
          recordViolation: () => recordViolation(ip),
        };

        next();
      } catch (err) {
        console.error('DDoS protection error:', err.message);
        next(); // Fail-open
      }
    };
  }

  /**
   * Record a rate limit violation for an IP.
   * If violations exceed the threshold, auto-ban the IP.
   *
   * @param {string} ip - The IP address that violated
   * @returns {Promise<{ banned: boolean, violations: number }>}
   */
  async function recordViolation(ip) {
    if (!redisClient) return { banned: false, violations: 0 };

    try {
      const violationKey = `${VIOLATION_KEY_PREFIX}${ip}`;

      const pipeline = redisClient.pipeline();
      pipeline.incr(violationKey);
      pipeline.expire(violationKey, trackingWindowSecs);
      const results = await pipeline.exec();

      const violations = results[0][1];

      if (violations >= maxViolations) {
        // Auto-ban this IP
        const banKey = `${BAN_KEY_PREFIX}${ip}`;
        await redisClient.setex(banKey, banDurationSecs, JSON.stringify({
          bannedAt: new Date().toISOString(),
          violations,
          reason: 'auto_ddos_protection',
        }));

        // Clean up violation counter
        await redisClient.del(violationKey);

        if (logBans) {
          console.log(`[DDoS Protection] Auto-banned IP ${ip} for ${banDurationSecs}s (${violations} violations)`);
        }

        return { banned: true, violations };
      }

      return { banned: false, violations };
    } catch (err) {
      console.error('DDoS recordViolation error:', err.message);
      return { banned: false, violations: 0 };
    }
  }

  /**
   * Manually ban an IP.
   * @param {string} ip
   * @param {number} [duration] - Override ban duration in seconds
   */
  async function banIp(ip, duration) {
    if (!redisClient) return;
    const banKey = `${BAN_KEY_PREFIX}${ip}`;
    await redisClient.setex(banKey, duration || banDurationSecs, JSON.stringify({
      bannedAt: new Date().toISOString(),
      reason: 'manual_ban',
    }));
  }

  /**
   * Manually unban an IP.
   * @param {string} ip
   */
  async function unbanIp(ip) {
    if (!redisClient) return;
    const banKey = `${BAN_KEY_PREFIX}${ip}`;
    await redisClient.del(banKey);
  }

  /**
   * Check if an IP is currently banned.
   * @param {string} ip
   * @returns {Promise<{ banned: boolean, ttl: number, data: Object|null }>}
   */
  async function isBanned(ip) {
    if (!redisClient) return { banned: false, ttl: 0, data: null };
    const banKey = `${BAN_KEY_PREFIX}${ip}`;
    const data = await redisClient.get(banKey);
    if (!data) return { banned: false, ttl: 0, data: null };
    const ttl = await redisClient.ttl(banKey);
    return { banned: true, ttl, data: JSON.parse(data) };
  }

  /**
   * Get current violation count for an IP.
   * @param {string} ip
   * @returns {Promise<number>}
   */
  async function getViolations(ip) {
    if (!redisClient) return 0;
    const violationKey = `${VIOLATION_KEY_PREFIX}${ip}`;
    const count = await redisClient.get(violationKey);
    return parseInt(count || '0', 10);
  }

  return {
    middleware,
    recordViolation,
    banIp,
    unbanIp,
    isBanned,
    getViolations,
  };
}

module.exports = { createDdosProtection };
