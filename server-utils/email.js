/**
 * Email Service — Resend Integration
 *
 * Sends verification emails using the Resend API.
 * Falls back to console logging if RESEND_API_KEY is not set.
 */

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function sendVerificationEmail(to, token) {
  const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify?token=${token}`;

  if (!resend) {
    console.log('──────────────────────────────────────────────');
    console.log('📧 VERIFICATION EMAIL (Resend not configured)');
    console.log(`   To: ${to}`);
    console.log(`   Link: ${verificationLink}`);
    console.log('──────────────────────────────────────────────');
    return { success: true, data: { id: 'console-fallback' } };
  }

  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: to,
      subject: 'Verify your TrafficShield account',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #333;">Welcome to TrafficShield!</h2>
          <p>Please verify your email address to get full access to the dashboard and API tools.</p>
          <div style="margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #000000; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
          </div>
          <p style="color: #666; font-size: 12px;">Or copy and paste this link in your browser: <br/>${verificationLink}</p>
        </div>
      `,
    });
    return { success: true, data };
  } catch (error) {
    console.error('Resend Error:', error);
    return { success: false, error };
  }
}

module.exports = { sendVerificationEmail };
