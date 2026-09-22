import { NextResponse } from 'next/server';
const { hashPassword } = require('@/server-utils/auth/passwords');
const { generateToken } = require('@/server-utils/auth/jwt');
const User = require('@/server-utils/models/User');
const { sendVerificationEmail } = require('@/server-utils/email');
const crypto = require('crypto');

export async function POST(request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Bad Request', message: 'Email and password are required.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Bad Request', message: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    let user = await User.create({ email, name: name || email.split('@')[0], passwordHash });
    user = await User.updateUser(user.id, { verificationToken });

    await sendVerificationEmail(email, verificationToken);

    const token = generateToken(user);

    return NextResponse.json({ message: 'Account created successfully. Please check your email.', user, token }, { status: 201 });
  } catch (err) {
    if (err.message.includes('already exists')) {
      return NextResponse.json({ error: 'Conflict', message: err.message }, { status: 409 });
    }
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
