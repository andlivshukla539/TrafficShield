/**
 * Basic Usage Example — @andliv/rate-limiter
 *
 * Shows how to add rate limiting to any Express app in under 15 lines.
 *
 * Run:
 *   node examples/basic-usage.js
 *
 * Test:
 *   curl -X POST http://localhost:3000/api/data   (repeat rapidly to see blocking)
 */

const express = require('express');
const { rateLimiter, createRedisConnection } = require('../lib');

const app = express();

async function main() {
  // 1. Connect to Redis
  const redis = createRedisConnection({ host: '127.0.0.1', port: 6379 });
  await redis.connect();
  console.log('✅ Redis connected');

  // 2. Apply rate limiting middleware
  app.use(rateLimiter({
    redisClient: redis.getClient(),
    algorithm: 'token_bucket',  // Or: leaky_bucket, fixed_window, sliding_window, sliding_window_counter
    rps: 5,                      // 5 requests per second
    windowSize: 10,              // 10-second window
  }));

  // 3. Your routes
  app.post('/api/data', (req, res) => {
    res.json({
      message: 'Request successful!',
      remaining: req.rateLimit.remaining,
      limit: req.rateLimit.limit,
    });
  });

  app.listen(3000, () => {
    console.log('🚀 Server running on http://localhost:3000');
    console.log('   Try: curl -X POST http://localhost:3000/api/data');
  });
}

main().catch(console.error);
