// algorithms/redisTokenBucket.js
const Redis = require("ioredis");
// Redis container se connect kar rahe hain
const redis = new Redis({ host: "127.0.0.1", port: 6379 }); 

async function redisTokenBucket(userId, capacity, refillRate) {
    const key = `rate_limit:token_bucket:${userId}`;
    const now = Date.now();

    // Redis se current state laao. Multiple commands ek saath bhejne ke liye pipeline use karte hain
    const state = await redis.hgetall(key);

    let tokens;
    let lastRefillTime;

    // Agar user pehli baar aaya hai (Redis mein data nahi hai)
    if (Object.keys(state).length === 0) {
        tokens = capacity;
        lastRefillTime = now;
    } else {
        tokens = parseFloat(state.tokens);
        lastRefillTime = parseInt(state.lastRefillTime);
    }

    // Math calculation (Same as Pure JS)
    const timePassed = (now - lastRefillTime) / 1000;
    const tokensToAdd = timePassed * refillRate;
    
    tokens = Math.min(capacity, tokens + tokensToAdd);
    lastRefillTime = now;

    let allowed = false;

    // Check if token available
    if (tokens >= 1) {
        tokens -= 1;
        allowed = true;
    }

    // Nayi state Redis mein save kar do
    // HMSET (Hash Set) use kar rahe hain variables store karne ke liye
    await redis.hset(key, {
        tokens: tokens,
        lastRefillTime: lastRefillTime
    });
    
    // Memory leak bachane ke liye expiry set karna zaroori hai (TTL - Time to live)
    await redis.expire(key, 60); // 60 seconds baad data delete agar user inactive hai

    return {
        allowed,
        remainingTokens: Math.floor(tokens)
    };
}

// TEST KARTE HAIN
async function testRedisBucket() {
    console.log("\n--- REDIS TOKEN BUCKET TEST ---");
    const userId = "user_123";
    
    for (let i = 1; i <= 5; i++) {
        const result = await redisTokenBucket(userId, 3, 1);
        console.log(`Req ${i} - Allowed: ${result.allowed}, Remaining Tokens: ${result.remainingTokens}`);
    }
    
    // Connection close kardo warna terminal hang rahega
    redis.quit();
}

testRedisBucket();