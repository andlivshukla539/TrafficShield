/**
 * API Gateway Example — @andliv/rate-limiter
 *
 * Shows how to use the rate limiter as an API gateway with per-route
 * rate limiting, security rules, and reverse proxy forwarding.
 *
 * Run:
 *   node examples/gateway-usage.js
 */

const express = require('express');
const {
  createRedisConnection,
  loadConfig,
  registerGatewayRoutes,
  createIpFilter,
  createBotDetector,
  createDdosProtection,
} = require('../lib');

const app = express();

async function main() {
  // 1. Connect to Redis
  const redis = createRedisConnection({ host: '127.0.0.1', port: 6379 });
  await redis.connect();
  const redisClient = redis.getClient();

  // 2. Load gateway configuration
  let config;
  try {
    config = loadConfig('./gateway/gateway.config.yml');
    console.log('✅ Gateway config loaded');
  } catch (err) {
    console.error('Failed to load gateway config:', err.message);
    console.log('Using default configuration...');
    config = {
      routes: [
        {
          path: '/api/example',
          target: 'http://httpbin.org',
          rateLimit: { algorithm: 'token_bucket', rps: 5, windowSize: 10 },
        },
      ],
    };
  }

  // 3. Initialize security services
  const ipFilter = createIpFilter({ redisClient, mode: 'blacklist' });
  const botDetector = createBotDetector({ blockMissingUA: false });
  const ddos = createDdosProtection({ redisClient, maxViolations: 10 });

  // 4. Register all routes from the config
  console.log('');
  console.log('  📡 Gateway Routes:');
  registerGatewayRoutes(app, config, {
    redisClient,
    ipFilter,
    botDetector,
    ddos,
  });
  console.log('');

  // 5. Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'gateway_healthy', routes: config.routes.length });
  });

  const port = config.server?.port || 8080;
  app.listen(port, () => {
    console.log(`🚪 API Gateway running on http://localhost:${port}`);
  });
}

main().catch(console.error);
