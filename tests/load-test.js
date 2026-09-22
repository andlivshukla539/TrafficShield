import http from 'k6/http';
import { check, sleep } from 'k6';

// ─── k6 Load Test Configuration ──────────────────────────────────────────────
// Tests the Rate Limiter under heavy load to prove performance and accuracy.

export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Ramp-up to 50 virtual users
    { duration: '30s', target: 50 },  // Sustained load at 50 VUs
    { duration: '10s', target: 0 },   // Ramp-down to 0
  ],
  thresholds: {
    // We expect 99% of requests to complete within 50ms
    http_req_duration: ['p(99)<50'],
    // We expect 0 errors connecting to the API
    http_req_failed: ['rate<0.01'], 
  },
};

const API_BASE = __ENV.API_URL || 'http://localhost:5000';

export default function () {
  const url = `${API_BASE}/api/data`;
  
  // Simulate unique users to test distributed scaling
  const randomUserId = `user_${Math.floor(Math.random() * 1000)}`;

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-simulated-ip': `192.168.1.${Math.floor(Math.random() * 255)}`
    },
  };

  const payload = JSON.stringify({ userId: randomUserId });

  const res = http.post(url, payload, params);

  // We check that the API returns either 200 (Allowed) or 429 (Blocked)
  // Both are valid responses from a working rate limiter.
  check(res, {
    'is status 200 or 429': (r) => r.status === 200 || r.status === 429,
    'has rate limit headers': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
  });

  // Short sleep to simulate real-world request spacing per VU
  sleep(0.1);
}
