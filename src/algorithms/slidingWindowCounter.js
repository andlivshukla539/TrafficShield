/**
 * Sliding Window Counter Rate Limiting Algorithm
 *
 * How it works:
 *   1. Maintains counters for the CURRENT and PREVIOUS fixed windows
 *   2. Computes a weighted request count based on position in the current window
 *   3. Formula: weightedCount = prevCount × (1 - elapsed%) + currentCount
 *   4. If the weighted count exceeds the limit, the request is rejected
 *
 * Characteristics:
 *   - Hybrid approach: accuracy of Sliding Window + efficiency of Fixed Window
 *   - Only stores two counters per user (very memory-efficient)
 *   - Near-perfect accuracy (slight approximation vs. exact Sliding Window Log)
 *   - Used in production by Cloudflare, Kong, and other major platforms
 *
 * Redis structure:
 *   Key:   rl:swc:{userId}:{windowId}
 *   Type:  String (integer counter) — one per window
 *   TTL:   windowSize × 2 + 2 seconds
 *
 * @param {Redis}  redis  - ioredis client instance
 * @param {string} userId - Unique identifier for the rate limit subject
 * @param {object} config - { rps: number, windowSize: number }
 * @returns {Promise<{ allowed: boolean, remaining: number, limit: number, resetMs: number }>}
 */
async function slidingWindowCounter(redis, userId, config) {
  const limit = config.rps * config.windowSize;
  const windowSize = config.windowSize;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const currentWindowId = Math.floor(nowSeconds / windowSize);
  const previousWindowId = currentWindowId - 1;

  const currentKey = `rl:swc:${userId}:${currentWindowId}`;
  const previousKey = `rl:swc:${userId}:${previousWindowId}`;

  // Fetch both window counts in one round-trip
  const [prevRaw, currRaw] = await redis.mget(previousKey, currentKey);

  const previousCount = parseInt(prevRaw || '0', 10);
  const currentCount = parseInt(currRaw || '0', 10);

  // Calculate how far into the current window we are (0.0 → 1.0)
  const windowStart = currentWindowId * windowSize;
  const elapsedFraction = (nowSeconds - windowStart) / windowSize;

  // Weighted estimate across the sliding boundary
  const weightedCount = previousCount * (1 - elapsedFraction) + currentCount;
  const allowed = weightedCount < limit;

  if (allowed) {
    // Only increment if the request is allowed (avoids inflating counts for rejected requests)
    const pipeline = redis.pipeline();
    pipeline.incr(currentKey);
    pipeline.expire(currentKey, windowSize * 2 + 2);
    await pipeline.exec();
  }

  // Time until the current window resets
  const resetMs = Math.max(0, ((currentWindowId + 1) * windowSize - nowSeconds) * 1000);

  return {
    allowed,
    remaining: Math.max(0, Math.floor(limit - weightedCount)),
    limit,
    resetMs,
  };
}

module.exports = slidingWindowCounter;
