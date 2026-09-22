/**
 * API Key Model — Redis-Based Store with In-Memory Fallback
 *
 * Generates, stores, and manages API keys for the SaaS dashboard.
 * Keys are cryptographically secure 32-byte hex strings prefixed with "rl_".
 *
 * Falls back to an in-memory Map when Redis is not available.
 *
 * Redis Keys:
 *   apikey:{id}          → Hash with all API key fields
 *   apikey:key:{key}     → String mapping key string → apikey id
 *   apikeys:user:{uid}   → Set of apikey IDs belonging to a user
 *
 * Schema:
 *   {
 *     id: string (UUID),
 *     userId: string,
 *     key: string (e.g., "rl_a1b2c3d4e5f6..."),
 *     name: string,
 *     permissions: string (JSON array),
 *     createdAt: string (ISO 8601),
 *     lastUsedAt: string|null,
 *     isActive: boolean,
 *   }
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('../redis');

// ─── In-Memory Fallback Store ──────────────────────────────────────────────
const memoryKeys = new Map();        // id → apikey object
const memoryKeyIndex = new Map();    // key string → id
const memoryUserIndex = new Map();   // userId → Set of ids

// ─── Redis Serialization ───────────────────────────────────────────────────

/**
 * Serialize an API key object for Redis storage.
 */
