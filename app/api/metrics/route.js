import { NextResponse } from 'next/server';
const { getMetrics } = require('@/server-utils/memoryStore');

export async function GET() {
  return NextResponse.json(getMetrics());
}
