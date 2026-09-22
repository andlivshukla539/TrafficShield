import { NextResponse } from 'next/server';
const User = require('@/server-utils/models/User');

export async function POST(request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Bad Request', message: 'Token is required.' }, { status: 400 });
    }

    const users = await User.readAll();
    const userToVerify = users.find(u => u.verificationToken === token);

    if (!userToVerify) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Invalid or expired verification token.' }, { status: 400 });
    }

    // Update user: set isVerified to true and remove the token
    const updatedUser = await User.updateUser(userToVerify.id, {
      isVerified: true,
      verificationToken: null
    });

    return NextResponse.json({ message: 'Email verified successfully!', user: updatedUser }, { status: 200 });
  } catch (err) {
    console.error('Verify error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
