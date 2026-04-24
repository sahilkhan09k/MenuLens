import { Router } from 'express';
import {
  signup,
  verifyOtp,
  login,
  logout,
  refreshToken,
  resendOtp,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/signup', signup);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/logout', protect, logout);
router.post('/refresh-token', refreshToken);
router.post('/resend-otp', resendOtp);

export default router;
