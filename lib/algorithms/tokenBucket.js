/**
 * Token Bucket Rate Limiting Algorithm
 *
 * How it works:
 *   1. A bucket holds tokens up to a maximum capacity (burst allowance)
 *   2. Tokens refill at a constant rate (refillRate tokens per second)
 *   3. Each incoming request consumes exactly one token
 *   4. If no tokens remain, the request is rejected
 *
 * Characteristics:
 *   - Allows controlled bursts up to the bucket capacity
 *   - Smooth, sustained rate limiting over time
 *   - Most widely used algorithm in production APIs (AWS, Stripe, etc.)
 *
 * Redis structure:
 *   Key:   rl:tb:{userId}
 *   Type:  Hash { tokens: float, lastRefillTime: int(ms) }
 *   TTL:   120 seconds (auto-cleanup for inactive users)
 *
 * @param {Redis}  redis  - ioredis client instance
 * @param {string} userId - Unique identifier for the rate limit subject
 * @param {object} config - { rps: number, windowSize: number }
 * @returns {Promise<{ allowed: boolean, remaining: number, limit: number, resetMs: number }>}
 */
async function tokenBucket(redis, userId, config) {
  const capacity = config.rps * 2;  // Allow 2x burst over sustained rate
  const refillRate = config.rps;     // Tokens added per second
  const key = `rl:tb:${userId}`;
  const now = Date.now();

  // Fetch current bucket state from Redis
  const [storedTokens, storedTime] = await redis.hmget(key, 'tokens', 'lastRefillTime');

  let tokens, lastRefillTime;

  if (storedTokens === null) {
    // First request from this user — start with full bucket
    tokens = capacity;
    lastRefillTime = now;
  } else {
    tokens = parseFloat(storedTokens);
    lastRefillTime = parseInt(storedTime, 10);
  }

  // Calculate tokens accumulated since last request
  const elapsedSeconds = (now - lastRefillTime) / 1000;
  tokens = Math.min(capacity, tokens + elapsedSeconds * refillRate);
  lastRefillTime = now;

  // Attempt to consume one token
  let allowed = false;
  if (tokens >= 1) {
    tokens -= 1;
    allowed = true;
  }

  // Persist updated state atomically with TTL
  const pipeline = redis.pipeline();
  pipeline.hmset(key, 'tokens', tokens.toString(), 'lastRefillTime', lastRefillTime.toString());
  pipeline.expire(key, 120);
  await pipeline.exec();

  return {
    allowed,
    remaining: Math.max(0, Math.floor(tokens)),
    limit: capacity,
    resetMs: allowed ? 0 : Math.ceil(((1 - tokens) / refillRate) * 1000),
  };
}

module.exports = tokenBucket;
