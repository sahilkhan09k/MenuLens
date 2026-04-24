import { Router } from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { adminOnly } from '../middleware/admin.middleware.js';
import {
  getQueue,
  getQueueStats,
  updateQueueItem,
  promoteToFoodItem,
  getDashboardStats,
} from '../controllers/admin.controller.js';

const router = Router();

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// Dashboard
router.get('/stats', getDashboardStats);

// Review queue
router.get('/queue', getQueue);
router.get('/queue/stats', getQueueStats);
router.put('/queue/:id', updateQueueItem);
router.post('/queue/:id/promote', promoteToFoodItem);

export default router;
