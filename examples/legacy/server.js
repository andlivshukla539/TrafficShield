// server.js
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
require('dotenv').config(); // .env file se variables load karne ke liye

const app = express();
const port = process.env.PORT || 5000;

// Redis connection setup
const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
});

// Middleware setup
app.use(cors()); // Frontend ko API access karne deta hai
app.use(express.json()); // JSON data ko parse karne ke liye (req.body)

// --- GLOBAL STATE (Dashboard ke liye) ---
// Default configuration set kar rahe hain
let config = {
    algorithm: 'token_bucket', // Options: 'token_bucket', 'sliding_window', 'fixed_window'
    rps: 5,                    // Requests Per Second (Limit)
    burstCapacity: 10,         // Token Bucket ke liye max capacity
    windowSize: 10             // Window algorithms ke liye time in seconds
};

// Live metrics track karne ke liye object
let metrics = {
    total: 0,
    allowed: 0,
    blocked: 0
};

// --- ALGORITHM FUNCTIONS ---

async function runTokenBucket(userId) {
    const key = `rate_limit:tb:${userId}`;
    const now = Date.now();
    const state = await redis.hgetall(key);

    // Agar state khali hai toh capacity full maano, warna Redis se value lo
    let tokens = Object.keys(state).length === 0 ? config.burstCapacity : parseFloat(state.tokens);
    let lastRefillTime = Object.keys(state).length === 0 ? now : parseInt(state.lastRefillTime);

    // Naye tokens calculate karo (rps = refillRate here)
    const timePassed = (now - lastRefillTime) / 1000;
    const tokensToAdd = timePassed * config.rps;
    
    tokens = Math.min(config.burstCapacity, tokens + tokensToAdd);
    lastRefillTime = now;

    let allowed = false;
    if (tokens >= 1) {
        tokens -= 1;
        allowed = true;
    }

    // Nayi state save aur expire karo
    await redis.hset(key, { tokens, lastRefillTime });
    await redis.expire(key, 60);

    return allowed;
}

async function runSlidingWindow(userId) {
    const key = `rate_limit:sw:${userId}`;
    const now = Date.now();
    const windowStart = now - (config.windowSize * 1000);

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart); // Purane timestamps hatao
    pipeline.zadd(key, now, `${now}-${Math.random()}`); // Naya request dalo
    pipeline.zcard(key); // Total count lo
    pipeline.expire(key, config.windowSize + 1);

    const results = await pipeline.exec();
    const requestCount = results[2][1];

    // Check karo kya limit cross hui
    return requestCount <= config.rps; 
}

async function runFixedWindow(userId) {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const currentWindow = Math.floor(nowInSeconds / config.windowSize);
    const key = `rate_limit:fw:${userId}:${currentWindow}`;

    const pipeline = redis.pipeline();
    pipeline.incr(key); // Counter badhao
    pipeline.expire(key, config.windowSize + 2);

    const results = await pipeline.exec();
    const currentCount = results[0][1];

    // Check karo kya limit cross hui
    return currentCount <= config.rps;
}

// --- API ROUTES ---

// 1. Core Route: API Hit simulate karne ke liye
app.post('/api/request', async (req, res) => {
    const userId = req.body.userId || 'global_user'; // Demo ke liye ek common user
    let allowed = false;

    // Jo algorithm config mein selected hai, wahi chalega
    try {
        if (config.algorithm === 'token_bucket') {
            allowed = await runTokenBucket(userId);
        } else if (config.algorithm === 'sliding_window') {
            allowed = await runSlidingWindow(userId);
        } else if (config.algorithm === 'fixed_window') {
            allowed = await runFixedWindow(userId);
        }

        // Metrics update karo
        metrics.total += 1;
        if (allowed) {
            metrics.allowed += 1;
            return res.status(200).json({ status: 'ALLOWED', message: 'Request Successful' });
        } else {
            metrics.blocked += 1;
            // 429 is the standard HTTP status code for Too Many Requests
            return res.status(429).json({ status: 'BLOCKED', message: 'Too Many Requests' });
        }
    } catch (error) {
        console.error("Redis Error:", error);
        return res.status(500).json({ status: 'ERROR', message: 'Internal Server Error' });
    }
});

// 2. Metrics Route: Frontend graph aur counters ke liye
app.get('/api/metrics', (req, res) => {
    res.json(metrics);
});

// 3. Get Config Route: Frontend ko current settings batane ke liye
app.get('/api/config', (req, res) => {
    res.json(config);
});

// 4. Update Config Route: Dashboard se sliders/buttons dabane par settings change karne ke liye
app.post('/api/config', (req, res) => {
    // req.body se nayi values lo, agar nahi aayi toh purani hi rakho
    config.algorithm = req.body.algorithm || config.algorithm;
    config.rps = req.body.rps || config.rps;
    config.burstCapacity = req.body.burstCapacity || config.burstCapacity;
    config.windowSize = req.body.windowSize || config.windowSize;
    
    // Config change hone par metrics reset kar dete hain dashboard clean dikhne ke liye
    metrics = { total: 0, allowed: 0, blocked: 0 }; 

    res.json({ message: 'Configuration Updated', config });
});

// Server start
app.listen(port, () => {
    console.log(`🚀 Premium Rate Limiter API running on http://localhost:${port}`);
    console.log(`Current Algorithm: ${config.algorithm}`);
});