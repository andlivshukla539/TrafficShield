# Premium Rate Limiter (V3)

A production-grade, distributed rate limiting toolkit and API Gateway for Node.js, built on Redis.

![Rate Limiter Playground](https://github.com/andlivshukla539/premium-rate-limiter/assets/placeholder.png)

## Features

1. **5 Advanced Algorithms:** Token Bucket, Leaky Bucket, Fixed Window, Sliding Window, and Sliding Window Counter.
2. **NPM Package:** Use as Express middleware in any Node.js project.
3. **API Gateway:** Reverse proxy with per-route rate limits.
4. **WAF Security:** IP filtering, Geo-blocking, Bot Detection, and DDoS auto-banning.
5. **SaaS Dashboard:** Multi-tenant dashboard with API Keys, Policies, and Real-time Analytics.
6. **Kubernetes Ready:** Helm charts included for easy scaling.
7. **Developer Playground:** Interactive educational algorithm visualizer.

## Quick Start (NPM Package)

```bash
npm install @andliv/rate-limiter ioredis
```

```javascript
const express = require('express');
const { rateLimiter, createRedisConnection } = require('@andliv/rate-limiter');

const app = express();

const redis = createRedisConnection({ host: '127.0.0.1', port: 6379 });
redis.connect().then(() => console.log('Redis connected'));

app.use(rateLimiter({
  redisClient: redis.getClient(),
  algorithm: 'token_bucket',
  rps: 10,
  windowSize: 10,
}));

app.get('/api/data', (req, res) => res.send('Success'));
app.listen(3000);
```

## Quick Start (API Gateway)

1. Create a `gateway.config.yml` file:
```yaml
server:
  port: 8080
redis:
  host: 127.0.0.1
  port: 6379
routes:
  - path: /api/users
    target: http://localhost:3001
    rateLimit:
      algorithm: sliding_window_counter
      rps: 5
      windowSize: 10
```

2. Run the gateway:
```bash
npm run start:gateway
```

## Quick Start (SaaS Server & Dashboard)

Run the full SaaS platform with Docker Compose:

```bash
docker-compose up --build
```

Access the dashboard at [http://localhost:5000](http://localhost:5000)

## Security Middleware (WAF)

Protect your APIs with built-in security modules:

```javascript
const {
  createIpFilter,
  createGeoBlocker,
  createBotDetector,
  createDdosProtection
} = require('@andliv/rate-limiter');

// IP Blacklist/Whitelist
app.use(createIpFilter({ redisClient, mode: 'blacklist' }).middleware());

// Geo-blocking (requires geoip-lite)
app.use(createGeoBlocker({ blockedCountries: ['KP', 'RU'] }));

// Bot Detection
app.use(createBotDetector({ blockMissingUA: true, allowLegitBots: true }));

// DDoS Auto-ban
app.use(createDdosProtection({ redisClient, maxViolations: 10 }).middleware());
```

## Deploying to Kubernetes

```bash
cd charts
helm install premium-rate-limiter ./premium-rate-limiter -f my-values.yaml
```

## License

ISC License. Built by [Andliv Shukla](https://github.com/andlivshukla539).