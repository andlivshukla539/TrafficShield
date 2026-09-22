import { NextResponse } from 'next/server';
const { getHourlyHistory } = require('@/server-utils/memoryStore');

export async function GET() {
  return NextResponse.json(getHourlyHistory());
}
