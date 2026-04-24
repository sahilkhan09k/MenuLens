import FoodReviewQueue from '../models/FoodReviewQueue.model.js';
import Dish from '../models/Dish.model.js';

/**
 * User submits feedback on a dish's nutrition accuracy.
 * Adds to review queue as 'user_feedback' type.
 */
export async function submitFeedback(req, res) {
  try {
    const { dishId } = req.params;
    const { feedback_type, user_comment } = req.body;

    if (!feedback_type) {
      return res.status(400).json({ message: 'feedback_type is required' });
    }

    const dish = await Dish.findById(dishId).populate('scanId', 'userId');
    if (!dish) return res.status(404).json({ message: 'Dish not found' });

    // Verify dish belongs to this user's scan
    if (dish.scanId?.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const dishName = dish.name;

    // Check if already in queue — update if exists
    const existing = await FoodReviewQueue.findOne({
      dish_name: { $regex: new RegExp(`^${dishName}$`, 'i') },
      entry_type: 'user_feedback',
      status: 'pending',
    });

    if (existing) {
      existing.scan_count += 1;
      existing.priority_score = (existing.scan_count * 3) + 5 + (dish.confidenceScore < 60 ? 10 : 0);
      existing.last_seen_at = new Date();
      await existing.save();
      return res.json({ message: 'Feedback recorded. Thank you!' });
    }

    // Create new queue entry
    const priority = 3 + 5 + (dish.confidenceScore < 60 ? 10 : 0);

    await FoodReviewQueue.create({
      entry_type: 'user_feedback',
      dish_name: dishName,
      raw_name: dishName,
      scan_count: 1,
      ai_nutrition: dish.estimatedNutrition ? {
        calories_min: dish.estimatedNutrition.calories?.min,
        calories_max: dish.estimatedNutrition.calories?.max,
        protein_min: dish.estimatedNutrition.protein?.min,
        protein_max: dish.estimatedNutrition.protein?.max,
        carbs_min: dish.estimatedNutrition.carbs?.min,
        carbs_max: dish.estimatedNutrition.carbs?.max,
        fat_min: dish.estimatedNutrition.fat?.min,
        fat_max: dish.estimatedNutrition.fat?.max,
        cooking_method: dish.cookingMethod,
        confidence: dish.confidenceScore,
      } : null,
      user_feedback: {
        feedback_type,
        user_comment: user_comment || '',
        user_id: req.user.id,
        dish_id: dishId,
        scan_id: dish.scanId?._id,
      },
      priority_score: priority,
    });

    res.json({ message: 'Feedback recorded. Thank you!' });
  } catch (err) {
    console.error('[feedback] Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}
