/**
 * Redis-based Historical Analytics Engine
 * 
 * Tracks rate limiter metrics over time using Redis Hashes with TTL.
 * Provides aggregations for:
 *   - Last 60 minutes (minute-level resolution)
 *   - Last 24 hours (hour-level resolution)
 */

const redis = require('./redis');

// In-memory buffer to reduce Redis write load (batch processing)
let metricsBuffer = {
  allowed: 0,
  blocked: 0,
};

/**
 * Start the background worker that flushes metrics to Redis every 5 seconds.
 */
function start() {
  setInterval(flushBuffer, 5000);
}

/**
 * Record a request outcome locally.
 */
function record(allowed) {
  if (allowed) {
    metricsBuffer.allowed++;
  } else {
    metricsBuffer.blocked++;
  }
}

/**
 * Flushes the in-memory buffer to Redis Hashes representing current minute and hour.
 */
async function flushBuffer() {
  const { allowed, blocked } = metricsBuffer;
  if (allowed === 0 && blocked === 0) return;

  // Reset buffer immediately so we don't drop concurrent requests
  metricsBuffer = { allowed: 0, blocked: 0 };

  try {
    const client = redis.getClient();
    const now = new Date();
    
    // YYYY-MM-DD:HH:mm (Minute resolution key)
    const minStr = now.toISOString().substring(0, 16);
    const minKey = `rl:metrics:min:${minStr}`;
    
    // YYYY-MM-DD:HH (Hour resolution key)
    const hourStr = now.toISOString().substring(0, 13);
    const hourKey = `rl:metrics:hour:${hourStr}`;

    const pipeline = client.pipeline();
    
    pipeline.hincrby(minKey, 'allowed', allowed);
    pipeline.hincrby(minKey, 'blocked', blocked);
    pipeline.expire(minKey, 60 * 60 * 2); // Keep minute data for 2 hours
    
    pipeline.hincrby(hourKey, 'allowed', allowed);
    pipeline.hincrby(hourKey, 'blocked', blocked);
    pipeline.expire(hourKey, 60 * 60 * 48); // Keep hourly data for 48 hours

    await pipeline.exec();
  } catch (err) {
    console.error('Failed to flush analytics to Redis:', err.message);
  }
}

/**
 * Fetch the last 24 hours of data.
 * Returns an array of exactly 24 objects for the chart.
 */
async function getHistory() {
  try {
    const client = redis.getClient();
    const now = new Date();
    
    const pipeline = client.pipeline();
    const labels = [];
    
    // Build pipeline for the last 24 hours (including current hour)
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
        blocked: parseInt(data.blocked || '0', 10)
      };
    });

  } catch (err) {
    console.error('Failed to fetch historical analytics:', err.message);
    return [];
  }
}

module.exports = { start, record, getHistory };
