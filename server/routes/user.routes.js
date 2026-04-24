import { Router } from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getProfile,
  updateProfile,
  completeOnboarding,
  deleteAccount,
} from '../controllers/user.controller.js';

const router = Router();

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/onboarding', completeOnboarding);
router.delete('/account', deleteAccount);

export default router;
