import { NextResponse } from 'next/server';
const { validateToken } = require('@/server-utils/auth/middleware');
const User = require('@/server-utils/models/User');

export async function GET(request) {
  const auth = validateToken(request);
  if (auth.error) return NextResponse.json({ error: 'Unauthorized', message: auth.error }, { status: auth.status });

  const user = await User.findById(auth.user.id);
  if (!user) return NextResponse.json({ error: 'Not Found', message: 'User not found.' }, { status: 404 });

  return NextResponse.json({ user });
}
