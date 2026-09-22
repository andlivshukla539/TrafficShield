/**
 * Algorithm Registry
 *
 * Central registry for all rate limiting algorithms.
 * Provides:
 *   - Factory access to algorithm functions by key
 *   - Algorithm metadata (name, icon, description, pros/cons) for the dashboard UI
 *   - Input validation for unknown algorithm keys
 */

const tokenBucket = require('./tokenBucket');
const leakyBucket = require('./leakyBucket');
const fixedWindowCounter = require('./fixedWindowCounter');
const slidingWindowLog = require('./slidingWindowLog');
const slidingWindowCounter = require('./slidingWindowCounter');

const registry = {
  token_bucket: {
    fn: tokenBucket,
    name: 'Token Bucket',
    icon: '🪣',
    description:
      'Tokens refill at a fixed rate up to a maximum capacity. Each request consumes one token. Allows controlled bursts while enforcing a sustained rate limit.',
    pros: ['Allows controlled bursts', 'Smooth long-term limiting', 'Industry standard (AWS, Stripe)'],
    cons: ['Slightly more state to track', 'Bursts can overwhelm downstream services'],
  },
  leaky_bucket: {
    fn: leakyBucket,
    name: 'Leaky Bucket',
    icon: '💧',
    description:
      'Requests enter a queue that drains at a fixed rate. Produces a perfectly smooth output with zero burst tolerance.',
    pros: ['Perfectly smooth output rate', 'Strict enforcement', 'Predictable downstream load'],
    cons: ['No burst tolerance at all', 'Higher perceived latency under load'],
  },
  fixed_window: {
    fn: fixedWindowCounter,
    name: 'Fixed Window',
    icon: '📊',
    description:
      'Divides time into fixed blocks and counts requests per block. Simplest and most memory-efficient approach using a single counter.',
    pros: ['Extremely memory-efficient', 'O(1) per request', 'Simple to reason about'],
    cons: ['Boundary-edge burst vulnerability', 'Can allow 2× limit at window boundaries'],
  },
  sliding_window: {
    fn: slidingWindowLog,
    name: 'Sliding Window',
    icon: '🌊',
    description:
      'Logs every request timestamp in a Redis Sorted Set. Provides 100% accurate rate limiting with no boundary-edge issues.',
    pros: ['100% accurate', 'No boundary-edge bursts', 'Precise enforcement'],
    cons: ['High memory usage (stores every timestamp)', 'O(N) cleanup per request'],
  },
  sliding_window_counter: {
    fn: slidingWindowCounter,
    name: 'SW Counter',
    icon: '🔄',
    description:
      'Hybrid of Fixed Window and Sliding Window. Uses a weighted average across two adjacent windows for near-perfect accuracy with minimal memory.',
    pros: ['Memory-efficient (two counters)', 'Near-perfect accuracy', 'Used by Cloudflare & Kong'],
    cons: ['Approximation (not exact)', 'Slightly more complex logic'],
  },
};

/**
 * Returns the algorithm function for the given key.
 * @param {string} key - Algorithm identifier (e.g., 'token_bucket')
 * @returns {Function} The rate limiting function
 * @throws {Error} If the key is not found in the registry
 */
function get(key) {
  const entry = registry[key];
  if (!entry) {
    const valid = Object.keys(registry).join(', ');
    throw new Error(`Unknown algorithm: "${key}". Valid options: ${valid}`);
  }
  return entry.fn;
}

/**
 * Returns metadata for all available algorithms.
 * Used by the /api/algorithms endpoint to populate the dashboard.
 * @returns {Array<{key, name, icon, description, pros, cons}>}
 */
function list() {
  return Object.entries(registry).map(([key, entry]) => ({
    key,
    name: entry.name,
    icon: entry.icon,
    description: entry.description,
    pros: entry.pros,
    cons: entry.cons,
  }));
}

module.exports = { get, list };
