/**
 * Password Hashing Module
 *
 * Uses bcryptjs for secure password hashing and comparison.
 * Pure JavaScript implementation — no native compilation required.
 */

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a plaintext password with a hash.
 * @param {string} password - Plaintext password
 * @param {string} hash     - Stored password hash
 * @returns {Promise<boolean>} True if match
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, comparePassword };
