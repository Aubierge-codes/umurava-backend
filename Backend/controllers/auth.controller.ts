import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import nodemailer from 'nodemailer';
import User from '../models/user.models';
import { generateToken } from '../middleware/auth.middleware';
import tokenBlacklist from '../utils/tokenBlacklist';

const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function cryptoRandomPassword(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function sendEmail(
  toEmail: string,
  subject: string,
  code: string,
  type: 'verify' | 'reset' = 'verify'
): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const label = type === 'reset' ? 'Reset your password' : 'Verify your email';
  const description =
    type === 'reset'
      ? 'You requested a password reset. Use the code below to continue.'
      : 'Thank you for joining Umurava. Use the code below to verify your account.';

  const html = `
  <div style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 30px;">
    <div style="max-width: 500px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
      <div style="background: #1a1a2e; padding: 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Umurava</h1>
        <p style="color: #a0a0b0; margin: 4px 0 0; font-size: 13px;">AI Recruitment Platform</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="color: #1a1a2e; margin: 0 0 12px;">${label}</h2>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">${description}</p>
        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; background: #f0f0ff; border: 2px dashed #5c5ce0; border-radius: 12px; padding: 16px 32px;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #5c5ce0; font-family: monospace;">${code}</span>
          </div>
        </div>
        <p style="color: #888; font-size: 13px; text-align: center;">This code expires in <strong>15 minutes</strong>.</p>
        <p style="color: #aaa; font-size: 12px; text-align: center;">If you did not request this, you can safely ignore this email.</p>
      </div>
      <div style="background: #f9f9f9; padding: 16px; text-align: center; font-size: 11px; color: #aaa;">
        &copy; ${new Date().getFullYear()} Umurava. All rights reserved.
      </div>
    </div>
  </div>`;

  await transporter.sendMail({
    from: `Umurava <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject,
    html,
  });
}

async function verifyGoogleIdToken(idToken: string): Promise<{
  email: string;
  email_verified: boolean;
  name: string;
  sub: string;
}> {
  const { data } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { id_token: idToken },
    timeout: 10000,
  });

  const expectedClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (expectedClientId && data.aud !== expectedClientId) {
    throw new Error('Google token audience does not match this application');
  }

  return {
    email: data.email,
    email_verified: data.email_verified === 'true',
    name: data.name || data.given_name || data.email?.split('@')[0] || 'Google User',
    sub: data.sub,
  };
}

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, password, companyName } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    // ✅ FIX: Delete any stuck unverified account with same email
    await User.deleteOne({ email: email.toLowerCase(), isVerified: false });

    const code = generateCode();
    const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'applicant';

    // ✅ FIX: Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      companyName: companyName || '',
      role,
      verificationCode: code,
      verificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
      isVerified: false,
    });

    try {
      await sendEmail(email, 'Verify your Umurava account', code, 'verify');
    } catch (emailErr) {
      const err = emailErr as Error;
      const isDev = process.env.NODE_ENV !== 'production';

      if (isDev) {
        console.log('\n' + '='.repeat(50));
        console.log('EMAIL NOT CONFIGURED — verification code:');
        console.log(`  Email: ${email} | Code: ${code}`);
        console.log('='.repeat(50) + '\n');
      } else {
        console.error('❌ Email error:', err.message);
        await User.findByIdAndDelete(user._id);
        res.status(500).json({ message: 'Could not send verification email. Please try again.' });
        return;
      }
    }

    res.status(201).json({ success: true, message: 'Signup successful! Please verify your email.' });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ message: error.message });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    const user = await User.findOne({ email });

    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    if (user.isVerified) { res.status(400).json({ message: 'Email already verified' }); return; }
    if (user.verificationCode !== code) { res.status(400).json({ message: 'Invalid code' }); return; }
    if (Date.now() > (user.verificationCodeExpires?.getTime() ?? 0)) {
      res.status(400).json({ message: 'Code expired. Please sign up again.' });
      return;
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider,
      },
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    const user = await User.findOne({ email }).select('+password');
    if (!user) { res.status(400).json({ message: 'Invalid credentials' }); return; }
    if (!user.isVerified) { res.status(403).json({ message: 'Please verify your email before logging in' }); return; }
    if (user.authProvider === 'google' && !user.password) {
      res.status(400).json({ message: 'This account uses Google sign-in. Please continue with Google.' });
      return;
    }
    if (!user.password) {
      res.status(400).json({ message: 'This account does not have a password. Please continue with Google.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) { res.status(400).json({ message: 'Invalid credentials' }); return; }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider,
      },
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ message: error.message });
  }
};

export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const idToken = req.body.idToken || req.body.credential;
    if (!idToken) {
      res.status(400).json({ message: 'Google credential is required' });
      return;
    }

    const googleUser = await verifyGoogleIdToken(idToken);
    if (!googleUser.email_verified) {
      res.status(400).json({ message: 'Google account email is not verified' });
      return;
    }

    const normalizedEmail = googleUser.email.toLowerCase().trim();
    const role = ADMIN_EMAILS.includes(normalizedEmail) ? 'admin' : 'applicant';
    const existingUser = await User.findOne({ email: normalizedEmail }).select('+password');

    let user = existingUser;

    if (user) {
      if (!user.googleId) {
        user.authProvider = 'google';
        user.googleId = googleUser.sub;
      }
      user.name = user.name || googleUser.name;
      user.isVerified = true;
      await user.save();
    } else {
      const tempPassword = await bcrypt.hash(cryptoRandomPassword(), 12);
      user = await User.create({
        name: googleUser.name,
        email: normalizedEmail,
        password: tempPassword,
        authProvider: 'google',
        googleId: googleUser.sub,
        role,
        companyName: '',
        isVerified: true,
        verificationCode: null,
        verificationCodeExpires: null,
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Google sign-in successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider,
      },
    });
  } catch (err) {
    const error = err as Error;
    res.status(400).json({ message: err.message || 'Google authentication failed' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const normalizedEmail: string = email?.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      const code = generateCode();
      user.resetPasswordCode = code;
      user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      try {
        await sendEmail(normalizedEmail, 'Reset your Umurava password', code, 'reset');
      } catch (emailErr) {
        const err = emailErr as Error;
        console.error('❌ Password reset email error:', err.message);
        user.resetPasswordCode = null;
        user.resetPasswordExpires = null;
        await user.save();
        res.status(500).json({ message: 'Could not send reset email. Please try again.' });
        return;
      }
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset code has been sent.',
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to process forgot password request' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, newPassword } = req.body;
    const email = req.body.email?.trim().toLowerCase();
    const user = await User.findOne({ email });

    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    if (user.resetPasswordCode !== code) { res.status(400).json({ message: 'Invalid reset code' }); return; }
    if (Date.now() > (user.resetPasswordExpires?.getTime() ?? 0)) {
      res.status(400).json({ message: 'Reset code expired' });
      return;
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ message: error.message });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization as string;
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET as string);
    await tokenBlacklist.add(token);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};