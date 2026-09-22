/**
 * @andliv/rate-limiter — NPM Package Entry Point
 *
 * A production-grade, distributed rate limiting toolkit for Node.js.
 *
 * Features:
 *   - 5 rate limiting algorithms (Token Bucket, Leaky Bucket, Fixed Window, Sliding Window, SW Counter)
 *   - Express middleware with dependency injection
 *   - WAF security: IP filtering, geo-blocking, bot detection, DDoS protection
 *   - API gateway with reverse proxy and middleware pipeline
 *   - Redis-backed distributed state
 *
 * Quick Start:
 *   const {
 *     rateLimiter,
 *     createRedisConnection,
 *     createIpFilter,
 *     createGeoBlocker,
 *     createBotDetector,
 *     createDdosProtection,
 *   } = require('@andliv/rate-limiter');
 *
 *   // Connect to Redis
 *   const redis = createRedisConnection({ host: '127.0.0.1', port: 6379 });
 *   await redis.connect();
 *
 *   // Rate limit Express routes
 *   app.use(rateLimiter({
 *     redisClient: redis.getClient(),
 *     algorithm: 'token_bucket',
 *     rps: 10,
 *     windowSize: 10,
 *   }));
 */

// ─── Core ───────────────────────────────────────────────────────────────────
const rateLimiter = require('./middleware/rateLimiter');
const algorithms = require('./algorithms');
const { createRedisConnection } = require('./redis');

// ─── Security / WAF ────────────────────────────────────────────────────────
const { createIpFilter } = require('./security/ipFilter');
const { createGeoBlocker } = require('./security/geoBlock');
const { createBotDetector } = require('./security/botDetector');
const { createDdosProtection } = require('./security/ddosProtection');

// ─── Gateway ────────────────────────────────────────────────────────────────
const { createProxy } = require('./gateway/proxy');
const { buildPipeline, registerGatewayRoutes } = require('./gateway/pipeline');
const { loadConfig, watchConfig, getDefaultConfig } = require('./gateway/configLoader');

module.exports = {
  // Core rate limiting
  rateLimiter,
  algorithms,
  createRedisConnection,

  // Security / WAF (Option 7)
  createIpFilter,
  createGeoBlocker,
  createBotDetector,
  createDdosProtection,

  // API Gateway (Option 4)
  createProxy,
  buildPipeline,
  registerGatewayRoutes,
  loadConfig,
  watchConfig,
  getDefaultConfig,
};
