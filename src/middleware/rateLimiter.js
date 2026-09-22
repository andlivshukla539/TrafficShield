/**
 * Rate Limiter Express Middleware
 *
 * A reusable, production-ready middleware that wraps the algorithm logic.
 *
 * Usage:
 *   const rateLimiter = require('./middleware/rateLimiter');
 *
 *   app.use('/api', rateLimiter({
 *     algorithm: 'token_bucket',
 *     rps: 10,
 *     windowSize: 10,
 *     keyGenerator: (req) => req.ip
 *   }));
 */

const algorithms = require('../algorithms');
const redis = require('../redis');
const analytics = require('../analytics');

/**
 * Creates an Express rate limiting middleware.
 * @param {Object} options - Configuration options
 * @param {string} options.algorithm - Name of the algorithm to use (default: 'token_bucket')
 * @param {number} options.rps - Requests allowed per second (default: 5)
 * @param {number} options.windowSize - Window size in seconds (default: 10)
 * @param {Function} options.keyGenerator - Function to generate unique ID from request (default: IP based)
 * @param {Function} options.onLimitReached - Custom handler for 429 errors
 */
function rateLimiter(options = {}) {
  // Global config fallback reference (useful if we want to change config at runtime via dashboard)
  const getConfig = () => {
    // If the server module exposes a global config override, we can use it.
    // Otherwise, fallback to the passed options or defaults.
    const globalConfig = global.RATE_LIMIT_CONFIG || {};
    return {
      algorithm: globalConfig.algorithm || options.algorithm || 'token_bucket',
      rps: globalConfig.rps || options.rps || 5,
      windowSize: globalConfig.windowSize || options.windowSize || 10,
    };
  };

  const keyGenerator = options.keyGenerator || ((req) => {
    // Determine the IP or simulated IP from dashboard
    return req.headers['x-simulated-ip'] || req.ip || 'global';
  });

  return async (req, res, next) => {
    try {
      const config = getConfig();
      const userId = keyGenerator(req);
      
      const redisClient = redis.getClient();
      const algo = algorithms.get(config.algorithm);
      
      const result = await algo(redisClient, userId, config);
      
      // Record analytics asynchronously
      analytics.record(result.allowed);

      // Set standard headers
      res.set({
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
        'X-RateLimit-Policy': `${result.limit};w=${config.windowSize}`,
      });

      if (result.allowed) {
        // Attach rate limit info to request object for downstream use if needed
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
          message: `Rate limit exceeded. Please try again in ${Math.ceil(result.resetMs / 1000)} seconds.`
        });
      }
    } catch (error) {
      console.error('Rate Limiter Middleware Error:', error);
      // Fail-open: if Redis or algorithm fails, allow the request so we don't break the application
      next();
    }
  };
}

module.exports = rateLimiter;
