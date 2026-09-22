// algorithms/fixedWindowCounter.js
const Redis = require("ioredis");
const redis = new Redis({ host: "127.0.0.1", port: 6379 });

async function fixedWindowCounter(userId, limit, windowSizeInSeconds) {
    // Current time ko seconds mein convert karo
    const nowInSeconds = Math.floor(Date.now() / 1000);
    
    // Window ka ID calculate karo. (Current time divided by window size)
    // Example: Agar window 10 sec ki hai, toh 10:00 se 10:09 tak same currentWindow value aayegi
    const currentWindow = Math.floor(nowInSeconds / windowSizeInSeconds);
    
    // Redis key banate time usme window ID add karna bohot zaroori hai
    const key = `rate_limit:fixed_window:${userId}:${currentWindow}`;

    const pipeline = redis.pipeline();

    // 1. INCR command: Redis mein is key ki value +1 kar do. 
    // Agar key pehle se exist nahi karti, toh Redis isko khud 1 set kar dega. (Yeh Atomicity guarantee karta hai)
    pipeline.incr(key);

    // 2. EXPIRE command: Purane counters ko memory se hatane ke liye expiry set karo.
    // Window size se thoda extra time dete hain taaki delay wagera handle ho jaye
    pipeline.expire(key, windowSizeInSeconds + 2);

    const results = await pipeline.exec();

    // results array mein pipeline ke saare outputs hain.
    // results[0] hai pehli command (INCR) ka output, jisme actual value [1] index par hoti hai.
    const currentCount = results[0][1];

    let allowed = true;
    if (currentCount > limit) {
        allowed = false;
    }

    return {
        allowed: allowed,
        count: currentCount
    };
}

// TEST KARTE HAIN
async function testFixedWindow() {
    console.log("\n--- REDIS FIXED WINDOW COUNTER TEST ---");
    const userId = "user_789";
    const limit = 3;          // Max 3 requests allow karenge
    const windowSize = 3;     // Har 3 second ka ek fixed time block hoga
    
    // Loop lagakar ek saath 5 requests test karte hain
    for (let i = 1; i <= 5; i++) {
        const result = await fixedWindowCounter(userId, limit, windowSize);
        console.log(`Req ${i} - Allowed: ${result.allowed}, Count in current window: ${result.count}`);
    }

    console.log("\nWaiting for 4 seconds for the next time window block...");
    
    // 4 seconds ka delay (taaki purani window expire ho jaye aur naya time block shuru ho)
    setTimeout(async () => {
        const result = await fixedWindowCounter(userId, limit, windowSize);
        console.log(`Req 6 (New Window) - Allowed: ${result.allowed}, Count in current window: ${result.count}`);
        
        redis.quit(); // Connection safely close karo
    }, 4000);
}

testFixedWindow();