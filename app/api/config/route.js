import { NextResponse } from 'next/server';

// Global config state for demo purposes (like Express app.locals)
// In a real app, this might be saved in Redis or a DB per user
let currentConfig = {
  algorithm: 'token_bucket',
  rps: 5,
  windowSize: 10,
};

export async function GET() {
  return NextResponse.json(currentConfig);
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body.algorithm) currentConfig.algorithm = body.algorithm;
    if (body.rps !== undefined) currentConfig.rps = body.rps;
    if (body.windowSize !== undefined) currentConfig.windowSize = body.windowSize;
    
    return NextResponse.json({ message: 'Configuration updated', config: currentConfig });
  } catch (err) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

// Export a way to read config internally
export function getInternalConfig() {
  return currentConfig;
}