function serialize(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = '__null__';
    } else if (typeof value === 'boolean') {
      result[key] = value ? '__true__' : '__false__';
    } else if (Array.isArray(value)) {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

/**
 * Deserialize a Redis hash back to an API key object.
 */
function deserialize(hash) {
  if (!hash || Object.keys(hash).length === 0) return null;
  const result = {};
  for (const [key, value] of Object.entries(hash)) {
    if (value === '__null__') {
      result[key] = null;
    } else if (value === '__true__') {
      result[key] = true;
    } else if (value === '__false__') {
      result[key] = false;
    } else if (key === 'permissions') {
      try { result[key] = JSON.parse(value); } catch { result[key] = [value]; }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Generate a cryptographically secure API key.
 * @returns {string} Key in format "rl_<64 hex chars>"
 */
function generateKey() {
  return 'rl_' + crypto.randomBytes(32).toString('hex');
}

// ─── CRUD Operations ───────────────────────────────────────────────────────

/**
 * Create a new API key for a user.
 * @param {Object} data - { userId, name, permissions }
 * @returns {Promise<Object>} The created API key record
 */
async function create(data) {
  const client = getRedisClient();

  const apiKey = {
    id: uuidv4(),
    userId: data.userId,
    key: generateKey(),
    name: data.name || 'Default Key',
    permissions: data.permissions || ['read', 'write'],
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    isActive: true,
  };

  if (!client) {
    // In-memory fallback
    memoryKeys.set(apiKey.id, { ...apiKey });
    memoryKeyIndex.set(apiKey.key, apiKey.id);
    if (!memoryUserIndex.has(apiKey.userId)) {
      memoryUserIndex.set(apiKey.userId, new Set());
    }
    memoryUserIndex.get(apiKey.userId).add(apiKey.id);
    return { ...apiKey };
  }

  // Redis path
  const pipeline = client.pipeline();
  pipeline.hset(`apikey:${apiKey.id}`, serialize(apiKey));
  pipeline.set(`apikey:key:${apiKey.key}`, apiKey.id);
  pipeline.sadd(`apikeys:user:${apiKey.userId}`, apiKey.id);
  await pipeline.exec();

  return apiKey;
}

/**
 * Find all API keys belonging to a user.
 * @param {string} userId
 * @returns {Promise<Array<Object>>}
 */
async function findByUserId(userId) {
  const client = getRedisClient();

  if (!client) {
    const ids = memoryUserIndex.get(userId);
    if (!ids || ids.size === 0) return [];
    return Array.from(ids)
      .map(id => memoryKeys.get(id))
      .filter(Boolean)
      .map(k => ({ ...k }));
  }

  const ids = await client.smembers(`apikeys:user:${userId}`);
  if (!ids.length) return [];

  const pipeline = client.pipeline();
  for (const id of ids) {
    pipeline.hgetall(`apikey:${id}`);
  }
  const results = await pipeline.exec();

  return results
    .map(([err, hash]) => (err ? null : deserialize(hash)))
    .filter(Boolean);
}

/**
 * Find an API key by its key string.
 * @param {string} key
 * @returns {Promise<Object|null>}
 */
async function findByKey(key) {
  const client = getRedisClient();

  if (!client) {
    const id = memoryKeyIndex.get(key);
    if (!id) return null;
    const apiKey = memoryKeys.get(id);
    if (!apiKey || !apiKey.isActive) return null;
    return { ...apiKey };
  }

  const id = await client.get(`apikey:key:${key}`);
  if (!id) return null;

  const hash = await client.hgetall(`apikey:${id}`);
  const apiKey = deserialize(hash);
  if (!apiKey || !apiKey.isActive) return null;
  return apiKey;
}

/**
 * Find an API key by its ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const client = getRedisClient();

  if (!client) {
    const apiKey = memoryKeys.get(id);
    return apiKey ? { ...apiKey } : null;
  }

  const hash = await client.hgetall(`apikey:${id}`);
  return deserialize(hash);
}

/**
 * Revoke (deactivate) an API key.
 * @param {string} id
 * @param {string} userId - Owner verification
 * @returns {Promise<boolean>} True if revoked
 */
async function revoke(id, userId) {
  const client = getRedisClient();

  if (!client) {
    const apiKey = memoryKeys.get(id);
    if (!apiKey || apiKey.userId !== userId) return false;
    apiKey.isActive = false;
    return true;
  }

  const hash = await client.hgetall(`apikey:${id}`);
  const apiKey = deserialize(hash);
  if (!apiKey || apiKey.userId !== userId) return false;

  await client.hset(`apikey:${id}`, 'isActive', '__false__');
  return true;
}

/**
 * Rotate an API key: generate a new key for the same record.
 * @param {string} id
 * @param {string} userId - Owner verification
 * @returns {Promise<Object|null>} Updated key record, or null if not found
 */
async function rotate(id, userId) {
  const client = getRedisClient();

  if (!client) {
    const apiKey = memoryKeys.get(id);
    if (!apiKey || apiKey.userId !== userId || !apiKey.isActive) return null;
    const oldKey = apiKey.key;
    const newKey = generateKey();
    memoryKeyIndex.delete(oldKey);
    apiKey.key = newKey;
    apiKey.lastUsedAt = null;
    memoryKeyIndex.set(newKey, id);
    return { ...apiKey };
  }

  const hash = await client.hgetall(`apikey:${id}`);
  const apiKey = deserialize(hash);
  if (!apiKey || apiKey.userId !== userId || !apiKey.isActive) return null;

  const oldKey = apiKey.key;
  const newKey = generateKey();

  const pipeline = client.pipeline();
  pipeline.del(`apikey:key:${oldKey}`);
  pipeline.hset(`apikey:${id}`, 'key', newKey);
  pipeline.hset(`apikey:${id}`, 'lastUsedAt', '__null__');
  pipeline.set(`apikey:key:${newKey}`, id);
  await pipeline.exec();

  apiKey.key = newKey;
  apiKey.lastUsedAt = null;
  return apiKey;
}

/**
 * Update lastUsedAt timestamp for an API key.
 * @param {string} key
 * @returns {Promise<void>}
 */
async function touch(key) {
  const client = getRedisClient();

  if (!client) {
    const id = memoryKeyIndex.get(key);
    if (id) {
      const apiKey = memoryKeys.get(id);
      if (apiKey) apiKey.lastUsedAt = new Date().toISOString();
    }
    return;
  }

  const id = await client.get(`apikey:key:${key}`);
  if (id) {
    await client.hset(`apikey:${id}`, 'lastUsedAt', new Date().toISOString());
  }
}

module.exports = { create, findByUserId, findByKey, findById, revoke, rotate, touch };
