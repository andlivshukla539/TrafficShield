import { NextResponse } from 'next/server';
const { comparePassword } = require('@/server-utils/auth/passwords');
const { generateToken } = require('@/server-utils/auth/jwt');
const User = require('@/server-utils/models/User');

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Bad Request', message: 'Email and password are required.' }, { status: 400 });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Invalid email or password.' }, { status: 401 });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Invalid email or password.' }, { status: 401 });
    }

    const { passwordHash, ...safeUser } = user;
    const token = generateToken(safeUser);

    return NextResponse.json({ message: 'Login successful', user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
