/**
 * WAF Security Example — @andliv/rate-limiter
 *
 * Demonstrates IP filtering, geo-blocking, bot detection, and DDoS protection.
 *
 * Run:
 *   node examples/waf-usage.js
 */

const express = require('express');
const {
  rateLimiter,
  createRedisConnection,
  createIpFilter,
  createGeoBlocker,
  createBotDetector,
  createDdosProtection,
} = require('../lib');

const app = express();
app.use(express.json());

async function main() {
  // 1. Connect to Redis
  const redis = createRedisConnection({ host: '127.0.0.1', port: 6379 });
  await redis.connect();
  const redisClient = redis.getClient();

  // 2. IP Filtering — Block known bad IPs
  const ipFilter = createIpFilter({
    redisClient,
    mode: 'blacklist',
    staticBlacklist: ['10.0.0.1'],        // Always blocked
    staticWhitelist: ['127.0.0.1', '::1'], // Always allowed
  });
  app.use(ipFilter.middleware());

  // 3. Geo-Blocking — Block specific countries
  app.use(createGeoBlocker({
    blockedCountries: ['KP'],  // Block North Korea
    allowPrivate: true,         // Allow localhost/Docker IPs
  }));

  // 4. Bot Detection — Block malicious bots
  app.use(createBotDetector({
    blockMissingUA: true,
    allowLegitBots: true,   // Allow Googlebot, Bingbot, etc.
    logBlocked: true,        // Log blocked requests
  }));

  // 5. DDoS Protection — Auto-ban repeat offenders
  const ddos = createDdosProtection({
    redisClient,
    maxViolations: 5,           // Ban after 5 violations
    trackingWindowSecs: 60,     // Within 60 seconds
    banDurationSecs: 3600,      // Ban for 1 hour
  });
  app.use(ddos.middleware());

  // 6. Rate Limiting
  app.use(rateLimiter({
    redisClient,
    algorithm: 'sliding_window_counter',
    rps: 10,
    windowSize: 10,
    onRequest: async ({ allowed, ip }) => {
      if (!allowed) {
        await ddos.recordViolation(ip);
      }
    },
  }));

  // 7. Your routes
  app.get('/api/data', (req, res) => {
    res.json({
      message: 'You passed all security checks!',
      geoip: req.geoip || null,
      botInfo: req.botInfo || null,
    });
  });

  // Management endpoints
  app.post('/admin/block-ip', async (req, res) => {
    await ipFilter.addToBlacklist(req.body.ip);
    res.json({ message: `Blocked ${req.body.ip}` });
  });

  app.post('/admin/ban-ip', async (req, res) => {
    await ddos.banIp(req.body.ip, req.body.duration || 86400);
    res.json({ message: `Banned ${req.body.ip}` });
  });

  app.listen(3000, () => {
    console.log('🛡️ WAF-protected server running on http://localhost:3000');
    console.log('   Try: curl http://localhost:3000/api/data');
    console.log('   Try: curl -H "User-Agent: sqlmap" http://localhost:3000/api/data');
  });
}

main().catch(console.error);
