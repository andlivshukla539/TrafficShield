/**
 * IP Filter Middleware — Whitelist & Blacklist
 *
 * Provides O(1) IP-based access control using Redis SETs.
 * Supports both whitelist (allow only) and blacklist (deny only) modes.
 *
 * Redis structure:
 *   Whitelist: rl:security:whitelist (SET)
 *   Blacklist: rl:security:blacklist (SET)
 *
 * Usage:
 *   const { createIpFilter } = require('@andliv/rate-limiter');
 *
 *   const ipFilter = createIpFilter({
 *     redisClient,
 *     mode: 'blacklist',
 *     staticBlacklist: ['1.2.3.4', '5.6.7.8'],
 *   });
 *
 *   app.use(ipFilter.middleware());
 *   await ipFilter.addToBlacklist('10.0.0.1');
 */

const WHITELIST_KEY = 'rl:security:whitelist';
const BLACKLIST_KEY = 'rl:security:blacklist';

/**
 * Creates an IP filter with whitelist/blacklist support.
 *
 * @param {Object} options
 * @param {Redis}  options.redisClient       - ioredis client instance
 * @param {string} [options.mode='blacklist'] - 'whitelist' or 'blacklist'
 * @param {Array<string>} [options.staticWhitelist=[]] - IPs always allowed (in-memory, no Redis)
 * @param {Array<string>} [options.staticBlacklist=[]] - IPs always blocked (in-memory, no Redis)
 * @param {Function} [options.getIp] - Custom IP extractor: (req) => string
 */
function createIpFilter(options = {}) {
  const {
    redisClient,
    mode = 'blacklist',
    staticWhitelist = [],
    staticBlacklist = [],
    getIp,
  } = options;

  const whiteSet = new Set(staticWhitelist);
  const blackSet = new Set(staticBlacklist);

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
   * Express middleware that checks IP against whitelist/blacklist.
   */
  function middleware() {
    return async (req, res, next) => {
      const ip = extractIp(req);

      try {
        // Static checks first (no Redis round-trip)
        if (blackSet.has(ip)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Your IP address has been blocked.',
            ip,
          });
        }

        if (whiteSet.has(ip)) {
          return next();
        }

        if (!redisClient) {
          return next();
        }

        if (mode === 'whitelist') {
          // Whitelist mode: only explicitly listed IPs are allowed
          const isMember = await redisClient.sismember(WHITELIST_KEY, ip);
          if (!isMember) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Your IP address is not in the allowed list.',
              ip,
            });
          }
        } else {
          // Blacklist mode: check if IP is blocked
          const isBlocked = await redisClient.sismember(BLACKLIST_KEY, ip);
          if (isBlocked) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Your IP address has been blocked.',
              ip,
            });
          }
        }

        next();
      } catch (err) {
        // Fail-open: if Redis is down, allow the request
        console.error('IP Filter error:', err.message);
        next();
      }
    };
  }

  /**
   * Add an IP to the whitelist.
   * @param {string} ip
   */
  async function addToWhitelist(ip) {
    if (redisClient) {
      await redisClient.sadd(WHITELIST_KEY, ip);
    }
    whiteSet.add(ip);
  }

  /**
   * Remove an IP from the whitelist.
   * @param {string} ip
   */
  async function removeFromWhitelist(ip) {
    if (redisClient) {
      await redisClient.srem(WHITELIST_KEY, ip);
    }
    whiteSet.delete(ip);
  }

  /**
   * Add an IP to the blacklist.
   * @param {string} ip
   */
  async function addToBlacklist(ip) {
    if (redisClient) {
      await redisClient.sadd(BLACKLIST_KEY, ip);
    }
    blackSet.add(ip);
  }

  /**
   * Remove an IP from the blacklist.
   * @param {string} ip
   */
  async function removeFromBlacklist(ip) {
    if (redisClient) {
      await redisClient.srem(BLACKLIST_KEY, ip);
    }
    blackSet.delete(ip);
  }

  /**
   * Get all whitelisted IPs.
   * @returns {Promise<string[]>}
   */
  async function getWhitelist() {
    const redisMembers = redisClient ? await redisClient.smembers(WHITELIST_KEY) : [];
    return [...new Set([...whiteSet, ...redisMembers])];
  }

  /**
   * Get all blacklisted IPs.
   * @returns {Promise<string[]>}
   */
  async function getBlacklist() {
    const redisMembers = redisClient ? await redisClient.smembers(BLACKLIST_KEY) : [];
    return [...new Set([...blackSet, ...redisMembers])];
  }

  /**
   * Check if a specific IP is allowed or blocked.
   * @param {string} ip
   * @returns {Promise<{ allowed: boolean, reason: string }>}
   */
  async function check(ip) {
    if (blackSet.has(ip)) {
      return { allowed: false, reason: 'static_blacklist' };
    }
    if (whiteSet.has(ip)) {
      return { allowed: true, reason: 'static_whitelist' };
    }

    if (redisClient) {
      if (mode === 'whitelist') {
        const isMember = await redisClient.sismember(WHITELIST_KEY, ip);
        return { allowed: !!isMember, reason: isMember ? 'redis_whitelist' : 'not_in_whitelist' };
      } else {
        const isBlocked = await redisClient.sismember(BLACKLIST_KEY, ip);
        return { allowed: !isBlocked, reason: isBlocked ? 'redis_blacklist' : 'not_blocked' };
      }
    }

    return { allowed: true, reason: 'no_redis' };
  }

  return {
    middleware,
    addToWhitelist,
    removeFromWhitelist,
    addToBlacklist,
    removeFromBlacklist,
    getWhitelist,
    getBlacklist,
    check,
  };
}

module.exports = { createIpFilter };
