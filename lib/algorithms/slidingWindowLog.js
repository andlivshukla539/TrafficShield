/**
 * Sliding Window Log Rate Limiting Algorithm
 *
 * How it works:
 *   1. Every request timestamp is stored as a member in a Redis Sorted Set
 *   2. On each new request, entries outside the sliding window are pruned
 *   3. The remaining count determines whether the limit has been exceeded
 *   4. Uses ZADD for insert, ZREMRANGEBYSCORE for cleanup, ZCARD for count
 *
 * Characteristics:
 *   - 100% accurate rate limiting — no boundary-edge burst vulnerability
 *   - Most memory-intensive algorithm (stores every request timestamp)
 *   - O(log N) insert, O(N) cleanup (where N = requests in window)
 *   - Best for scenarios requiring precise enforcement
 *
 * Redis structure:
 *   Key:   rl:sw:{userId}
 *   Type:  Sorted Set (score = timestamp in ms, member = unique ID)
 *   TTL:   windowSize + 2 seconds
 *
 * @param {Redis}  redis  - ioredis client instance
 * @param {string} userId - Unique identifier for the rate limit subject
 * @param {object} config - { rps: number, windowSize: number }
 * @returns {Promise<{ allowed: boolean, remaining: number, limit: number, resetMs: number }>}
 */
async function slidingWindowLog(redis, userId, config) {
  const limit = config.rps * config.windowSize;
  const windowSize = config.windowSize;
  const key = `rl:sw:${userId}`;
  const now = Date.now();
  const windowStart = now - (windowSize * 1000);

  // All operations in a single pipeline round-trip
  const pipeline = redis.pipeline();

  // 1. Remove all entries older than the sliding window boundary
  pipeline.zremrangebyscore(key, 0, windowStart);

  // 2. Add current request with a unique member to prevent timestamp collisions
  const uniqueMember = `${now}:${Math.random().toString(36).slice(2, 8)}`;
  pipeline.zadd(key, now, uniqueMember);

  // 3. Count all entries within the current window
  pipeline.zcard(key);

  // 4. Set TTL to auto-cleanup abandoned keys
  pipeline.expire(key, windowSize + 2);

  const results = await pipeline.exec();
  const requestCount = results[2][1]; // ZCARD result

  const allowed = requestCount <= limit;

  return {
    allowed,
    remaining: Math.max(0, limit - requestCount),
    limit,
    resetMs: allowed ? 0 : windowSize * 1000,
  };
}

module.exports = slidingWindowLog;
