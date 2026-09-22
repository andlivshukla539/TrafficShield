/**
 * Fixed Window Counter Rate Limiting Algorithm
 *
 * How it works:
 *   1. Time is divided into fixed-size windows (e.g., 10-second blocks)
 *   2. Each window has an atomic counter tracking request count
 *   3. When the counter exceeds the limit, requests are rejected
 *   4. Counter auto-resets when the window expires (via Redis TTL)
 *
 * Characteristics:
 *   - Simplest and most memory-efficient (one counter per window per user)
 *   - O(1) time and space complexity per request
 *   - Susceptible to boundary-edge bursts: a client can send 2× the limit
 *     by timing requests at the boundary of two adjacent windows
 *
 * Redis structure:
 *   Key:   rl:fw:{userId}:{windowId}
 *   Type:  String (integer counter)
 *   TTL:   windowSize + 2 seconds (buffer for clock skew)
 *
 * @param {Redis}  redis  - ioredis client instance
 * @param {string} userId - Unique identifier for the rate limit subject
 * @param {object} config - { rps: number, windowSize: number }
 * @returns {Promise<{ allowed: boolean, remaining: number, limit: number, resetMs: number }>}
 */
async function fixedWindowCounter(redis, userId, config) {
  const limit = config.rps * config.windowSize; // Total requests allowed per window
  const windowSize = config.windowSize;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(nowSeconds / windowSize);
  const key = `rl:fw:${userId}:${windowId}`;

  // INCR is atomic — no race condition between read and write
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, windowSize + 2);
  const results = await pipeline.exec();

  const currentCount = results[0][1];
  const allowed = currentCount <= limit;

  // Time until this window resets
  const windowEndSeconds = (windowId + 1) * windowSize;
  const resetMs = Math.max(0, (windowEndSeconds - nowSeconds) * 1000);

  return {
    allowed,
    remaining: Math.max(0, limit - currentCount),
    limit,
    resetMs,
  };
}

module.exports = fixedWindowCounter;
