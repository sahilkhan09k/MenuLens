import { Router } from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { submitFeedback } from '../controllers/feedback.controller.js';

const router = Router();

router.post('/dish/:dishId', protect, submitFeedback);

export default router;
