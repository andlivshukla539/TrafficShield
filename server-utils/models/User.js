/**
 * User Model — Redis-Based Store with In-Memory Fallback
 *
 * Provides CRUD operations for user accounts.
 * Data is persisted to Redis when available, otherwise uses
 * an in-memory Map store for demo/development.
 *
 * Redis Keys:
 *   user:{id}          → Hash with all user fields
 *   user:email:{email} → String mapping email → user id
 *   users:all          → Set of all user IDs
 *
 * Schema:
 *   {
 *     id: string (UUID),
 *     email: string,
 *     name: string,
 *     passwordHash: string,
 *     createdAt: string (ISO 8601),
 *     isVerified: boolean,
 *     verificationToken: string|null,
 *   }
 */

const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('../redis');

// ─── In-Memory Fallback Store ──────────────────────────────────────────────
const memoryUsers = new Map();       // id → user object
const memoryEmailIndex = new Map();  // email → id

// ─── Redis Serialization ───────────────────────────────────────────────────

/**
 * Serialize a user object for Redis storage.
 * Converts booleans and nulls to strings.
 */
function serialize(user) {
  const result = {};
  for (const [key, value] of Object.entries(user)) {
    if (value === null || value === undefined) {
      result[key] = '__null__';
    } else if (typeof value === 'boolean') {
      result[key] = value ? '__true__' : '__false__';
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

/**
 * Deserialize a Redis hash back to a user object.
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
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── CRUD Operations ───────────────────────────────────────────────────────

/**
 * Create a new user.
 * @param {Object} data - { email, name, passwordHash }
 * @returns {Promise<Object>} The created user (without passwordHash)
 */
async function create(data) {
  const client = getRedisClient();

  const user = {
    id: uuidv4(),
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    createdAt: new Date().toISOString(),
    isVerified: false,
    verificationToken: null,
  };

  if (!client) {
    // In-memory fallback
    if (memoryEmailIndex.has(data.email)) {
      throw new Error('A user with this email already exists');
    }
    memoryUsers.set(user.id, { ...user });
    memoryEmailIndex.set(user.email, user.id);
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Redis path
  const existingId = await client.get(`user:email:${data.email}`);
  if (existingId) {
    throw new Error('A user with this email already exists');
  }

  const pipeline = client.pipeline();
  pipeline.hset(`user:${user.id}`, serialize(user));
  pipeline.set(`user:email:${user.email}`, user.id);
  pipeline.sadd('users:all', user.id);
  await pipeline.exec();

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Find a user by email.
 * @param {string} email
 * @returns {Promise<Object|null>} Full user object (includes passwordHash for auth)
 */
async function findByEmail(email) {
  const client = getRedisClient();

  if (!client) {
    const userId = memoryEmailIndex.get(email);
    if (!userId) return null;
    const user = memoryUsers.get(userId);
    return user ? { ...user } : null;
  }

  const userId = await client.get(`user:email:${email}`);
  if (!userId) return null;

  const hash = await client.hgetall(`user:${userId}`);
  return deserialize(hash);
}

/**
 * Find a user by ID.
 * @param {string} id
 * @returns {Promise<Object|null>} User without passwordHash
 */
async function findById(id) {
  const client = getRedisClient();

  if (!client) {
    const user = memoryUsers.get(id);
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return { ...safeUser };
  }

  const hash = await client.hgetall(`user:${id}`);
  const user = deserialize(hash);
  if (!user) return null;

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Read all users from the store.
 * @returns {Promise<Array<Object>>}
 */
async function readAll() {
  const client = getRedisClient();

  if (!client) {
    return Array.from(memoryUsers.values()).map(u => ({ ...u }));
  }

  const userIds = await client.smembers('users:all');
  if (!userIds.length) return [];

  const pipeline = client.pipeline();
  for (const id of userIds) {
    pipeline.hgetall(`user:${id}`);
  }
  const results = await pipeline.exec();

  return results
    .map(([err, hash]) => (err ? null : deserialize(hash)))
    .filter(Boolean);
}

/**
 * Update a user by ID.
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function updateUser(id, updates) {
  const client = getRedisClient();

  if (!client) {
    const user = memoryUsers.get(id);
    if (!user) return null;
    const updated = { ...user, ...updates };
    memoryUsers.set(id, updated);
    const { passwordHash, ...safeUser } = updated;
    return { ...safeUser };
  }

  const hash = await client.hgetall(`user:${id}`);
  const user = deserialize(hash);
  if (!user) return null;

  const updated = { ...user, ...updates };
  await client.hset(`user:${id}`, serialize(updated));

  const { passwordHash, ...safeUser } = updated;
  return safeUser;
}

module.exports = { create, findByEmail, findById, readAll, updateUser };
