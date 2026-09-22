/**
 * API Gateway — Middleware Pipeline Builder
 *
 * Constructs an ordered middleware chain for each gateway route:
 *   IP Filter → Bot Detection → DDoS Protection → Rate Limiter → Proxy Forward
 *
 * Each route can have independent configuration for rate limits and security rules.
 *
 * Usage:
 *   const { buildPipeline } = require('./pipeline');
 *   const middlewares = buildPipeline(routeConfig, { redisClient, ipFilter, ddos });
 *   app.use(routeConfig.path, ...middlewares);
 */

const rateLimiter = require('../middleware/rateLimiter');
const { createProxy } = require('./proxy');

/**
 * Builds an ordered middleware pipeline for a gateway route.
 *
 * @param {Object} routeConfig - Route configuration from gateway.config.yml
 * @param {string} routeConfig.path      - Incoming request path (e.g., '/api/users')
 * @param {string} routeConfig.target    - Backend target URL
 * @param {Object} routeConfig.rateLimit - Rate limit configuration
 * @param {Object} sharedServices - Shared middleware instances
 * @param {Redis}  sharedServices.redisClient - Redis client
 * @param {Object} [sharedServices.ipFilter]  - IP filter instance
 * @param {Object} [sharedServices.ddos]      - DDoS protection instance
 * @param {Function} [sharedServices.botDetector] - Bot detector middleware
 * @param {Function} [sharedServices.geoBlocker]  - Geo blocker middleware
 * @returns {Function[]} Array of Express middleware functions
 */
function buildPipeline(routeConfig, sharedServices = {}) {
  const pipeline = [];
  const { redisClient, ipFilter, ddos, botDetector, geoBlocker } = sharedServices;

  // Step 1: IP Filter (if configured)
  if (ipFilter) {
    pipeline.push(ipFilter.middleware());
  }

  // Step 2: Geo-blocking (if configured)
  if (geoBlocker) {
    pipeline.push(geoBlocker);
  }

  // Step 3: Bot Detection (if configured)
  if (botDetector) {
    pipeline.push(botDetector);
  }

  // Step 4: DDoS Protection (if configured)
  if (ddos) {
    pipeline.push(ddos.middleware());
  }

  // Step 5: Rate Limiter (if configured for this route)
  if (routeConfig.rateLimit && redisClient) {
    const rlMiddleware = rateLimiter({
      redisClient,
      algorithm: routeConfig.rateLimit.algorithm || 'token_bucket',
      rps: routeConfig.rateLimit.rps || 10,
      windowSize: routeConfig.rateLimit.windowSize || 10,
      keyGenerator: (req) => {
        // Rate limit per IP per route
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
        return `gw:${routeConfig.path}:${ip}`;
      },
      onRequest: ({ allowed, ip }) => {
        // Record violations for DDoS protection
        if (!allowed && ddos && req) {
          ddos.recordViolation(ip);
        }
      },
    });
    pipeline.push(rlMiddleware);
  }

  // Step 6: Proxy to target
  if (routeConfig.target) {
    const pathRewrite = {};
    if (routeConfig.stripPrefix !== false) {
      pathRewrite[`^${routeConfig.path}`] = '';
    }

    pipeline.push(createProxy({
      target: routeConfig.target,
      pathRewrite: Object.keys(pathRewrite).length > 0 ? pathRewrite : undefined,
      headers: routeConfig.headers || {},
      timeout: routeConfig.timeout || 30000,
    }));
  }

  return pipeline;
}

/**
 * Registers all routes from the gateway configuration onto an Express app.
 *
 * @param {Express} app          - Express application instance
 * @param {Object}  config       - Parsed gateway configuration
 * @param {Object}  sharedServices - Shared middleware instances
 */
function registerGatewayRoutes(app, config, sharedServices) {
  const routes = config.routes || [];

  for (const route of routes) {
    if (!route.path || !route.target) {
      console.warn(`[Gateway] Skipping invalid route:`, route);
      continue;
    }

    const pipeline = buildPipeline(route, sharedServices);
    app.use(route.path, ...pipeline);
    console.log(`  ├── ${route.path} → ${route.target} (${route.rateLimit?.algorithm || 'no rate limit'})`);
  }
}

module.exports = { buildPipeline, registerGatewayRoutes };
