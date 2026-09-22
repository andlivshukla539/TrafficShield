/**
 * API Gateway — Reverse Proxy Engine
 *
 * Routes incoming requests to configured backend targets using http-proxy-middleware.
 * Supports path rewriting, header injection, and error handling.
 *
 * Usage:
 *   const { createProxy } = require('./proxy');
 *   const proxy = createProxy({ target: 'http://localhost:3001' });
 *   app.use('/api/users', proxy);
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Creates a reverse proxy middleware for a single target.
 *
 * @param {Object} options
 * @param {string} options.target        - Backend target URL (e.g., 'http://localhost:3001')
 * @param {string} [options.pathRewrite] - Path rewrite rules (e.g., { '^/api/users': '/users' })
 * @param {Object} [options.headers]     - Additional headers to inject into proxied requests
 * @param {number} [options.timeout]     - Proxy timeout in ms (default: 30000)
 * @param {Function} [options.onError]   - Custom error handler
 * @returns {Function} Express middleware
 */
function createProxy(options = {}) {
  const {
    target,
    pathRewrite,
    headers = {},
    timeout = 30000,
    onError,
  } = options;

  if (!target) {
    throw new Error('Gateway proxy requires a target URL');
  }

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: pathRewrite || undefined,
    timeout,
    proxyTimeout: timeout,
    headers: {
      'X-Forwarded-By': 'premium-rate-limiter-gateway',
      ...headers,
    },
    on: {
      error: (err, req, res) => {
        if (onError) {
          return onError(err, req, res);
        }
        console.error(`[Gateway] Proxy error for ${target}:`, err.message);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Bad Gateway',
            message: `Unable to reach backend service at ${target}`,
            target,
          });
        }
      },
      proxyReq: (proxyReq, req) => {
        // Forward the original client IP
        const clientIp = req.headers['x-forwarded-for'] || req.ip;
        proxyReq.setHeader('X-Forwarded-For', clientIp);
        proxyReq.setHeader('X-Real-IP', req.ip || 'unknown');

        // Forward gateway metadata
        proxyReq.setHeader('X-Gateway-Timestamp', Date.now().toString());
      },
    },
  });
}

module.exports = { createProxy };
