/**
 * Leaky Bucket Rate Limiting Algorithm
 *
 * How it works:
 *   1. Incoming requests are added to a virtual queue (the bucket)
 *   2. The bucket "leaks" (drains) at a fixed rate — processing requests steadily
 *   3. If the bucket is full (queue at capacity), new requests are rejected
 *   4. Unlike Token Bucket, this produces a perfectly smooth output rate
 *
 * Characteristics:
 *   - Strictly smooth output — no bursts whatsoever
 *   - Good for downstream services that can't handle spikes
 *   - Slightly higher perceived latency under load (requests are queued)
 *
 * Redis structure:
 *   Key:   rl:lb:{userId}
 *   Type:  Hash { queueSize: float, lastLeakTime: int(ms) }
 *   TTL:   120 seconds
 *
 * @param {Redis}  redis  - ioredis client instance
 * @param {string} userId - Unique identifier for the rate limit subject
 * @param {object} config - { rps: number, windowSize: number }
 * @returns {Promise<{ allowed: boolean, remaining: number, limit: number, resetMs: number }>}
 */
async function leakyBucket(redis, userId, config) {
  const capacity = config.rps * 2;  // Maximum queue depth
  const leakRate = config.rps;       // Requests drained per second
  const key = `rl:lb:${userId}`;
  const now = Date.now();

  // Fetch current queue state
  const [storedQueue, storedTime] = await redis.hmget(key, 'queueSize', 'lastLeakTime');

  let queueSize, lastLeakTime;

  if (storedQueue === null) {
    // No prior state — empty queue
    queueSize = 0;
    lastLeakTime = now;
  } else {
    queueSize = parseFloat(storedQueue);
    lastLeakTime = parseInt(storedTime, 10);
  }

  // Drain requests that have "leaked" since last check
  const elapsedSeconds = (now - lastLeakTime) / 1000;
  const leaked = elapsedSeconds * leakRate;
  queueSize = Math.max(0, queueSize - leaked);
  lastLeakTime = now;

  // Attempt to enqueue the new request
  let allowed = false;
  if (queueSize < capacity) {
    queueSize += 1;
    allowed = true;
  }

  // Persist updated state
  const pipeline = redis.pipeline();
  pipeline.hmset(key, 'queueSize', queueSize.toString(), 'lastLeakTime', lastLeakTime.toString());
  pipeline.expire(key, 120);
  await pipeline.exec();

  return {
    allowed,
    remaining: Math.max(0, Math.floor(capacity - queueSize)),
    limit: capacity,
    resetMs: allowed ? 0 : Math.ceil((1 / leakRate) * 1000),
  };
}

module.exports = leakyBucket;
