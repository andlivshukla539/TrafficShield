/**
 * API Gateway — Configuration Loader
 *
 * Loads and validates gateway configuration from YAML or JSON files.
 * Supports hot-reload via fs.watch for live configuration updates.
 *
 * Usage:
 *   const { loadConfig, watchConfig } = require('./configLoader');
 *   const config = loadConfig('./gateway/gateway.config.yml');
 *
 *   // Optional: watch for changes
 *   watchConfig('./gateway/gateway.config.yml', (newConfig) => {
 *     console.log('Config updated:', newConfig);
 *   });
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Loads gateway configuration from a YAML or JSON file.
 *
 * @param {string} filePath - Path to the configuration file
 * @returns {Object} Parsed configuration object
 * @throws {Error} If the file is missing, unreadable, or invalid
 */
function loadConfig(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Gateway config file not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, 'utf8');
  const ext = path.extname(absolutePath).toLowerCase();

  let config;

  if (ext === '.yml' || ext === '.yaml') {
    config = yaml.load(raw);
  } else if (ext === '.json') {
    config = JSON.parse(raw);
  } else {
    throw new Error(`Unsupported config file format: ${ext}. Use .yml, .yaml, or .json`);
  }

  validateConfig(config);
  return config;
}

/**
 * Validates the gateway configuration schema.
 *
 * @param {Object} config - Parsed configuration
 * @throws {Error} If validation fails
 */
function validateConfig(config) {
  if (!config) {
    throw new Error('Gateway config is empty');
  }

  if (!config.routes || !Array.isArray(config.routes)) {
    throw new Error('Gateway config must have a "routes" array');
  }

  for (let i = 0; i < config.routes.length; i++) {
    const route = config.routes[i];

    if (!route.path) {
      throw new Error(`Route at index ${i} is missing "path"`);
    }

    if (!route.target) {
      throw new Error(`Route "${route.path}" is missing "target"`);
    }

    // Validate URL format
    try {
      new URL(route.target);
    } catch {
      throw new Error(`Route "${route.path}" has invalid target URL: "${route.target}"`);
    }

    // Validate rate limit config if present
    if (route.rateLimit) {
      if (route.rateLimit.rps && (typeof route.rateLimit.rps !== 'number' || route.rateLimit.rps <= 0)) {
        throw new Error(`Route "${route.path}" has invalid rps: ${route.rateLimit.rps}`);
      }

      const validAlgorithms = [
        'token_bucket', 'leaky_bucket', 'fixed_window',
        'sliding_window', 'sliding_window_counter',
      ];

      if (route.rateLimit.algorithm && !validAlgorithms.includes(route.rateLimit.algorithm)) {
        throw new Error(
          `Route "${route.path}" has invalid algorithm: "${route.rateLimit.algorithm}". ` +
          `Valid: ${validAlgorithms.join(', ')}`
        );
      }
    }
  }
}

/**
 * Watches a config file for changes and calls the callback with the new config.
 *
 * @param {string}   filePath - Path to the configuration file
 * @param {Function} callback - Called with (newConfig) on file changes
 * @returns {fs.FSWatcher} The file watcher (call .close() to stop)
 */
function watchConfig(filePath, callback) {
  const absolutePath = path.resolve(filePath);
  let debounceTimer = null;

  const watcher = fs.watch(absolutePath, (eventType) => {
    if (eventType !== 'change') return;

    // Debounce rapid file changes (editors often write multiple times)
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const newConfig = loadConfig(absolutePath);
        console.log('[Gateway] Configuration reloaded successfully');
        callback(newConfig);
      } catch (err) {
        console.error('[Gateway] Failed to reload config:', err.message);
      }
    }, 500);
  });

  console.log(`[Gateway] Watching config file: ${absolutePath}`);
  return watcher;
}

/**
 * Returns a default configuration object.
 * @returns {Object}
 */
function getDefaultConfig() {
  return {
    server: {
      port: 8080,
    },
    redis: {
      host: '127.0.0.1',
      port: 6379,
    },
    security: {
      ipBlacklist: [],
      ipWhitelist: [],
      blockedCountries: [],
      botDetection: true,
      ddosProtection: {
        enabled: true,
        maxViolations: 10,
        banDuration: 86400,
      },
    },
    routes: [],
  };
}

module.exports = { loadConfig, validateConfig, watchConfig, getDefaultConfig };
