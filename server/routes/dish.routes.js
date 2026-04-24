import { Router } from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { getDish, toggleSaveDish, getSavedDishes } from '../controllers/dish.controller.js';

const router = Router();

router.get('/saved', protect, getSavedDishes);
router.get('/:dishId', protect, getDish);
router.put('/:dishId/save', protect, toggleSaveDish);

export default router;
