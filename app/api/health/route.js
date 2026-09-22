import { NextResponse } from 'next/server';

const REDIS_PING_TIMEOUT_MS = 500;

async function checkRedis() {
  if (process.env.REDIS_ENABLED === 'false') return false;

  try {
    const { getRedisClient, getRedisConnection } = require('@/server-utils/redis');
    const connection = getRedisConnection();

    // Skip ping entirely if we already know it's not connected
    if (!connection.isConnected()) return false;

    const client = getRedisClient();
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Redis ping timeout')), REDIS_PING_TIMEOUT_MS)
    );

    const ping = await Promise.race([client.ping(), timeout]);
    return ping === 'PONG';
  } catch {
    return false;
  }
}

export async function GET() {
  const redisStatus = await checkRedis();

  return NextResponse.json({
    status: 'healthy',
    redis: redisStatus,
    memoryStore: true,
    timestamp: new Date().toISOString(),
    algorithm: 'token_bucket',
  });
}
