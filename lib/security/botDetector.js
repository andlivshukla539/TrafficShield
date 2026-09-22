/**
 * Bot Detection Middleware
 *
 * Identifies and blocks automated bot traffic using heuristic analysis.
 * Checks User-Agent headers against known bad patterns and common bot signatures.
 *
 * Features:
 *   - Block requests with missing User-Agent
 *   - Block known malicious bot signatures
 *   - Block known scanner/exploit tools
 *   - Customizable blocked agent patterns
 *   - Challenge mode (returns 403 with challenge token instead of hard block)
 *
 * Usage:
 *   const { createBotDetector } = require('@andliv/rate-limiter');
 *
 *   app.use(createBotDetector({
 *     blockMissingUA: true,
 *     blockedAgents: ['custom-bad-bot'],
 *   }));
 */

// Well-known malicious bot signatures and scanning tools
const DEFAULT_BLOCKED_PATTERNS = [
  // Scanners & exploit tools
  'sqlmap',
  'nikto',
  'nessus',
  'nmap',
  'masscan',
  'zgrab',
  'dirbuster',
  'gobuster',
  'wpscan',
  'acunetix',
  'burpsuite',
  'hydra',
  'metasploit',

  // Known bad bots
  'ahrefsbot',
  'semrushbot',
  'dotbot',
  'mj12bot',
  'blexbot',
  'petalbot',
  'dataforseobot',

  // Generic scrapers
  'scrapy',
  'python-requests',
  'go-http-client',
  'java/',
  'wget/',
  'curl/',
  'httpie/',
  'libwww-perl',
  'lwp-trivial',
  'php/',
];

// Legitimate bots that should NOT be blocked
const ALLOWED_BOT_PATTERNS = [
  'googlebot',
  'bingbot',
  'yandexbot',
  'duckduckbot',
  'slurp',        // Yahoo
  'baiduspider',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'applebot',
];

/**
 * Creates a bot detection Express middleware.
 *
 * @param {Object} options
 * @param {boolean}  [options.blockMissingUA=true]   - Block requests with no User-Agent header
 * @param {string[]} [options.blockedAgents=[]]      - Additional User-Agent patterns to block
 * @param {string[]} [options.allowedAgents=[]]       - Additional User-Agent patterns to allow
 * @param {boolean}  [options.allowLegitBots=true]   - Allow known search engine bots
 * @param {boolean}  [options.logBlocked=false]      - Log blocked requests to console
 * @returns {Function} Express middleware
 */
function createBotDetector(options = {}) {
  const {
    blockMissingUA = true,
    blockedAgents = [],
    allowedAgents = [],
    allowLegitBots = true,
    logBlocked = false,
  } = options;

  // Build combined pattern lists (lowercased for case-insensitive matching)
  const blockedPatterns = [
    ...DEFAULT_BLOCKED_PATTERNS,
    ...blockedAgents.map(a => a.toLowerCase()),
  ];

  const allowedPatterns = [
    ...(allowLegitBots ? ALLOWED_BOT_PATTERNS : []),
    ...allowedAgents.map(a => a.toLowerCase()),
  ];

  return (req, res, next) => {
    const userAgent = req.headers['user-agent'];

    // Check 1: Missing User-Agent
    if (!userAgent || userAgent.trim() === '') {
      if (blockMissingUA) {
        if (logBlocked) {
          console.log(`[Bot Detector] Blocked request with missing User-Agent from ${req.ip}`);
        }
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Request blocked: Missing User-Agent header.',
          reason: 'missing_user_agent',
        });
      }
      return next();
    }

    const uaLower = userAgent.toLowerCase();

    // Check 2: Allow legitimate bots first (higher priority)
    for (const pattern of allowedPatterns) {
      if (uaLower.includes(pattern)) {
        req.botInfo = { isBot: true, type: 'legitimate', agent: pattern };
        return next();
      }
    }

    // Check 3: Block malicious/unwanted bots
    for (const pattern of blockedPatterns) {
      if (uaLower.includes(pattern)) {
        if (logBlocked) {
          console.log(`[Bot Detector] Blocked bot "${pattern}" from ${req.ip}: ${userAgent}`);
        }
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Request blocked: Automated access detected.',
          reason: 'blocked_bot',
          pattern,
        });
      }
    }

    // Check 4: Heuristic — very short User-Agent strings are suspicious
    if (uaLower.length < 10) {
      if (logBlocked) {
        console.log(`[Bot Detector] Blocked suspicious short UA from ${req.ip}: "${userAgent}"`);
      }
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Request blocked: Suspicious User-Agent.',
        reason: 'suspicious_user_agent',
      });
    }

    // Passed all checks
    req.botInfo = { isBot: false, type: 'human', agent: userAgent };
    next();
  };
}

module.exports = { createBotDetector };
