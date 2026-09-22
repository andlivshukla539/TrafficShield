// algorithms/pureJsTokenBucket.js

class PureTokenBucket {
    constructor(capacity, refillRate) {
        this.capacity = capacity;       // Maximum tokens balti mein kitne aa sakte hain
        this.refillRate = refillRate;   // Ek second mein kitne tokens wapas aayenge
        this.tokens = capacity;         // Shuru mein balti full hai
        this.lastRefillTime = Date.now();
    }

    allowRequest() {
        const now = Date.now();
        // Time difference in seconds
        const timePassed = (now - this.lastRefillTime) / 1000; 

        // 1. Naye tokens calculate karo based on time passed
        const tokensToAdd = timePassed * this.refillRate;

        // 2. Balti mein tokens daalo, par capacity se zyada nahi
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefillTime = now; // Time update kar do

        // 3. Check karo kya request ke liye token bacha hai?
        if (this.tokens >= 1) {
            this.tokens -= 1; // Ek token consume kar liya
            return true;      // Request ALLOWED
        } else {
            return false;     // Request BLOCKED (Tokens = 0)
        }
    }
}

// TEST KARTE HAIN
const bucket = new PureTokenBucket(3, 1); // Capacity: 3, Refill: 1 token/sec

console.log("--- PURE JS TOKEN BUCKET TEST ---");
console.log("Req 1 (Allowed):", bucket.allowRequest()); // True
console.log("Req 2 (Allowed):", bucket.allowRequest()); // True
console.log("Req 3 (Allowed):", bucket.allowRequest()); // True
console.log("Req 4 (Blocked):", bucket.allowRequest()); // False (Bucket khali)

// 2 seconds wait karke try karte hain (2 naye tokens aa jane chahiye)
setTimeout(() => {
    console.log("Req 5 (After 2s - Allowed):", bucket.allowRequest()); // True
}, 2000);