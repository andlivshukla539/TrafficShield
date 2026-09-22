/**
 * In-Memory Rate Limiter & Metrics Store
 *
 * Provides a zero-dependency fallback so the dashboard demo works
 * without Redis running. Also tracks metrics in-memory for instant
 * retrieval by the /api/metrics endpoints.
 */

// ─── In-Memory Rate Limiter ────────────────────────────────────────────────

const buckets = new Map();

/**
 * Simple in-memory token bucket rate limiter.
 * @param {string} key - Unique identifier (IP, user, etc.)
 * @param {object} config - { rps, windowSize }
 * @returns {{ allowed: boolean, remaining: number, limit: number, resetMs: number }}
 */
function checkRateLimit(key, config) {
  const limit = config.rps || 5;
  const windowMs = (config.windowSize || 10) * 1000;
  const now = Date.now();

  let bucket = buckets.get(key);

  if (!bucket || now - bucket.lastRefill > windowMs) {
    // New bucket or window expired — reset
    bucket = { tokens: limit, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refillRate = limit / (windowMs / 1000); // tokens per second
  const tokensToAdd = (elapsed / 1000) * refillRate;
  bucket.tokens = Math.min(limit, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      limit,
      resetMs: windowMs - elapsed,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    limit,
    resetMs: windowMs - elapsed,
  };
}

// Cleanup stale buckets every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > 120000) {
      buckets.delete(key);
    }
  }
}, 60000);

// ─── In-Memory Metrics ─────────────────────────────────────────────────────

let metrics = { total: 0, allowed: 0, blocked: 0 };

// Rolling per-second history for the traffic chart (last 30 seconds)
let currentSecond = Math.floor(Date.now() / 1000);
let currentSecondMetrics = { allowed: 0, blocked: 0 };
const perSecondHistory = []; // Array of { allowed, blocked } — max 30 entries

// Rolling per-hour history for the history chart (last 24 hours)
const perHourHistory = new Map(); // hourKey → { allowed, blocked }

function recordMetric(allowed) {
  metrics.total++;
  if (allowed) metrics.allowed++;
  else metrics.blocked++;

  // Per-second tracking
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec !== currentSecond) {
    // Push the completed second to history
    perSecondHistory.push({ ...currentSecondMetrics });
    if (perSecondHistory.length > 30) perSecondHistory.shift();
    currentSecondMetrics = { allowed: 0, blocked: 0 };
    currentSecond = nowSec;
  }
  if (allowed) currentSecondMetrics.allowed++;
  else currentSecondMetrics.blocked++;

  // Per-hour tracking
  const hourKey = new Date().toISOString().substring(0, 13);
  const hourData = perHourHistory.get(hourKey) || { allowed: 0, blocked: 0 };
  if (allowed) hourData.allowed++;
  else hourData.blocked++;
  perHourHistory.set(hourKey, hourData);
}

function getMetrics() {
  return { ...metrics };
}

function getPerSecondHistory() {
  // Return the last 30 seconds + the current incomplete second
  return [...perSecondHistory, { ...currentSecondMetrics }];
}

function getHourlyHistory() {
  const now = new Date();
  const result = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourKey = d.toISOString().substring(0, 13);
    const data = perHourHistory.get(hourKey) || { allowed: 0, blocked: 0 };
    result.push({
      timestamp: d.toISOString(),
      allowed: data.allowed,
      blocked: data.blocked,
    });
  }
  return result;
}

module.exports = {
  checkRateLimit,
  recordMetric,
  getMetrics,
  getPerSecondHistory,
  getHourlyHistory,
};
