/**
 * SaaS Analytics Engine
 *
 * Upgraded version of src/analytics.js for the SaaS server.
 * Tracks rate limiter metrics over time using Redis Hashes with TTL.
 */

let metricsBuffer = {
  allowed: 0,
  blocked: 0,
};

let redisClientRef = null;
let flushInterval = null;

/**
 * Start the analytics engine with a Redis client reference.
 * @param {Redis} redisClient
 */
function start(redisClient) {
  redisClientRef = redisClient;
  flushInterval = setInterval(flushBuffer, 5000);
}

/**
 * Stop the analytics engine.
 */
function stop() {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}

/**
 * Record a request outcome.
 * @param {boolean} allowed
 */
function record(allowed) {
  if (allowed) {
    metricsBuffer.allowed++;
  } else {
    metricsBuffer.blocked++;
  }
}

/**
 * Flush the in-memory buffer to Redis.
 */
async function flushBuffer() {
  const { allowed, blocked } = metricsBuffer;
  if (allowed === 0 && blocked === 0) return;

  metricsBuffer = { allowed: 0, blocked: 0 };

  try {
    if (!redisClientRef) return;

    const now = new Date();
    const minStr = now.toISOString().substring(0, 16);
    const minKey = `rl:metrics:min:${minStr}`;
    const hourStr = now.toISOString().substring(0, 13);
    const hourKey = `rl:metrics:hour:${hourStr}`;

    const pipeline = redisClientRef.pipeline();

    pipeline.hincrby(minKey, 'allowed', allowed);
    pipeline.hincrby(minKey, 'blocked', blocked);
    pipeline.expire(minKey, 60 * 60 * 2);

    pipeline.hincrby(hourKey, 'allowed', allowed);
    pipeline.hincrby(hourKey, 'blocked', blocked);
    pipeline.expire(hourKey, 60 * 60 * 48);

    await pipeline.exec();
  } catch (err) {
    console.error('Analytics flush error:', err.message);
  }
}

/**
 * Get the last 24 hours of data.
 * @returns {Promise<Array>}
 */
async function getHistory() {
  try {
    if (!redisClientRef) return [];

    const now = new Date();
    const pipeline = redisClientRef.pipeline();
    const labels = [];

    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const hourStr = d.toISOString().substring(0, 13);
      const key = `rl:metrics:hour:${hourStr}`;
      labels.push(d.toISOString());
      pipeline.hgetall(key);
    }

    const results = await pipeline.exec();

    return results.map((res, index) => {
      const data = res[1] || {};
      return {
        timestamp: labels[index],
        allowed: parseInt(data.allowed || '0', 10),
        blocked: parseInt(data.blocked || '0', 10),
      };
    });
  } catch (err) {
    console.error('Analytics history error:', err.message);
    return [];
  }
}

module.exports = { start, stop, record, getHistory };
