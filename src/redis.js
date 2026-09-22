/**
 * Redis Connection Manager
 *
 * Centralizes Redis client lifecycle with:
 * - Configurable retry strategy with exponential backoff
 * - Connection status tracking via event listeners
 * - Graceful shutdown support for SIGTERM/SIGINT
 *
 * Usage:
 *   const redis = require('./redis');
 *   await redis.createClient();
 *   const client = redis.getClient();
 */

const Redis = require('ioredis');

let client = null;
let connected = false;

/**
 * Creates and connects the Redis client.
 * Resolves when the client is ready to accept commands.
 * @returns {Promise<Redis>} The connected Redis client
 */
function createClient() {
  return new Promise((resolve, reject) => {
    client = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      enableReadyCheck: true,
      retryStrategy(times) {
        if (times > 15) {
          console.error('❌ Redis: Maximum reconnection attempts exceeded');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 200, 5000);
        console.log(`🔄 Redis: Reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
    });

    client.on('connect', () => {
      connected = true;
      console.log('✅ Redis: Connection established');
    });

    client.on('ready', () => {
      connected = true;
      resolve(client);
    });

    client.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
      // Only reject on initial connection failure
      if (!connected) reject(err);
    });

    client.on('close', () => {
      connected = false;
    });

    client.on('reconnecting', () => {
      connected = false;
    });
  });
}

/**
 * Returns the initialized Redis client instance.
 * @throws {Error} If createClient() hasn't been called yet
 */
function getClient() {
  if (!client) {
    throw new Error('Redis client not initialized. Call createClient() first.');
  }
  return client;
}

/**
 * Returns whether Redis is currently connected and ready.
 * @returns {boolean}
 */
function isConnected() {
  return connected;
}

/**
 * Gracefully closes the Redis connection.
 */
async function disconnect() {
  if (client) {
    await client.quit();
    client = null;
    connected = false;
    console.log('✅ Redis: Disconnected gracefully');
  }
}

module.exports = { createClient, getClient, isConnected, disconnect };
