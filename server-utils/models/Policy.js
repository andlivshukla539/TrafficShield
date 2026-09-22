/**
 * Policy Model — Redis-Based Store
 *
 * Stores rate limit policy definitions linked to API keys.
 * Each policy defines the algorithm, limits, and security rules for an API key.
 *
 * Redis Keys:
 *   policy:{id}              → Hash with all policy fields
 *   policies:user:{uid}      → Set of policy IDs belonging to a user
 *   policy:apikey:{apiKeyId} → String mapping apiKeyId → policy id
 *
 * Schema:
 *   {
 *     id: string (UUID),
 *     userId: string,
 *     apiKeyId: string,
 *     name: string,
 *     algorithm: string,
 *     rps: number,
 *     windowSize: number,
 *     ipRules: { whitelist: string[], blacklist: string[] },
 *     geoRules: { allowedCountries: string[], blockedCountries: string[] },
 *     botDetection: boolean,
 *     ddosProtection: { enabled: boolean, maxViolations: number, banDuration: number },
 *     createdAt: string (ISO 8601),
 *     updatedAt: string (ISO 8601),
 *   }
 */

const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('../redis');

/**
 * Serialize a policy object for Redis storage.
 * Converts complex types to JSON strings.
 */
function serialize(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = '__null__';
    } else if (typeof value === 'boolean') {
      result[key] = value ? '__true__' : '__false__';
    } else if (typeof value === 'object') {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

/** Fields that are stored as JSON objects in Redis */
const JSON_FIELDS = ['ipRules', 'geoRules', 'ddosProtection'];
const NUMERIC_FIELDS = ['rps', 'windowSize'];

/**
 * Deserialize a Redis hash back to a policy object.
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
    } else if (JSON_FIELDS.includes(key)) {
      try { result[key] = JSON.parse(value); } catch { result[key] = value; }
    } else if (NUMERIC_FIELDS.includes(key)) {
      result[key] = Number(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Create a new rate limit policy.
 * @param {Object} data
 * @returns {Promise<Object>} The created policy
 */
async function create(data) {
  const client = getRedisClient();
  if (!client) throw new Error('Redis is not available');

  const policy = {
    id: uuidv4(),
    userId: data.userId,
    apiKeyId: data.apiKeyId || null,
    name: data.name || 'Default Policy',
    algorithm: data.algorithm || 'token_bucket',
    rps: data.rps || 10,
    windowSize: data.windowSize || 10,
    ipRules: {
      whitelist: data.ipRules?.whitelist || [],
      blacklist: data.ipRules?.blacklist || [],
    },
    geoRules: {
      allowedCountries: data.geoRules?.allowedCountries || [],
      blockedCountries: data.geoRules?.blockedCountries || [],
    },
    botDetection: data.botDetection !== undefined ? data.botDetection : true,
    ddosProtection: {
      enabled: data.ddosProtection?.enabled !== undefined ? data.ddosProtection.enabled : true,
      maxViolations: data.ddosProtection?.maxViolations || 10,
      banDuration: data.ddosProtection?.banDuration || 86400,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const pipeline = client.pipeline();
  pipeline.hset(`policy:${policy.id}`, serialize(policy));
  pipeline.sadd(`policies:user:${policy.userId}`, policy.id);
  if (policy.apiKeyId) {
    pipeline.set(`policy:apikey:${policy.apiKeyId}`, policy.id);
  }
  await pipeline.exec();

  return policy;
}

/**
 * Find all policies belonging to a user.
 * @param {string} userId
 * @returns {Promise<Array<Object>>}
 */
async function findByUserId(userId) {
  const client = getRedisClient();
  if (!client) return [];

  const ids = await client.smembers(`policies:user:${userId}`);
  if (!ids.length) return [];

  const pipeline = client.pipeline();
  for (const id of ids) {
    pipeline.hgetall(`policy:${id}`);
  }
  const results = await pipeline.exec();

  return results
    .map(([err, hash]) => (err ? null : deserialize(hash)))
    .filter(Boolean);
}

/**
 * Find a policy by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const client = getRedisClient();
  if (!client) return null;

  const hash = await client.hgetall(`policy:${id}`);
  return deserialize(hash);
}

/**
 * Find a policy by API key ID.
 * @param {string} apiKeyId
 * @returns {Promise<Object|null>}
 */
async function findByApiKeyId(apiKeyId) {
  const client = getRedisClient();
  if (!client) return null;

  const policyId = await client.get(`policy:apikey:${apiKeyId}`);
  if (!policyId) return null;

  const hash = await client.hgetall(`policy:${policyId}`);
  return deserialize(hash);
}

/**
 * Update an existing policy.
 * @param {string} id
 * @param {string} userId - Owner verification
 * @param {Object} updates
 * @returns {Promise<Object|null>} Updated policy or null if not found
 */
async function update(id, userId, updates) {
  const client = getRedisClient();
  if (!client) return null;

  const hash = await client.hgetall(`policy:${id}`);
  const policy = deserialize(hash);
  if (!policy || policy.userId !== userId) return null;

  // Merge updates (shallow)
  const allowed = ['name', 'algorithm', 'rps', 'windowSize', 'apiKeyId',
    'ipRules', 'geoRules', 'botDetection', 'ddosProtection'];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      policy[key] = updates[key];
    }
  }

  policy.updatedAt = new Date().toISOString();

  const pipeline = client.pipeline();
  pipeline.hset(`policy:${id}`, serialize(policy));
  // Update apikey index if changed
  if (updates.apiKeyId !== undefined) {
    pipeline.set(`policy:apikey:${updates.apiKeyId}`, id);
  }
  await pipeline.exec();

  return policy;
}

/**
 * Delete a policy.
 * @param {string} id
 * @param {string} userId - Owner verification
 * @returns {Promise<boolean>}
 */
async function remove(id, userId) {
  const client = getRedisClient();
  if (!client) return false;

  const hash = await client.hgetall(`policy:${id}`);
  const policy = deserialize(hash);
  if (!policy || policy.userId !== userId) return false;

  const pipeline = client.pipeline();
  pipeline.del(`policy:${id}`);
  pipeline.srem(`policies:user:${userId}`, id);
  if (policy.apiKeyId) {
    pipeline.del(`policy:apikey:${policy.apiKeyId}`);
  }
  await pipeline.exec();

  return true;
}

module.exports = { create, findByUserId, findById, findByApiKeyId, update, remove };
