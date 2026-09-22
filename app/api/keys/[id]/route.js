import { NextResponse } from 'next/server';
const { validateToken } = require('@/server-utils/auth/middleware');
const ApiKey = require('@/server-utils/models/ApiKey');

export async function DELETE(request, { params }) {
  const auth = validateToken(request);
  if (auth.error) return NextResponse.json({ error: 'Unauthorized', message: auth.error }, { status: auth.status });

  // Await params in Next.js 15
  const { id } = await params;
  
  const success = await ApiKey.revoke(id, auth.user.id);

  if (!success) {
    return NextResponse.json({ error: 'Not Found', message: 'API key not found or already revoked.' }, { status: 404 });
  }

  return NextResponse.json({ message: 'API key revoked successfully.' });
}
