import { NextResponse } from 'next/server';
const algorithms = require('@/lib/algorithms');

export async function GET() {
  return NextResponse.json(algorithms.list());
}
