/**
 * Premium Rate Limiter — API Server (V2)
 *
 * Production-grade Express server showcasing:
 *   - Modular Rate Limiter Middleware
 *   - Route-Based & IP-Based Limiting
 *   - Real-time Analytics & Historical Tracking
 *   - Standard rate limit response headers
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const redis = require('./redis');
const algorithms = require('./algorithms');
const analytics = require('./analytics');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Serve the dashboard frontend from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Application State ──────────────────────────────────────────────────────

// Global config override that the middleware will read dynamically.
global.RATE_LIMIT_CONFIG = {
  algorithm: 'token_bucket',
  rps: 5,
  windowSize: 10,
};

// Start the analytics engine background worker
analytics.start();

// ─── Protected Routes (Using Middleware) ────────────────────────────────────

// Route 1: General Data API (Uses the global config from the dashboard)
app.post('/api/data', rateLimiter(), (req, res) => {
  res.status(200).json({
    status: 'ALLOWED',
    message: 'Data accessed successfully',
    remaining: req.rateLimit.remaining,
    limit: req.rateLimit.limit
  });
});

// Route 2: Strict Login API (Hardcoded strict limits, IP-based)
app.post('/api/login', rateLimiter({
  algorithm: 'fixed_window',
  rps: 2, // Only 2 requests per second allowed
  windowSize: 1,
  keyGenerator: (req) => `login_limit:${req.headers['x-simulated-ip'] || req.ip}`
}), (req, res) => {
  res.status(200).json({
    status: 'ALLOWED',
    message: 'Login attempt processed',
    remaining: req.rateLimit.remaining,
    limit: req.rateLimit.limit
  });
});

// Backward compatibility for V1 dashboard simulation
app.post('/api/request', rateLimiter(), (req, res) => {
  res.status(200).json({
    status: 'ALLOWED',
    remaining: req.rateLimit.remaining,
    limit: req.rateLimit.limit
  });
});

// ─── Admin API Routes ───────────────────────────────────────────────────────

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    redis: redis.isConnected(),
    uptime: Math.floor(process.uptime()),
    algorithm: global.RATE_LIMIT_CONFIG.algorithm,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/algorithms
 */
app.get('/api/algorithms', (req, res) => {
  res.json(algorithms.list());
});

/**
 * GET /api/metrics
 * Returns current request counters for the live dashboard chart.
 */
app.get('/api/metrics', async (req, res) => {
  // Read from the current minute hash in Redis
  try {
    const client = redis.getClient();
    const now = new Date();
    const minStr = now.toISOString().substring(0, 16);
    const minKey = `rl:metrics:min:${minStr}`;
    
    const data = await client.hgetall(minKey);
    res.json({
      total: parseInt(data.allowed || '0', 10) + parseInt(data.blocked || '0', 10),
      allowed: parseInt(data.allowed || '0', 10),
      blocked: parseInt(data.blocked || '0', 10)
    });
  } catch (err) {
    res.json({ total: 0, allowed: 0, blocked: 0 });
  }
});

/**
 * GET /api/metrics/history

 * Returns the last 24 hours of aggregated metrics.
 */
app.get('/api/metrics/history', async (req, res) => {
  const history = await analytics.getHistory();
  res.json(history);
});

/**
 * GET /api/config
 */
app.get('/api/config', (req, res) => {
  res.json(global.RATE_LIMIT_CONFIG);
});

/**
 * POST /api/config
 */
app.post('/api/config', (req, res) => {
  const body = req.body;

  if (body.algorithm) {
    try {
      algorithms.get(body.algorithm);
      global.RATE_LIMIT_CONFIG.algorithm = body.algorithm;
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (body.rps !== undefined) {
    global.RATE_LIMIT_CONFIG.rps = Math.max(1, Math.min(50, parseInt(body.rps, 10)));
  }

  if (body.windowSize !== undefined) {
    global.RATE_LIMIT_CONFIG.windowSize = Math.max(1, Math.min(60, parseInt(body.windowSize, 10)));
  }

  res.json({ message: 'Configuration updated', config: global.RATE_LIMIT_CONFIG });
});

/**
 * SPA fallback — serve dashboard
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Server Lifecycle ───────────────────────────────────────────────────────

async function start() {
  try {
    await redis.createClient();

    app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('  ╔═══════════════════════════════════════════════╗');
      console.log('  ║     🚀 Premium Rate Limiter API (V2)          ║');
      console.log('  ╠═══════════════════════════════════════════════╣');
      console.log(`  ║   Dashboard:  http://localhost:${PORT}             ║`);
      console.log(`  ║   Health:     http://localhost:${PORT}/api/health   ║`);
      console.log('  ╚═══════════════════════════════════════════════╝');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  await redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
