/**
 * Singleton Redis Client for Next.js
 *
 * Lazy-initializes a Redis connection using the lib/ package.
 * Safe for serverless/edge: only connects when first accessed.
 *
 * Set REDIS_ENABLED=false in .env to skip Redis entirely and use
 * the in-memory store without any connection attempts or error logs.
 */

const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

// ─── No-op stub used when Redis is disabled ───────────────────────────────
const noopConnection = {
  connect: () => Promise.resolve(),
  getClient: () => { throw new Error('Redis is disabled (REDIS_ENABLED=false)'); },
  isConnected: () => false,
  disconnect: () => Promise.resolve(),
};

const noopClient = null;

// ─── Singletons ────────────────────────────────────────────────────────────
let redisConnection = null;
let redisClient = null;

function getRedisClient() {
  if (!REDIS_ENABLED) return noopClient;

  if (!redisClient) {
    const { createRedisConnection } = require('../lib');
    redisConnection = createRedisConnection({
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
    redisConnection.connect()
      .then(() => { console.log('✅ Redis: Connection established'); })
      .catch(err => { console.error('❌ Redis connection failed:', err.message); });
    redisClient = redisConnection.getClient();
  }
  return redisClient;
}

function getRedisConnection() {
  if (!REDIS_ENABLED) return noopConnection;
  if (!redisConnection) getRedisClient();
  return redisConnection;
}

module.exports = { getRedisClient, getRedisConnection };
