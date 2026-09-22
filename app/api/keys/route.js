import { NextResponse } from 'next/server';
const { validateToken } = require('@/server-utils/auth/middleware');
const ApiKey = require('@/server-utils/models/ApiKey');

export async function GET(request) {
  const auth = validateToken(request);
  if (auth.error) return NextResponse.json({ error: 'Unauthorized', message: auth.error }, { status: auth.status });

  const keys = await ApiKey.findByUserId(auth.user.id);
  const masked = keys.map(k => ({
    ...k,
    key: k.isActive ? `rl_${'*'.repeat(56)}${k.key.slice(-8)}` : '[REVOKED]',
    fullKey: undefined,
  }));

  return NextResponse.json({ keys: masked });
}

export async function POST(request) {
  const auth = validateToken(request);
  if (auth.error) return NextResponse.json({ error: 'Unauthorized', message: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const apiKey = await ApiKey.create({
      userId: auth.user.id,
      name: body.name || 'My API Key',
      permissions: body.permissions || ['read', 'write'],
    });

    return NextResponse.json({
      message: 'API key created. Save this key — it will not be shown again.',
      apiKey,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }
}
