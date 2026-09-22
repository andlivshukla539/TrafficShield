/**
 * Security Singletons for Next.js API Routes
 *
 * Lazily initializes WAF modules from lib/ using the Redis singleton.
 */

const { createIpFilter, createBotDetector, createDdosProtection } = require('../lib');
const { getRedisClient } = require('./redis');

let ipFilter = null;
let ddos = null;
let botDetector = null;

function getIpFilter() {
  if (!ipFilter) {
    ipFilter = createIpFilter({
      redisClient: getRedisClient(),
      mode: 'blacklist',
      staticWhitelist: ['127.0.0.1', '::1'],
    });
  }
  return ipFilter;
}

function getDdosProtection() {
  if (!ddos) {
    ddos = createDdosProtection({
      redisClient: getRedisClient(),
      maxViolations: 10,
      trackingWindowSecs: 60,
      banDurationSecs: 86400,
    });
  }
  return ddos;
}

function getBotDetector() {
  if (!botDetector) {
    botDetector = createBotDetector({
      blockMissingUA: false,
      allowLegitBots: true,
    });
  }
  return botDetector;
}

module.exports = { getIpFilter, getDdosProtection, getBotDetector };
