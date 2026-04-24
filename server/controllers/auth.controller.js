import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateTokens.js';
import { sendOtpEmail } from '../utils/sendEmail.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  secure: process.env.NODE_ENV === 'production',
};

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

export async function signup(req, res) {
  const { name, email, password } = req.body;

  // Validate inputs
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Name is required.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ message: 'A valid email is required.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  // Check duplicate email
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return res.status(409).json({ message: 'Email already in use.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const plainOtp = generateOtp();
  const hashedOtp = await bcrypt.hash(plainOtp, 10);

  await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    isVerified: false,
    otp: hashedOtp,
    otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
  });

  await sendOtpEmail(email, plainOtp);

  return res.status(201).json({ message: 'Account created. Check your email for OTP.' });
}

export async function verifyOtp(req, res) {
  const { email, otp } = req.body;

  const user = await User.findOne({ email: email?.toLowerCase().trim() });
  if (!user) {
    return res.status(400).json({ message: 'Invalid request.' });
  }

  if (!user.otpExpiry || user.otpExpiry < Date.now()) {
    return res.status(400).json({ message: 'OTP expired.' });
  }

  const valid = await bcrypt.compare(String(otp), user.otp);
  if (!valid) {
    return res.status(400).json({ message: 'Invalid OTP.' });
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  return res.status(200).json({ message: 'Email verified. You can now log in.' });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email?.toLowerCase().trim() });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  if (!user.isVerified) {
    return res.status(403).json({ message: 'Please verify your email first.' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();

  res.cookie('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return res.status(200).json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      onboardingComplete: user.onboardingComplete,
      profile: user.profile,
    },
  });
}

export async function logout(req, res) {
  res.clearCookie('accessToken', COOKIE_OPTIONS);
  res.clearCookie('refreshToken', COOKIE_OPTIONS);

  const user = await User.findById(req.user.id);
  if (user) {
    user.refreshToken = null;
    await user.save();
  }

  return res.status(200).json({ message: 'Logged out successfully.' });
}

export async function refreshToken(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  const user = await User.findById(decoded.id);
  if (!user || user.refreshToken !== token) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  const newAccessToken = generateAccessToken(user._id);
  res.cookie('accessToken', newAccessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });

  return res.status(200).json({ message: 'Token refreshed.' });
}

export async function resendOtp(req, res) {
  const { email } = req.body;

  const user = await User.findOne({ email: email?.toLowerCase().trim() });
  if (!user) {
    return res.status(400).json({ message: 'No account found with that email.' });
  }

  const plainOtp = generateOtp();
  const hashedOtp = await bcrypt.hash(plainOtp, 10);

  user.otp = hashedOtp;
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOtpEmail(email, plainOtp);

  return res.status(200).json({ message: 'OTP resent. Check your email.' });
}
