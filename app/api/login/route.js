import { NextResponse } from 'next/server';
const { checkRateLimit, recordMetric } = require('@/server-utils/memoryStore');

export async function POST(request) {
  try {
    const config = {
      algorithm: 'token_bucket',
      rps: 2,
      windowSize: 10,
    };

    const simulatedIp = request.headers.get('x-simulated-ip') || 'global';
    const result = checkRateLimit(`login:${simulatedIp}`, config);

    recordMetric(result.allowed);

    const headers = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
    };

    if (result.allowed) {
      return NextResponse.json({
        message: 'Login successful',
        status: 'ALLOWED',
        remaining: result.remaining,
        limit: result.limit,
      }, { headers });
    } else {
      headers['Retry-After'] = String(Math.ceil(result.resetMs / 1000));
      return NextResponse.json({
        error: 'Too Many Requests',
        status: 'BLOCKED',
        remaining: result.remaining,
        limit: result.limit,
      }, { status: 429, headers });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Service Unavailable' }, { status: 503 });
  }
}
