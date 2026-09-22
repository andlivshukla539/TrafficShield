/**
 * Rate Limiter Express Middleware (NPM Package Version)
 *
 * A production-ready, dependency-injectable middleware that wraps the algorithm logic.
 * Unlike the internal src/ version, this does NOT rely on global state or require
 * analytics/redis modules directly. Everything is passed via options.
 *
 * Usage:
 *   const { rateLimiter, createRedisConnection } = require('@andliv/rate-limiter');
 *
 *   const redis = createRedisConnection({ host: '127.0.0.1', port: 6379 });
 *   await redis.connect();
 *
 *   app.use(rateLimiter({
 *     redisClient: redis.getClient(),
 *     algorithm: 'token_bucket',
 *     rps: 10,
 *     windowSize: 10,
 *   }));
 */

const algorithms = require('../algorithms');

/**
 * Creates an Express rate limiting middleware.
 *
 * @param {Object} options - Configuration options
 * @param {Redis}  options.redisClient   - ioredis client instance (REQUIRED for NPM usage)
 * @param {string} [options.algorithm]   - Algorithm name (default: 'token_bucket')
 * @param {number} [options.rps]         - Requests per second (default: 10)
 * @param {number} [options.windowSize]  - Window size in seconds (default: 10)
 * @param {Function} [options.keyGenerator]   - Custom key generator function(req) → string
 * @param {Function} [options.onLimitReached] - Custom 429 handler function(req, res, result)
 * @param {Function} [options.onRequest]      - Callback on every request: function({ allowed, ip, algorithm })
 * @param {boolean}  [options.failOpen]       - If true (default), allow requests when Redis is down
 * @param {Object}   [options._globalConfig]  - Internal: reference to global config for SaaS server
 */
function rateLimiter(options = {}) {
  const getConfig = () => {
    // If an internal global config is passed (SaaS server mode), use it dynamically
    if (options._globalConfig) {
      const gc = options._globalConfig;
      return {
        algorithm: gc.algorithm || options.algorithm || 'token_bucket',
        rps: gc.rps || options.rps || 10,
        windowSize: gc.windowSize || options.windowSize || 10,
      };
    }

    return {
      algorithm: options.algorithm || 'token_bucket',
      rps: options.rps || 10,
      windowSize: options.windowSize || 10,
    };
  };

  const keyGenerator = options.keyGenerator || ((req) => {
    return req.headers['x-simulated-ip'] || req.ip || 'global';
  });

  const failOpen = options.failOpen !== undefined ? options.failOpen : true;

  return async (req, res, next) => {
    try {
      const config = getConfig();
      const userId = keyGenerator(req);

      // Get Redis client: either from options or from global (SaaS server mode)
      let redisClient = options.redisClient;
      if (!redisClient && options._getRedisClient) {
        redisClient = options._getRedisClient();
      }

      if (!redisClient) {
        throw new Error('No Redis client provided to rateLimiter middleware. Pass redisClient in options.');
      }

      const algo = algorithms.get(config.algorithm);
      const result = await algo(redisClient, userId, config);

      // Fire optional callback
      if (options.onRequest) {
        options.onRequest({
          allowed: result.allowed,
          ip: userId,
          algorithm: config.algorithm,
          remaining: result.remaining,
          limit: result.limit,
        });
      }

      // Set standard rate limit headers
      res.set({
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
        'X-RateLimit-Policy': `${result.limit};w=${config.windowSize}`,
      });

      if (result.allowed) {
        req.rateLimit = result;
        return next();
      } else {
        res.set('Retry-After', String(Math.ceil(result.resetMs / 1000)));

        if (options.onLimitReached) {
          return options.onLimitReached(req, res, result);
        }

        return res.status(429).json({
          error: 'Too Many Requests',
          status: 'BLOCKED',
          remaining: result.remaining,
          limit: result.limit,
          retryAfter: Math.ceil(result.resetMs / 1000),
          message: `Rate limit exceeded. Please try again in ${Math.ceil(result.resetMs / 1000)} seconds.`,
        });
      }
    } catch (error) {
      console.error('Rate Limiter Middleware Error:', error.message);

      if (failOpen) {
        // Fail-open: allow request so we don't break the application
        return next();
      } else {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Rate limiter backend is temporarily unavailable.',
        });
      }
    }
  };
}

module.exports = rateLimiter;
