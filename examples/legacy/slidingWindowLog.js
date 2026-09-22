// algorithms/slidingWindowLog.js
const Redis = require("ioredis");
const redis = new Redis({ host: "127.0.0.1", port: 6379 });

async function slidingWindowLog(userId, limit, windowSizeInSeconds) {
    const key = `rate_limit:sliding_window:${userId}`;
    const now = Date.now();
    // Puraani limit kahan se shuru hoti hai (in milliseconds)
    const windowStart = now - (windowSizeInSeconds * 1000); 

    // Redis Pipeline: Multiple commands ko ek batch mein server par bhejna taaki network delay na ho
    const pipeline = redis.pipeline();

    // 1. ZREMRANGEBYSCORE: Un saare records ko delete karo jinka timestamp windowStart se pehle ka hai
    pipeline.zremrangebyscore(key, 0, windowStart);

    // 2. ZADD: Current request ko Redis mein add karo
    // Score bhi 'now' hai, aur Value bhi 'now + random string' hai taaki same millisecond pe aayi requests overwrite na hon
    const uniqueValue = `${now}-${Math.random()}`;
    pipeline.zadd(key, now, uniqueValue);

    // 3. ZCARD: Ab check karo ki current window mein kitni requests bachi hain
    pipeline.zcard(key);

    // 4. EXPIRE: Memory leak na ho, isliye key par expiry laga do (window size + 1 sec)
    pipeline.expire(key, windowSizeInSeconds + 1);

    // Pipeline ko execute karo
    const results = await pipeline.exec();

    // 'results' ek array hoga jisme saari commands ka output hoga
    // results[2] matlab 3rd command (ZCARD) ka result. [1] ke andar actual value hoti hai.
    const requestCount = results[2][1];

    let allowed = true;
    if (requestCount > limit) {
        allowed = false;
    }

    return {
        allowed: allowed,
        count: requestCount
    };
}

// TEST KARTE HAIN
async function testSlidingWindow() {
    console.log("\n--- REDIS SLIDING WINDOW LOG TEST ---");
    const userId = "user_456";
    const limit = 3; // Max 3 requests
    const windowSize = 5; // In 5 seconds
    
    // Ek saath 5 requests bhej kar dekhte hain
    for (let i = 1; i <= 5; i++) {
        const result = await slidingWindowLog(userId, limit, windowSize);
        console.log(`Req ${i} - Allowed: ${result.allowed}, Current Count in Window: ${result.count}`);
    }

    console.log("\nWaiting for 6 seconds to let the window slide...");
    
    // 6 seconds wait karenge, puraani window clear ho jayegi
    setTimeout(async () => {
        const result = await slidingWindowLog(userId, limit, windowSize);
        console.log(`Req 6 (After 6s) - Allowed: ${result.allowed}, Current Count in Window: ${result.count}`);
        
        redis.quit(); // Connection close
    }, 6000);
}

testSlidingWindow();