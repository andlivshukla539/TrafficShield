/**
 * Redis Connection Manager (Dependency-Injectable)
 *
 * Supports two modes:
 *   1. External client: Consumer passes in their own ioredis instance
 *   2. Managed client: Creates and manages a client from connection options
 *
 * Usage:
 *   // Mode 1: Bring your own Redis
 *   const { createClient } = require('@andliv/rate-limiter');
 *   const client = createClient({ client: myExistingRedisInstance });
 *
 *   // Mode 2: Let us manage it
 *   const client = createClient({ host: '127.0.0.1', port: 6379 });
 */

const Redis = require('ioredis');

/**
 * Creates a Redis connection wrapper.
 *
 * @param {Object} options
 * @param {Redis}  [options.client]   - Pre-existing ioredis client instance
 * @param {string} [options.host]     - Redis host (default: 127.0.0.1)
 * @param {number} [options.port]     - Redis port (default: 6379)
 * @param {string} [options.password] - Redis password
 * @param {string} [options.url]      - Redis connection URL (overrides host/port)
 * @param {number} [options.db]       - Redis database number (default: 0)
 * @returns {Object} Connection wrapper with getClient, isConnected, disconnect
 */
function createRedisConnection(options = {}) {
  let client = null;
  let connected = false;
  let isExternalClient = false;

  /**
   * Initialize and connect the Redis client.
   * @returns {Promise<Redis>}
   */
  function connect() {
    return new Promise((resolve, reject) => {
      // Mode 1: External client provided
      if (options.client) {
        client = options.client;
        isExternalClient = true;
        connected = client.status === 'ready';

        if (connected) {
          return resolve(client);
        }

        // Wait for ready if not yet connected
        client.once('ready', () => {
          connected = true;
          resolve(client);
        });

        client.once('error', (err) => {
          if (!connected) reject(err);
        });

        return;
      }

      // Mode 2: Create managed client
      const connectionOptions = {
        host: options.host || process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(options.port || process.env.REDIS_PORT || '6379', 10),
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        enableReadyCheck: true,
        retryStrategy(times) {
          if (times > 15) {
            console.error('❌ Redis: Maximum reconnection attempts exceeded');
            return null;
          }
          const delay = Math.min(times * 200, 5000);
          return delay;
        },
      };

      if (options.password) {
        connectionOptions.password = options.password;
      }

      if (options.db !== undefined) {
        connectionOptions.db = options.db;
      }

      const redisUrl = options.url || process.env.REDIS_URL;
      
      if (redisUrl) {
        client = new Redis(redisUrl);
      } else {
        client = new Redis(connectionOptions);
      }

      client.on('connect', () => {
        connected = true;
      });

      client.on('ready', () => {
        connected = true;
        resolve(client);
      });

      client.on('error', (err) => {
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
   * @throws {Error} If connect() hasn't been called yet
   * @returns {Redis}
   */
  function getClient() {
    if (!client) {
      throw new Error('Redis client not initialized. Call connect() first.');
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
   * Will not close external clients (caller is responsible).
   */
  async function disconnect() {
    if (client && !isExternalClient) {
      await client.quit();
      client = null;
      connected = false;
    }
  }

  return { connect, getClient, isConnected, disconnect };
}

module.exports = { createRedisConnection };
