import rateLimit from 'express-rate-limit';

export const scanUploadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { message: 'Daily scan limit reached (10 scans per day)' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body?.email || req.ip,
  message: { message: 'Too many OTP requests. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
